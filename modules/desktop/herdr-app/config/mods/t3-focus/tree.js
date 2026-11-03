// An agent with the sub-agents it started, one reading for Focus cards, the agents list, tabs and pane headers:
// one stuck anywhere in it needs the person; then its own unread reply; an agent waiting on working sub-agents
// is still at work.

// A sub-agent's own word: a sub-agent without a pane isn't in agents(), so its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
export const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};

// Live sub-agents of `addr`, all the way down.
export function descendants(all, addr) {
  return all.filter((k) => k.parent === addr && k.state === "live").flatMap((k) => [k, ...descendants(all, k.address)]);
}

// Its own word with what's under it: needing the person first, then its own done, then busy or waiting on
// sub-agents it will hear back from, else its own. No word of its own: no agent, whatever it started.
export function treeStatus(own, kids) {
  if (own == null) return own;
  if (own === "blocked" || kids.includes("blocked")) return "blocked";
  return own !== "done" && kids.includes("working") ? "working" : own;
}
