// Fork a live Pi conversation with Pi's own /fork picker, in the terminal that runs it.
// Herdr presses the key Pi binds to app.session.fork (Nix: modules/agents/pi.nix); Pi then shows its
// message picker there. Esc cancels and keeps the draft; picking a message replaces any unsent draft.
// Picking a message switches that Pi to a new forked session; the original session stays saved.
import { agents, terminals, run, hc } from "herdr";

export const FORK_KEY = "ctrl+alt+shift+f";
// Pi's own report words (OSC 7501) in which its editor takes input. Forking a working Pi would abort
// its turn, and a blocked one has a dialog open that would get the key.
const READY = new Set(["idle", "done", "error"]);

// { pi, ok, why }: pi says whether Fork applies at all; ok whether it can run now.
export function forkState(address) {
  const agent = agents().find((a) => a.address === address);
  const term = terminals().find((t) => t.address === address && t.state === "live");
  if (!agent || !term) return { pi: false, ok: false, why: "This conversation is no longer open." };
  if (agent.app !== "pi") return { pi: false, ok: false, why: "Only Pi conversations can be forked here." };
  if (!READY.has(term.status) || agent.status === "working" || agent.status === "blocked")
    return { pi: true, ok: false, why: "Pi is busy. Fork when it is idle." };
  return { pi: true, ok: true, why: null };
}

// Rechecks, shows the conversation, then presses the fork key in exactly that terminal (machine/tN too).
export async function forkConversation(address) {
  const state = forkState(address);
  if (!state.ok) throw new Error(state.why);
  run("agent.focus", { terminal: address });
  const result = await hc(["keys", address, FORK_KEY]);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `hc keys exited with ${result.code}`);
  return result;
}
