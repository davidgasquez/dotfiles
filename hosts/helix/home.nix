{ pkgs, ... }:

{
  home.stateVersion = "26.05";

  services.hypridle.settings.general.ignore_wayland_inhibit = true;

  programs.btop = {
    package = pkgs.btop.override { rocmSupport = true; };
    settings.shown_boxes = "cpu gpu0 mem net proc";
  };
}
