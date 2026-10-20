{ config, pkgs, ... }:

let
  rcloneConfig = "${config.xdg.configHome}/rclone/rclone.conf";
  stateDirectory = "${config.xdg.stateHome}/personal-sync";
  filters = pkgs.writeText "personal-sync-filters" ''
    - .git
    - .git/**
    - **/.git/**
    - .gitignore
    - .gitattributes
    - .DS_Store
    - Thumbs.db
    - desktop.ini
    - *.swp
    - *.swo
    - .env
    - *.local
    - *.local.*
    - .venv/**
    - __pycache__/**
    - .pytest_cache/**
    - .ruff_cache/**
    - .mypy_cache/**
    - dist/**
    - build/**
    - *.tmp
    - *.bak
  '';
  sync = pkgs.writeShellApplication {
    name = "personal-sync";
    runtimeInputs = [
      pkgs.gitMinimal
      pkgs.git-lfs
      pkgs.rclone
      pkgs.coreutils
    ];
    text = ''
      install -m 600 ${filters} "$STATE_DIRECTORY/filters"
      test "$(git branch --show-current)" = main
      git -c pull.rebase=false -c rebase.autoStash=false pull --ff-only origin main

      rclone --config ${rcloneConfig} bisync . personal-drive: \
        --filters-file "$STATE_DIRECTORY/filters" \
        --workdir "$STATE_DIRECTORY/bisync" \
        --check-access --check-filename AGENTS.md \
        --max-delete 10 --resilient --recover --max-lock 5m --verbose

      git add --all
      if ! git diff --cached --quiet; then
        git commit -m "📝 Update personal documents from Google Drive"
      fi
      git push origin main
    '';
  };
in
{
  systemd.user.services.personal-sync = {
    Unit = {
      Description = "Sync personal documents between GitHub and Google Drive";
      ConditionPathExists = [
        rcloneConfig
        "${stateDirectory}/initialized"
      ];
    };
    Service = {
      Type = "oneshot";
      ExecStart = "${sync}/bin/personal-sync";
      WorkingDirectory = "%h/personal";
      StateDirectory = "personal-sync";
      StateDirectoryMode = "0700";
      Environment = [ "GIT_TERMINAL_PROMPT=0" ];
      TimeoutStartSec = "1h";
      TimeoutStopSec = "2min";
      UMask = "0077";
    };
  };

  systemd.user.timers.personal-sync = {
    Unit.Description = "Sync personal documents every 15 minutes";
    Timer = {
      OnCalendar = "*:0/15";
      Persistent = true;
    };
    Install.WantedBy = [ "timers.target" ];
  };
}
