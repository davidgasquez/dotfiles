// A live conversation's context menu, opened as a popup by any agents list:
// openOverlay({ mod: "conversation-menu", kind: "popup", width: 260, props: { target: { terminal, title } } }).
// Every action uses target.terminal, the right-clicked conversation, never the focused one.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, run, notify, theme, shared, setShared, props, closeOverlay } from "herdr";
import { forkState, forkConversation } from "./pi-fork.js";

const icon = (name) => `mods/workspace-chrome/${name}.svg`;
const FORK_HINT = "Opens Pi's message picker in this conversation. Picking a message continues from there in a new session, in place; the original stays saved (/resume). Picking a message replaces any unsent draft. Esc cancels and keeps the draft.";

export default class ConversationMenu extends View {
  init(_props, cx) {
    this.at = Math.max(0, this.items().findIndex((item) => item.enabled));
    this.focus = cx.focus_handle();
    this.focus.focus();
  }

  target() {
    return props()?.target ?? {};
  }

  items() {
    const { terminal: address, title } = this.target();
    const agent = address && agents().find((a) => a.address === address);
    const term = agent && terminals().find((t) => t.address === address && t.state === "live");
    if (!agent || !term) return [];
    const machine = address.includes("/") ? address.split("/")[0] : "Local";
    const cwd = panes().find((p) => p.terminal === address)?.cwd || term.cwd || "";
    const reference = [
      `Conversation: ${(title || agent.title || address).replace(/\s+/g, " ")}`,
      `Machine: ${machine}`,
      cwd && `Project: ${cwd}`,
      `Live terminal: ${address}`,
    ].filter(Boolean).join("\n");
    const copy = (id, label, value, glyph) => ({ id, label, icon: icon(glyph), enabled: Boolean(value),
      action: (cx) => cx.write_to_clipboard(value) });
    const fork = forkState(address);
    const pinned = (shared("agents.pins") ?? []).includes(address);
    return [
      { id: "open", label: "Open conversation", icon: icon("terminal"), enabled: true,
        action: () => run("agent.focus", { terminal: address }) },
      ...(fork.pi ? [{ id: "fork", label: this.forking ? "Opening fork picker…" : "Fork conversation…",
        icon: icon("git-branch"), enabled: fork.ok && !this.forking, hint: fork.ok ? FORK_HINT : fork.why }] : []),
      copy("reference", "Copy conversation reference", reference, "layers"),
      copy("address", "Copy terminal address", address, "terminal"),
      copy("project", "Copy project path", cwd, "folder"),
      { id: "pin", label: pinned ? "Unpin conversation" : "Pin conversation", icon: icon(pinned ? "pin-off" : "pin"), enabled: true,
        action: () => {
          const pins = shared("agents.pins") ?? [];
          setShared("agents.pins", pins.includes(address) ? pins.filter((a) => a !== address) : [...pins, address]);
        } },
    ];
  }

  choose(index, cx) {
    const item = this.items()[index];
    if (!item?.enabled) return;
    const overlay = props()?.overlay;
    if (item.id === "fork") {
      // Stays open until the key is in, so a failure can still be told.
      const address = this.target().terminal;
      this.forking = true;
      cx.notify();
      cx.spawn(async (cx) => {
        try { await forkConversation(address); }
        catch (e) { notify({ title: "Couldn't fork conversation", body: String(e?.message ?? e), level: "error" }); }
        this.forking = false;
        closeOverlay(overlay);
      });
      return;
    }
    try { item.action(cx); }
    catch (e) { notify({ title: "Conversation action failed", body: String(e?.message ?? e), level: "error" }); }
    closeOverlay(overlay);
  }

  render() {
    const t = theme(), items = this.items(), dividers = new Set(["reference", "pin"]);
    return v_flex().id("conversation-menu").w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .track_focus(this.focus)
      .on_key_down((e, cx) => {
        if (e.key === "escape") closeOverlay(props()?.overlay);
        else if (e.key === "enter") this.choose(this.at, cx);
        else if ((e.key === "up" || e.key === "down") && items.some((item) => item.enabled)) {
          do this.at = (this.at + (e.key === "down" ? 1 : -1) + items.length) % items.length;
          while (!items[this.at].enabled);
        } else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).truncate().child(this.target().title || "Conversation"))
      .when(!items.length, (el) => el.child(div().px(8).py(8).text_color(t.dim).child("This conversation is no longer open.")))
      .children(items.map((item, i) => v_flex()
        .when(dividers.has(item.id), (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
        .child(h_flex().id(`conversation-menu-${item.id}`).h(31).px(8).gap(9).rounded(7).items_center()
          .role("button").accessibility_label(item.label).tooltip(item.hint || item.label)
          .text_color(item.enabled ? t.foreground : t.dim)
          .when(item.enabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).when(i === this.at, (el) => el.bg(t.selected)))
          .on_hover((on, cx) => { if (on && item.enabled && this.at !== i) { this.at = i; cx.notify(); } })
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => { cx.stop_propagation(); this.choose(i, cx); })
          .child(svg(item.icon).size(14).flex_none().text_color(t.muted))
          .child(div().flex_1().child(item.label)))));
  }
}
