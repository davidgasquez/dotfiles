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
  qtSettings = {
    Appearance.icon_theme = config.gtk.iconTheme.name;
    Fonts = {
      general = "\"${font.name},${toString font.size}\"";
      fixed = "\"JetBrains Mono,11\"";
    };
  };
in
{
  _module.args = {
    inherit palette;
    accent = palette.${config.catppuccin.accent};
  };

  catppuccin = {
    enable = true;
    autoEnable = false;
    flavor = "frappe";
    accent = "mauve";
    sources.cursors = pkgs.catppuccin-cursors;
    gtk.icon.enable = true;
    cursors = {
      enable = true;
      accent = "light";
    };
    ghostty.enable = true;
    zed.enable = true;
    starship.enable = true;
    kvantum.enable = true;
    mako.enable = true;
    waybar.enable = true;
  };

  programs.t3code = {
    userSettings.defaultTheme = "catppuccin-frappe";
    clientSettings.glassOpacity = 100;
    themes.catppuccin-frappe = pkgs.fetchurl {
      url = "https://raw.githubusercontent.com/SunkenInTime/t3-themes/81470c594bb9f7c7337fb2de98fb361eb100e444/themes/catppuccin-frappe.json";
      hash = "sha256-KVoP7WKOrkRLxKVx/afTSoXQXY2BLpJRpAD89b3paLk=";
    };
  };

  home.pointerCursor = {
    enable = true;
    size = 24;
    gtk.enable = true;
    x11.enable = true;
    hyprcursor.enable = true;
  };
  gtk = {
    enable = true;
    gtk3.bookmarks = map (dir: "file://${dir}") (
      with config.xdg.userDirs;
      [
        documents
        download
        music
        pictures
        videos
        projects
        publicShare
        templates
      ]
    );
    colorScheme = "dark";
    theme = {
      name = "catppuccin-${config.catppuccin.flavor}-${config.catppuccin.accent}-standard";
      package = pkgs.catppuccin-gtk.override {
        variant = config.catppuccin.flavor;
        accents = [ config.catppuccin.accent ];
      };
    };
    gtk4.extraCss = ''
      @import url("${config.gtk.theme.package}/share/themes/${config.gtk.theme.name}/gtk-4.0/gtk.css");
    '';
    font = {
      name = "Inter";
      size = 11;
    };
  };
  qt = {
    enable = true;
    platformTheme.name = "qtct";
    style.name = "kvantum";
    qt5ctSettings = qtSettings;
    qt6ctSettings = qtSettings;
  };

  services.mako = {
    enable = true;
    settings = {
      anchor = "top-right";
      font = "${font.name} ${toString font.size}";
      format = "<b>%s</b>\\n<span foreground='${palette.subtext0.hex}'>%b</span>";
      width = 380;
      height = 120;
      margin = 12;
      padding = 12;
      border-size = 1;
      border-radius = 6;
      max-icon-size = 48;
      icon-border-radius = 4;
      max-visible = 3;
      icon-path = lib.concatStringsSep ":" [
        "${config.gtk.iconTheme.package}/share/icons/${config.gtk.iconTheme.name}"
        "${config.gtk.iconTheme.package}/share/icons/Papirus"
        "${config.xdg.dataHome}/icons/hicolor"
      ];
      default-timeout = 12000;
      "".border-color = palette.${config.catppuccin.accent}.hex;
      "urgency=critical" = {
        border-color = palette.red.hex;
        default-timeout = 0;
        ignore-timeout = true;
      };
    };
  };

}
