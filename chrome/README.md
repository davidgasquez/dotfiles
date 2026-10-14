# Google Chrome

Run `make chrome` from the repository root to install Chrome, symlink the
extension, theme and user service, and enable background startup for future logins.

One-time setup in the Chrome profile you use:

1. Open `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**,
   and select `~/.config/chrome/extension` (or `$XDG_CONFIG_HOME/chrome/extension`).
   Accept Chrome's New Tab confirmation if shown.
2. To match Brave's colours, click **Load unpacked** again and select
   `~/.config/chrome/theme`. In `chrome://settings/appearance`, select **Dark** mode.
3. In `chrome://settings/system`, enable **Continue running background apps when
   Google Chrome is closed**. Keep graphics acceleration enabled.
4. Run `systemctl --user start chrome-background.service` to start it this session.

Launch windows with `google-chrome-stable --new-window`, and use Ctrl+T for tabs.
Closing the last window keeps Chrome resident; explicitly exiting Chrome quits
it. The service follows `graphical-session.target` and restarts on failure.

The extension combines Chrome's documented `background` permission with a local
blank New Tab page. It has no scripts, service worker, or site permissions.
Install it through Chrome's UI so it persists across restarts.

## Appearance

Brave currently uses a built-in custom-colour theme with seed `#8cabe4`.
The separate Slate Blue theme captures its generated dark palette: `#172030`
for the tab strip, `#333c4d` for the toolbar, and light text/icons. The blank
New Tab page uses the same toolbar colour. Chrome still computes some colours,
including the address-bar background, so this matches the main palette rather
than every Brave control. The theme contains only colour data and no code.

For a minimal UI, use `chrome://settings/appearance`:

- Turn off **Show home button** and **Show tab search button**. Hide the bookmarks
  bar, using **Always hide** if Chrome presents a visibility dropdown.
- Under **Customize your toolbar**, unpin optional actions and extension buttons;
  keep side panels closed.
- Turn off tab preview images and memory-usage hover cards if unwanted.
- On Hyprland, **Use system title bar and borders** lets the compositor handle
  window decorations, as in the current Brave setup. Hyprland's close/move
  bindings remain available.
- **Tab position** also offers native vertical tabs in the tested Chrome 155.
  Choose based on your tab workflow; this setup does not force either layout.

Ctrl+Shift+B toggles the bookmarks bar, Ctrl+L focuses the address bar, and F11
hides the browser chrome for reading. For a dedicated single-site window,
`google-chrome-stable --app=https://example.com` omits the tab strip and omnibox.
Themes cannot change toolbar geometry; Chrome's old Compact Mode was removed.
These UI choices are profile settings, not enterprise policies or startup flags.

Chrome already selects native Wayland and hardware acceleration on the tested
Hyprland/AMD setup. No experimental flags or RAM-backed profiles are required.

References: [background permission](https://developer.chrome.com/docs/extensions/reference/permissions-list),
[New Tab overrides](https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages),
[themes](https://developer.chrome.com/docs/extensions/develop/ui/themes),
[toolbar customization](https://support.google.com/chrome/answer/14835450?co=GENIE.Platform%3DDesktop&hl=en),
[Compact Mode removal](https://chromium.googlesource.com/chromium/src/+/2423efbcd682692f6cd3951cd5eca34223c52118%5E!/).
