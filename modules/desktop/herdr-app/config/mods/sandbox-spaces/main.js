// Saved spaces, each a folder with its tabs as chats and their sub-agents under
// them; standalone Pi chats (dated folders under ~/Documents/Pi/Chats, or older /tmp ones);
// and any other space. Each saved space and Chats has a History of its own saved conversations. A saved space
// stays listed with nothing running: clicking it starts Pi there, else folds it.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, panes, agents, terminals, focused, run, exec, theme, shared, setShared, pickFolder, openOverlay, closeOverlay, props, setAgentOrder, layout, nextCommand, notify, home } from "herdr";

const PI = ["exec", "pi"];
const ICONS = "mods/workspace-chrome";
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

const trim = (path) => path.replace(/\/+$/, "") || "/";
const base = (path) => trim(path).split("/").pop() || "/";
const inside = (path, folder) => Boolean(path) && (trim(path) === folder || trim(path).startsWith(folder === "/" ? "/" : folder + "/"));
const chats = () => home() + "/Documents/Pi/Chats";
const isChat = (path) => /^\/tmp\/[^/]+/.test(path ?? "") || inside(path, chats());

const SAVED = "sandbox-spaces.saved";
const saved = () => shared(SAVED) ?? [];
const save = (list) => setShared(SAVED, list);

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s, ps) {
  const tabs = new Set(s.tabs.map((t) => t.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

function lead(tab, ps) {
  const mine = ps.filter((p) => p.tab === tab.id && p.terminal);
  return mine.find((p) => p.program?.agent) ?? mine.find((p) => p.focused) ?? mine[0];
}

function title(tab, ps) {
  const l = lead(tab, ps);
  const program = l?.program;
  if (tab.named && tab.name !== program?.name) return tab.name;
  const folder = base(l?.cwd ?? "");
  const live = (l?.title ?? "").replace(/^π\s*-\s*/u, "").replace(" - " + folder, "").trim();
  const telling = live && live !== program?.name && live.toLowerCase() !== program?.key
    && live !== folder && !/^[~/]/.test(live) && !live.includes("@");
  if (telling) return live;
  return program?.agent ? "New chat" : !program || program.shell ? "Terminal" : program.name;
}

// Spaces by where they work: the deepest saved folder, else a standalone chat, else other.
function grouped() {
  const ps = panes();
  const list = saved();
  const of = new Map(list.map((p) => [p.folder, []]));
  const chats = [];
  const other = [];
  for (const s of spaces()) {
    const at = place(s, ps);
    const p = s.machine ? null : list
      .filter((p) => inside(at, p.folder) || inside(s.folder, p.folder))
      .sort((a, b) => b.folder.length - a.folder.length)[0];
    if (p) of.get(p.folder).push(s);
    else if (!s.machine && (isChat(at) || isChat(s.folder))) chats.push(s);
    else other.push(s);
  }
  return { ps, list, of, chats, other };
}

function start(entry, argv) {
  const live = grouped().of.get(entry.folder)?.[0];
  const agent = argv ? { argv } : {};
  if (!live) return run("space.new", { name: entry.name, folder: entry.folder, ...agent });
  run("space.select", { id: live.id });
  run("tab.new", { space: live.id, folder: entry.folder, ...agent });
}

async function chatNow() {
  try {
    const r = await exec("pi-chats", ["new"]);
    if (r.code !== 0) throw new Error(r.stderr.trim() || "pi-chats exited with " + r.code);
    run("space.new", { folder: r.stdout.trim(), argv: PI });
  } catch (e) {
    notify({ title: "Couldn't start a new chat", body: String(e?.message ?? e), level: "error" });
  }
}

// History of the conversations saved in folder (and inside it).
const history = (folder, label) =>
  openOverlay({ mod: "sandbox-history", kind: "dialog", width: 980, height: 0.82, props: { folder, label } });
const chatHistory = () => history(chats(), "Chats");

function newChat(cx) {
  cx.spawn(chatNow);
}

const savedMenu = (p) =>
  openOverlay({ mod: "sandbox-spaces", kind: "popup", width: 200, height: 195, props: { menu: { saved: p.folder } } });

function addSaved(folder) {
  const list = saved();
  folder = trim(folder);
  if (list.some((p) => p.folder === folder)) return;
  const uses = (c) => list.filter((p) => p.color === c).length;
  const color = Object.keys(MARK).reduce((best, c) => (uses(c) < uses(best) ? c : best));
  save([...list, { name: base(folder), folder, color }]);
}

function pick(cx) {
  cx.spawn(async () => {
    const folder = await pickFolder({ prompt: "Add space" });
    if (folder) addSaved(folder);
  });
}

function avatar(name, color, size = 18) {
  return h_flex().size(size).flex_none().rounded(5).bg(MARK[color] ?? color ?? MARK.ansi6)
    .items_center().justify_center().text_size(size * 0.58).font_bold().text_color("#ffffff")
    .child([...name][0]?.toUpperCase() ?? "?");
}

function icon(program, size, color) {
  if (!program?.icon) return div().w(size).flex_none();
  return svg(program.icon).size(size).flex_none().text_color(color);
}

// A sub-agent's raw word, error counting as blocked; its done is its parent's news.
function kidStatus(k, listed) {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
}

// Live sub-agents of addr, depth first, each with the tree lines in front of it.
function tree(all, addr, lead = []) {
  const kids = all.filter((k) => k.parent === addr && k.state === "live");
  return kids.flatMap((k, i) => {
    const last = i === kids.length - 1;
    return [{ k, lines: [...lead, last ? "└" : "├"] }, ...tree(all, k.address, [...lead, last ? "" : "│"])];
  });
}

const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
const urgent = (list) => list.reduce((m, x) => ((RANK[x] ?? 0) > (RANK[m] ?? 0) ? x : m), null);

function mark(t, status) {
  if (status === "working") return svg(ICONS + "/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold()
    .text_color(t.blocked).flex().items_center().justify_center().child("!");
  if (status === "done") return div().size(7).mx(3).flex_none().rounded(4).bg(t.done);
  return null;
}

export default class SavedSpaces extends View {
  init(_props, cx) {
    this.hovered = null;
    this.folded = new Set(JSON.parse(localStorage.getItem("folded") ?? "[]"));
    const p = props() ?? {};
    if (p.rename) {
      this.input = InputState.new({ value: saved().find((x) => x.folder === p.rename)?.name ?? "" });
      this.input.on("submit", () => this.rename());
      this.input.focus();
      cx.timer.after(600, () => this.input.focus());
    }
    if (!p.rename && !p.menu) {
      cx.spawn(async () => {
        for (;;) if ((await nextCommand()) === "new_chat") await chatNow();
      });
    }
    if (p.rename || p.menu) {
      this.handle = cx.focus_handle();
      if (p.menu) this.handle.focus();
    }
  }

  hover(id, on, cx) {
    if (on) this.hovered = id;
    else if (this.hovered === id) this.hovered = null;
    cx.notify();
  }

  toggle(key, cx) {
    this.folded.has(key) ? this.folded.delete(key) : this.folded.add(key);
    localStorage.setItem("folded", JSON.stringify([...this.folded]));
    cx.notify();
  }

  // The fold chevron; folded, how many are hidden too, colored by the most urgent.
  fold(id, key, count, top) {
    const t = theme();
    const open = !this.folded.has(key);
    return h_flex().id(id).h(22).min_w(22).px(3).gap(3).flex_none().items_center().justify_center().rounded(5)
      .text_size(11).text_color(open ? t.dim : (t[top] ?? t.dim)).hover((s) => s.bg(t.raised).text_color(t.foreground))
      .tooltip(open ? "Collapse" : "Expand")
      .on_click((_e, cx) => { cx.stop_propagation(); this.toggle(key, cx); })
      .when(!open, (el) => el.child(String(count)))
      .child(svg(ICONS + "/chevron-" + (open ? "down" : "right") + ".svg").size(11));
  }

  button(id, child, tip, action) {
    const t = theme();
    return div().id(id).size(22).flex_none().flex().items_center().justify_center().rounded(5)
      .text_color(t.dim).hover((s) => s.bg(t.raised).text_color(t.foreground)).tooltip(tip)
      .on_click((_e, cx) => { cx.stop_propagation(); action(cx); }).child(child);
  }

  section(id, label, tip, action, extra) {
    const t = theme();
    return h_flex().h(31).flex_none().pl(8).pr(2).pt(6).items_center().justify_between()
      .text_size(11.5).text_color(t.dim).child(label)
      .when(Boolean(action), (el) => el.child(h_flex().gap(2).when(Boolean(extra), (el) => el.child(extra))
        .child(this.button(id, svg(ICONS + "/plus.svg").size(14), tip, action))));
  }

  sub({ k, lines }, indent, listed) {
    const t = theme();
    const on = k.address === focused()?.agent;
    return h_flex().id("sub-" + k.address).h(26).flex_none().pl(indent).pr(4).items_center().rounded(7)
      .when(on, (el) => el.bg(t.raised)).hover((st) => st.bg(t.hover))
      .on_click(() => run("terminal.peek", { terminal: k.address }))
      .children(lines.map((l) => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", (el) => el.border_b(1.5).rounded_bl(6))))
      .child(div().mr(8).child(icon(k.program, 13, on ? t.foreground : t.muted)))
      .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(on ? t.foreground : t.muted)
        .child(k.name || k.template || k.program?.name || k.address))
      .child(div().w(22).flex_none().flex().justify_center().child(mark(t, kidStatus(k, listed)) ?? div()));
  }

  chat(s, tab, ps, indent, numbered = false) {
    const t = theme();
    const on = s.active && tab.active;
    const id = "chat-" + tab.id;
    const color = on ? t.foreground : t.muted;
    const all = terminals();
    const listed = new Map(agents().map((a) => [a.address, a.status]));
    const subs = ps.filter((p) => p.tab === tab.id && p.terminal).flatMap((p) => tree(all, p.terminal));
    const key = "c:" + tab.id;
    return [h_flex().id(id).h(28).flex_none().pl(indent).pr(4).gap(8).items_center().rounded(7)
      .when(on, (el) => el.bg(t.selected)).when(!on, (el) => el.hover((st) => st.bg(t.hover)))
      .on_hover((h, cx) => this.hover(id, h, cx))
      .on_click(() => { run("space.select", { id: s.id }); run("tab.select", { id: tab.id }); })
      .on_mouse_down("right", () => openOverlay({ mod: "sandbox-menu", kind: "popup", width: 200, height: 260, props: { tab: "tab", target: { id: tab.id, space: s.id } } }))
      .child(icon(lead(tab, ps)?.program, 14, color))
      .when(numbered && tab.index <= 9, (el) => el.child(div().flex_none().ml(-3).text_size(11).text_color(t.dim).child(String(tab.index))))
      .child(div().flex_1().min_w(0).truncate().text_color(color).child(title(tab, ps)))
      .when(subs.length > 0, (el) => el.child(this.fold("fold-" + tab.id, key, subs.length, urgent(subs.map(({ k }) => kidStatus(k, listed))))))
      .child(this.hovered === id
        ? this.button("close-" + tab.id, svg(ICONS + "/x.svg").size(13), "Close", () => run("tab.close", { id: tab.id }))
        : div().w(22).flex_none().flex().justify_center().child(mark(t, tab.status) ?? div())),
      ...(this.folded.has(key) ? [] : subs.map((k) => this.sub(k, indent + 3, listed)))];
  }

  entry(p, i, live, ps) {
    const t = theme();
    const id = "saved-" + i;
    const shown = this.hovered === id;
    const tabs = live.flatMap((s) => s.tabs.map((tab) => [s, tab]));
    const key = "s:" + p.folder;
    const folded = this.folded.has(key);
    const top = urgent(tabs.map(([, tab]) => tab.status));
    return [
      h_flex().id(id).h(30).flex_none().px(8).pr(4).gap(9).items_center().rounded(8)
        .hover((st) => st.bg(t.hover))
        .on_hover((h, cx) => this.hover(id, h, cx))
        .on_click((_e, cx) => (tabs.length ? this.toggle(key, cx) : start(p, PI)))
        .on_mouse_down("right", () => savedMenu(p))
        .child(avatar(p.name, p.color))
        .child(div().flex_1().min_w(0).truncate().font_medium().text_color(t.foreground).child(p.name))
        .when(shown, (el) => el
          .child(this.button("hist-" + i, svg(ICONS + "/clock.svg").size(13), "History", () => history(p.folder, p.name)))
          .child(this.button("term-" + i, svg(ICONS + "/terminal.svg").size(13), "New terminal", () => start(p)))
          .child(this.button("pi-" + i, svg("icons/pi.svg").size(13), "New Pi chat", () => start(p, PI))))
        .when(folded && !shown && top !== "idle", (el) => el.child(div().w(22).flex_none().flex().justify_center().child(mark(t, top) ?? div())))
        .when(tabs.length > 0 && (shown || folded), (el) => el.child(this.fold("fold-" + i, key, tabs.length, top))),
      ...(folded ? [] : tabs.flatMap(([s, tab]) => this.chat(s, tab, ps, 35, true))),
    ];
  }

  other(s) {
    const t = theme();
    const colors = shared("space.colors") ?? {};
    const id = "space-" + s.id;
    // History reads this computer's sessions: a remote space's folder isn't here.
    const hist = s.machine
      ? div().id("hist-" + s.id).size(22).flex_none().flex().items_center().justify_center().opacity(0.4)
        .text_color(t.dim).tooltip("History covers this computer's spaces only").child(svg(ICONS + "/clock.svg").size(13))
      : this.button("hist-" + s.id, svg(ICONS + "/clock.svg").size(13), "History", () => history(place(s, panes()), s.name));
    return h_flex().id(id).h(30).flex_none().px(8).gap(9).items_center().rounded(8)
      .when(s.active, (el) => el.bg(t.selected)).when(!s.active, (el) => el.hover((st) => st.bg(t.hover)))
      .on_hover((h, cx) => this.hover(id, h, cx))
      .on_click(() => run("space.select", { id: s.id }))
      .on_mouse_down("right", () => openOverlay({ mod: "sandbox-spaces", kind: "popup", width: 200, height: s.machine ? 100 : 165, props: { menu: { space: s.id } } }))
      .child(avatar(s.name, colors[s.id]))
      .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(s.name))
      .when(Boolean(s.machine), (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(s.machine)))
      .when(this.hovered === id, (el) => el.child(hist))
      .child(div().w(22).flex_none().flex().justify_center().child(mark(t, s.status) ?? div()));
  }

  rail(g) {
    const t = theme();
    return v_flex().size_full().min_h(0).bg(t.chrome).items_center().gap(6).pt(8).overflow_y_scrollbar()
      .children(g.list.map((p, i) => div().id("rail-" + i).tooltip(p.name)
        .on_click(() => { const live = g.of.get(p.folder)[0]; live ? run("space.select", { id: live.id }) : start(p, PI); })
        .on_mouse_down("right", () => savedMenu(p))
        .child(avatar(p.name, p.color, 22))))
      .child(this.button("rail-chat", svg("icons/pi.svg").size(14), "New Pi chat", newChat))
      .child(this.button("rail-history", svg(ICONS + "/clock.svg").size(14), "Chats history", chatHistory));
  }

  menu(m) {
    const t = theme();
    const overlay = props().overlay;
    const item = (id, label, action) => h_flex().id(id).h(30).px(9).flex_none().rounded(7).items_center()
      .text_color(t.foreground).hover((s) => s.bg(t.selected))
      .on_click((_e, cx) => { closeOverlay(overlay); action(cx); }).child(label);
    let items = [];
    if (m.saved) {
      const p = saved().find((x) => x.folder === m.saved);
      if (p) items = [
        item("m-pi", "New Pi chat", () => start(p, PI)),
        item("m-term", "New terminal", () => start(p)),
        item("m-history", "History", () => history(p.folder, p.name)),
        item("m-rename", "Rename…", () => openOverlay({ mod: "sandbox-spaces", kind: "dialog", width: 380, height: 190, props: { rename: p.folder } })),
        item("m-remove", "Remove from Spaces", () => save(saved().filter((x) => x.folder !== p.folder))),
      ];
    } else if (m.space) {
      const s = spaces().find((x) => x.id === m.space);
      if (s) items = [
        ...(s.machine ? [] : [
          item("m-save", "Save to Spaces", () => addSaved(place(s, panes()))),
          item("m-history", "History", () => history(place(s, panes()), s.name)),
        ]),
        item("m-rename", "Rename", () => run("space.rename", { id: s.id })),
        item("m-close", "Close", () => run("space.close", { id: s.id })),
      ];
    }
    return v_flex().id("spaces-menu").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(overlay); cx.stop_propagation(); } })
      .w_full().p(5).bg(t.popover).text_size(12.8).children(items);
  }

  rename() {
    const p = props();
    const name = this.input.value().trim();
    closeOverlay(p.overlay);
    if (!name) return;
    save(saved().map((x) => (x.folder === p.rename ? { ...x, name } : x)));
    for (const s of grouped().of.get(p.rename) ?? []) run("space.rename", { id: s.id, name });
  }

  dialog() {
    const t = theme();
    const p = props();
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .hover((s) => s.opacity(0.88)).on_click(action).child(text);
    return v_flex().id("spaces-rename").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .w_full().p(18).gap(14).bg(t.popover).text_color(t.foreground)
      .child(div().text_size(15).font_semibold().child("Rename space"))
      .child(Input.new(this.input).h(36).px(10).rounded(9).border_1().border_color(t.accent).bg(t.background).text_size(12.8))
      .child(div().text_size(11.5).text_color(t.dim).child(p.rename))
      .child(h_flex().gap(8).justify_end()
        .child(button("rn-cancel", "Cancel", false, () => closeOverlay(p.overlay)))
        .child(button("rn-save", "Save", true, () => this.rename())));
  }

  render() {
    const p = props() ?? {};
    if (p.menu) return this.menu(p.menu);
    if (p.rename) return this.dialog();
    const t = theme();
    const g = grouped();
    const order = [...g.list.flatMap((x) => g.of.get(x.folder)), ...g.chats, ...g.other].flatMap((s) => s.tabs.map((tab) => tab.id));
    const all = agents();
    setAgentOrder(order.flatMap((id) => all.filter((a) => a.tab === id).map((a) => a.address)));
    if (narrow()) return this.rail(g);
    const chats = g.chats.flatMap((s) => s.tabs.flatMap((tab) => this.chat(s, tab, g.ps, 8)));
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(v_flex().id("spaces-list").flex_1().min_h(0).px(8).pb(8).overflow_y_scrollbar()
        .child(this.section("add-space", "Spaces", "Add space", pick))
        .children(g.list.flatMap((x, i) => this.entry(x, i, g.of.get(x.folder), g.ps)))
        .when(!g.list.length, (el) => el.child(div().id("add-first").h(28).px(8).flex().items_center().rounded(7)
          .text_size(12).text_color(t.dim).hover((s) => s.bg(t.hover)).on_click((_e, cx) => pick(cx)).child("Add a folder…")))
        .when(g.other.length > 0, (el) => el.child(this.section("other", "Other")).children(g.other.map((s) => this.other(s)))))
      .child(v_flex().flex_none().px(8).pb(8).border_t(1).border_color(t.border)
        .child(this.section("new-chat", "Chats", "New Pi chat (Ctrl+I)", newChat,
          this.button("history", svg(ICONS + "/clock.svg").size(13), "Chats history", chatHistory)))
        .when(chats.length > 0, (el) => el.child(v_flex().id("chats-list").max_h(240).overflow_y_scrollbar().children(chats))));
  }
}
