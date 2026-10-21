{ config, lib, ... }:

let
  quad9 = [
    "9.9.9.9"
    "149.112.112.112"
  ];
in
{
  services.pihole-ftl = {
    enable = true;
    lists = [
      { url = "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"; }
    ];
    settings = {
      dns = {
        upstreams = quad9;
        listeningMode = "ALL";
      };
      database.maxDBdays = 7;
    };
  };

  services.pihole-web = {
    enable = true;
    ports = [ 80 ];
  };

  systemd.services.pihole-ftl.serviceConfig.EnvironmentFile =
    "/home/david/.config/pihole/environment";

  systemd.services.pihole-gravity = {
    description = "Update Pi-hole blocklists";
    startAt = "weekly";
    after = [
      "network-online.target"
      "pihole-ftl.service"
    ];
    wants = [ "network-online.target" ];
    requires = [ "pihole-ftl.service" ];
    serviceConfig = {
      Type = "oneshot";
      User = "pihole";
      Group = "pihole";
      ExecStart = "${lib.getExe config.services.pihole-ftl.piholePackage} -g";
    };
  };

  services.tailscale.extraSetFlags = [ "--accept-dns=false" ];
  networking.nameservers = quad9;
  networking.resolvconf.extraConfig = "allow_keys=static";

  networking.firewall.interfaces = {
    end0 = {
      allowedTCPPorts = [ 53 ];
      allowedUDPPorts = [ 53 ];
    };
    ${config.services.tailscale.interfaceName} = {
      allowedTCPPorts = [
        53
        80
      ];
      allowedUDPPorts = [ 53 ];
    };
  };
}
