{ pkgs, ... }:

let
  pull = pkgs.writeShellApplication {
    name = "projects-pull";
    runtimeInputs = [
      pkgs.gitMinimal
      pkgs.git-lfs
      pkgs.openssh
      pkgs.findutils
      pkgs.coreutils
    ];
    text = ''
      export GIT_TERMINAL_PROMPT=0
      export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15"

      projects="$HOME/projects"
      [ -d "$projects" ] || exit 0

      failed=0
      while IFS= read -r -d ''' marker; do
        repo="''${marker%/.git}"
        echo "Checking $repo"
        if ! git -C "$repo" symbolic-ref -q HEAD >/dev/null; then
          echo "Skipping: detached HEAD or invalid repository"
          continue
        fi
        if ! git -C "$repo" rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
          echo "Skipping: no upstream"
          continue
        fi
        if ! status=$(git -C "$repo" status --porcelain --untracked-files=normal); then
          failed=1
          continue
        fi
        if [ -n "$status" ]; then
          echo "Skipping: uncommitted changes"
          continue
        fi
        busy=0
        for state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply BISECT_START; do
          path=$(git -C "$repo" rev-parse --path-format=absolute --git-path "$state")
          if [ -e "$path" ]; then
            busy=1
          fi
        done
        if [ "$busy" = 1 ]; then
          echo "Skipping: Git operation in progress"
          continue
        fi
        if ! timeout 2m git -C "$repo" pull --ff-only --no-rebase --no-autostash \
          --no-all --no-recurse-submodules; then
          echo "Could not update $repo; leaving it for manual attention" >&2
          failed=1
        fi
      done < <(find "$projects" -name .git -prune -print0)
      exit "$failed"
    '';
  };
in
{
  home.packages = [ pull ];

  systemd.user.services.projects-pull = {
    Unit = {
      Description = "Fast-forward clean repositories under ~/projects";
      ConditionPathIsDirectory = "%h/projects";
    };
    Service = {
      Type = "oneshot";
      ExecStart = "${pull}/bin/projects-pull";
      TimeoutStartSec = "30min";
    };
  };

  systemd.user.timers.projects-pull = {
    Unit.Description = "Update project repositories once after boot";
    Timer.OnBootSec = "2min";
    Install.WantedBy = [ "timers.target" ];
  };
}
