{ config, pkgs, ... }:

let
  rcloneConfig = "${config.xdg.configHome}/rclone/rclone.conf";
  filters = pkgs.writeText "personal-sync-filters" ''
    - /.personal-sync-backups/**
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
      pkgs.gh
      pkgs.rclone
      pkgs.coreutils
    ];
    text = ''
      cd "$STATE_DIRECTORY"
      if [ ! -d repo ]; then
        git clone --branch main --single-branch https://github.com/davidgasquez/personal.git repo
      fi
      cd repo
      test "$(git branch --show-current)" = main
      test -z "$(git status --porcelain)"
      git -c pull.rebase=false -c rebase.autoStash=false pull --ff-only origin main
      test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"

      rclone sync . personal-drive: \
        --filter-from ${filters} \
        --backup-dir "personal-drive:.personal-sync-backups/$(date -u +%Y%m%dT%H%M%S.%NZ)" \
        --checksum --max-delete 10 --verbose "$@"
    '';
  };
in
{
  home.packages = [ sync ];

  systemd.user.services.personal-sync = {
    Unit = {
      Description = "Publish personal documents from GitHub to Google Drive";
      ConditionPathExists = rcloneConfig;
    };
    Service = {
      Type = "oneshot";
      ExecStart = "${sync}/bin/personal-sync";
      StateDirectory = "personal-sync";
      StateDirectoryMode = "0700";
      Environment = [
        "GIT_TERMINAL_PROMPT=0"
        "RCLONE_CONFIG=${rcloneConfig}"
      ];
      TimeoutStartSec = "1h";
      TimeoutStopSec = "2min";
      UMask = "0077";
    };
  };

  systemd.user.timers.personal-sync = {
    Unit.Description = "Publish personal documents to Google Drive every 15 minutes";
    Timer = {
      OnCalendar = "*:0/15";
      Persistent = true;
    };
    Install.WantedBy = [ "timers.target" ];
  };
}
