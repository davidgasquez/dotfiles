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
    extraPackages = [
      pkgs.gitMinimal
      pkgs.nodejs_22
    ];
    mutableSettings = true;
    settings = builtins.fromJSON (builtins.readFile ./pi.json);
    keybindings = {
      "app.message.followUp" = "ctrl+enter";
    };
  };

  home.packages = [
    pkgs.claude-code
    pkgs.libnotify
  ];

  home.sessionVariables.PI_CLAUDE_CODE_COMMAND = lib.getExe pkgs.claude-code;

  home.file.".pi/agent/extensions" = {
    source = ./pi/extensions;
    recursive = true;
  };
  home.file.".pi/agent/themes/frappe.json".source = ./pi/themes/frappe.json;

  home.activation.piExtensions =
    lib.hm.dag.entryAfter
      [
        "piCodingAgentMutableSettings"
        "reloadSystemd"
      ]
      ''
        (
          cd ${lib.escapeShellArg config.home.homeDirectory}
          if ! run ${config.home.path}/bin/pi update --extensions --no-approve; then
            warnEcho 'Pi extension update failed; retry with pi update --extensions --no-approve.'
          fi
        )
      '';
}
