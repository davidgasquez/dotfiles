{
  config,
  lib,
  pkgs,
  inputs,
  ...
}:

{
  programs.pi-coding-agent = {
    enable = true;
    package = inputs.pi.packages.${pkgs.stdenv.hostPlatform.system}.default;
  };

  home.packages = [
    pkgs.claude-code
    pkgs.libnotify
  ];

  home.file.".pi/agent/extensions" = {
    source = ./pi/extensions;
    recursive = true;
  };
  home.file.".pi/agent/themes/frappe.json".source = ./pi/themes/frappe.json;

  home.activation.piSettings = lib.hm.dag.entryBetween [ "reloadSystemd" ] [ "linkGeneration" ] (
    lib.hm.generators.mkImpureConfigMerger {
      inherit pkgs;
      format = "json";
      empty = "{}";
      jqOperation = "$dynamic * $static";
      path = "${config.home.homeDirectory}/.pi/agent/settings.json";
      staticSettings = ./pi.json;
      mode = "600";
    }
  );

  home.activation.piClaudeBridge = lib.hm.dag.entryBetween [ "reloadSystemd" ] [ "linkGeneration" ] (
    lib.hm.generators.mkImpureConfigMerger {
      inherit pkgs;
      format = "json";
      empty = "{}";
      jqOperation = "$dynamic * $static";
      path = "${config.home.homeDirectory}/.pi/agent/claude-bridge.json";
      staticSettings = (pkgs.formats.json { }).generate "claude-bridge.json" {
        provider.pathToClaudeCodeExecutable = lib.getExe pkgs.claude-code;
      };
      mode = "600";
    }
  );

  home.activation.piExtensions = lib.hm.dag.entryAfter [ "reloadSystemd" ] ''
    if [[ -S "''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/systemd/private" ]]; then
      if ! run ${pkgs.coreutils}/bin/env XDG_RUNTIME_DIR="''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}" \
        ${config.systemd.user.systemctlPath} --user --no-block start pi-extensions.service; then
        warnEcho 'Could not schedule Pi extension update; continuing activation.'
      fi
    fi
  '';

  systemd.user.services.pi-extensions = {
    Unit = {
      Description = "Update Pi extensions";
      After = [ "default.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = "${lib.getExe config.programs.pi-coding-agent.package} update --extensions";
      Environment = "PATH=${
        lib.makeBinPath [
          pkgs.gitMinimal
          pkgs.nodejs_22
        ]
      }";
      WorkingDirectory = "%h";
    };
    Install.WantedBy = [ "default.target" ];
  };
}
