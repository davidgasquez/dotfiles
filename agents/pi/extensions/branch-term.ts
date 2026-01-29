import { spawn } from "node:child_process"
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { SessionManager } from "@mariozechner/pi-coding-agent"

const TERMINAL_FLAG = "branch-terminal"

function normalizeTerminalFlag(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const trimmed = value.trim()
	return trimmed.length > 0 ? trimmed : undefined
}

function renderTerminalCommand(template: string, sessionFile: string): string {
	if (template.includes("{session}")) {
		return template.split("{session}").join(sessionFile)
	}
	return `${template} ${sessionFile}`
}

function spawnDetached(command: string, args: string[], onError?: (error: Error) => void): void {
	const child = spawn(command, args, { detached: true, stdio: "ignore" })
	child.unref()
	if (onError) child.on("error", onError)
}

export default function (pi: ExtensionAPI) {
	pi.registerFlag(TERMINAL_FLAG, {
		description: "Command to open a new terminal. Use {session} placeholder for the session file path.",
		type: "string",
	})

	pi.registerCommand("branch", {
		description: "Fork current session into a new terminal",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle()

			const sessionFile = ctx.sessionManager.getSessionFile()
			if (!sessionFile) {
				if (ctx.hasUI) ctx.ui.notify("Session is not persisted. Restart without --no-session.", "error")
				return
			}

			const leafId = ctx.sessionManager.getLeafId()
			if (!leafId) {
				if (ctx.hasUI) ctx.ui.notify("No messages yet. Nothing to branch.", "error")
				return
			}

			const forkManager = SessionManager.open(sessionFile)
			const forkFile = forkManager.createBranchedSession(leafId)
			if (!forkFile) {
				throw new Error("Failed to create branched session")
			}

			const terminalFlag = normalizeTerminalFlag(pi.getFlag(`--${TERMINAL_FLAG}`))
			if (terminalFlag) {
				const command = renderTerminalCommand(terminalFlag, forkFile)
				spawnDetached("bash", ["-lc", command], (error) => {
					if (ctx.hasUI) ctx.ui.notify(`Terminal command failed: ${error.message}`, "error")
				})
				if (ctx.hasUI) ctx.ui.notify("Opened fork in new terminal", "info")
				return
			}

			if (process.env.TMUX) {
				const result = await pi.exec("tmux", ["new-window", "-n", "branch", "pi", "--session", forkFile])
				if (result.code !== 0) {
					throw new Error(result.stderr || result.stdout || "tmux new-window failed")
				}
				if (ctx.hasUI) ctx.ui.notify("Opened fork in new tmux window", "info")
				return
			}

			spawnDetached("alacritty", ["-e", "pi", "--session", forkFile], (error) => {
				if (ctx.hasUI) {
					ctx.ui.notify(`Alacritty failed to open: ${error.message}`, "warning")
					ctx.ui.notify(`Run: pi --session ${forkFile}`, "info")
				}
			})
			if (ctx.hasUI) ctx.ui.notify("Opened fork in new Alacritty window", "info")
		},
	})
}
