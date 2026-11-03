// History of one place: the Pi conversations saved on this computer whose folder is props
// {folder, label} or inside it (standalone Chats by default), newest activity first. Type to
// filter by title and folder at once and, after a pause, by what you and Pi wrote (pi-chats
// reads Pi's own session files; tool output and prompts aren't searched). One line per
// conversation, whose hover shows how its active branch opened and where it is now;
// selecting starts nothing, the footer's Resume does: it runs "pi --session <that file>".

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, VirtualListScrollHandle, v_virtual_list } from "gpui-base";
import { exec, spaces, panes, run, theme, props, closeOverlay, notify, pickFolder, home } from "herdr";

const ROW = 34;
const PAGE = 500;
const DEBOUNCE = 300;
const ICONS = "mods/workspace-chrome";
const FOLDER = 140;
const COLS = 72;

export const words = (q) => q.toLowerCase().split(/\s+/).filter(Boolean);
export const titleOf = (s) => s.name || s.first || "(no text)";
const trim = (p) => p.replace(/\/+$/, "") || "/";

async function helper(args) {
  const r = await exec("pi-chats", args);
  if (r.code !== 0) throw new Error(r.stderr.trim() || "pi-chats exited with " + r.code);
  return JSON.parse(r.stdout);
}

export function where(cwd, h = home()) {
  if (!cwd) return "no folder recorded";
  if (cwd.startsWith(h + "/Documents/Pi/Chats/")) return "Chat · " + cwd.split("/").slice(-2).join("/");
  if (/^\/tmp\//.test(cwd)) return "Temporary chat";
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

// A folder in the scope by its path from there (the scope's own folder by its label).
export function place(cwd, scope, h = home()) {
  const at = cwd && trim(cwd);
  if (at && scope.folder !== "/" && at === scope.folder) return scope.label;
  if (at && scope.folder !== "/" && at.startsWith(scope.folder + "/")) return at.slice(scope.folder.length + 1);
  return where(cwd, h);
}

const pad = (n) => String(n).padStart(2, "0");
const day = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

export function when(ms, now = new Date()) {
  if (!ms) return "";
  const d = new Date(ms);
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((midnight(now) - midnight(d)) / 86400000);
  const time = pad(d.getHours()) + ":" + pad(d.getMinutes());
  if (days === 0) return time;
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return day(d);
}

export function wrap(text, cols = COLS) {
  const out = [];
  let line = "";
  for (let w of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + w.length > cols) { out.push(line); line = ""; }
    for (; w.length > cols; w = w.slice(cols)) {
      if (line) { out.push(line); line = ""; }
      out.push(w.slice(0, cols));
    }
    line = line ? line + " " + w : w;
  }
  if (line) out.push(line);
  return out;
}

export function elapsed(ms) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return "moments";
  if (m < 60) return m + " min";
  if (h < 24) return h + " h" + (m % 60 ? " " + (m % 60) + " min" : "");
  return d < 7 && h % 24 ? d + " d " + (h % 24) + " h" : d + (d === 1 ? " day" : " days");
}

// The hover text, short enough for small windows: the title (two lines at most), then the
// active branch's opening and latest messages with who wrote them and when, split by how many
// came between and how much later it went on.
export function preview(s) {
  const two = (lines, cols) => (lines.length > 2 ? [lines[0], lines[1].slice(0, cols - 1) + "…"] : lines);
  const out = two(wrap(titleOf(s)), COLS);
  const p = s.preview;
  out.push("");
  if (!p?.opening) return [...out, "Preview unavailable" + (p?.note ? ": " + p.note : "")].join("\n");
  let seen = null;
  const said = (m) => {
    const d = m.time ? new Date(m.time) : null;
    const at = !d ? "" : " · " + (seen === day(d) ? "" : day(d) + " ") + pad(d.getHours()) + ":" + pad(d.getMinutes());
    if (d) seen = day(d);
    out.push((m.role === "user" ? "You" : "Pi") + at, ...two(wrap(m.text, COLS - 2), COLS - 2).map((l) => "  " + l));
  };
  p.opening.forEach(said);
  const [a, b] = [p.opening.at(-1)?.time, p.recent[0]?.time];
  const gap = a && b && b >= a ? b - a : null;
  const later = gap !== null && (p.omitted || gap >= 3600000) ? elapsed(gap) + " later" : "";
  const more = p.omitted ? p.omitted + (p.omitted === 1 ? " more message" : " more messages") : "";
  if (more || later) out.push("··· " + [more, later].filter(Boolean).join(" · ") + " ···");
  p.recent.forEach(said);
  return out.join("\n");
}

// Rows for a query: loaded title/folder matches at once, plus the helper's text matches for
// that exact query once they arrive, including ones older than what's loaded. Newest first.
export function filter(sessions, query, results) {
  const want = words(query);
  if (!want.length) return sessions;
  const hits = results?.query === want.join(" ") ? results.hits : null;
  const rows = sessions.filter((s) => {
    if (hits?.has(s.path)) return true;
    s.hay ??= (titleOf(s) + " " + s.first + " " + s.cwd).toLowerCase();
    return want.every((w) => s.hay.includes(w));
  });
  if (!hits) return rows;
  const known = new Set(sessions.map((s) => s.path));
  for (const h of hits.values()) if (!known.has(h.path)) rows.push(h);
  return rows.sort((a, b) => b.modified - a.modified);
}

// A local workspace now in the conversation's folder: its terminals' live folders, else (with
// none known) the folder it was made in. It may or may not be running this conversation.
export function openAt(cwd, sp = spaces(), ps = panes()) {
  if (!cwd) return null;
  const at = trim(cwd);
  const local = sp.filter((x) => !x.machine);
  const live = (x) => ps.filter((p) => p.cwd && x.tabs.some((t) => t.id === p.tab));
  return local.find((x) => live(x).some((p) => trim(p.cwd) === at))
    ?? local.find((x) => !live(x).length && trim(x.folder || "") === at) ?? null;
}

export const chatsFolder = () => home() + "/Documents/Pi/Chats";

export default class History extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.scope = p.folder ? { folder: trim(p.folder), label: p.label || trim(p.folder).split("/").pop() || "/" } : { folder: chatsFolder(), label: "Chats" };
    this.sessions = null;
    this.count = PAGE;
    this.query = "";
    this.results = null;
    this.searching = false;
    this.selected = null;
    this.busy = null;
    this.scroll = VirtualListScrollHandle.new();
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Search conversations…" });
    this.input.on("change", (_e, cx) => this.changed(cx));
    this.input.on("submit", (_e, cx) => this.primary(cx));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.load(cx);
  }

  async close() {
    this.closed = true;
    this.debounce?.cancel();
  }

  // The conversations in the `count` newest session files, read afresh; "Load older" asks
  // for more, so files written meanwhile are never skipped.
  load(cx, count = this.count) {
    if (this.loading) return;
    this.loading = true;
    this.listError = null;
    cx.spawn(async (cx) => {
      try {
        const out = await helper(["list", "--in", this.scope.folder, String(count)]);
        if (this.closed) return;
        this.sessions = out.sessions;
        this.count = count;
        this.more = out.more;
        this.cut = out.truncated;
        this.unreadable = out.unreadable;
      } catch (e) {
        if (this.closed) return;
        this.sessions = this.sessions ?? [];
        this.listError = String(e?.message ?? e);
      } finally {
        this.loading = false;
      }
      this.reselect(cx);
      cx.notify();
    });
  }

  changed(cx) {
    this.query = this.input.value();
    this.debounce?.cancel();
    this.reselect(cx);
    const q = words(this.query).join(" ");
    if (q) this.debounce = cx.timer.after(DEBOUNCE, (cx) => { this.wanted = q; this.search(cx); });
    else this.wanted = "";
    cx.notify();
  }

  // One search at a time; when it ends, the latest settled query runs if it changed meanwhile.
  search(cx) {
    if (this.searching) return;
    this.searching = true;
    cx.spawn(async (cx) => {
      try {
        while (this.wanted && this.results?.query !== this.wanted) {
          const q = this.wanted;
          let res;
          try {
            const out = await helper(["search", "--in", this.scope.folder, q]);
            res = { ...out, query: q, hits: new Map(out.hits.map((h) => [h.path, h])) };
          } catch (e) {
            res = { query: q, hits: new Map(), error: String(e?.message ?? e) };
          }
          if (this.closed) return;
          this.results = res;
          this.reselect(cx);
          cx.notify();
        }
      } finally {
        this.searching = false;
        if (!this.closed) cx.notify();
      }
    });
  }

  rows() {
    const m = this.memo;
    if (m?.query === this.query && m.results === this.results && m.sessions === this.sessions) return m.rows;
    this.memo = { query: this.query, results: this.results, sessions: this.sessions, rows: filter(this.sessions ?? [], this.query, this.results) };
    return this.memo.rows;
  }

  current() {
    return this.rows().find((s) => s.path === this.selected) ?? null;
  }

  reselect(cx) {
    const rows = this.rows();
    if (!rows.some((s) => s.path === this.selected)) this.select(rows[0]?.path ?? null);
  }

  select(path) {
    this.selected = path;
  }

  move(by, cx) {
    const rows = this.rows();
    if (!rows.length) return;
    const i = Math.max(0, Math.min(rows.length - 1, rows.findIndex((s) => s.path === this.selected) + by));
    this.select(rows[i].path);
    this.scroll.scroll_to_item(i);
  }

  // Launches exactly that file with Pi, after checking it's still the same session. A folder
  // that's gone asks for another first (a notice says why); Pi then asks to continue there.
  resume(s, space, cx) {
    if (this.busy) return;
    this.busy = s.path;
    cx.spawn(async (cx) => {
      try {
        const now = await helper(["check", s.path]);
        if (this.closed) return;
        if (now.id !== s.id) throw new Error("This file now holds another session. Reopen History.");
        let folder = now.cwd;
        if (!now.cwdExists) {
          notify({ title: "Conversation folder is gone", body: (now.cwd || "No folder was recorded") + ". Choose a folder to resume in; Pi will ask to continue there.", level: "warning" });
          folder = await pickFolder({ prompt: "Resume here" });
          if (!folder || this.closed) return;
          space = null;
        }
        const argv = ["exec", "pi", "--session", s.path];
        closeOverlay(props().overlay);
        if (space) {
          run("space.select", { id: space.id });
          run("tab.new", { space: space.id, folder, argv });
        } else run("space.new", { folder, argv });
      } catch (e) {
        if (!this.closed) notify({ title: "Couldn't resume conversation", body: String(e?.message ?? e), level: "error" });
      } finally {
        this.busy = null;
        if (!this.closed) cx.notify();
      }
    });
    cx.notify();
  }

  primary(cx) {
    const s = this.current();
    if (s) this.resume(s, openAt(s.cwd), cx);
  }

  button(id, label, primary, action, tip) {
    const t = theme();
    return h_flex().id(id).h(28).px(12).flex_none().items_center().rounded(7).border_1()
      .border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12).font_medium().cursor_pointer()
      .hover((st) => st.opacity(0.88)).when(Boolean(tip), (el) => el.tooltip(tip)).on_click(action).child(label);
  }

  // The selected conversation's action, outside the list: its rows can't hold handlers.
  actions() {
    const t = theme();
    const s = this.current();
    if (!s) return null;
    if (this.busy === s.path) return div().flex_none().text_size(12).text_color(t.dim).child("Checking…");
    const space = openAt(s.cwd);
    const tip = space
      ? "Open a new tab in " + space.name + " with pi --session " + s.path + ". If that workspace is already running this conversation, two Pi sessions will write to the same file."
      : "Open a new workspace with pi --session " + s.path;
    return this.button("resume", "Resume", true, (_e, cx) => this.resume(s, openAt(s.cwd), cx), tip);
  }

  status(rows) {
    const out = [];
    if (this.listError && this.sessions?.length) out.push("couldn't load: " + this.listError);
    if (this.cut === "time") out.push("listing stopped after 20 s");
    else if (this.cut === "size") out.push("list too long, search to find older ones");
    else if (this.more) out.push("older ones not loaded");
    if (this.unreadable) out.push(this.unreadable + " unreadable");
    const r = this.results;
    const q = words(this.query).join(" ");
    if (q && (this.searching || this.wanted !== q || r?.query !== q)) out.push("searching conversation text…");
    else if (q && r?.error) out.push("text search failed: " + r.error);
    else if (q && r?.truncated === "time") out.push("text search stopped after 20 s (" + r.scanned + " of " + r.total + " newest searched)");
    else if (q && r?.truncated === "limit") out.push("first " + r.hits.size + " text matches");
    if (q && r?.query === q && r.skipped) out.push(r.skipped + " oversized messages skipped");
    return rows.length + (this.sessions ? " of " + this.sessions.length : "") + " conversations" + (out.length ? " · " + out.join(" · ") : "");
  }

  render() {
    const t = theme();
    const rows = this.rows();
    const row = (s) => {
      const on = s.path === this.selected;
      s.tip ??= preview(s);
      return h_flex().id("row-" + s.path).h(ROW).px(10).gap(14).items_center().rounded(7).cursor_pointer().text_size(11.5)
        .when(on, (el) => el.bg(t.selected)).when(!on, (el) => el.hover((st) => st.bg(t.hover)))
        .child(div().id("title-" + s.path).flex_1().min_w(0).truncate().text_size(13).font_medium().text_color(t.foreground).tooltip(s.tip).child(titleOf(s)))
        .child(div().id("cwd-" + s.path).max_w(FOLDER).min_w(0).truncate().text_color(t.muted).tooltip(s.cwd || "no folder recorded").child(place(s.cwd, this.scope)))
        .child(h_flex().id("meta-" + s.path).flex_none().gap(8).text_color(t.dim).tooltip(s.tip)
          .child(div().w(66).text_right().child(when(s.modified)))
          .child(div().w(56).text_right().child(s.messages + (s.messages === 1 ? " msg" : " msgs"))));
    };
    const empty = this.listError ? "Couldn't read Pi conversations: " + this.listError
      : !this.sessions ? "Loading conversations…"
      : !this.sessions.length ? "No saved Pi conversations in " + this.scope.label + " yet."
      : this.searching || this.results?.query !== words(this.query).join(" ") ? "Searching…" : "No conversations match.";
    const status = this.status(rows);
    return v_flex().id("history").track_focus(this.handle).size_full().min_h(0).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") closeOverlay(props().overlay);
        else if (e.key === "down" || e.key === "up") this.move(e.key === "down" ? 1 : -1, cx);
        else if (e.key === "pagedown" || e.key === "pageup") this.move(e.key === "pagedown" ? 8 : -8, cx);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().flex_none().px(16).pt(14).pb(10).gap(10).items_center()
        .child(h_flex().id("scope").flex_none().max_w(260).gap(6).items_baseline().tooltip(this.scope.folder)
          .child(div().flex_none().text_size(15).font_semibold().text_color(t.foreground).child("History"))
          .child(div().min_w(0).truncate().text_size(13).text_color(t.muted).child(this.scope.label)))
        .child(h_flex().flex_1().h(34).px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(svg(ICONS + "/search.svg").size(15).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground)))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(div().id("list").relative().flex_1().min_h(0).p(6).border_t(1).border_color(t.border)
        .when(!rows.length, (el) => el.child(v_flex().p(10).gap(8).text_color(t.dim).child(empty)
          .when(Boolean(this.listError), (el) => el.child(h_flex().child(this.button("retry", "Retry", false, (_e, cx) => this.load(cx)))))))
        .when(rows.length > 0, (el) => el
          .child(v_virtual_list("history-rows", rows.length, ROW, (i) => rows[i].path,
            (range) => rows.slice(range.start, range.end).map(row))
            .on_item_click((key, cx) => { this.select(key); cx.notify(); }).track_scroll(this.scroll).size_full())
          .child(Scrollbar.vertical("history-rows").absolute().inset_0())))
      .child(h_flex().flex_none().min_h(40).px(12).py(6).gap(10).items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(div().id("status").flex_1().min_w(0).truncate().tooltip(status).child(status))
        .when(Boolean(this.more) && !this.cut && !words(this.query).length, (el) => el.child(div().id("older").flex_none().px(8).h(24).flex().items_center().rounded(6)
          .text_color(t.muted).cursor_pointer().hover((st) => st.bg(t.hover))
          .on_click((_e, cx) => this.load(cx, this.count + PAGE)).child(this.loading ? "Loading…" : "Load older")))
        .when(Boolean(this.current()), (el) => el.child(this.actions())));
  }
}
