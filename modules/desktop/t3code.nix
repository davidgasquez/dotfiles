{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

let
  t3code = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.t3code;
  stock = "${t3code.desktop}/bin/t3code-desktop";
  launcher = pkgs.writeShellApplication {
    name = "t3code-desktop";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.hyprland
      pkgs.systemd
    ];
    text = ''
      systemctl --user is-active --quiet t3code-desktop.service ||
        systemctl --user start t3code-desktop.service
      for _ in $(seq 300); do
        if hyprctl eval 't3code_show()' >/dev/null; then
          [ "$#" -eq 0 ] || T3CODE_DESKTOP_LAUNCHER_PATH=$(realpath "$0") exec ${stock} "$@"
          exit 0
        fi
        sleep 0.1
      done
      echo "T3 window did not appear. Check journalctl --user -u t3code-desktop." >&2
      exit 1
    '';
  };
in
{
  home.packages = [
    t3code.desktop
    (lib.hiPrio launcher)
  ];

  home.sessionVariables.T3CODE_TELEMETRY_ENABLED = "false";

  xdg.configFile."t3code/catppuccin-frappe.json".source = pkgs.fetchurl {
    url = "https://raw.githubusercontent.com/SunkenInTime/t3-themes/81470c594bb9f7c7337fb2de98fb361eb100e444/themes/catppuccin-frappe.json";
    hash = "sha256-KVoP7WKOrkRLxKVx/afTSoXQXY2BLpJRpAD89b3paLk=";
  };

  programs.t3code = {
    enable = true;
    package = t3code;
    userSettings = {
      enableProviderUpdateChecks = false;
      continueThreadsAfterServerUpdate = true;
      providerInstances.pi = {
        driver = "pi";
        enabled = true;
        config.binaryPath = lib.getExe config.programs.pi-coding-agent.package;
      };
      defaultAutoPull = true;
      defaultModelSelection = {
        instanceId = "pi";
        model = "openai/gpt-6-astra";
        options = [
          {
            id = "thinking";
            value = "xhigh";
          }
        ];
      };
      pullRequestMergeMethod = "squash";
      branchNamePrefix = "";
      idleCompaction = "onReturn";
      snoozeLimitedThreads = true;
      autoResumeLimitedThreads = true;
      storageCleanup = {
        worktreeAfterDays = 8;
        worktreeOnMerge = true;
        worktreeOnDelete = true;
        browserArtifactsAfterDays = 8;
        logsAfterDays = 8;
      };
    };
    clientSettings = {
      fontFamilyCode = "JetBrains Mono";
      notificationMode = "notifications-and-sound";
      mathRenderingEnabled = true;
      glassOpacity = 100;
    };
  };

  xdg.mimeApps = {
    associations.added."x-scheme-handler/t3code" = "t3code.desktop";
    defaultApplications."x-scheme-handler/t3code" = "t3code.desktop";
  };

  home.activation = {
    t3codeRemoteOnly =
      lib.hm.dag.entryBetween
        [ "reloadSystemd" ]
        [
          "t3codeSettingsActivation"
          "t3codeClientSettingsActivation"
        ]
        (
          lib.hm.generators.mkImpureConfigMerger {
            inherit pkgs;
            format = "json";
            empty = "{}";
            jqOperation = "$dynamic * $static";
            path = "${config.home.homeDirectory}/.t3/userdata/desktop-settings.json";
            staticSettings = pkgs.writeText "t3code-desktop-settings.json" (
              builtins.toJSON { localEnvironmentEnabled = false; }
            );
          }
        );
  };

  systemd.user.services.t3code-server = {
    Unit.Description = "T3 Code server";
    Service = {
      Type = "exec";
      WorkingDirectory = "%h";
      Environment = [
        "NODE_COMPILE_CACHE=%C/t3code/node"
        "T3CODE_TELEMETRY_ENABLED=false"
        "PI_CLAUDE_CODE_COMMAND=${config.home.sessionVariables.PI_CLAUDE_CODE_COMMAND}"
      ];
      ExecStart = "${lib.getExe t3code} serve --host 127.0.0.1 --port 3773 --base-dir %h/.t3";
      Restart = "on-failure";
      RestartSec = 2;
      KillMode = "mixed";
      OOMPolicy = "continue";
    };
    Install.WantedBy = [ "default.target" ];
  };

  systemd.user.services.t3code-desktop = {
    Unit = {
      Description = "T3 Code desktop";
      PartOf = [ "graphical-session.target" ];
      After = [
        "graphical-session.target"
        "t3code-server.service"
      ];
      Requisite = [ "graphical-session.target" ];
      Wants = [ "t3code-server.service" ];
    };
    Service = {
      Type = "exec";
      WorkingDirectory = "%h";
      Environment = [
        "T3CODE_DESKTOP_LAUNCHER_PATH=${lib.getExe launcher}"
        "T3CODE_TELEMETRY_ENABLED=false"
      ];
      ExecStart = stock;
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };
}
