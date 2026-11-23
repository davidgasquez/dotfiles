{ config, pkgs, ... }:

let
  bin = "${config.home-manager.users.david.home.path}/bin";
  notifyUpgradeFailure = pkgs.writeShellScript "notify-upgrade-failure" ''
    if [ "$(${pkgs.libnotify}/bin/notify-send -u critical -A 'default=Open in T3 Code' \
      "NixOS update failed" "$1")" = default ]; then
      ${bin}/t3code-desktop && exec ${bin}/t3 app /etc/nixos
    fi
  '';
in
{
  system.autoUpgrade.dates = "daily";
  nix.optimise.dates = [ "weekly" ];
  systemd.services.nixos-upgrade = {
    serviceConfig.ExecCondition = "${pkgs.networkmanager}/bin/nm-online --quiet --timeout=120";
    onFailure = [ "nixos-upgrade-notify.service" ];
  };

  systemd.services.nixos-upgrade-notify = {
    description = "Notify and diagnose a failed NixOS upgrade";
    serviceConfig = {
      Type = "oneshot";
      User = "david";
    };
    script = ''
      export XDG_RUNTIME_DIR="/run/user/$(id -u)"
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
      log="journalctl -u nixos-upgrade.service --invocation=''${MONITOR_INVOCATION_ID:-0} --no-pager"
      if ${bin}/t3 thread start --title "NixOS upgrade failed on ${config.networking.hostName}" \
        --provider claudeAgent --model claude-opus-5-5 --option effort=high /etc/nixos \
        "The NixOS upgrade on ${config.networking.hostName} failed. Check $log and start with flake.nix, hosts/common.nix, and modules/desktop/update.nix. Diagnose the failure and plan a fix. Do not make changes." >/dev/null; then
        body="Claude is diagnosing it in T3 Code."
      else
        body="Check $log"
      fi
      if systemctl --user is-active --quiet graphical-session.target; then
        systemd-run --user --collect --property=PartOf=graphical-session.target \
          --expand-environment=no ${notifyUpgradeFailure} "$body"
      fi
    '';
  };
}
