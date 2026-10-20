{ config, lib, ... }:

let
  palette =
    (lib.importJSON "${config.catppuccin.sources.palette}/palette.json")
    .${config.catppuccin.flavor}.colors;
in
{
  programs.codex.settings.desktop = {
    "browser-family-enabled:chrome" = false;
    appearanceTheme = "dark";
    appearanceDarkCodeThemeId = "catppuccin";
    appearanceDarkChromeTheme = {
      accent = palette.${config.catppuccin.accent}.hex;
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
        skill = palette.${config.catppuccin.accent}.hex;
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
