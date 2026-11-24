{
  imports = [
    ../../modules/agents
    ./hardware.nix
    ./maintenance.nix
  ];

  networking.hostName = "tau";
  networking.nameservers = [
    "1.1.1.1"
    "1.0.0.1"
  ];
  networking.resolvconf.extraConfig = "allow_keys=static";
  fonts.fontconfig.enable = false;
  system.stateVersion = "26.11";
  home-manager.users.david.imports = [ ./home.nix ];

  systemd.oomd = {
    enableSystemSlice = true;
    enableUserSlices = true;
  };

  security.sudo.wheelNeedsPassword = false;

  users.mutableUsers = false;
  users.users.david = {
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
