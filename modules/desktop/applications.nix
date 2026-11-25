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
  flakePackages = inputs.self.packages.${pkgs.stdenv.hostPlatform.system};
  grokBot = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.grok-bot;
  t3code = config.programs.t3code.package;
  parkedAppLauncher =
    {
      name,
      workspace,
      service,
      executable,
    }:
    pkgs.writeShellApplication {
      inherit name;
      runtimeInputs = with pkgs; [
        coreutils
        hyprland
        systemd
      ];
      text = ''
        for ((attempt = 0; attempt < 300; attempt++)); do
          if hyprctl eval 'show_parked_app("${workspace}")' >/dev/null 2>&1; then
            if (( $# > 0 )); then
              exec ${executable} "$@"
            fi
            exit 0
          fi
          if (( attempt == 0 )); then
            systemctl --user start ${service}.service
          fi
          sleep 0.1
        done
        echo 'Window did not appear; check journalctl --user -u ${service}.service.' >&2
        exit 1
      '';
    };
  grokBotLauncher = parkedAppLauncher {
    name = "grok-bot-show";
    workspace = "grok";
    service = "grok-bot";
    executable = lib.getExe grokBot;
  };
  t3codeLauncher = parkedAppLauncher {
    name = "t3code-desktop";
    workspace = "t3code";
    service = "t3code";
    executable = "${t3code.desktop}/bin/t3code-desktop";
  };
  t3codeNewThread = pkgs.writeShellApplication {
    name = "t3code-new-thread";
    runtimeInputs = [ pkgs.hyprland ];
    text = ''
      ${lib.getExe t3codeLauncher}
      hyprctl eval 'hl.dispatch(hl.dsp.send_shortcut({ mods = "CTRL ALT", key = "N" }))'
    '';
  };
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
in
{
  home.sessionVariables = {
    GOG_KEYRING_SERVICE_NAME = "Default_Keyring";
    PROTON_PASS_LINUX_KEYRING = "dbus";
  };
  home.packages = with pkgs; [
    agent-browser
    chatgpt
    gogcli
    todoist-cli
    inputs.nix-openclaw-tools.packages.${pkgs.stdenv.hostPlatform.system}.wacli
    grokBot
    proton-pass-cli
    seahorse
    (callPackage ./signal-desktop.nix { inherit (config.catppuccin) flavor; })
    spotify
    slack
    flakePackages.slacrawl
    t3code.desktop
    (lib.hiPrio t3codeLauncher)
    t3codeNewThread
    file-roller
    xfce4-settings
  ];

  programs.t3code = {
    keybindings = [
      {
        key = "ctrl+tab";
        command = "thread.next";
      }
      {
        key = "ctrl+shift+tab";
        command = "thread.previous";
      }
    ];
  };

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
  xdg.desktopEntries.grok-bot = {
    name = "Grok Bot";
    exec = "${lib.getExe grokBotLauncher} %U";
    icon = "grok-bot";
    categories = [ "Development" ];
    mimeType = [
      "x-scheme-handler/grokbot"
      "x-scheme-handler/sand"
    ];
    settings.StartupWMClass = "grok-bot";
  };

  xdg.desktopEntries.t3code = {
    name = "T3 Code (Beta)";
    exec = "${lib.getExe t3codeLauncher} %U";
    icon = "t3code";
    comment = "Control surface for coding agents";
    categories = [ "Development" ];
    mimeType = [ "x-scheme-handler/t3code" ];
    settings.StartupWMClass = "com.t3tools.T3Code";
  };

  xdg.desktopEntries.todoist = {
    name = "Todoist";
    exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --app=https://app.todoist.com/app/today";
    icon = "todoist";
    categories = [ "Office" ];
  };
  xdg.desktopEntries.whatsapp = {
    name = "WhatsApp";
    exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --app=https://web.whatsapp.com/";
    icon = "whatsapp";
    categories = [
      "Network"
      "InstantMessaging"
    ];
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
      "x-scheme-handler/grokbot" = "grok-bot.desktop";
      "x-scheme-handler/http" = "google-chrome.desktop";
      "x-scheme-handler/https" = "google-chrome.desktop";
      "x-scheme-handler/mailto" = "google-chrome.desktop";
      "x-scheme-handler/sand" = "grok-bot.desktop";
      "x-scheme-handler/t3code" = "t3code.desktop";
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
        grok-bot = {
          name = "Grok Bot";
          exec = lib.getExe grokBot;
          service.Restart = "always";
        };
        t3code = {
          name = "T3 Code";
          exec = "${t3code.desktop}/bin/t3code-desktop";
          env = [ "T3CODE_CLOUDFLARED_PATH=${lib.getExe pkgs.cloudflared}" ];
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
      };
  xdg.dataFile."icons/hicolor/32x32/apps/chatgpt.png".source =
    pkgs.runCommand "chatgpt-icon.png" { nativeBuildInputs = [ pkgs.imagemagick ]; }
      ''
        magick ${pkgs.chatgpt}/share/pixmaps/chatgpt.png -resize 32x32 "$out"
      '';

}
