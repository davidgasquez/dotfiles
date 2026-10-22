{ inputs, ... }:

{
  imports = [
    inputs.disko.nixosModules.disko
    ./hardware.nix
    ./disk-config.nix
    ../../modules/desktop
    ../../modules/agents
  ];

  networking.hostName = "zephyr";
  boot.loader.limine.style.interface.resolution = "2560x1600";

  services.power-profiles-daemon.enable = true;
  services.upower.enable = true;
  services.fwupd.enable = true;
  services.logind.settings.Login = {
    HandleLidSwitch = "suspend";
    HandleLidSwitchExternalPower = "suspend";
    HandleLidSwitchDocked = "ignore";
  };

  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "no";
    };
  };
  users.users.david = {
    hashedPasswordFile = "/var/lib/secrets/david-password-hash";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP/Zjl7ztFYGhOvvXaHxjzdDQUCtMUjouh5SJM4z8UlT"
    ];
  };

  home-manager.users.david.imports = [ ./home.nix ];
  system.stateVersion = "26.05";
}
