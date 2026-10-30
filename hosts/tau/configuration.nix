{ lib, ... }:

{
  imports = [
    ../../modules/agents
    ./hardware.nix
    ./maintenance.nix
    ./pihole.nix
  ];

  nixpkgs.config.allowUnfreePredicate = pkg: lib.getName pkg == "claude-code";

  networking.hostName = "tau";
  systemd.defaultUnit = "multi-user.target";
  fonts.fontconfig.enable = false;
  system.stateVersion = "26.11";
  home-manager.users.david.imports = [ ./home.nix ];

  systemd.oomd.enableSystemSlice = true;

  users.mutableUsers = false;
  # Tailscale SSH authenticates users without local passwords or authorized keys.
  users.allowNoPasswordLogin = true;
  users.users.david = {
    linger = true;
    hashedPassword = "!";
  };

  services.tailscale = {
    openFirewall = true;
  };
}
