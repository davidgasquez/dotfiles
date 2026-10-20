{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

let
  hosts = {
    helix = {
      ip = "100.102.221.87";
      key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIak4uAeQGdx71kgfYyrTRZ5wVIIAoKGCa7O4dU29kgI";
    };
    tau = {
      ip = "100.125.95.52";
      key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINT9oAnQHaivtO+EEU2xJHi4EwQBSPjiopVkS8as0GD8";
    };
  };
in
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
    extraSetFlags = [ "--ssh=false" ];
  };
  services.openssh = {
    enable = true;
    openFirewall = false;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  networking.firewall.interfaces.${config.services.tailscale.interfaceName}.allowedTCPPorts = [ 22 ];

  programs.ssh = {
    extraConfig = lib.concatMapAttrsStringSep "" (name: host: ''
      Host ${name} ${host.ip}
        HostName ${host.ip}
        IdentityAgent none
        IdentitiesOnly yes
    '') hosts;
    knownHosts = lib.mapAttrs (_: host: {
      extraHostNames = [ host.ip ];
      publicKey = host.key;
    }) hosts;
  };

  nix.settings.experimental-features = [
    "nix-command"
    "flakes"
  ];

  system.autoUpgrade = {
    enable = true;
    flake = "/home/david/projects/dotfiles";
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
    preStart = ''
      /run/wrappers/bin/sudo -u david -- ${pkgs.bash}/bin/bash -euc '
        cd /home/david/projects/dotfiles
        git diff --quiet
        git diff --cached --quiet
        git pull --ff-only
        test "$(git rev-parse HEAD)" = "$(git rev-parse "@{upstream}")"
      '
    '';
    serviceConfig = {
      Nice = 10;
      IOSchedulingClass = "idle";
    };
  };

  programs.git = {
    enable = true;
    config.safe.directory = "/home/david/projects/dotfiles";
  };

  home-manager = {
    useGlobalPkgs = true;
    useUserPackages = true;
    backupFileExtension = "before-home-manager";
    extraSpecialArgs = { inherit inputs; };
    users.david.imports = [ ../home/common.nix ];
  };
}
