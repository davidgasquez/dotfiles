// Match the terminal shown by sandbox-spaces for the clicked tab.
export function lead(tab, ps) {
  const mine = ps.filter((p) => p.tab === tab.id && p.terminal);
  return mine.find((p) => p.program?.agent) ?? mine.find((p) => p.focused) ?? mine[0];
}

export function address(terminal, machine) {
  return !machine || terminal.includes("/") ? terminal : `${machine}/${terminal}`;
}

export function chatLink(space, tab, ps) {
  const l = lead(tab, ps);
  return l ? `hc read ${address(l.terminal, space.machine)} --lines 200` : null;
}
