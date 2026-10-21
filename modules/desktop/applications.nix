{
  config,
  lib,
  pkgs,
  ...
}:

let
  chatgpt = pkgs.chatgpt.overrideAttrs (previous: {
    preFixup = (previous.preFixup or "") + ''
      gappsWrapperArgs+=(--set NIXOS_OZONE_WL 1)
    '';
  });
  spotify = pkgs.spotify.overrideAttrs (previous: {
    preFixup = (previous.preFixup or "") + ''
      gappsWrapperArgs+=(--set NIXOS_OZONE_WL 1)
    '';
  });
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
  home.sessionVariables.PROTON_PASS_LINUX_KEYRING = "dbus";
  home.packages = with pkgs; [
    chatgpt
    proton-pass-cli
    seahorse
    spotify
    slack
    file-roller
    xfce4-settings
  ];

  programs.ghostty = {
    enable = true;
    settings = {
      async-backend = "epoll";
      gtk-single-instance = true;
      quit-after-last-window-closed = false;
      confirm-close-surface = false;
      window-padding-x = 10;
      window-padding-y = 5;
      window-decoration = "none";
      resize-overlay = "never";
      copy-on-select = "clipboard";
      app-notifications = "no-clipboard-copy";
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
    commandLineArgs = [ "--disable-features=WebUIOmniboxDynamicAiModeButton" ];
  };
  xdg.desktopEntries.todoist = {
    name = "Todoist";
    exec = "${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --app=https://app.todoist.com/app/today";
    icon = "todoist";
    categories = [ "Office" ];
    terminal = false;
  };
  programs.mangohud.enable = true;
  programs.zed-editor = {
    enable = true;
    userSettings = builtins.fromJSON (builtins.readFile ./zed.json);
    userKeymaps = [
      {
        context = "Editor && mode == full";
        bindings."ctrl-shift-s" = [
          "task::Spawn"
          { task_name = "Generate Commit and Push"; }
        ];
      }
      {
        context = "Workspace || Terminal";
        bindings."ctrl-shift-a" = [
          "task::Spawn"
          { task_name = "pi"; }
        ];
      }
      {
        context = "Editor";
        bindings = {
          "ctrl-ç" = [
            "editor::ToggleComments"
            { advance_downwards = false; }
          ];
          "ctrl-shift-up" = "editor::MoveLineUp";
          "ctrl-shift-down" = "editor::MoveLineDown";
        };
      }
      {
        context = "Workspace || Terminal";
        bindings."ctrl-_" = [
          "task::Spawn"
          { task_name = "Open External Terminal"; }
        ];
      }
    ];
    userTasks = [
      {
        label = "Generate Commit and Push";
        command = lib.getExe config.programs.pi-coding-agent.package;
        args = [
          "--thinking"
          "low"
          "--print"
          "\"split work into atomic commits and push\""
        ];
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "no_focus";
        hide = "on_success";
        use_new_terminal = false;
        allow_concurrent_runs = false;
        show_summary = false;
        show_command = false;
        save = "all";
      }
      {
        label = "pi";
        command = lib.getExe config.programs.ghostty.package;
        args = [
          "+new-window"
          "-e"
          (lib.getExe config.programs.pi-coding-agent.package)
        ];
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "never";
        hide = "on_success";
        show_summary = false;
        show_command = false;
      }
      {
        label = "Open External Terminal";
        command = lib.getExe config.programs.ghostty.package;
        args = [ "+new-window" ];
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "never";
        hide = "on_success";
        show_summary = false;
        show_command = false;
      }
    ];
  };

  xdg.mimeApps = {
    enable = true;
    defaultApplications = {
      "inode/directory" = "thunar.desktop";
      "text/html" = "google-chrome.desktop";
      "application/xhtml+xml" = "google-chrome.desktop";
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

  xdg.configFile."chrome/extension/manifest.json".text = builtins.toJSON {
    manifest_version = 3;
    name = "Chrome Warm";
    version = "1.0.0";
    permissions = [ "background" ];
  };

  systemd.user.services.chrome-background = {
    Unit = {
      Description = "Google Chrome background mode";
      X-SwitchMethod = "keep-old";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${waitForNetwork} https://www.google.com ${config.programs.google-chrome.finalPackage}/bin/google-chrome-stable --no-startup-window";
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };

  systemd.user.services.spotify = {
    Unit = {
      Description = "Spotify background mode";
      X-SwitchMethod = "keep-old";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${waitForNetwork} https://open.spotify.com ${spotify}/bin/spotify";
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };

  systemd.user.services.slack = {
    Unit = {
      Description = "Slack background mode";
      X-SwitchMethod = "keep-old";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${waitForNetwork} https://slack.com ${pkgs.slack}/bin/slack --startup";
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };

  systemd.user.services.chatgpt = {
    Unit = {
      Description = "ChatGPT background mode";
      X-SwitchMethod = "keep-old";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${waitForNetwork} https://chatgpt.com ${chatgpt}/bin/chatgpt";
      Environment = [ "CODEX_ELECTRON_START_IN_BACKGROUND=1" ];
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };
  xdg.dataFile."icons/hicolor/32x32/apps/chatgpt.png".source =
    pkgs.runCommand "chatgpt-icon.png" { nativeBuildInputs = [ pkgs.imagemagick ]; }
      ''
        magick ${pkgs.chatgpt}/share/pixmaps/chatgpt.png -resize 32x32 "$out"
      '';

}
