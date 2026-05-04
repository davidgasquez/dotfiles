import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import type { AssistantMessage } from "@mariozechner/pi-ai";

function getLastAssistantText(branch: SessionEntry[]): string | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type !== "message") {
			continue;
		}
		const message = entry.message;
		if (message.role !== "assistant") {
			continue;
		}
		const assistant = message as AssistantMessage;
		if (assistant.stopReason !== "stop") {
			return undefined;
		}
		const text = assistant.content
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("\n")
			.trim();
		return text || undefined;
	}
	return undefined;
}

function formatQuotedEditorText(text: string): string {
	return text
		.split("\n")
		.map((line) => `> ${line}`)
		.join("\n");
}

function editWithExternalEditor(initialText: string): string {
	const editorCmd = process.env.VISUAL || process.env.EDITOR;
	if (!editorCmd) {
		throw new Error("No editor configured. Set $VISUAL or $EDITOR environment variable.");
	}

	const tmpFile = path.join(os.tmpdir(), `pi-comment-${Date.now()}.md`);
	try {
		fs.writeFileSync(tmpFile, initialText, "utf-8");
		const [editor, ...editorArgs] = editorCmd.split(" ");
		const result = spawnSync(editor, [...editorArgs, tmpFile], {
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		if (result.status !== 0) {
			throw new Error(`Editor exited with status ${result.status ?? "unknown"}`);
		}
		return fs.readFileSync(tmpFile, "utf-8").replace(/\n$/, "");
	} finally {
		try {
			fs.unlinkSync(tmpFile);
		} catch {
			// Ignore cleanup errors
		}
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("comment", {
		description: "Open the last assistant message in $EDITOR and load the result into the editor",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("comment requires interactive mode", "error");
				return;
			}

			const lastAssistantText = getLastAssistantText(ctx.sessionManager.getBranch());
			if (!lastAssistantText) {
				ctx.ui.notify("No completed assistant message found on the current branch", "error");
				return;
			}

			try {
				const editedText = editWithExternalEditor(formatQuotedEditorText(lastAssistantText));
				ctx.ui.setEditorText(editedText);
				ctx.ui.notify("Loaded edited quoted assistant text into the editor", "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});
}
