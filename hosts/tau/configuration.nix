{ config, pkgs, ... }:

{
  imports = [
    ../../modules/agents
    ./hardware.nix
    ./maintenance.nix
  ];

  networking.hostName = "tau";
  systemd.defaultUnit = "multi-user.target";
  fonts.fontconfig.enable = false;
  system.stateVersion = "26.11";
  home-manager.users.david.imports = [ ./home.nix ];

  systemd.oomd.enableSystemSlice = true;

  users.mutableUsers = false;
  users.users.david = {
    linger = true;
    hashedPassword = "!";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP/Zjl7ztFYGhOvvXaHxjzdDQUCtMUjouh5SJM4z8UlT"
    ];
  };

  services.glances = {
    enable = true;
    package = pkgs.glances.overrideAttrs (old: {
      postPatch = (old.postPatch or "") + ''
        substituteInPlace tests/test_restful.py \
          --replace-fail 'time.sleep(5)' 'time.sleep(30)'
      '';
      # psutil may not detect physical CPU cores on this Pi.
      disabledTests = old.disabledTests ++ [ "test_phys_core_returns_int" ];
    });
  };
  networking.firewall.interfaces.${config.services.tailscale.interfaceName}.allowedTCPPorts = [
    61208
  ];

  services.tailscale = {
    openFirewall = true;
  };

  services.openssh.settings.PermitRootLogin = "no";
}
