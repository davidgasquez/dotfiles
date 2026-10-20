{ pkgs, ... }:

let
  session = "${pkgs.uwsm}/bin/uwsm start hyprland.desktop";
in
{
  home-manager.users.david.imports = [
    ./session.nix
    ./appearance.nix
    ./applications.nix
  ];

  programs.chromium = {
    enable = true;
    extensions = [ "olhelnoplefjdmncknfphenjclimckaf" ];
    extraOpts = {
      AIModeSettings = 1;
      SearchContentSharingSettings = 1;
      PromotionsEnabled = false;
      BrowserLabsEnabled = false;
    };
  };

  programs.steam = {
    enable = true;
    extraPackages = [ pkgs.gamescope ];
  };
  programs.gamescope.enable = true;

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
