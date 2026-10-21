{
  config,
  lib,
  pkgs,
  ...
}:

let
  inherit (config.gtk) font;
  palette =
    (lib.importJSON "${config.catppuccin.sources.palette}/palette.json")
    .${config.catppuccin.flavor}.colors;
  qtSettings = {
    Appearance.icon_theme = config.gtk.iconTheme.name;
    Fonts = {
      general = "\"${font.name},${toString font.size}\"";
      fixed = "\"JetBrains Mono,11\"";
    };
  };
in
{
  programs.fuzzel = {
    enable = true;
    settings = {
      main = {
        font = "${font.name}:size=${toString (font.size + 1)}";
        icon-theme = config.gtk.iconTheme.name;
        terminal = "${lib.getExe config.programs.ghostty.package} +new-window -e";
        launch-prefix = "${pkgs.uwsm}/bin/uwsm app --";
        lines = 10;
        minimal-lines = true;
        width = 56;
        line-height = 24;
        image-size-ratio = 0;
        horizontal-pad = 20;
        vertical-pad = 20;
        inner-pad = 10;
      };
      border = {
        radius = 8;
        width = 1;
        selection-radius = 4;
      };
      colors = lib.mapAttrs (_: color: "${lib.removePrefix "#" color.hex}ff") {
        background = palette.base;
        text = palette.text;
        prompt = palette.subtext1;
        placeholder = palette.overlay1;
        input = palette.text;
        match = palette.${config.catppuccin.accent};
        selection = palette.surface2;
        selection-text = palette.text;
        selection-match = palette.${config.catppuccin.accent};
        counter = palette.overlay1;
        border = palette.${config.catppuccin.accent};
      };
    };
  };

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
        disable-scroll = true;
        show-special = true;
        special-visible-only = true;
      };
      "hyprland/submap" = {
        format = "󰘳 {}";
        tooltip = false;
      };
      "custom/voxtype" = {
        exec = "${lib.getExe config.services.voxtype.package} status --follow --format json --icon-theme nerd-font";
        return-type = "json";
        format = "{}";
        tooltip-format = "Dictado · Super+Shift+O";
      };
      clock = {
        format = "{:%a %d %b  %H:%M}";
        tooltip-format = "{:%A, %d %B %Y}\n\n<tt>{calendar}</tt>";
        calendar = {
          mode = "month";
          first-day-of-week = 1;
          format.today = "<span color='${palette.${config.catppuccin.accent}.hex}'><b><u>{}</u></b></span>";
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
      #mpris, #custom-voxtype, #wireplumber, #tray-expander, #clock {
        background: @surface0;
        border-radius: 4px;
        color: @subtext0;
      }
      #custom-voxtype, #wireplumber, #tray-expander { margin-right: 4px; }
      #custom-voxtype, #wireplumber, #custom-expand-icon, #tray { padding: 0 8px; }
      #custom-voxtype.recording { color: @red; }
      #custom-voxtype.transcribing { color: @yellow; }
      #mpris { margin: 4px 12px; padding: 0 10px; }
      #mpris.paused { color: @overlay1; }
      #clock { padding: 0 10px; color: @text; }
      #mpris:hover, #wireplumber:hover, #tray-expander:hover, #clock:hover { color: @accent; }
      #custom-expand-icon {
        font-size: 10px;
        min-width: 10px;
      }
      #submap { background: @mauve; color: @base; padding: 0 12px; }
      #wireplumber.muted { color: @subtext0; }
    '';
  };

  catppuccin = {
    enable = true;
    autoEnable = false;
    flavor = "frappe";
    accent = "mauve";
    sources.cursors = pkgs.catppuccin-cursors;
    gtk.icon.enable = true;
    cursors = {
      enable = true;
      accent = "light";
    };
    ghostty.enable = true;
    zed.enable = true;
    starship.enable = true;
    kvantum.enable = true;
    mako.enable = true;
    waybar.enable = true;
  };

  home.pointerCursor = {
    enable = true;
    size = 24;
    gtk.enable = true;
    x11.enable = true;
    hyprcursor.enable = true;
  };
  gtk = {
    enable = true;
    gtk3.bookmarks = map (dir: "file://${dir}") (
      with config.xdg.userDirs;
      [
        documents
        download
        music
        pictures
        videos
        projects
        publicShare
        templates
      ]
    );
    colorScheme = "dark";
    theme = {
      name = "catppuccin-${config.catppuccin.flavor}-${config.catppuccin.accent}-standard";
      package = pkgs.catppuccin-gtk.override {
        variant = config.catppuccin.flavor;
        accents = [ config.catppuccin.accent ];
      };
    };
    gtk4.extraCss = ''
      @import url("${config.gtk.theme.package}/share/themes/${config.gtk.theme.name}/gtk-4.0/gtk.css");
    '';
    font = {
      name = "Inter";
      size = 11;
    };
  };
  dconf.settings."org/gnome/desktop/interface".color-scheme = "prefer-dark";
  qt = {
    enable = true;
    platformTheme.name = "qtct";
    style.name = "kvantum";
    qt5ctSettings = qtSettings;
    qt6ctSettings = qtSettings;
  };

  services.mako = {
    enable = true;
    settings = {
      anchor = "top-right";
      font = "${font.name} ${toString font.size}";
      width = 360;
      margin = 12;
      padding = "14,16";
      border-size = 1;
      border-radius = 8;
      max-icon-size = 32;
      max-visible = 3;
      icon-path = lib.concatStringsSep ":" [
        "${config.gtk.iconTheme.package}/share/icons/${config.gtk.iconTheme.name}"
        "${config.gtk.iconTheme.package}/share/icons/Papirus"
        "${config.xdg.dataHome}/icons/hicolor"
      ];
      default-timeout = 7500;
      "urgency=critical" = {
        border-color = palette.red.hex;
        default-timeout = 0;
        ignore-timeout = true;
      };
    };
  };

}
