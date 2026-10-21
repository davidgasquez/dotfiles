{ palette, accent, ... }:

{
  programs.codex.settings.desktop = {
    "browser-family-enabled:chrome" = false;
    appearanceTheme = "dark";
    appearanceDarkCodeThemeId = "catppuccin";
    appearanceDarkChromeTheme = {
      accent = accent.hex;
      accentSource = "custom";
      contrast = 60;
      fonts = {
        ui = "Inter";
        content = "Inter";
        code = "JetBrains Mono";
      };
      ink = palette.text.hex;
      surface = palette.base.hex;
      opaqueWindows = true;
      semanticColors = {
        diffAdded = palette.green.hex;
        diffRemoved = palette.red.hex;
        skill = accent.hex;
      };
    };
    keepRemoteControlAwakeWhilePluggedIn = true;
    preventSleepWhileRunning = true;
    followUpQueueMode = "steer";
    show-context-window-usage = true;
    conversationDetailMode = "STEPS_COMMANDS";
    open-link-in-target-preference = "external-browser";
    open-local-url-in-target-preference = "external-browser";
  };
}
