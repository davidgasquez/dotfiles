{ config, pkgs, ... }:

{
  imports = [
    ../../modules/agents/codex.nix
    ../../modules/agents/pi.nix
  ];

  home.stateVersion = "26.05";
  home.file."projects/nixos".source = config.lib.file.mkOutOfStoreSymlink "/etc/nixos";

  home.packages = [ pkgs.gcr_3 ];

  programs.gpg = {
    enable = true;
    settings.default-key = "F2750587F59F961961BFE122E376A4D9EADE15CF";
    publicKeys = [
      {
        source = ./davidgasquez.asc;
        trust = "ultimate";
      }
    ];
  };

  services.gpg-agent = {
    enable = true;
    pinentry.package = pkgs.pinentry-gnome3;
  };

  programs.git.signing = {
    key = "F2750587F59F961961BFE122E376A4D9EADE15CF";
    format = "openpgp";
    signByDefault = false;
  };

  programs.direnv = {
    enable = true;
    enableGitIntegration = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
    config.global.log_filter = "^$";
    config.whitelist.prefix = [ "${config.home.homeDirectory}/projects/" ];
  };
}
