// The sidebar's one row of actions: search, Pi history, the machine new agents start on, and a new agent.
// New space lives in the shipped spaces list below. "sandbox-toolbar.new-pi" (a key) starts Pi in a new tab.

import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex, Popover } from "gpui-base";
import { spaces, machines, run, theme, openOverlay, nextCommand, layout } from "herdr";

const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean) ?? null);
// The sidebar's rail goes by its width, as the shipped sidebar mods read it.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;
const icon = (name, color) => svg(`mods/workspace-chrome/${name}.svg`).size(14).flex_none().text_color(color);

export default class SidebarToolbar extends View {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        cx.notify();
        if (command === "new-pi") run("tab.new", { name: "Pi", argv: ["pi"] });
      }
    });
  }

  // That machine's shown or first space, else a new one there (local: no machine argument).
  selectMachine(name) {
    const on = spaces().filter((s) => (s.machine ?? null) === name);
    const space = on.find((s) => s.active) ?? on[0];
    if (space) run("space.select", { id: space.id });
    else run("space.new", name === null ? {} : { machine: name });
    this.machineOpen = false;
  }

  render() {
    const t = theme();
    const tool = (id, label, name, fn) => div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6)
      .hover((s) => s.bg(t.hover)).role("button").accessibility_label(label).tooltip(label).on_click(fn).child(icon(name, t.dim));
    const add = tool("toolbar-new-agent", "New agent", "plus", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }));
    if (narrow()) return h_flex().id("toolbar").size_full().bg(t.chrome).items_center().justify_center().child(add);
    const machine = spaces().find((s) => s.active)?.machine ?? null;
    const picker = Popover.new("toolbar-machine-menu").anchor("top_right").open(this.machineOpen ?? false)
      .on_open_change((open, cx) => { this.machineOpen = open; cx.notify(); })
      .trigger(h_flex().id("toolbar-machine").h(26).px(5).gap(3).flex_none().items_center().rounded(6)
        .text_color(t.muted).hover((s) => s.bg(t.hover))
        .role("button").accessibility_label("Choose machine for new agents").tooltip(`Machine for new agents: ${machine ?? "Local"}`)
        .child(div().max_w(56).truncate().child(machine ?? "Local"))
        .child(svg("mods/workspace-chrome/chevron-down.svg").size(10)))
      .content(v_flex().w(220).p(5).rounded(8).bg(t.popover).border(1).border_color(t.border)
        .children(machines().map((m) => h_flex().id(`toolbar-machine-${m.name ?? "local"}`).h(32).px(8).gap(6).items_center().rounded(6)
          .text_color(m.layout === "ready" ? t.foreground : t.dim)
          .when(m.layout === "ready", (el) => el.hover((s) => s.bg(t.hover)))
          .role("button").accessibility_label(m.name ?? "Local")
          .on_click((_e, cx) => { if (m.layout === "ready") { this.selectMachine(m.name); cx.notify(); } })
          .child(div().flex_1().child(m.name ?? "Local"))
          .when(m.layout !== "ready", (el) => el.child(m.layout === "loading" ? "connecting…" : "offline"))
          .when(m.name === machine, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(12).text_color(t.accent))))));
    // pr 10 as the brand row above, so the two rows' right-hand icons line up.
    return h_flex().id("toolbar").size_full().bg(t.chrome).pl(8).pr(10).gap(2).items_center().overflow_hidden().text_size(13)
      .child(h_flex().id("toolbar-search").flex_1().min_w(0).h(26).px(10).gap(8).items_center().rounded(6)
        .text_color(t.dim).hover((s) => s.bg(t.hover)).role("button").accessibility_label("Search")
        .on_click(() => run("mod.open", { name: "picker" }))
        .child(icon("search", t.dim)).child(div().min_w(0).truncate().child("Search")))
      .child(tool("toolbar-history", "Pi history", "clock", () => run("mod.open", { name: "pi-history" })))
      .child(picker)
      .child(add);
  }
}
