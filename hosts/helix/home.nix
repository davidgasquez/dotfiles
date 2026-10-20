{ config, ... }:

{
  imports = [
    ../../modules/agents/codex.nix
    ../../modules/agents/pi.nix
  ];

  home.stateVersion = "26.05";
  home.file."projects/nixos".source = config.lib.file.mkOutOfStoreSymlink "/etc/nixos";

  programs.direnv = {
    enable = true;
    enableGitIntegration = true;
    enableZshIntegration = true;
    nix-direnv.enable = true;
    config.global.log_filter = "^$";
    config.whitelist.prefix = [ "${config.home.homeDirectory}/projects/" ];
  };
}
