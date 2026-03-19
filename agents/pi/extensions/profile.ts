import { existsSync, readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, extname, join, resolve } from "node:path"
import type { AssistantMessage } from "@mariozechner/pi-ai"
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent"
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui"

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

interface ParsedProfileConfig {
	model: string
	thinking: ThinkingLevel
	system: string
	skills: string[]
	sessionsDir?: string
}

interface SkillMetadata {
	name: string
	description: string
	filePath: string
}

interface ResolvedProfile {
	name: string
	configPath: string
	provider: string
	modelId: string
	thinking: ThinkingLevel
	systemPrompt: string
	skillNames: string[]
	whitelistedSkills: SkillMetadata[]
	sessionsDir?: string
}

const PROFILE_FLAG = "profile"
const VALID_THINKING_LEVELS = new Set<ThinkingLevel>(["off", "minimal", "low", "medium", "high", "xhigh"])
const ALLOWED_PROFILE_KEYS = new Set(["model", "thinking", "system", "skills", "sessions_dir"])

function normalizeProfileName(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined
	const trimmed = value.trim().toLowerCase()
	if (trimmed.length === 0) return undefined
	return trimmed.replace(/\.(yaml|yml)$/i, "")
}

function getProfilesDir(): string {
	return join(homedir(), ".pi", "agent", "profiles")
}

function getSkillRoots(): string[] {
	return [join(homedir(), ".pi", "agent", "skills"), join(homedir(), ".agents", "skills")]
}

function getAncestorDirs(start: string): string[] {
	const dirs: string[] = []
	let current = resolve(start)
	while (true) {
		dirs.push(current)
		const parent = dirname(current)
		if (parent === current) break
		current = parent
	}
	return dirs
}

function resolveProfileConfigPath(profileName: string, cwd: string): string {
	for (const dir of getAncestorDirs(cwd)) {
		for (const profilesDir of [join(dir, ".pi", "profiles"), join(dir, ".pi", "agent", "profiles")]) {
			for (const extension of ["yaml", "yml"]) {
				const path = join(profilesDir, `${profileName}.${extension}`)
				if (existsSync(path)) return path
			}
		}
	}

	const globalProfilesDir = getProfilesDir()
	for (const extension of ["yaml", "yml"]) {
		const path = join(globalProfilesDir, `${profileName}.${extension}`)
		if (existsSync(path)) return path
	}

	throw new Error(`Profile "${profileName}" not found in project .pi/profiles, project .pi/agent/profiles, or ${globalProfilesDir}`)
}

function stripQuotes(value: string): string {
	const trimmed = value.trim()
	if (trimmed.length >= 2) {
		const first = trimmed[0]
		const last = trimmed[trimmed.length - 1]
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return trimmed.slice(1, -1)
		}
	}
	return trimmed
}

function parseSimpleYaml(content: string, source: string): Record<string, string | string[]> {
	const result: Record<string, string | string[]> = {}
	const lines = content.split(/\r?\n/)
	let pendingKey: string | undefined
	let currentArrayKey: string | undefined
	let blockKey: string | undefined
	let blockIndent: number | undefined
	let blockLines: string[] = []
	let index = 0

	function finishBlock(): void {
		if (!blockKey) return
		result[blockKey] = blockLines.join("\n").trim()
		blockKey = undefined
		blockIndent = undefined
		blockLines = []
	}

	while (index < lines.length) {
		const rawLine = lines[index]!
		const trimmed = rawLine.trim()
		const indent = rawLine.match(/^\s*/)?.[0].length ?? 0

		if (blockKey) {
			if (trimmed.length === 0) {
				blockLines.push("")
				index += 1
				continue
			}

			if (blockIndent === undefined) {
				if (indent === 0) {
					finishBlock()
					continue
				}
				blockIndent = indent
			}

			if (indent >= blockIndent) {
				blockLines.push(rawLine.slice(blockIndent))
				index += 1
				continue
			}

			finishBlock()
			continue
		}

		if (trimmed.length === 0 || trimmed.startsWith("#")) {
			index += 1
			continue
		}

		const arrayItemMatch = rawLine.match(/^\s*-\s*(.*)$/)
		if (arrayItemMatch) {
			const key = currentArrayKey ?? pendingKey
			if (!key) {
				throw new Error(`${source}:${index + 1}: unexpected list item`)
			}
			if (!Array.isArray(result[key])) {
				result[key] = []
			}
			;(result[key] as string[]).push(stripQuotes(arrayItemMatch[1]))
			currentArrayKey = key
			pendingKey = undefined
			index += 1
			continue
		}

		currentArrayKey = undefined
		pendingKey = undefined

		const keyMatch = rawLine.match(/^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/)
		if (!keyMatch) {
			throw new Error(`${source}:${index + 1}: invalid YAML syntax`)
		}

		const key = keyMatch[1]
		const rawValue = keyMatch[2] ?? ""
		if (rawValue === "|" || rawValue === ">") {
			result[key] = ""
			blockKey = key
			blockIndent = undefined
			blockLines = []
			index += 1
			continue
		}
		if (rawValue.length === 0) {
			result[key] = ""
			pendingKey = key
			index += 1
			continue
		}

		result[key] = stripQuotes(rawValue)
		index += 1
	}

	finishBlock()
	return result
}

function parseModel(model: string, configPath: string): { provider: string; modelId: string } {
	const slashIndex = model.indexOf("/")
	if (slashIndex <= 0 || slashIndex === model.length - 1) {
		throw new Error(`${configPath}: "model" must be in provider/model format`)
	}
	return { provider: model.slice(0, slashIndex), modelId: model.slice(slashIndex + 1) }
}

function parseProfileConfig(content: string, configPath: string): ParsedProfileConfig {
	const data = parseSimpleYaml(content, configPath)

	for (const key of Object.keys(data)) {
		if (!ALLOWED_PROFILE_KEYS.has(key)) {
			throw new Error(`${configPath}: unsupported key "${key}"`)
		}
	}

	const model = data.model
	if (typeof model !== "string" || model.length === 0) {
		throw new Error(`${configPath}: missing required "model"`)
	}

	const thinking = data.thinking
	if (typeof thinking !== "string" || !VALID_THINKING_LEVELS.has(thinking as ThinkingLevel)) {
		throw new Error(`${configPath}: "thinking" must be one of ${Array.from(VALID_THINKING_LEVELS).join(", ")}`)
	}

	const system = data.system
	if (typeof system !== "string" || system.trim().length === 0) {
		throw new Error(`${configPath}: missing required "system"`)
	}

	const skillsValue = data.skills
	const skills = Array.isArray(skillsValue)
		? skillsValue.map((skill) => skill.trim()).filter((skill) => skill.length > 0)
		: typeof skillsValue === "string" && skillsValue.length === 0
			? []
			: (() => {
				throw new Error(`${configPath}: "skills" must be a list`)
			})()

	const sessionsDir = data.sessions_dir
	if (sessionsDir !== undefined && typeof sessionsDir !== "string") {
		throw new Error(`${configPath}: "sessions_dir" must be a string`)
	}

	return {
		model,
		thinking: thinking as ThinkingLevel,
		system: system.trim(),
		skills,
		sessionsDir: sessionsDir?.trim(),
	}
}

function resolveFilePath(baseDir: string, value: string): string {
	if (value.startsWith("~")) return resolve(join(homedir(), value.slice(1)))
	if (value.startsWith("/")) return resolve(value)
	return resolve(baseDir, value)
}

function readSkillMetadata(skillFile: string): SkillMetadata {
	const content = readFileSync(skillFile, "utf8")
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/)
	if (!frontmatterMatch) {
		throw new Error(`Skill is missing frontmatter: ${skillFile}`)
	}

	const frontmatter = frontmatterMatch[1]
	const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim()
	const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim()
	if (!name) {
		throw new Error(`Skill frontmatter is missing name: ${skillFile}`)
	}
	if (!description) {
		throw new Error(`Skill frontmatter is missing description: ${skillFile}`)
	}

	return { name: stripQuotes(name), description: stripQuotes(description), filePath: skillFile }
}

function walkSkillFiles(root: string): string[] {
	if (!existsSync(root)) return []

	const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
	const files: string[] = []

	for (const entry of entries) {
		const path = join(root, entry.name)
		if (entry.isFile() && extname(entry.name) === ".md") {
			files.push(path)
			continue
		}
		if (entry.isDirectory()) {
			files.push(...walkNestedSkillFiles(path))
		}
	}

	return files
}

function walkNestedSkillFiles(root: string): string[] {
	const entries = readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
	const files: string[] = []

	for (const entry of entries) {
		const path = join(root, entry.name)
		if (entry.isFile() && entry.name === "SKILL.md") {
			files.push(path)
			continue
		}
		if (entry.isDirectory()) {
			files.push(...walkNestedSkillFiles(path))
		}
	}

	return files
}

function buildSkillIndex(): Map<string, SkillMetadata> {
	const index = new Map<string, SkillMetadata>()

	for (const root of getSkillRoots()) {
		for (const skillFile of walkSkillFiles(root)) {
			const skill = readSkillMetadata(skillFile)
			if (!index.has(skill.name)) {
				index.set(skill.name, skill)
			}
		}
	}

	return index
}

function getDefaultSessionsDir(profileName: string, cwd: string): string {
	const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`
	return join(homedir(), ".pi", "agent", "sessions", `${profileName}${safePath}`)
}

function getSessionsDir(profile: ResolvedProfile, cwd: string): string {
	if (profile.sessionsDir && profile.sessionsDir.length > 0) return profile.sessionsDir
	return getDefaultSessionsDir(profile.name, cwd)
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
}

function buildSkillPrompt(skills: SkillMetadata[]): string {
	if (skills.length === 0) return ""

	const skillLines = skills.flatMap((skill) => [
		"  <skill>",
		`    <name>${escapeXml(skill.name)}</name>`,
		`    <description>${escapeXml(skill.description)}</description>`,
		`    <location>${escapeXml(skill.filePath)}</location>`,
		"  </skill>",
	])

	return [
		"The following skills provide specialized instructions for specific tasks.",
		"Use the read tool to load a skill's file when the task matches its description.",
		"When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.",
		"",
		"<available_skills>",
		...skillLines,
		"</available_skills>",
	].join("\n")
}

function buildProfilePrompt(profile: ResolvedProfile, cwd: string): string {
	const parts = [profile.systemPrompt]
	const skillPrompt = buildSkillPrompt(profile.whitelistedSkills)
	if (skillPrompt.length > 0) parts.push(skillPrompt)
	parts.push(`Current date and time: ${new Date().toString()}`)
	parts.push(`Current working directory: ${cwd}`)
	return parts.join("\n\n")
}

function formatThousands(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`
	if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
	return `${Math.round(value)}`
}

function buildFooterLeft(ctx: ExtensionContext): string {
	let cost = 0
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message" || entry.message.role !== "assistant") continue
		const message = entry.message as AssistantMessage
		cost += message.usage.cost.total
	}

	const usage = ctx.getContextUsage()
	const contextWindow = ctx.model?.contextWindow
	const usageText =
		contextWindow && contextWindow > 0
			? `${((((usage?.tokens ?? 0) as number) / contextWindow) * 100).toFixed(1)}%/${formatThousands(contextWindow)}`
			: "0.0%/0"

	return `$${cost.toFixed(3)} (sub) ${usageText} (auto)`
}

function buildFooterRight(
	ctx: ExtensionContext,
	theme: ExtensionContext["ui"]["theme"],
	thinking: string,
	statuses: readonly string[],
): string {
	const provider = ctx.model?.provider ?? "no-provider"
	const modelId = ctx.model?.id ?? "no-model"
	let text = theme.fg("dim", `(${provider}) ${modelId} • ${thinking}`)
	if (statuses.length > 0) {
		text += theme.fg("dim", " · ") + statuses.join(theme.fg("dim", " · "))
	}
	return text
}

function applyFooter(ctx: ExtensionContext, pi: ExtensionAPI): void {
	if (!ctx.hasUI) return
	ctx.ui.setFooter((tui, theme, footerData) => {
		const unsubscribe = footerData.onBranchChange(() => tui.requestRender())
		return {
			dispose: unsubscribe,
			invalidate() {},
			render(width: number): string[] {
				const left = theme.fg("dim", buildFooterLeft(ctx))
				const statuses = Array.from(footerData.getExtensionStatuses().entries())
					.filter(([, value]) => value.length > 0)
					.map(([, value]) => value)
				const right = buildFooterRight(ctx, theme, pi.getThinkingLevel(), statuses)
				const gap = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)))
				return [truncateToWidth(left + gap + right, width)]
			},
		}
	})
}

function setProfileStatus(ctx: ExtensionContext, text?: string, kind: "active" | "error" = "active"): void {
	if (!ctx.hasUI) return
	if (!text) {
		ctx.ui.setStatus("profile", undefined)
		return
	}

	const themed =
		kind === "error"
			? ctx.ui.theme.fg("error", ctx.ui.theme.bold(text))
			: ctx.ui.theme.fg("warning", ctx.ui.theme.bold(text))
	ctx.ui.setStatus("profile", themed)
}

function notifyOrLog(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error" = "info"): void {
	if (ctx.hasUI) {
		ctx.ui.notify(message, level)
		return
	}
	if (level === "info") return
	const output = level === "error" ? console.error : console.warn
	output(message)
}

function extractSkillCommand(text: string): string | undefined {
	const match = text.trim().match(/^\/skill:([^\s]+)/)
	return match?.[1]
}

function loadProfile(profileName: string, cwd: string): ResolvedProfile {
	const configPath = resolveProfileConfigPath(profileName, cwd)
	const configDir = dirname(configPath)
	const config = parseProfileConfig(readFileSync(configPath, "utf8"), configPath)
	const { provider, modelId } = parseModel(config.model, configPath)
	const skillIndex = buildSkillIndex()
	const whitelistedSkills = config.skills.map((skillName) => {
		const skill = skillIndex.get(skillName)
		if (!skill) {
			throw new Error(`${configPath}: unknown skill "${skillName}"`)
		}
		return skill
	})

	return {
		name: profileName,
		configPath,
		provider,
		modelId,
		thinking: config.thinking,
		systemPrompt: config.system,
		skillNames: config.skills,
		whitelistedSkills,
		sessionsDir: config.sessionsDir ? resolveFilePath(configDir, config.sessionsDir) : undefined,
	}
}

export default function profileExtension(pi: ExtensionAPI) {
	let activeProfileName: string | undefined
	let activeProfileCwd: string | undefined
	let activeProfile: ResolvedProfile | undefined
	let loadError: string | undefined

	function getSelectedProfileName(): string | undefined {
		return normalizeProfileName(pi.getFlag(PROFILE_FLAG))
	}

	function clearState(): void {
		activeProfileName = undefined
		activeProfileCwd = undefined
		activeProfile = undefined
		loadError = undefined
	}

	function ensureProfileLoaded(cwd: string = process.cwd()): ResolvedProfile | undefined {
		const profileName = getSelectedProfileName()
		if (!profileName) {
			clearState()
			return undefined
		}

		if (activeProfile && activeProfileName === profileName && activeProfileCwd === cwd) {
			return activeProfile
		}

		try {
			const profile = loadProfile(profileName, cwd)
			activeProfileName = profileName
			activeProfileCwd = cwd
			activeProfile = profile
			loadError = undefined
			return profile
		} catch (error) {
			activeProfileName = profileName
			activeProfileCwd = cwd
			activeProfile = undefined
			loadError = error instanceof Error ? error.message : String(error)
			return undefined
		}
	}

	pi.registerFlag(PROFILE_FLAG, {
		description: "Load profile from ~/.pi/agent/profiles/<name>.yaml",
		type: "string",
	})

	pi.on("session_directory", async (event) => {
		const profile = ensureProfileLoaded(event.cwd)
		if (!profile) return undefined
		return { sessionDir: getSessionsDir(profile, event.cwd) }
	})

	pi.on("session_start", async (_event, ctx) => {
		const profile = ensureProfileLoaded(ctx.cwd)
		if (!profile) {
			if (loadError) {
				notifyOrLog(ctx, loadError, "error")
				setProfileStatus(ctx, "profile:error", "error")
			} else {
				setProfileStatus(ctx, undefined)
			}
			applyFooter(ctx, pi)
			return
		}

		const model = ctx.modelRegistry.find(profile.provider, profile.modelId)
		if (!model) {
			loadError = `Profile "${profile.name}": model not found: ${profile.provider}/${profile.modelId}`
			notifyOrLog(ctx, loadError, "error")
			setProfileStatus(ctx, "profile:error", "error")
			applyFooter(ctx, pi)
			return
		}

		const setModelOk = await pi.setModel(model)
		if (!setModelOk) {
			loadError = `Profile "${profile.name}": no API key for ${profile.provider}/${profile.modelId}`
			notifyOrLog(ctx, loadError, "error")
			setProfileStatus(ctx, "profile:error", "error")
			applyFooter(ctx, pi)
			return
		}

		pi.setThinkingLevel(profile.thinking)
		setProfileStatus(ctx, profile.name)
		applyFooter(ctx, pi)
	})

	pi.on("input", async (event, ctx) => {
		const profileName = getSelectedProfileName()
		if (!profileName) return { action: "continue" as const }

		const profile = ensureProfileLoaded(ctx.cwd)
		if (!profile) {
			const message = loadError ?? `Failed to load profile "${profileName}"`
			notifyOrLog(ctx, message, "error")
			setProfileStatus(ctx, "profile:error", "error")
			return { action: "handled" as const }
		}

		const requestedSkill = extractSkillCommand(event.text)
		if (!requestedSkill) return { action: "continue" as const }

		if (profile.skillNames.includes(requestedSkill)) {
			return { action: "continue" as const }
		}

		notifyOrLog(ctx, `Profile "${profile.name}" does not allow /skill:${requestedSkill}`, "error")
		return { action: "handled" as const }
	})

	pi.on("before_agent_start", async (_event, ctx) => {
		const profile = ensureProfileLoaded(ctx.cwd)
		if (!profile) return undefined
		return { systemPrompt: buildProfilePrompt(profile, ctx.cwd) }
	})
}
