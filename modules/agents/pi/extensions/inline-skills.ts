import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";

const SKILL_COMMAND_PREFIX = "skill:";
const SKILL_COMPLETION = /(?:^|[\t ])\$([a-z0-9-]*)$/;
const SKILL_REFERENCE = /(?:^|\s)\$([a-z0-9][a-z0-9-]{0,63})(?![a-z0-9-])/g;

type Skill = {
  name: string;
  description?: string;
};

function getSkills(pi: ExtensionAPI): Skill[] {
  return pi
    .getCommands()
    .filter((command) => command.source === "skill")
    .map((command) => ({
      name: command.name.slice(SKILL_COMMAND_PREFIX.length),
      description: command.description,
    }));
}

function completionItems(skills: Skill[], query: string): AutocompleteItem[] {
  return skills
    .filter((skill) => skill.name.startsWith(query))
    .map((skill) => ({
      value: `$${skill.name}`,
      label: `$${skill.name}`,
      description: skill.description,
    }));
}

function referencedSkill(text: string, skills: Skill[]): string | undefined {
  const knownSkills = new Set(skills.map((skill) => skill.name));
  const references = new Set(
    [...text.matchAll(SKILL_REFERENCE)]
      .map((match) => match[1])
      .filter((name): name is string => Boolean(name && knownSkills.has(name))),
  );
  return references.size === 1 ? references.values().next().value : undefined;
}

export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.addAutocompleteProvider((current) => ({
      triggerCharacters: ["$"],

      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const beforeCursor = (lines[cursorLine] ?? "").slice(0, cursorCol);
        const query = beforeCursor.match(SKILL_COMPLETION)?.[1];
        if (
          (lines[0] ?? "").trimStart().startsWith("/") ||
          query === undefined
        ) {
          return current.getSuggestions(lines, cursorLine, cursorCol, options);
        }

        const items = completionItems(getSkills(pi), query);
        return items.length > 0
          ? { prefix: `$${query}`, items }
          : current.getSuggestions(lines, cursorLine, cursorCol, options);
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        return current.applyCompletion(
          lines,
          cursorLine,
          cursorCol,
          item,
          prefix,
        );
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        return (
          current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
            true
        );
      },
    }));
  });

  pi.on("input", (event) => {
    if (
      event.source === "extension" ||
      !event.text.includes("$") ||
      event.text.trimStart().startsWith("/")
    ) {
      return { action: "continue" };
    }

    const skill = referencedSkill(event.text, getSkills(pi));
    return skill
      ? { action: "transform", text: `/skill:${skill} ${event.text}` }
      : { action: "continue" };
  });
}
