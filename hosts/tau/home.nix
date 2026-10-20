{
  config,
  lib,
  pkgs,
  ...
}:

{
  imports = [ ./personal-sync.nix ];

  home.stateVersion = "26.11";
  home.packages = [ pkgs.rclone ];

  systemd.user.services.codex-remote-control = {
    Unit.Description = "Codex remote control for tau";
    Install.WantedBy = [ "default.target" ];
    Service = {
      ExecStart = "${lib.getExe config.programs.codex.package} app-server --listen unix://%h/.codex/app-server-control/app-server-control.sock --remote-control --managed-daemon";
      Restart = "on-failure";
      RestartSec = 5;
      TimeoutStopSec = 30;
      UMask = "0077";
    };
  };
}
