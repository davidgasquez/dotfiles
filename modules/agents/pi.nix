{
  config,
  lib,
  osConfig,
  pkgs,
  inputs,
  ...
}:

{
  programs.pi-coding-agent = {
    enable = true;
    package = inputs.pi.packages.${pkgs.stdenv.hostPlatform.system}.default.override {
      nodejs_22 = pkgs.nodejs_24;
    };
    extraPackages = [
      pkgs.gitMinimal
      pkgs.nodejs_24
    ];
    mutableSettings = true;
    settings = builtins.fromJSON (builtins.readFile ./pi.json);
    keybindings = {
      "app.message.followUp" = "ctrl+enter";
    };
  };

  home.sessionVariables.PI_SKIP_VERSION_CHECK = "1";

  home.packages = [
    pkgs.claude-code
    pkgs.libnotify
  ];

  home.file.".pi/agent/extensions" = {
    source = ./pi/extensions;
    recursive = true;
  };
  home.file.".pi/agent/themes/frappe.json".source = ./pi/themes/frappe.json;

  systemd.user.services.pi-extensions-update = {
    Unit.X-SwitchMethod = "keep-old";
    Install.WantedBy = [ "default.target" ];
    Service = {
      Type = "exec";
      RemainAfterExit = true;
      ExecStart = pkgs.writeShellScript "pi-extensions-update" ''
        set -e
        ${lib.optionalString osConfig.networking.networkmanager.enable "${pkgs.networkmanager}/bin/nm-online --quiet"}
        exec ${config.home.path}/bin/pi update --extensions --no-approve
      '';
    };
  };
}
