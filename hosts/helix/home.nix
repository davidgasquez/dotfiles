{ pkgs, ... }:

{
  home.stateVersion = "26.05";

  programs.btop = {
    package = pkgs.btop.override { rocmSupport = true; };
    settings.shown_boxes = "cpu gpu0 mem net proc";
  };
}
