{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

let
  withOzone =
    pkg:
    pkg.overrideAttrs (previous: {
      preFixup = (previous.preFixup or "") + ''
        gappsWrapperArgs+=(--set NIXOS_OZONE_WL 1)
      '';
    });
  chatgpt = withOzone pkgs.chatgpt;
  spotify = withOzone pkgs.spotify;
  herdrApp = pkgs.callPackage ./herdr-app {
    package = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.herdr-app;
  };
  piChats = pkgs.writeShellScriptBin "pi-chats" ''
    exec ${lib.getExe pkgs.nodejs_24} ${./herdr-app/pi-chats/pi-chats.mjs} "$@"
  '';
  chromeWarm = pkgs.writeText "chrome-warm.json" (
    builtins.toJSON {
      external_crx = ./chrome-warm/extension.crx;
      external_version = (builtins.fromJSON (builtins.readFile ./chrome-warm/manifest.json)).version;
    }
  );
  waitForNetwork = pkgs.writeShellScript "wait-for-network" ''
    until ${pkgs.curl}/bin/curl --silent --head --output /dev/null \
      --connect-timeout 3 --max-time 5 "$1"; do
      ${pkgs.coreutils}/bin/sleep 2
    done
    shift
    exec "$@"
  '';
  closeChatgptStartup = pkgs.writeShellApplication {
    name = "close-chatgpt-startup";
    runtimeInputs = with pkgs; [
      coreutils
      hyprland
      jq
      systemd
    ];
    text = ''
      for ((attempt = 0; attempt < 300; attempt++)); do
        kill -0 "$MAINPID" 2>/dev/null || exit 0
        window=$(hyprctl clients -j | jq -r --argjson pid "$MAINPID" '
          [.[] | select(.pid == $pid and .class == "chatgpt" and .mapped and (.floating | not))]
          | .[0].address // empty
        ')
        items=$(busctl --user --json=short get-property \
          org.kde.StatusNotifierWatcher /StatusNotifierWatcher \
          org.kde.StatusNotifierWatcher RegisteredStatusNotifierItems 2>/dev/null) \
          || items='{"data":[]}'
        if [[ -n "$window" ]] && busctl --user --json=short list \
          | jq -e --argjson pid "$MAINPID" --argjson items "$items" '
              any(.[]; .pid == $pid and
                (.name as $name | any($items.data[]; startswith($name + "/"))))
            ' >/dev/null; then
          sleep 5
          if hyprctl clients -j | jq -e --argjson pid "$MAINPID" --arg window "$window" \
            'any(.[]; .pid == $pid and .address == $window and .mapped)' >/dev/null; then
            hyprctl dispatch "hl.dsp.window.close({window=\"address:$window\"})"
          fi
          exit 0
        fi
        sleep 0.1
      done
      echo "ChatGPT startup window or tray was not ready; leaving it visible." >&2
    '';
  };
in
{
  # Herdr reloads its layouts and keys live; keep them writable.
  home.activation.herdrAppConfig = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    run ${lib.getExe pkgs.rsync} \
      --recursive --checksum --perms --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
      ${./herdr-app/config}/ ${lib.escapeShellArg "${config.xdg.configHome}/herdr-app/"}
  '';

  home.activation.herdrAppKeys = lib.hm.dag.entryAfter [ "linkGeneration" ] (
    lib.hm.generators.mkImpureConfigMerger {
      inherit pkgs;
      format = "json";
      empty = "{}";
      jqOperation = ''
        $dynamic * $static
        | if .["mod:sandbox-palette"]["ctrl-n"] == "sandbox-palette.confirm"
          then del(.["mod:sandbox-palette"]["ctrl-n"])
          else .
          end
      '';
      path = "${config.xdg.configHome}/herdr-app/keys.json";
      staticSettings = (pkgs.formats.json { }).generate "herdr-app-keys.json" {
        "layout:sandbox" = {
          ctrl-alt-z = "sandbox-tabs.open_zed";
          ctrl-i = "sandbox-spaces.new_chat";
          ctrl-n = "sandbox-tabs.new_pi";
          ctrl-shift-p = "mod.open:sandbox-palette";
        };
      };
    }
  );

  home.sessionVariables = {
    GOG_KEYRING_SERVICE_NAME = "Default_Keyring";
    PROTON_PASS_LINUX_KEYRING = "dbus";
  };
  home.packages = with pkgs; [
    chatgpt
    gogcli
    herdrApp
    (writeShellApplication {
      name = "herdr-new-chat";
      runtimeInputs = [
        config.programs.fuzzel.package
        herdrApp
        uwsm
        hyprland
        coreutils
        findutils
      ];
      text = ''
        projects=()
        if [[ -d "$HOME/projects" ]]; then
          mapfile -t projects < <(find -L "$HOME/projects" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
        fi
        choice=$(
          {
            printf 'sandbox\0icon\x1ffolder-temp\n'
            for project in "''${projects[@]}"; do
              printf '%s\0icon\x1ffolder-development\n' "$project"
            done
          } | fuzzel --dmenu --index --only-match --no-run-if-empty \
            --prompt='~/projects › ' --placeholder='New Pi chat'
        ) || exit 0
        if [[ "$choice" != 0 ]]; then
          cd -- "$HOME/projects/''${projects[choice - 1]}"
        fi

        uwsm-app -- herdr-app &
        for ((attempt = 0; attempt < 50; attempt++)); do
          if herdr-app status >/dev/null 2>&1; then
            hyprctl dispatch 'hl.dsp.focus({ window = "class:^herdr-app$" })'
            if [[ "$choice" == 0 ]]; then
              exec herdr-app "do" sandbox-spaces.new_chat
            fi
            exec herdr-pi
          fi
          sleep 0.1
        done
        echo "Herdr did not become ready" >&2
        exit 1
      '';
    })
    (pkgs.writeShellScriptBin "herdr-pi" ''
      set -euo pipefail
      folder=$(${pkgs.coreutils}/bin/realpath -e -- "$PWD")
      spaces=$(${lib.getExe herdrApp} ls)
      space=$(${lib.getExe pkgs.jq} -r --arg folder "$folder" '
        [.spaces[] | select((.machine == null or .machine == "") and .folder == $folder)]
        | first | .id // empty
      ' <<< "$spaces")
      if [ -n "$space" ]; then
        exec ${lib.getExe herdrApp} do tab.new --space "$space" --name Pi --folder "$folder" \
          --argv '${builtins.toJSON [ (lib.getExe config.programs.pi-coding-agent.package) ]}'
      else
        exec ${lib.getExe herdrApp} do space.new \
          --name "$(${pkgs.coreutils}/bin/basename -- "$folder")" --folder "$folder" --machine "" \
          --tab Pi --argv '${builtins.toJSON [ (lib.getExe config.programs.pi-coding-agent.package) ]}'
      fi
    '')
    piChats
    proton-pass-cli
    seahorse
    (callPackage ./signal-desktop.nix { inherit (config.catppuccin) flavor; })
    spotify
    slack
    (callPackage ./slacrawl.nix { })
    file-roller
    xfce4-settings
  ];

  programs.ghostty = {
    enable = true;
    settings = {
      async-backend = "epoll";
      gtk-single-instance = true;
      linux-cgroup = "never";
      quit-after-last-window-closed = false;
      confirm-close-surface = false;
      window-padding-x = 10;
      window-padding-y = 5;
      window-decoration = "none";
      resize-overlay = "never";
      copy-on-select = "clipboard";
      app-notifications = "no-clipboard-copy";
      keybind = [ "ctrl+enter=unbind" ];
    };
  };
  xdg.configFile."xfce4/helpers.rc".text = ''
    TerminalEmulator=ghostty
  '';
  xdg.dataFile."xfce4/helpers/ghostty.desktop".text = ''
    [Desktop Entry]
    Version=1.0
    Type=X-XFCE-Helper
    Name=Ghostty
    Icon=com.mitchellh.ghostty
    StartupNotify=false
    X-XFCE-Category=TerminalEmulator
    X-XFCE-Commands=${lib.getExe config.programs.ghostty.package} +new-window;
    X-XFCE-CommandsWithParameter=${lib.getExe config.programs.ghostty.package} +new-window -e %s;
  '';
  programs.google-chrome = {
    enable = true;
    package = pkgs.google-chrome.overrideAttrs (previous: {
      postInstall = (previous.postInstall or "") + ''
        install -Dm644 ${chromeWarm} \
          $out/share/google/chrome/extensions/hldjjbpflihgcbcpfdnegkclidfmndfj.json
      '';
    });
    commandLineArgs = [ "--disable-features=WebUIOmniboxDynamicAiModeButton" ];
  };
  xdg.desktopEntries.todoist = {
    name = "Todoist";
    exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --app=https://app.todoist.com/app/today";
    icon = "todoist";
    categories = [ "Office" ];
    terminal = false;
  };
  xdg.desktopEntries.whatsapp = {
    name = "WhatsApp";
    exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --app=https://web.whatsapp.com/";
    icon = "whatsapp";
    categories = [
      "Network"
      "InstantMessaging"
    ];
    terminal = false;
  };
  programs.mangohud.enable = true;
  programs.mpv = {
    enable = true;
    config.hwdec = "auto";
  };

  xdg.mimeApps = {
    enable = true;
    defaultApplications = {
      "inode/directory" = "thunar.desktop";
      "text/html" = "google-chrome.desktop";
      "application/xhtml+xml" = "google-chrome.desktop";
      "video/mp4" = "mpv.desktop";
      "video/webm" = "mpv.desktop";
      "video/x-matroska" = "mpv.desktop";
      "x-scheme-handler/http" = "google-chrome.desktop";
      "x-scheme-handler/https" = "google-chrome.desktop";
      "x-scheme-handler/mailto" = "google-chrome.desktop";
    };
  };
  xdg.configFile."systemd/user/graphical-session.target.wants/app-com.mitchellh.ghostty.service".source =
    "${config.programs.ghostty.package}/share/systemd/user/app-com.mitchellh.ghostty.service";
  xdg.configFile."systemd/user/app-com.mitchellh.ghostty.service.d/startup.conf".text = ''
    [Service]
    Type=notify
    ExecReload=${pkgs.coreutils}/bin/kill -USR2 $MAINPID
  '';

  systemd.user.services =
    lib.mapAttrs
      (_: app: {
        Unit = {
          Description = "${app.name} background mode";
          X-SwitchMethod = "keep-old";
          PartOf = [ "graphical-session.target" ];
          After = [ "graphical-session.target" ];
          Requisite = [ "graphical-session.target" ];
        };
        Service = {
          Type = "exec";
          ExecStart = lib.optionalString (app ? url) "${waitForNetwork} ${app.url} " + app.exec;
          Environment = app.env or [ ];
          Restart = "on-failure";
          RestartSec = 2;
        }
        // (app.service or { });
        Install.WantedBy = [ "graphical-session.target" ];
      })
      {
        herdr-app = {
          name = "Herdr";
          exec = "${herdrApp}/bin/herdr-app";
          env = [ "HERDR_START_HIDDEN=1" ];
        };
        chrome-background = {
          name = "Google Chrome";
          exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --no-startup-window";
        };
        spotify = {
          name = "Spotify";
          url = "https://open.spotify.com";
          exec = "${spotify}/bin/spotify";
        };
        slack = {
          name = "Slack";
          url = "https://slack.com";
          exec = "${pkgs.slack}/bin/slack --startup";
        };
        chatgpt = {
          name = "ChatGPT";
          exec = "${chatgpt}/bin/chatgpt";
          env = [ "CODEX_ELECTRON_START_IN_BACKGROUND=1" ];
          service = {
            ExecStartPre = "${waitForNetwork} https://chatgpt.com ${pkgs.coreutils}/bin/true";
            ExecStartPost = "-${lib.getExe closeChatgptStartup}";
            TimeoutStartSec = "infinity";
          };
        };
      };
  xdg.dataFile."icons/hicolor/32x32/apps/chatgpt.png".source =
    pkgs.runCommand "chatgpt-icon.png" { nativeBuildInputs = [ pkgs.imagemagick ]; }
      ''
        magick ${pkgs.chatgpt}/share/pixmaps/chatgpt.png -resize 32x32 "$out"
      '';

}
