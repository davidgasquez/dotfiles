{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  zramSwap.enable = true;
  systemd.oomd.enableUserSlices = true;

  programs.zsh = {
    enable = true;
    enableGlobalCompInit = false;
  };
  users.users.david = {
    isNormalUser = true;
    shell = pkgs.zsh;
    extraGroups = [ "wheel" ];
  };

  security.sudo.extraRules = [
    {
      users = [ "david" ];
      runAs = "root";
      commands = [
        {
          command = "/run/current-system/sw/bin/nixos-rebuild";
          options = [ "NOPASSWD" ];
        }
      ];
    }
  ];

  services.tailscale = {
    enable = true;
    extraSetFlags = [ "--ssh" ];
  };
  systemd.services.tailscaled-set = {
    wantedBy = [ "multi-user.target" ];
    serviceConfig.RemainAfterExit = true;
  };
  programs.ssh.extraConfig = ''
    Host helix tau
      User david
  '';

  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];

  system.autoUpgrade = {
    enable = true;
    flake = "/etc/nixos#${config.networking.hostName}";
    upgrade = false;
    flags = [
      "--no-update-lock-file"
      "--option"
      "allow-dirty"
      "false"
    ];
    dates = "02:00";
    persistent = false;
    randomizedDelaySec = lib.mkDefault "15min";
  };
  systemd.services.nixos-upgrade = {
    path = [ pkgs.gh ];
    preStart = ''
      /run/wrappers/bin/sudo -u david -- ${pkgs.bash}/bin/bash -euc '
        cd /etc/nixos
        test "$(git branch --show-current)" = main
        test -z "$(git status --porcelain)"
        git -c pull.rebase=false -c rebase.autoStash=false pull --ff-only origin main
        test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
      '
    '';
    serviceConfig = {
      Nice = 10;
      IOSchedulingClass = "idle";
    };
  };

  programs.git = {
    enable = true;
    config.safe.directory = "/etc/nixos";
  };

  home-manager = {
    useGlobalPkgs = true;
    useUserPackages = true;
    backupFileExtension = "before-home-manager";
    extraSpecialArgs = { inherit inputs; };
    users.david.imports = [ ../home/common.nix ];
  };
}
