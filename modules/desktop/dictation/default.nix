{ lib, pkgs, ... }:

let
  transcribe-cpp = pkgs.callPackage ./transcribe-cpp.nix { };
  model = pkgs.fetchurl {
    url = "https://huggingface.co/handy-computer/parakeet-ultra-gguf/resolve/a1539be1b849ea7463b88343e5277b373d0c4ea9/parakeet-ultra-Q8_0.gguf";
    hash = "sha256-AHpZdh6SWHefGJ3zlrUNErg7tbeeZt9LlVwjDS8qClk=";
  };
  sounds = pkgs.runCommand "dictation-sounds" { nativeBuildInputs = [ pkgs.sox ]; } ''
    mkdir $out
    for freq in 440 880; do
      sox -n -r 44100 -b 16 -c 1 $freq.wav synth 0.075 sine $freq vol 0.25
    done
    sox 440.wav 880.wav $out/start.wav fade 0.02 -0 0.02
    sox 880.wav 440.wav $out/stop.wav fade 0.02 -0 0.02
  '';
  waybarSignal = 8;
  refreshIndicator = "systemctl --user kill --kill-whom=main --signal=SIGRTMIN+${toString waybarSignal} waybar.service 2>/dev/null || :";
in
{
  home.packages = [
    (pkgs.writeShellApplication {
      name = "dictate";
      runtimeInputs = with pkgs; [
        systemd
        util-linux
      ];
      text = ''
        exec 9>"$XDG_RUNTIME_DIR/dictation.lock"
        flock -n 9 || exit 0
        case $(systemctl --user show --property=ActiveState --value dictation.service) in
          active)
            : >"$XDG_RUNTIME_DIR/dictation/finish"
            systemctl --user stop --no-block dictation.service
            ;;
          inactive | failed)
            systemctl --user start dictation.service
            ;;
        esac
      '';
    })
  ];

  programs.waybar.settings.mainBar = {
    modules-right = lib.mkBefore [ "custom/dictation" ];
    "custom/dictation" = {
      exec = lib.getExe (
        pkgs.writeShellApplication {
          name = "dictation-status";
          runtimeInputs = [ pkgs.systemd ];
          text = ''
            if [ -e "$XDG_RUNTIME_DIR/dictation/transcribing" ]; then
              echo '{"text":"󰔟","class":"transcribing","tooltip":"Transcribing dictation"}'
            else
              case $(systemctl --user show --property=ActiveState --value dictation.service) in
                activating | active) echo '{"text":"󰍬","class":"recording","tooltip":"Recording dictation · F9 to stop"}' ;;
                *) echo '{"text":""}' ;;
              esac
            fi
          '';
        }
      );
      interval = "once";
      signal = waybarSignal;
      return-type = "json";
      hide-empty-text = true;
    };
  };
  programs.waybar.style = lib.mkAfter ''
    #custom-dictation {
      background: @surface0;
      border-radius: 4px;
      margin-right: 4px;
      padding: 0 8px;
    }
    #custom-dictation.recording { color: @red; }
    #custom-dictation.transcribing { color: @yellow; }
  '';

  systemd.user.services.dictation = {
    Unit = {
      Description = "Record and transcribe dictation";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${lib.getExe' pkgs.pipewire "pw-record"} --rate 16000 --channels 1 --format s16 %t/dictation/audio.wav";
      ExecStartPost = lib.getExe (
        pkgs.writeShellApplication {
          name = "dictation-ready";
          runtimeInputs = with pkgs; [
            coreutils
            pipewire
            systemd
          ];
          text = ''
            for _ in $(seq 200); do
              if [ "$(stat -c %s "$RUNTIME_DIRECTORY/audio.wav" 2>/dev/null || echo 0)" -gt 1024 ]; then
                ${refreshIndicator}
                exec pw-play ${sounds}/start.wav
              fi
              sleep 0.01
            done
            echo "Recording did not start" >&2
            exit 1
          '';
        }
      );
      ExecStopPost = lib.getExe (
        pkgs.writeShellApplication {
          name = "dictation-finish";
          runtimeInputs = with pkgs; [
            coreutils
            libnotify
            pipewire
            systemd
            transcribe-cpp
            wtype
          ];
          text = ''
            trap 'rm -f "$RUNTIME_DIRECTORY/transcribing"; ${refreshIndicator}' EXIT
            trap 'exit 130' INT TERM

            fail() {
              notify-send --app-name=Dictation --urgency=critical "$1" \
                "See journalctl --user -u dictation.service for details."
              exit 1
            }

            case $SERVICE_RESULT in
              success) [ -e "$RUNTIME_DIRECTORY/finish" ] || exit 0 ;;
              timeout) ;;
              *) fail "Dictation recording failed" ;;
            esac

            : >"$RUNTIME_DIRECTORY/transcribing"
            ${refreshIndicator}
            pw-play ${sounds}/stop.wav &
            audio=$RUNTIME_DIRECTORY/audio.wav
            bytes=$(stat -c %s "$audio")
            if [ "$bytes" -lt 9644 ]; then
              echo "Ignoring recording shorter than 300 ms" >&2
              wait
              exit 0
            fi

            started=$(date +%s%N)
            transcribe-cli --model ${model} --backend vulkan --timestamps none \
              --output "$RUNTIME_DIRECTORY/text" "$audio" >/dev/null || fail "Dictation transcription failed"
            echo "Transcribed $(( (bytes - 44) / 32 )) ms of audio in $(( ($(date +%s%N) - started) / 1000000 )) ms" >&2

            text=$(tr -s '[:space:][:cntrl:]' ' ' <"$RUNTIME_DIRECTORY/text")
            text=''${text# }
            text=''${text% }
            if [ -n "$text" ] && ! printf '%s' "$text" | wtype -; then
              systemd-run --user --quiet --collect --description="Dictation clipboard fallback" \
                --setenv=TMPDIR="$XDG_RUNTIME_DIR" \
                --property=StandardInputData="$(printf '%s' "$text" | base64 --wrap=0)" \
                ${lib.getExe' pkgs.wl-clipboard "wl-copy"} --foreground --type text/plain ||
                fail "Dictation typing failed"
              notify-send --app-name=Dictation "Dictation copied to clipboard" "Typing failed; paste it manually."
            fi
            wait
          '';
        }
      );
      KillSignal = "SIGINT";
      RuntimeDirectory = "dictation";
      RuntimeDirectoryMode = "0700";
      RuntimeMaxSec = 60;
      SuccessExitStatus = 1;
      TimeoutStopSec = 30;
      UMask = "0077";
    };
  };
}
