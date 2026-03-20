import { createEditTool, type EditToolDetails, type ExtensionAPI, withFileMutationQueue } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn } from "child_process";
import { constants } from "fs";
import {
	access as fsAccess,
	mkdtemp as fsMkdtemp,
	readFile as fsReadFile,
	rm as fsRm,
	writeFile as fsWriteFile,
} from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";

const editSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	oldText: Type.Optional(
		Type.String({
			description: "Exact text to find and replace. Use with newText for one precise replacement.",
		}),
	),
	newText: Type.Optional(
		Type.String({
			description: "Replacement text for oldText.",
		}),
	),
	old_string: Type.Optional(
		Type.String({
			description: "Alias for oldText.",
		}),
	),
	new_string: Type.Optional(
		Type.String({
			description: "Alias for newText.",
		}),
	),
	edits: Type.Optional(
		Type.Array(
			Type.Object({
				oldText: Type.String({ description: "Exact text to find and replace for this edit." }),
				newText: Type.String({ description: "Replacement text for this edit." }),
			}),
			{
				description: "Multiple exact replacements in one file. Prefer this for multiple precise edits in the same file.",
			},
		),
	),
});

type EditInput = {
	path: string;
	oldText?: string;
	newText?: string;
	old_string?: string;
	new_string?: string;
	edits?: ReplaceEdit[];
};

interface ReplaceEdit {
	oldText: string;
	newText: string;
}

interface ReplaceModeInput {
	path: string;
	oldText: string;
	newText: string;
}

interface MultiReplaceModeInput {
	path: string;
	edits: ReplaceEdit[];
}

interface RenderedDiff {
	diff: string;
	firstChangedLine: number | undefined;
}

function stripLeadingAt(path: string): string {
	return path.startsWith("@") ? path.slice(1) : path;
}

function resolveToCwd(path: string, cwd: string): string {
	return resolve(cwd, stripLeadingAt(path));
}

function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1) return "\n";
	if (crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF") ? { bom: "\uFEFF", text: content.slice(1) } : { bom: "", text: content };
}

function normalizeForFuzzyMatch(text: string): string {
	return text
		.normalize("NFKC")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

interface FuzzyMatchResult {
	found: boolean;
	index: number;
	matchLength: number;
	usedFuzzyMatch: boolean;
	contentForReplacement: string;
}

function fuzzyFindText(content: string, oldText: string): FuzzyMatchResult {
	const exactIndex = content.indexOf(oldText);
	if (exactIndex !== -1) {
		return {
			found: true,
			index: exactIndex,
			matchLength: oldText.length,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);
	if (fuzzyIndex === -1) {
		return {
			found: false,
			index: -1,
			matchLength: 0,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	return {
		found: true,
		index: fuzzyIndex,
		matchLength: fuzzyOldText.length,
		usedFuzzyMatch: true,
		contentForReplacement: fuzzyContent,
	};
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) throw new Error("Operation aborted");
}

function getMultiReplaceModeInput(input: EditInput): MultiReplaceModeInput | null {
	if (input.edits === undefined) return null;
	if (
		input.oldText !== undefined ||
		input.newText !== undefined ||
		input.old_string !== undefined ||
		input.new_string !== undefined
	) {
		throw new Error("Edit tool input is invalid. Use either edits or single replacement mode, not both.");
	}
	if (input.edits.length === 0) {
		throw new Error("Edit tool input is invalid. edits must contain at least one replacement.");
	}
	return { path: input.path, edits: input.edits };
}

function getReplaceModeInput(input: EditInput): ReplaceModeInput | null {
	const oldText = input.oldText ?? input.old_string;
	const newText = input.newText ?? input.new_string;
	if (oldText === undefined && newText === undefined) return null;
	if (input.edits !== undefined) {
		throw new Error("Edit tool input is invalid. Use either single replacement mode or edits mode, not both.");
	}
	if (oldText === undefined || newText === undefined) {
		throw new Error("Edit tool input is invalid. Replacement mode requires both oldText and newText.");
	}
	return { path: input.path, oldText, newText };
}

async function runGitDiff(oldContent: string, newContent: string): Promise<string> {
	const dir = await fsMkdtemp(join(tmpdir(), "pi-edit-diff-"));
	const beforePath = join(dir, "before.txt");
	const afterPath = join(dir, "after.txt");
	await fsWriteFile(beforePath, oldContent, "utf-8");
	await fsWriteFile(afterPath, newContent, "utf-8");

	try {
		const output = await new Promise<string>((resolvePromise, rejectPromise) => {
			const child = spawn("git", ["diff", "--no-index", "--unified=4", "--", beforePath, afterPath], {
				stdio: ["ignore", "pipe", "pipe"],
			});
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (chunk: Buffer | string) => {
				stdout += chunk.toString();
			});
			child.stderr.on("data", (chunk: Buffer | string) => {
				stderr += chunk.toString();
			});
			child.on("error", rejectPromise);
			child.on("close", (code) => {
				if (code === 0 || code === 1) {
					resolvePromise(stdout);
				} else {
					rejectPromise(new Error(stderr.trim() || `git diff failed with code ${code}`));
				}
			});
		});
		return output;
	} finally {
		await fsRm(dir, { recursive: true, force: true });
	}
}

async function generateDiffString(oldContent: string, newContent: string): Promise<RenderedDiff> {
	const unified = await runGitDiff(oldContent, newContent);
	const lines = unified.split("\n");
	const output: string[] = [];
	let oldLineNum = 1;
	let newLineNum = 1;
	let firstChangedLine: number | undefined;
	let maxLineNum = Math.max(oldContent.split("\n").length, newContent.split("\n").length);

	for (const line of lines) {
		const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (match) {
			oldLineNum = Number.parseInt(match[1], 10);
			newLineNum = Number.parseInt(match[2], 10);
			maxLineNum = Math.max(maxLineNum, oldLineNum, newLineNum);
		}
	}
	const lineNumWidth = String(maxLineNum).length;

	for (const line of lines) {
		const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
		if (match) {
			oldLineNum = Number.parseInt(match[1], 10);
			newLineNum = Number.parseInt(match[2], 10);
			continue;
		}
		if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("--- ") || line.startsWith("+++") || line === "") {
			continue;
		}
		if (line.startsWith("\\")) {
			continue;
		}
		if (line.startsWith(" ")) {
			output.push(` ${String(oldLineNum).padStart(lineNumWidth, " ")} ${line.slice(1)}`);
			oldLineNum++;
			newLineNum++;
			continue;
		}
		if (line.startsWith("-")) {
			if (firstChangedLine === undefined) firstChangedLine = newLineNum;
			output.push(`-${String(oldLineNum).padStart(lineNumWidth, " ")} ${line.slice(1)}`);
			oldLineNum++;
			continue;
		}
		if (line.startsWith("+")) {
			if (firstChangedLine === undefined) firstChangedLine = newLineNum;
			output.push(`+${String(newLineNum).padStart(lineNumWidth, " ")} ${line.slice(1)}`);
			newLineNum++;
		}
	}

	return { diff: output.join("\n"), firstChangedLine };
}

async function readNormalizedFile(path: string, signal: AbortSignal | undefined): Promise<{
	normalizedContent: string;
	bom: string;
	originalEnding: "\r\n" | "\n";
}> {
	throwIfAborted(signal);
	try {
		await fsAccess(path, constants.R_OK | constants.W_OK);
	} catch {
		throw new Error(`File not found: ${path}`);
	}
	const rawContent = await fsReadFile(path, "utf-8");
	throwIfAborted(signal);
	const { bom, text } = stripBom(rawContent);
	return {
		normalizedContent: normalizeToLF(text),
		bom,
		originalEnding: detectLineEnding(text),
	};
}

async function executeMultiReplaceMode(
	input: MultiReplaceModeInput,
	cwd: string,
	signal: AbortSignal | undefined,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: EditToolDetails }> {
	const absolutePath = resolveToCwd(input.path, cwd);

	return withFileMutationQueue(absolutePath, async () => {
		const { normalizedContent, bom, originalEnding } = await readNormalizedFile(absolutePath, signal);

		type MatchedEdit = ReplaceEdit & { index: number; matchLength: number };
		const normalizedEdits = input.edits.map((edit) => ({
			oldText: normalizeToLF(edit.oldText),
			newText: normalizeToLF(edit.newText),
		}));
		let baseContent = normalizedContent;
		if (normalizedEdits.some((edit) => fuzzyFindText(normalizedContent, edit.oldText).usedFuzzyMatch)) {
			baseContent = normalizeForFuzzyMatch(normalizedContent);
		}

		const matchedEdits: MatchedEdit[] = [];
		for (const edit of normalizedEdits) {
			if (edit.oldText.length === 0) {
				throw new Error("Edit tool input is invalid. edits[].oldText must not be empty.");
			}

			const matchResult = fuzzyFindText(baseContent, edit.oldText);
			if (!matchResult.found) {
				throw new Error(
					`Could not find the exact text in ${input.path} for one of the edits. Each oldText must match exactly including whitespace and newlines.`,
				);
			}

			const fuzzyContent = normalizeForFuzzyMatch(baseContent);
			const fuzzyOldText = normalizeForFuzzyMatch(edit.oldText);
			const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
			if (occurrences > 1) {
				throw new Error(
					`Found multiple occurrences of one edits[].oldText block in ${input.path}. Each oldText must be unique in the original file.`,
				);
			}

			matchedEdits.push({
				oldText: edit.oldText,
				newText: edit.newText,
				index: matchResult.index,
				matchLength: matchResult.matchLength,
			});
		}

		matchedEdits.sort((a, b) => a.index - b.index);
		for (let i = 1; i < matchedEdits.length; i++) {
			const previous = matchedEdits[i - 1];
			const current = matchedEdits[i];
			if (previous.index + previous.matchLength > current.index) {
				throw new Error("Edit tool input is invalid. edits must not overlap in the original file.");
			}
		}

		let newContent = baseContent;
		for (let i = matchedEdits.length - 1; i >= 0; i--) {
			const edit = matchedEdits[i];
			newContent =
				newContent.slice(0, edit.index) + edit.newText + newContent.slice(edit.index + edit.matchLength);
		}

		if (newContent === baseContent) {
			throw new Error(`No changes made to ${input.path}. The replacements produced identical content.`);
		}

		await fsWriteFile(absolutePath, bom + restoreLineEndings(newContent, originalEnding), "utf-8");
		throwIfAborted(signal);
		const diffResult = await generateDiffString(baseContent, newContent);
		return {
			content: [{ type: "text", text: `Successfully replaced ${input.edits.length} block(s) in ${input.path}.` }],
			details: diffResult,
		};
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "edit",
		label: "edit",
		description:
			"Edit a single file. Use oldText and newText for one precise replacement. Use edits for multiple precise replacements in the same file. Do not provide both modes at once.",
		parameters: editSchema,
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const input = params as EditInput;

			const multiReplaceModeInput = getMultiReplaceModeInput(input);
			if (multiReplaceModeInput) {
				return executeMultiReplaceMode(multiReplaceModeInput, ctx.cwd, signal);
			}

			const replaceModeInput = getReplaceModeInput(input);
			if (replaceModeInput) {
				const builtInEdit = createEditTool(ctx.cwd);
				return builtInEdit.execute(toolCallId, replaceModeInput, signal, onUpdate);
			}

			throw new Error("Edit tool input is invalid. Provide either oldText and newText, or edits.");
		},
	});
}
