{ pkgs, ... }:

{
  system.autoUpgrade.dates = "hourly";
  systemd.timers.nixos-upgrade.timerConfig.OnBootSec = "1min";
  systemd.services.nixos-upgrade = {
    serviceConfig.ExecCondition = "${pkgs.networkmanager}/bin/nm-online --quiet --timeout=120";
    onFailure = [ "nixos-upgrade-notify.service" ];
  };

  systemd.services.nixos-upgrade-notify = {
    description = "Notify about a failed NixOS upgrade";
    path = [ pkgs.libnotify ];
    serviceConfig = {
      Type = "oneshot";
      User = "david";
    };
    script = ''
      export XDG_RUNTIME_DIR="/run/user/$(id -u)"
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
      if ${pkgs.systemd}/bin/systemctl --user is-active --quiet graphical-session.target; then
        notify-send -u critical "NixOS update failed" "journalctl -u nixos-upgrade"
      fi
    '';
  };
}
