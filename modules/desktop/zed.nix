{
  config,
  lib,
  pkgs,
  ...
}:

let
  openT3Project = pkgs.writeShellScript "open-t3-project" ''
    t3code-desktop && exec t3 app
  '';
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
        bindings = {
          "ctrl-shift-a" = [
            "task::Spawn"
            { task_name = "Open Project in T3 Code"; }
          ];
          "ctrl-_" = [
            "task::Spawn"
            { task_name = "Open External Terminal"; }
          ];
        };
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
        show_summary = false;
        show_command = false;
        save = "all";
      }
      {
        label = "Open Project in T3 Code";
        command = "${openT3Project}";
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
