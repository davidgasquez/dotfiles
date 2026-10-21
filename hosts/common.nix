{
  config,
  inputs,
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
    flags = [ "--no-update-lock-file" ];
  };
  systemd.services.nixos-upgrade = {
    path = [ pkgs.gh ];
    preStart = ''
      cd /etc/nixos
      /run/wrappers/bin/sudo -u david -H git pull --ff-only || true
      /run/wrappers/bin/sudo -u david -H nix flake update --commit-lock-file
    '';
    postStart = ''
      cd /etc/nixos
      /run/wrappers/bin/sudo -u david -H git push
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
