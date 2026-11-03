// History: every saved Pi chat on each connected machine, as Pi's /resume "All" lists them. Type to search
// titles, first messages, folders and IDs; Enter or a click asks before resuming it with `pi --session`.
// Opened with mod.open {name: "pi-history"}; self-contained (no shared state, no live-terminal guesses).

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, VirtualListScrollHandle, v_virtual_list } from "gpui-base";
import { machines, spaces, panes, run, theme, props, closeOverlay, openOverlay, notify } from "herdr";
import { readSessions, resumePlan, title, matches } from "./sessions.js";

const ROW = 46;
const name = (key) => key || "Local";
const keyOf = (s) => (s.machine ?? "") + ":" + s.path;

function ago(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d";
}

export default class History extends View {
  init(_props, cx) {
    this.found = {};
    this.errors = {};
    this.loading = new Set();
    this.scope = null;
    this.at = 0;
    this.generation = 0;
    this.scroll = VirtualListScrollHandle.new();
    this.focus = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Search saved Pi chats…" });
    this.input.on("change", (_e, cx) => { this.at = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.resume(this.rows()[this.at], cx));
    this.input.focus();
    this.refresh(cx);
  }

  async close() { this.closed = true; }

  // This computer always answers (its saved chats don't depend on the layout document); other machines once ready.
  // Each answers on its own; a newer refresh or closing drops older answers.
  refresh(cx) {
    const generation = ++this.generation;
    const ready = [null, ...machines().filter((m) => m.name !== null && m.layout === "ready").map((m) => m.name)];
    const keys = new Set(ready.map((m) => m ?? ""));
    for (const key of Object.keys(this.found)) if (!keys.has(key)) delete this.found[key];
    this.errors = {};
    this.loading = new Set(keys);
    for (const machine of ready) cx.spawn(async (cx) => {
      const key = machine ?? "";
      try {
        const rows = await readSessions(machine);
        if (this.closed || generation !== this.generation) return;
        this.found[key] = rows.map((s) => ({ ...s, machine }));
      } catch (e) {
        if (this.closed || generation !== this.generation) return;
        delete this.found[key];
        this.errors[key] = String(e?.message ?? e);
      }
      this.loading.delete(key);
      cx.notify();
    });
    cx.notify();
  }

  rows() {
    const all = Object.entries(this.found).filter(([key]) => this.scope === null || key === this.scope).flatMap(([, rows]) => rows);
    return matches(all, this.input.value()).sort((a, b) => b.modified - a.modified || a.path.localeCompare(b.path));
  }

  // Checks the exact clicked session on its machine, then asks: Pi doesn't lock sessions, and History can't know
  // whether another Pi still has it open.
  resumeKey(key, cx) {
    const rows = this.rows(), i = rows.findIndex((s) => keyOf(s) === key);
    if (i < 0) return;
    this.at = i;
    this.resume(rows[i], cx);
  }

  resume(s, cx) {
    if (!s || this.pending) return;
    this.pending = s;
    cx.spawn(async (cx) => {
      try {
        const { cwdExists } = await readSessions(s.machine, { path: s.path, id: s.id, cwd: s.cwd });
        if (this.closed) return;
        const [command, args] = resumePlan(s, cwdExists, spaces(), panes());
        closeOverlay(props().overlay);
        openOverlay({ mod: "confirm", kind: "dialog", width: 480, height: 240, props: {
          title: "Resume this Pi chat?",
          detail: title(s) + "\n" + name(s.machine) + " · " + (s.cwd || "no folder recorded") + "\n\n"
            + (cwdExists ? "" : "Its folder no longer exists; Pi will ask where to continue.\n")
            + "If this chat is still open in another Pi, both will write to the same session file.",
          command: { name: command, args },
        } });
      } catch (e) {
        if (!this.closed) notify({ title: "Couldn't resume Pi chat", body: String(e?.message ?? e), level: "error" });
      } finally {
        this.pending = null;
        if (!this.closed) cx.notify();
      }
    });
    cx.notify();
  }

  // Pi's own picker: full-text search, rename and delete (Tab switches to All projects).
  picker() {
    closeOverlay(props().overlay);
    run("space.new", { ...(this.scope ? { machine: this.scope } : {}), argv: ["pi", "--resume"] });
  }

  render(cx) {
    const t = theme(), rows = this.rows();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    const keys = [...new Set([...this.loading, ...Object.keys(this.found), ...Object.keys(this.errors)])].sort();
    const chip = (key, label, note) => div().id("scope-" + (key ?? "all")).h(24).px(8).flex().items_center().rounded(6)
      .text_size(12).cursor_pointer().text_color(this.scope === key ? t.foreground : t.muted)
      .when(this.scope === key, (el) => el.bg(t.selected)).hover((el) => el.bg(t.hover))
      .when(Boolean(note), (el) => el.tooltip(note))
      .on_click((_e, cx) => { this.scope = key; this.at = 0; cx.notify(); })
      .child(label);
    // Virtual list rows can't register handlers; the list's on_item_click resumes by key.
    const row = (s, i) => h_flex().id("row-" + keyOf(s)).h(ROW).px(10).gap(10).items_center().rounded(8)
      .cursor_pointer().when(i === this.at, (el) => el.bg(t.selected)).hover((el) => el.bg(t.hover))
      .tooltip(s.cwd + "\n" + s.id + "\n" + s.path)
      .child(v_flex().flex_1().min_w(0)
        .child(div().truncate().text_color(t.foreground).child(title(s)))
        .child(div().truncate().text_size(11).text_color(t.dim)
          .child((s.cwd.split("/").filter(Boolean).pop() || s.cwd || "?") + " · " + name(s.machine))))
      .child(div().flex_none().text_size(11).text_color(t.dim)
        .child(this.pending === s ? "checking…" : ago(s.modified) + " · " + s.messageCount + " msgs"));
    const empty = this.loading.size ? "Loading saved Pi chats…" : keys.length ? "No saved Pi chats match." : "No connected machines.";
    return v_flex().id("pi-history").track_focus(this.focus).size_full().min_h(0).p(16).gap(10)
      .bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") closeOverlay(props().overlay);
        else if (e.key === "down" || e.key === "up") {
          this.at = Math.max(0, Math.min(rows.length - 1, this.at + (e.key === "down" ? 1 : -1)));
          this.scroll.scroll_to_item(this.at);
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("History"))
        .child(div().id("refresh").px(8).h(24).flex().items_center().rounded(6).text_size(12).text_color(t.muted)
          .cursor_pointer().hover((el) => el.bg(t.hover)).on_click((_e, cx) => this.refresh(cx)).child("Refresh"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground)))
      .child(h_flex().gap(4).flex_wrap()
        .child(chip(null, "All machines"))
        .children(keys.map((key) => chip(key, name(key) + (this.loading.has(key) ? " · loading…" : this.errors[key] ? " · unavailable" : ""), this.errors[key]))))
      .child(div().id("list").relative().flex_1().min_h(0)
        .when(rows.length === 0, (el) => el.child(div().p(10).text_color(t.dim).child(empty)))
        .when(rows.length > 0, (el) => el
          .child(v_virtual_list("history-rows", rows.length, ROW, (i) => keyOf(rows[i]),
            (range) => rows.slice(range.start, range.end).map((s, j) => row(s, range.start + j)))
            .on_item_click((key, cx) => this.resumeKey(key, cx)).track_scroll(this.scroll).size_full())
          .child(Scrollbar.vertical("history-rows").absolute().inset_0())))
      .child(h_flex().gap(8).items_center().text_size(11).text_color(t.dim)
        .child(div().flex_1().min_w(0).truncate()
          .tooltip("Lists Pi's session folder on each connected machine, like /resume's All scope. Subagent runs and sessions saved with a one-off --session-dir aren't listed. Search covers titles, first messages, folders and IDs. Nothing is uploaded.")
          .child(rows.length + " chats · Pi's All projects · no uploads"))
        .child(div().id("native-picker").px(8).h(24).flex().items_center().rounded(6).text_size(12).text_color(t.muted)
          .cursor_pointer().hover((el) => el.bg(t.hover)).on_click(() => this.picker()).child("Open Pi's picker")));
  }
}
