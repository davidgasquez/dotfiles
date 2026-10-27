{
  inputs,
  lib,
  pkgs,
  ...
}:

let
  session = "${pkgs.uwsm}/bin/uwsm start hyprland.desktop";
in
{
  imports = [
    ./boot.nix
    ./update.nix
  ];

  networking.networkmanager = {
    enable = true;
    dns = "systemd-resolved";
  };
  systemd.services.NetworkManager-wait-online.enable = false;
  services.resolved.enable = true;
  hardware.bluetooth.enable = true;
  console.keyMap = "es";
  users.users.david.extraGroups = [ "networkmanager" ];
  programs.nix-ld.enable = true;

  nixpkgs.config.allowUnfreePredicate =
    pkg:
    builtins.elem (lib.getName pkg) [
      "google-chrome"
      "chatgpt"
      "claude-code"
      "spotify"
      "slack"
      "steam"
      "steam-unwrapped"
    ];

  home-manager.sharedModules = [ inputs.catppuccin.homeModules.catppuccin ];
  home-manager.users.david.imports = [
    ./home.nix
    ./session.nix
    ./appearance.nix
    ./waybar.nix
    ./applications.nix
    ./zed.nix
    ./codex-desktop.nix
  ];

  programs.chromium = {
    enable = true;
    extensions = [
      "olhelnoplefjdmncknfphenjclimckaf"
      "clngdbkpkpeebahjckkjfobafhncgmne"
    ];
    extraOptsRecommended = {
      SearchSuggestEnabled = false;
      BookmarkBarEnabled = true;
      SpellCheckServiceEnabled = false;
      RegisteredProtocolHandlers = [
        {
          protocol = "mailto";
          url = "https://mail.google.com/mail/?extsrc=mailto&url=%s";
          default = true;
        }
      ];
    };
    extraOpts = {
      AIModeSettings = 1;
      SearchContentSharingSettings = 1;
      PromotionsEnabled = false;
      BrowserLabsEnabled = false;
      BackgroundModeEnabled = true;
    };
  };

  programs.steam = {
    enable = true;
    extraPackages = [ pkgs.gamescope ];
  };
  programs.gamescope.enable = true;

  environment.sessionVariables.GTK_IM_MODULE = "simple";

  programs.thunar = {
    enable = true;
    plugins = [ pkgs.thunar-archive-plugin ];
  };
  services.gvfs.enable = true;
  services.tumbler.enable = true;
  services.blueman.enable = true;
  programs.nm-applet.enable = true;

  fonts = {
    packages = with pkgs; [
      jetbrains-mono
      nerd-fonts.symbols-only
      noto-fonts
      inter
    ];
    fontconfig.defaultFonts = {
      monospace = [
        "JetBrains Mono"
        "Symbols Nerd Font Mono"
      ];
      sansSerif = [
        "Inter"
        "Noto Sans"
      ];
      serif = [ "Noto Serif" ];
    };
  };

  security.polkit.enablePkexecWrapper = true;
  security.rtkit.enable = true;
  services.pipewire = {
    enable = true;
    alsa.enable = true;
    pulse.enable = true;
  };
  services.gnome.gnome-keyring.enable = true;
  xdg.portal.config.hyprland = {
    default = [
      "hyprland"
      "gtk"
    ];
    "org.freedesktop.impl.portal.Secret" = [ "gnome-keyring" ];
  };

  programs.hyprland = {
    enable = true;
    withUWSM = true;
  };
  programs.hyprlock.enable = true;
  programs.gpu-screen-recorder.enable = true;
  systemd.user.services.wayland-wm-app-daemon = {
    wantedBy = [ "graphical-session.target" ];
    enableDefaultPath = false;
  };

  services.greetd = {
    enable = true;
    useTextGreeter = true;
    settings = {
      initial_session = {
        command = "${pkgs.systemd}/bin/systemd-cat --identifier=uwsm ${session}";
        user = "david";
      };
      default_session.command = "${pkgs.greetd}/bin/agreety --cmd '${session}'";
    };
  };
}
