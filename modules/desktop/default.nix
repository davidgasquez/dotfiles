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

  boot.kernelModules = [
    "tcp_bbr"
    "sch_fq"
  ];
  boot.kernel.sysctl = {
    "net.core.default_qdisc" = "fq";
    "net.ipv4.tcp_congestion_control" = "bbr";
    "net.core.rmem_default" = 1048576;
    "net.core.wmem_default" = 1048576;
    "net.core.rmem_max" = 67108864;
    "net.core.wmem_max" = 67108864;
    "net.ipv4.tcp_rmem" = "4096 131072 67108864";
    "net.ipv4.tcp_wmem" = "4096 131072 67108864";
    "net.core.netdev_max_backlog" = 16384;
    "net.ipv4.tcp_mtu_probing" = 1;
    "vm.dirty_background_bytes" = 67108864;
    "vm.dirty_bytes" = 268435456;
  };

  networking.networkmanager = {
    enable = true;
    dns = "systemd-resolved";
    wifi.powersave = false;
  };
  systemd.services.NetworkManager-wait-online.enable = false;
  services.resolved.enable = true;
  hardware.bluetooth.enable = true;
  console.keyMap = "es";
  users.users.david.extraGroups = [ "networkmanager" ];
  programs.nix-ld.enable = true;
  programs.gdk-pixbuf.modulePackages = [ pkgs.librsvg ];

  nixpkgs.config.allowUnfreePredicate =
    pkg:
    builtins.elem (lib.getName pkg) [
      "google-chrome"
      "chatgpt"
      "chatgpt-primary-runtime"
      "spotify"
      "slack"
      "superwhisper"
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
    ./dictation
  ];

  programs.chromium = {
    enable = true;
    extensions = [
      "olhelnoplefjdmncknfphenjclimckaf"
      "clngdbkpkpeebahjckkjfobafhncgmne"
      "ddkjiahejlhfcafbddmgiahcphecmpfh"
      "ghmbeldphafepmbegfdlkpapadhbakde"
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
      PasswordManagerEnabled = false;
      "3rdparty".extensions.ddkjiahejlhfcafbddmgiahcphecmpfh = {
        defaultFiltering = "complete";
        rulesets = [
          "-*"
          "+default"
          "+adguard-spyware-url"
          "+annoyances-cookies"
          "+annoyances-overlays"
          "+annoyances-notifications"
          "+annoyances-others"
          "+spa-0"
        ];
      };
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
  systemd.user.slices.app.sliceConfig = {
    ManagedOOMMemoryPressure = "kill";
    ManagedOOMMemoryPressureLimit = "80%";
    ManagedOOMSwap = "kill";
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
