{
  config,
  lib,
  pkgs,
  palette,
  accent,
  ...
}:

let
  inherit (config.gtk) font;
  recordingDirectory = "${config.xdg.userDirs.videos}/Recordings";
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
      name = "screen-record";
      runtimeInputs = [
        systemd
        util-linux
      ];
      text = ''
        exec 9>"$XDG_RUNTIME_DIR/screen-record.lock"
        flock -n 9 || exit 0
        if systemctl --user is-active --quiet screen-record.service; then
          systemctl --user stop screen-record.service
        else
          systemctl --user start screen-record.service
        fi
      '';
    })
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
              --prompt='~/projects › ' --placeholder='Open') || exit 0
        [ -n "$project" ] || exit 0
        exec zeditor --new -- "$HOME/projects/$project"
      '';
    })
    (writeShellApplication {
      name = "pi-scratch";
      runtimeInputs = [
        coreutils
        config.programs.ghostty.package
        config.programs.pi-coding-agent.package
      ];
      text = ''
        work_dir=$(mktemp -d -t pi-session.XXXXXX)
        exec ghostty +new-window --working-directory="$work_dir" -e pi \
          --session-dir "$HOME/.pi/agent/sessions/--tmp--"
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
        match = accent;
        selection = palette.surface2;
        selection-text = palette.text;
        selection-match = accent;
        counter = palette.overlay1;
        border = accent;
      };
    };
  };

  programs.hyprshot = {
    enable = true;
    saveLocation = "${config.home.homeDirectory}/Pictures/Screenshots";
  };

  systemd.user.services.screen-record = {
    Unit = {
      Description = "Record the focused monitor";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = lib.getExe (
        pkgs.writeShellApplication {
          name = "screen-record-start";
          runtimeInputs = with pkgs; [
            coreutils
            hyprland
            jq
            gpu-screen-recorder
          ];
          text = ''
            mkdir -p ${lib.escapeShellArg recordingDirectory}
            monitor=$(hyprctl monitors -j | jq -er '.[] | select(.focused) | .name')
            filename=${lib.escapeShellArg recordingDirectory}/recording-$(date +%Y-%m-%d_%H-%M-%S-%3N).mp4
            exec gpu-screen-recorder -w "$monitor" -k h264 -f 60 -fm cfr \
              -fallback-cpu-encoding yes -o "$filename"
          '';
        }
      );
      ExecStopPost = pkgs.writeShellScript "screen-record-notify" ''
        if [ "$SERVICE_RESULT" = success ]; then
          ${pkgs.libnotify}/bin/notify-send --app-name="Screen recording" \
            "Recording saved" ${lib.escapeShellArg recordingDirectory}
        else
          ${pkgs.libnotify}/bin/notify-send --app-name="Screen recording" --urgency=critical \
            "Screen recording failed" "See journalctl --user -u screen-record.service for details."
        fi
      '';
      KillSignal = "SIGINT";
      KillMode = "mixed";
      TimeoutStopSec = 15;
      UMask = "0077";
    };
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
          font_color = "rgb(${lib.removePrefix "#" accent.hex})";
          font_family = font.name;
          dots_size = 0.7;
          dots_spacing = 0.3;
          placeholder_text = "";
          fail_text = ''<span foreground="#${palette.red.hex}" size="57pt">!</span>'';
          fade_on_empty = false;
        }
      ];
    };
  };
  services.hypridle = {
    enable = true;
    settings.general = {
      lock_cmd = "${pkgs.procps}/bin/pidof hyprlock || ${lib.getExe lock}";
      on_lock_cmd = "${pkgs.systemd}/bin/systemctl --user restart lock-screen-off.timer";
      on_unlock_cmd = "${pkgs.systemd}/bin/systemctl --user stop lock-screen-off.timer lock-screen-off.service";
      before_sleep_cmd = "${pkgs.systemd}/bin/loginctl lock-session";
      after_sleep_cmd = "hyprctl dispatch 'hl.dsp.dpms({ action = \"enable\" })'";
      inhibit_sleep = 3;
    };
    settings.listener = [
      {
        timeout = 1200;
        on-timeout = "${pkgs.systemd}/bin/loginctl lock-session";
      }
    ];
  };
  systemd.user.timers.lock-screen-off = {
    Unit = {
      Description = "Turn off the display one hour after locking";
      PartOf = [ "graphical-session.target" ];
    };
    Timer = {
      OnActiveSec = "1h";
      AccuracySec = "1s";
    };
  };
  systemd.user.services.lock-screen-off = {
    Unit = {
      Description = "Turn off the locked display";
      PartOf = [ "graphical-session.target" ];
    };
    Service = {
      Type = "oneshot";
      ExecCondition = "${pkgs.procps}/bin/pidof hyprlock";
      ExecStart = "${pkgs.hyprland}/bin/hyprctl dispatch 'hl.dsp.dpms({ action = \"disable\" })'";
    };
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
    xdph.settings.screencopy.allow_token_by_default = true;
    configType = "lua";
    extraConfig = builtins.readFile ./hyprland.lua;
  };
}
