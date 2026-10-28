{
  config,
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
        };
        Install.WantedBy = [ "graphical-session.target" ];
      })
      {
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
