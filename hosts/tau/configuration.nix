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
  networking.nameservers = [
    "9.9.9.9"
    "149.112.112.112"
  ];
  networking.resolvconf.extraConfig = "allow_keys=static";
  services.pihole-ftl.enable = false;
  systemd.defaultUnit = "multi-user.target";
  fonts.fontconfig.enable = false;
  system.stateVersion = "26.11";
  home-manager.users.david.imports = [ ./home.nix ];

  systemd.oomd = {
    enableSystemSlice = true;
    enableUserSlices = true;
  };

  users.mutableUsers = false;
  users.users.david = {
    linger = true;
    hashedPassword = "!";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP/Zjl7ztFYGhOvvXaHxjzdDQUCtMUjouh5SJM4z8UlT"
    ];
  };

  services.openssh = {
    enable = true;
    openFirewall = false;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "no";
    };
  };
  networking.firewall.interfaces.end0.allowedTCPPorts = [ 22 ];

  services.tailscale = {
    openFirewall = true;
    extraSetFlags = [ "--accept-dns=false" ];
  };
}
