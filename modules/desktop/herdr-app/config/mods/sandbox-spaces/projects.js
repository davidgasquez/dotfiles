const folder = (path) => path.replace(/\/+$/, "") || "/";
export const projectKey = (p) => JSON.stringify([p.machine ?? null, folder(p.folder)]);

export function configuredProjects(value = []) {
  if (!Array.isArray(value)) throw new Error("Spaces projects must be an array");
  const seen = new Set();
  return value.map((p) => {
    if (!p || typeof p.folder !== "string" || !p.folder.startsWith("/"))
      throw new Error("Each Spaces project needs an absolute folder");
    if (p.machine != null && (typeof p.machine !== "string" || !p.machine.trim()))
      throw new Error("A project's machine must be an hc machine name");
    if (p.name != null && typeof p.name !== "string")
      throw new Error("A project's name must be text");
    return { name: p.name?.trim() || folder(p.folder).split("/").pop() || "/",
      folder: folder(p.folder), machine: p.machine?.trim() ?? null };
  }).filter((p) => {
    const key = projectKey(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function projectSpace(project, sp, ps) {
  const mine = sp.filter((s) => (s.machine ?? null) === project.machine);
  return mine.find((s) => s.folder && folder(s.folder) === project.folder)
    ?? mine.find((s) => ps.some((p) => p.cwd && folder(p.cwd) === project.folder && s.tabs.some((t) => t.id === p.tab)));
}

export function projectTerminal(project, space) {
  return space
    ? ["tab.new", { space: space.id, folder: project.folder }]
    : ["space.new", { name: project.name, folder: project.folder, ...(project.machine ? { machine: project.machine } : {}) }];
}
