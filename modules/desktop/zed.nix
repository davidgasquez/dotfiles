{
  config,
  lib,
  pkgs,
  ...
}:

let
  openHerdrProject = pkgs.writeShellApplication {
    name = "open-herdr-project";
    runtimeInputs = with pkgs; [
      coreutils
      config.wayland.windowManager.hyprland.package
      jq
      util-linux
      uwsm
    ];
    text = ''
      folder=$(realpath -e -- "$PWD")
      exec 9>"$XDG_RUNTIME_DIR/open-herdr-project.lock"
      flock 9

      uwsm-app -- herdr-app 9>&- >/dev/null 2>&1 &
      ready=false
      for _ in $(seq 1 100); do
        if spaces=$(herdr-app ls 2>/dev/null); then
          ready=true
          break
        fi
        sleep 0.1
      done
      if [ "$ready" != true ]; then
        echo "Herdr did not become ready" >&2
        exit 1
      fi

      space=$(jq -r --arg folder "$folder" '
        [.spaces[] | select((.machine == null or .machine == "") and .folder == $folder)]
        | first | .id // empty
      ' <<< "$spaces")
      if [ -n "$space" ]; then
        herdr-app "do" space.select --id "$space"
        terminal=$(jq -r --arg space "$space" '
          [.spaces[] | select(.id == $space) | .tabs[] | . as $tab
            | .terminals[] | select(.app == "pi" or (.app == null and $tab.name == "Pi"))]
          | first | .terminal // empty
        ' <<< "$spaces")
        if [ -n "$terminal" ]; then
          herdr-app "do" agent.focus --terminal "$terminal"
        else
          herdr-app "do" tab.new --space "$space" --name Pi --folder "$folder" \
            --argv '${builtins.toJSON [ (lib.getExe config.programs.pi-coding-agent.package) ]}'
        fi
      else
        herdr-app "do" space.new --name "$(basename -- "$folder")" --folder "$folder" --machine "" \
          --tab Pi --argv '${builtins.toJSON [ (lib.getExe config.programs.pi-coding-agent.package) ]}'
      fi
      if [ -n "''${HYPRLAND_INSTANCE_SIGNATURE:-}" ]; then
        hyprctl dispatch 'hl.dsp.focus({ window = "class:herdr-app" })'
      fi
    '';
  };
in
{
  programs.zed-editor = {
    enable = true;
    extensions = [
      "csv"
      "env"
      "git-firefly"
      "html"
      "ini"
      "lua"
      "make"
      "markdown-oxide"
      "nix"
      "sql"
      "toml"
    ];
    extraPackages = [
      pkgs.markdown-oxide
      pkgs.nil
    ];
    userSettings = builtins.fromJSON (builtins.readFile ./zed.json);
    userKeymaps = [
      {
        context = "Editor && mode == full";
        bindings."ctrl-shift-s" = [
          "task::Spawn"
          { task_name = "Generate Commit and Push"; }
        ];
      }
      {
        context = "Workspace || Terminal";
        bindings."ctrl-shift-a" = [
          "task::Spawn"
          { task_name = "Open Project in Herdr"; }
        ];
      }
      {
        context = "Editor";
        bindings = {
          "ctrl-ç" = [
            "editor::ToggleComments"
            { advance_downwards = false; }
          ];
          "ctrl-shift-up" = "editor::MoveLineUp";
          "ctrl-shift-down" = "editor::MoveLineDown";
        };
      }
      {
        context = "Workspace || Terminal";
        bindings."ctrl-_" = [
          "task::Spawn"
          { task_name = "Open External Terminal"; }
        ];
      }
    ];
    userTasks = [
      {
        label = "Generate Commit and Push";
        command = lib.getExe config.programs.pi-coding-agent.package;
        args = [
          "--thinking"
          "low"
          "--print"
          "\"split work into atomic commits and push\""
        ];
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "no_focus";
        hide = "on_success";
        use_new_terminal = false;
        allow_concurrent_runs = false;
        show_summary = false;
        show_command = false;
        save = "all";
      }
      {
        label = "Open Project in Herdr";
        command = lib.getExe openHerdrProject;
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "never";
        hide = "on_success";
        show_summary = false;
        show_command = false;
      }
      {
        label = "Open External Terminal";
        command = lib.getExe config.programs.ghostty.package;
        args = [ "+new-window" ];
        cwd = "$ZED_WORKTREE_ROOT";
        reveal = "never";
        hide = "on_success";
        show_summary = false;
        show_command = false;
      }
    ];
  };
}
