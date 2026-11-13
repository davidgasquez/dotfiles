{ config, pkgs, ... }:

let
  home = config.home-manager.users.david.home;
  herdr = "${home.path}/bin/herdr-app";
  notifyUpgradeFailure = pkgs.writeShellScript "notify-upgrade-failure" ''
    if [ -z "$1" ]; then
      exec ${pkgs.libnotify}/bin/notify-send -u critical "NixOS update failed" "$2"
    fi
    if [ "$(${pkgs.libnotify}/bin/notify-send -u critical -A 'default=Open in Herdr' \
      "NixOS update failed" "Click to open the diagnosis in Herdr.")" = default ]; then
      ${pkgs.systemd}/bin/systemctl --user start herdr-app.service
      for ((attempt = 0; attempt < 50; attempt++)); do
        if ${herdr} status >/dev/null 2>&1; then
          ${herdr} do terminal.peek --terminal "$1" || exit
          exec ${herdr}
        fi
        ${pkgs.coreutils}/bin/sleep 0.1
      done
      exit 1
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
    path = [
      pkgs.jq
      pkgs.systemd
    ];
    serviceConfig = {
      Type = "oneshot";
      User = "david";
    };
    script = ''
      export XDG_RUNTIME_DIR="/run/user/$(id -u)"
      export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
      log="journalctl -u nixos-upgrade.service --invocation=''${MONITOR_INVOCATION_ID:-0} --no-pager"
      terminal=$(${home.path}/bin/hc run --json --bg --no-parent --cwd /etc/nixos -- \
        ${pkgs.coreutils}/bin/env HOME=${home.homeDirectory} \
        PATH=/run/wrappers/bin:/etc/profiles/per-user/david/bin:/run/current-system/sw/bin \
        ${home.path}/bin/pi --provider anthropic --model claude-opus-5-5 --thinking high -- \
        "The NixOS upgrade on ${config.networking.hostName} failed. Check $log and start with flake.nix, hosts/common.nix, and modules/desktop/update.nix. Diagnose the failure and plan a fix. Do not make changes." \
        | jq -r '.address // empty') || terminal=
      if systemctl --user is-active --quiet graphical-session.target; then
        systemd-run --user --collect --property=PartOf=graphical-session.target \
          --expand-environment=no ${notifyUpgradeFailure} "$terminal" "$log"
      fi
    '';
  };
}
