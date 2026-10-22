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
  paseo-desktop = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.paseo-desktop;
  paseo = pkgs.writeShellScriptBin "paseo" ''
    exec ${pkgs.nodejs_22}/bin/node --disable-warning=DEP0040 \
      ${paseo-desktop}/share/paseo-desktop/packages/cli/dist/index.js "$@"
  '';
  chatgpt = withOzone pkgs.chatgpt;
  spotify = withOzone pkgs.spotify;
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
    paseo-desktop
    paseo
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
          ExecStart = "${waitForNetwork} ${app.url} ${app.exec}";
          Environment = app.env or [ ];
          Restart = "on-failure";
          RestartSec = 2;
        };
        Install.WantedBy = [ "graphical-session.target" ];
      })
      {
        chrome-background = {
          name = "Google Chrome";
          url = "https://www.google.com";
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
          url = "https://chatgpt.com";
          exec = "${chatgpt}/bin/chatgpt";
          env = [ "CODEX_ELECTRON_START_IN_BACKGROUND=1" ];
        };
      };
  xdg.dataFile."icons/hicolor/32x32/apps/chatgpt.png".source =
    pkgs.runCommand "chatgpt-icon.png" { nativeBuildInputs = [ pkgs.imagemagick ]; }
      ''
        magick ${pkgs.chatgpt}/share/pixmaps/chatgpt.png -resize 32x32 "$out"
      '';

}
