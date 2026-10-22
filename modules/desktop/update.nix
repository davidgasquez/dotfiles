{
  lib,
  pkgs,
  ...
}:

{
  system.autoUpgrade.operation = "boot";
  systemd.timers.nixos-upgrade.timerConfig = {
    OnCalendar = lib.mkForce [ ];
    OnBootSec = "1min";
  };
  systemd.services.nixos-upgrade.onFailure = [ "nixos-upgrade-notify.service" ];

  systemd.services.nixos-upgrade-notify = {
    description = "Notify about a failed NixOS upgrade";
    path = [ pkgs.libnotify ];
    environment.DBUS_SESSION_BUS_ADDRESS = "unix:path=/run/user/1000/bus";
    serviceConfig = {
      Type = "oneshot";
      User = "david";
    };
    script = ''
      for _ in $(seq 120); do
        [ -S /run/user/1000/bus ] && break
        sleep 5
      done
      notify-send -u critical "NixOS update failed" "journalctl -u nixos-upgrade"
    '';
  };
}
