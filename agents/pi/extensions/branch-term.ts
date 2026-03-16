import { spawn } from "node:child_process"
import { writeFileSync } from "node:fs"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { SessionManager } from "@mariozechner/pi-coding-agent"

const TERMINAL_FLAG = "branch-terminal"
const SNAPSHOT_META_TYPE = "branch-term"
const WINDOW_TITLE = "branch"

type NotifyLevel = "info" | "warning" | "error" | "success"
type LaunchMode = "terminal" | "tmux" | "alacritty"
type SnapshotEntry = ReturnType<SessionManager["getBranch"]>[number]
type SnapshotSource = Pick<
	SessionManager,
	"getBranch" | "getLeafId" | "getSessionDir" | "getSessionFile" | "getSessionId"
>

type BranchContext = {
	hasUI: boolean
	cwd: string
	ui: {
		notify: (message: string, level: NotifyLevel) => void
	}
}

type SnapshotSelection = {
	leafId: string | null
	entries: SnapshotEntry[]
	excludedInflightTurn: boolean
}

function normalizeTerminalFlag(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

function shellQuote(value: string): string {
	return "'" + value.replaceAll("'", "'\"'\"'") + "'"
}

function renderTerminalCommand(template: string, values: Record<string, string>): string {
	let command = template

	for (const [key, value] of Object.entries(values)) {
		command = command.split(`{${key}}`).join(shellQuote(value))
	}

	if (template.includes("{session}")) return command
	return `${command} ${shellQuote(values.session)}`
}

function spawnDetached(command: string, args: string[], onError?: (error: Error) => void): void {
	const child = spawn(command, args, { detached: true, stdio: "ignore" })
	child.unref()
	if (onError) child.on("error", onError)
}

function notify(ctx: BranchContext, message: string, level: NotifyLevel): void {
	if (!ctx.hasUI) return
	ctx.ui.notify(message, level)
}

function notifyLaunchError(ctx: BranchContext, launcher: string, error: Error, snapshotFile: string): void {
	notify(ctx, `${launcher} failed to open: ${error.message}`, "warning")
	notify(ctx, `Run: pi --session ${snapshotFile}`, "info")
}

function notifyOpened(ctx: BranchContext, selection: SnapshotSelection, mode: LaunchMode): void {
	const suffix =
		mode === "tmux"
			? " in new tmux window"
			: mode === "alacritty"
				? " in new Alacritty window"
				: " in new terminal"

	notify(
		ctx,
		selection.excludedInflightTurn
			? `Opened snapshot fork from last committed context${suffix}`
			: `Opened snapshot fork${suffix}`,
		"info",
	)
}

function requireMappedId(idMap: Map<string, string>, sourceId: string, entryType: string): string {
	const mappedId = idMap.get(sourceId)
	if (!mappedId) {
		throw new Error(`Failed to replay ${entryType}: missing mapped entry ${sourceId}`)
	}
	return mappedId
}

function copyBranchEntries(target: SessionManager, entries: SnapshotEntry[]): void {
	const idMap = new Map<string, string>()

	for (const entry of entries) {
		switch (entry.type) {
			case "message": {
				const newId = target.appendMessage(entry.message)
				idMap.set(entry.id, newId)
				break
			}
			case "thinking_level_change": {
				const newId = target.appendThinkingLevelChange(entry.thinkingLevel)
				idMap.set(entry.id, newId)
				break
			}
			case "model_change": {
				const newId = target.appendModelChange(entry.provider, entry.modelId)
				idMap.set(entry.id, newId)
				break
			}
			case "compaction": {
				const firstKeptEntryId = requireMappedId(idMap, entry.firstKeptEntryId, entry.type)
				const newId = target.appendCompaction(entry.summary, firstKeptEntryId, entry.tokensBefore, entry.details, entry.fromHook)
				idMap.set(entry.id, newId)
				break
			}
			case "branch_summary": {
				const branchFromId = entry.fromId === "root" ? null : requireMappedId(idMap, entry.fromId, entry.type)
				const newId = target.branchWithSummary(branchFromId, entry.summary, entry.details, entry.fromHook)
				idMap.set(entry.id, newId)
				break
			}
			case "custom": {
				const newId = target.appendCustomEntry(entry.customType, entry.data)
				idMap.set(entry.id, newId)
				break
			}
			case "custom_message": {
				const newId = target.appendCustomMessageEntry(entry.customType, entry.content, entry.display, entry.details)
				idMap.set(entry.id, newId)
				break
			}
			case "label": {
				const targetId = requireMappedId(idMap, entry.targetId, entry.type)
				const newId = target.appendLabelChange(targetId, entry.label)
				idMap.set(entry.id, newId)
				break
			}
			case "session_info": {
				if (!entry.name) break
				const newId = target.appendSessionInfo(entry.name)
				idMap.set(entry.id, newId)
				break
			}
			default: {
				const exhaustiveCheck: never = entry
				throw new Error(`Unsupported session entry type: ${JSON.stringify(exhaustiveCheck)}`)
			}
		}
	}
}

function persistSession(target: SessionManager): string {
	const sessionFile = target.getSessionFile()
	const header = target.getHeader()
	if (!sessionFile || !header) throw new Error("Failed to materialize snapshot session")

	const content = [header, ...target.getEntries()].map((entry) => JSON.stringify(entry)).join("\n") + "\n"
	writeFileSync(sessionFile, content, "utf8")
	return sessionFile
}

function selectBranchSnapshot(sessionManager: SnapshotSource, excludeInflightTurn: boolean): SnapshotSelection {
	const currentLeafId = sessionManager.getLeafId()
	if (!currentLeafId) {
		return {
			leafId: null,
			entries: [],
			excludedInflightTurn: false,
		}
	}

	if (!excludeInflightTurn) {
		return {
			leafId: currentLeafId,
			entries: sessionManager.getBranch(currentLeafId),
			excludedInflightTurn: false,
		}
	}

	const branch = sessionManager.getBranch(currentLeafId)
	for (let index = branch.length - 1; index >= 0; index -= 1) {
		const entry = branch[index]
		if (entry.type !== "message" || entry.message.role !== "user") continue

		const snapshotLeafId = entry.parentId
		return {
			leafId: snapshotLeafId,
			entries: snapshotLeafId ? sessionManager.getBranch(snapshotLeafId) : [],
			excludedInflightTurn: true,
		}
	}

	return {
		leafId: currentLeafId,
		entries: branch,
		excludedInflightTurn: false,
	}
}

function createSnapshotSession(
	sessionManager: SnapshotSource,
	cwd: string,
	excludeInflightTurn: boolean,
): { sessionFile: string; selection: SnapshotSelection } {
	const sessionDir = sessionManager.getSessionDir() || undefined
	const parentSession = sessionManager.getSessionFile()
	const selection = selectBranchSnapshot(sessionManager, excludeInflightTurn)

	const target = SessionManager.create(cwd, sessionDir)
	target.newSession({ parentSession })
	if (selection.entries.length > 0) copyBranchEntries(target, selection.entries)

	target.appendCustomEntry(SNAPSHOT_META_TYPE, {
		kind: "snapshot-fork",
		sourceSessionFile: parentSession,
		sourceSessionId: sessionManager.getSessionId(),
		sourceLeafId: selection.leafId,
		sourceEntryCount: selection.entries.length,
		excludedInflightTurn: selection.excludedInflightTurn,
		createdAt: new Date().toISOString(),
	})

	return {
		sessionFile: persistSession(target),
		selection,
	}
}

async function openSnapshotTerminal(
	pi: ExtensionAPI,
	ctx: BranchContext,
	snapshotFile: string,
	selection: SnapshotSelection,
	terminalCommand?: string,
): Promise<void> {
	if (terminalCommand) {
		const command = renderTerminalCommand(terminalCommand, {
			session: snapshotFile,
			cwd: ctx.cwd,
			title: WINDOW_TITLE,
		})
		spawnDetached("bash", ["-lc", command], (error) => notify(ctx, `Terminal command failed: ${error.message}`, "error"))
		notifyOpened(ctx, selection, "terminal")
		return
	}

	if (process.env.TMUX) {
		const result = await pi.exec("tmux", ["new-window", "-n", WINDOW_TITLE, "-c", ctx.cwd, "pi", "--session", snapshotFile])
		if (result.code !== 0) {
			throw new Error(result.stderr || result.stdout || "tmux new-window failed")
		}
		notifyOpened(ctx, selection, "tmux")
		return
	}

	spawnDetached("alacritty", ["--working-directory", ctx.cwd, "-e", "pi", "--session", snapshotFile], (error) => {
		notifyLaunchError(ctx, "Alacritty", error, snapshotFile)
	})
	notifyOpened(ctx, selection, "alacritty")
}

export default function (pi: ExtensionAPI) {
	pi.registerFlag(TERMINAL_FLAG, {
		description: "Command to open a new terminal for /branch. Supports {session}, {cwd}, and {title} placeholders.",
		type: "string",
	})

	pi.registerCommand("branch", {
		description: "Instantly open a snapshot fork in a new terminal",
		handler: async (_args, ctx) => {
			const excludeInflightTurn = !ctx.isIdle() || ctx.hasPendingMessages()
			const { sessionFile: snapshotFile, selection } = createSnapshotSession(ctx.sessionManager, ctx.cwd, excludeInflightTurn)
			const terminalCommand = normalizeTerminalFlag(pi.getFlag(`--${TERMINAL_FLAG}`))
			await openSnapshotTerminal(pi, ctx, snapshotFile, selection, terminalCommand)
		},
	})
}
