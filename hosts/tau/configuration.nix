{ config, pkgs, ... }:

{
  imports = [
    ../../modules/agents
    ./hardware.nix
    ./maintenance.nix
    ./pihole.nix
  ];

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
    config.services.glances.port
  ];

  services.tailscale = {
    openFirewall = true;
  };
}
