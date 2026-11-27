{
  inputs,
  lib,
  pkgs,
  ...
}:

let
  superwhisper = inputs.superwhisper.packages.${pkgs.stdenv.hostPlatform.system}.default;
  transcribe-cpp = pkgs.callPackage ./transcribe-cpp.nix { };
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
  home.packages = [
    superwhisper
    transcribe-cpp
  ];

  xdg.dataFile."transcribe-cpp/parakeet-ultra.gguf".source = pkgs.fetchurl {
    url = "https://huggingface.co/handy-computer/parakeet-ultra-gguf/resolve/a1539be1b849ea7463b88343e5277b373d0c4ea9/parakeet-ultra-Q8_0.gguf";
    hash = "sha256-AHpZdh6SWHefGJ3zlrUNErg7tbeeZt9LlVwjDS8qClk=";
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
