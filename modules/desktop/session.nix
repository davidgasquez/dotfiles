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
  lock = pkgs.writeShellApplication {
    name = "lock-session";
    runtimeInputs = with pkgs; [
      coreutils
      findutils
    ];
    text = ''
      read -r -d "" wallpaper < <(
        find ${lib.escapeShellArg "${config.home.homeDirectory}/Pictures/Wallpapers"} -type f \
          \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' \) \
          -print0 2>/dev/null | shuf -z -n 1
      ) || wallpaper=""
      export HYPRLOCK_WALLPAPER="$wallpaper"
      exec ${lib.getExe config.programs.hyprlock.package}
    '';
  };
in
{
  home.packages = with pkgs; [
    playerctl
    brightnessctl
    wl-clipboard
    pavucontrol
    (writeShellApplication {
      name = "open-project";
      runtimeInputs = [
        config.programs.fuzzel.package
        config.programs.zed-editor.package
        findutils
        coreutils
      ];
      text = ''
        [ -d "$HOME/projects" ] || exit 0
        project=$(find -L "$HOME/projects" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' \
          | sort \
          | while IFS= read -r name; do
              printf '%s\0icon\x1ffolder-development\n' "$name"
            done \
          | fuzzel --dmenu --only-match --no-run-if-empty \
              --prompt='Proyectos › ' --placeholder='Abrir en Zed') || exit 0
        [ -n "$project" ] || exit 0
        exec zeditor --new -- "$HOME/projects/$project"
      '';
    })
    (writeShellApplication {
      name = "clipboard-history";
      runtimeInputs = [
        config.services.cliphist.package
        config.programs.fuzzel.package
        wl-clipboard
        coreutils
      ];
      text = ''
        prompt='Clipboard > '
        if [ "''${1:-}" = --delete ]; then
          prompt='Delete clipboard > '
        fi
        selection=$(cliphist list | fuzzel --dmenu --with-nth=2 --only-match --no-run-if-empty --prompt="$prompt") || exit 0
        [ -n "$selection" ] || exit 0
        if [ "''${1:-}" = --delete ]; then
          printf '%s\n' "$selection" | cliphist delete
          exit 0
        fi
        umask 077
        content=$(mktemp)
        trap 'rm -f "$content"' EXIT
        printf '%s\n' "$selection" | cliphist decode > "$content"
        wl-copy < "$content"
      '';
    })
  ];

  programs.hyprshot = {
    enable = true;
    saveLocation = "${config.home.homeDirectory}/Pictures/Screenshots";
  };

  xdg.configFile."uwsm/env".source =
    "${config.home.sessionVariablesPackage}/etc/profile.d/hm-session-vars.sh";

  xdg.userDirs = {
    enable = true;
    createDirectories = true;
    projects = "${config.home.homeDirectory}/projects";
  };

  services.voxtype = {
    enable = true;
    package = pkgs.voxtype-vulkan;
    loadModels = [ "large-v3-turbo" ];
    settings = {
      audio.feedback.enabled = true;
      hotkey.enabled = false;
      osd.enabled = false;
      output.notification = {
        on_recording_start = false;
        on_recording_stop = true;
      };
      whisper = {
        model = "large-v3-turbo";
        language = "auto";
        translate = false;
      };
    };
  };

  services.hyprpolkitagent.enable = true;
  programs.hyprlock = {
    enable = true;
    settings = {
      general.hide_cursor = true;
      background = [
        {
          path = "$HYPRLOCK_WALLPAPER";
          color = "rgb(${lib.removePrefix "#" palette.crust.hex})";
        }
      ];
      input-field = [
        {
          size = "640, 80";
          position = "0, -120";
          outline_thickness = 0;
          inner_color = "rgba(00000000)";
          check_color = "rgba(00000000)";
          fail_color = "rgba(00000000)";
          font_color = "rgb(${lib.removePrefix "#" palette.${config.catppuccin.accent}.hex})";
          font_family = font.name;
          dots_size = 0.7;
          dots_spacing = 0.3;
          placeholder_text = "";
          fail_text = ''<span foreground="${palette.red.hex}" size="57pt">!</span>'';
          fade_on_empty = false;
        }
      ];
    };
  };
  services.hypridle = {
    enable = true;
    settings.general = {
      lock_cmd = "${pkgs.procps}/bin/pidof hyprlock || ${lib.getExe lock}";
      before_sleep_cmd = "${pkgs.systemd}/bin/loginctl lock-session";
      after_sleep_cmd = "hyprctl dispatch 'hl.dsp.dpms({ action = \"enable\" })'";
      inhibit_sleep = 3;
      ignore_wayland_inhibit = true;
    };
    settings.listener = [
      {
        timeout = 1200;
        on-timeout = "${pkgs.systemd}/bin/loginctl lock-session";
      }
    ];
  };
  services.wl-clip-persist.enable = true;
  services.cliphist = {
    enable = true;
    extraOptions = [
      "-max-items"
      "500"
      "-max-dedupe-search"
      "500"
    ];
  };
  systemd.user.services.cliphist.Service.UMask = "0077";
  systemd.user.services.cliphist-images.Service.UMask = "0077";
  wayland.windowManager.hyprland = {
    enable = true;
    package = null;
    portalPackage = null;
    systemd.enable = false;
    configType = "lua";
    extraConfig = builtins.readFile ./hyprland.lua;
  };
}
