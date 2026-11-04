{ lib, pkgs, ... }:

let
  superwhisper = pkgs.callPackage ./superwhisper.nix { };
  executable = lib.getExe superwhisper;
  preferences = pkgs.writeText "superwhisper-preferences.json" (
    builtins.toJSON {
      toggleRecordingShortcut = "F9";
      pushToTalkShortcut = "";
      cancelRecordingShortcut = "Escape";
      p2t = false;
      keepMicrophoneReady = false;
      recordingPreservationPeriod = 86400;
    }
  );
in
{
  home.packages = [ superwhisper ];

  xdg.desktopEntries."com.superwhisper.Superwhisper" = {
    name = "Superwhisper";
    comment = "Voice dictation";
    exec = "${executable} settings --window";
    icon = "superwhisper";
    categories = [
      "Utility"
      "Accessibility"
    ];
    settings.StartupWMClass = "com.superwhisper.Superwhisper";
  };

  systemd.user.services.superwhisper = {
    Unit = {
      Description = "Superwhisper dictation";
      PartOf = [ "graphical-session.target" ];
      After = [
        "graphical-session.target"
        "pipewire.service"
      ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStartPre = pkgs.writeShellScript "superwhisper-preferences" ''
        directory="''${XDG_CONFIG_HOME:-$HOME/.config}/superwhisper"
        mkdir -p "$directory"
        if [ ! -e "$directory/preferences.json" ]; then
          cp ${preferences} "$directory/preferences.json"
          chmod 600 "$directory/preferences.json"
        fi
      '';
      ExecStart = "${executable} daemon";
      ExecStopPost = [
        "${executable} playback-restore"
        "${executable} desktop-release"
      ];
      Restart = "on-failure";
      RestartSec = 2;
      TimeoutStopSec = 15;
      UMask = "0077";
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };
}
