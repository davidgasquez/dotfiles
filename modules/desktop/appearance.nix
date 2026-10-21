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
  dconf.settings."org/gnome/desktop/interface".color-scheme = "prefer-dark";
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
      width = 360;
      margin = 12;
      padding = "14,16";
      border-size = 1;
      border-radius = 8;
      max-icon-size = 32;
      max-visible = 3;
      icon-path = lib.concatStringsSep ":" [
        "${config.gtk.iconTheme.package}/share/icons/${config.gtk.iconTheme.name}"
        "${config.gtk.iconTheme.package}/share/icons/Papirus"
        "${config.xdg.dataHome}/icons/hicolor"
      ];
      default-timeout = 7500;
      "urgency=critical" = {
        border-color = palette.red.hex;
        default-timeout = 0;
        ignore-timeout = true;
      };
    };
  };

}
