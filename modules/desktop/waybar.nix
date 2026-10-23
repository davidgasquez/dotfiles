{
  config,
  lib,
  pkgs,
  accent,
  ...
}:

let
  inherit (config.gtk) font;
in
{
  programs.waybar = {
    enable = true;
    systemd.enable = true;
    settings.mainBar = {
      layer = "top";
      height = 32;
      modules-left = [
        "hyprland/workspaces"
        "hyprland/submap"
      ];
      modules-center = [ "mpris" ];
      modules-right = [
        "custom/voxtype"
        "wireplumber"
        "group/tray-expander"
        "clock"
      ];
      "hyprland/workspaces" = {
        show-special = true;
        special-visible-only = true;
      };
      "hyprland/submap" = {
        format = "󰘳 {}";
        tooltip = false;
      };
      "custom/voxtype" = {
        exec = "${lib.getExe config.services.voxtype.package} status --follow --format json --icon-theme nerd-font";
        restart-interval = 5;
        return-type = "json";
        format = "{}";
      };
      clock = {
        format = "{:%a %d %b  %H:%M}";
        tooltip-format = "{:%A, %d %B %Y}\n\n<tt>{calendar}</tt>";
        calendar = {
          mode = "month";
          iso8601 = true;
          format.today = "<span color='${accent.hex}'><b><u>{}</u></b></span>";
        };
      };
      mpris = {
        format = "{status_icon} {dynamic}";
        format-stopped = "";
        status-icons = {
          playing = "";
          paused = "";
        };
        dynamic-order = [
          "title"
          "artist"
        ];
        dynamic-len = 50;
        title-len = 50;
        max-length = 54;
        tooltip-format = "{title}\n{artist}\n\nLeft: play/pause · Right: next · Middle: previous";
      };
      wireplumber = {
        format = "{icon}";
        format-muted = "";
        tooltip-format = "Volume {volume}%";
        scroll-step = 2;
        format-icons = [
          ""
          ""
          ""
        ];
        on-click = "${pkgs.wireplumber}/bin/wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle";
        on-click-right = "${pkgs.uwsm}/bin/uwsm app -- ${pkgs.pavucontrol}/bin/pavucontrol";
      };
      "group/tray-expander" = {
        orientation = "inherit";
        drawer = {
          transition-duration = 300;
          children-class = "tray-group-item";
        };
        modules = [
          "custom/expand-icon"
          "tray"
        ];
      };
      "custom/expand-icon" = {
        format = "";
        tooltip = false;
      };
      tray = {
        icon-size = 16;
        spacing = 12;
      };
    };
    style = ''
      * {
        border: none;
        border-radius: 0;
        min-height: 0;
        font-family: "${font.name}", "Symbols Nerd Font Mono", sans-serif;
        font-size: 13px;
      }
      window#waybar {
        background: @crust;
        color: @text;
      }
      tooltip {
        background: @mantle;
        color: @text;
        border: 1px solid @surface0;
        border-radius: 8px;
      }
      #workspaces { margin: 4px 8px; }
      #workspaces button {
        padding: 0 10px;
        margin: 0 2px;
        border-radius: 4px;
        background: transparent;
        color: @subtext0;
        box-shadow: none;
        text-shadow: none;
      }
      #workspaces button:hover { background: @surface0; }
      #workspaces button.active { background: @surface0; color: @accent; }
      #workspaces button.urgent { background: @red; color: @base; }
      .modules-right { margin: 4px 10px 4px 0; }
      #mpris, #battery, #backlight, #custom-voxtype, #wireplumber, #tray-expander, #clock {
        background: @surface0;
        border-radius: 4px;
        color: @subtext0;
      }
      #battery, #backlight, #custom-voxtype, #wireplumber, #tray-expander { margin-right: 4px; }
      #battery, #backlight, #custom-voxtype, #wireplumber, #custom-expand-icon, #tray { padding: 0 8px; }
      #custom-voxtype.recording { color: @red; }
      #custom-voxtype.transcribing { color: @yellow; }
      #mpris { margin: 4px 12px; padding: 0 10px; }
      #mpris.paused { color: @overlay1; }
      #clock { padding: 0 10px; color: @text; }
      #mpris:hover, #battery:hover, #backlight:hover, #wireplumber:hover, #tray-expander:hover, #clock:hover { color: @accent; }
      #custom-expand-icon {
        font-size: 10px;
        min-width: 10px;
      }
      #submap { background: @mauve; color: @base; padding: 0 12px; }
      #wireplumber.muted { color: @subtext0; }
    '';
  };
}
