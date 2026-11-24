{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  time.timeZone = "Europe/Madrid";
  i18n.defaultLocale = "en_US.UTF-8";

  zramSwap.enable = true;
  boot.kernel.sysctl = {
    "vm.page-cluster" = 0;
    "vm.swappiness" = 180;
    "vm.watermark_boost_factor" = 0;
    "vm.watermark_scale_factor" = 125;
  };

  programs.zsh = {
    enable = true;
    enableGlobalCompInit = false;
  };
  users.users.david = {
    isNormalUser = true;
    shell = pkgs.zsh;
    extraGroups = [ "wheel" ];
    linger = true;
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
    extraSetFlags = [
      "--ssh"
      "--operator=david"
    ];
  };
  systemd.services.tailscaled-set = {
    wantedBy = [ "multi-user.target" ];
    serviceConfig.RemainAfterExit = true;
  };
  programs.ssh.extraConfig = ''
    Host helix tau zephyr
      User david
  '';

  nix.settings = {
    experimental-features = [
      "nix-command"
      "flakes"
    ];
    extra-substituters = [ "https://cache.numtide.com" ];
    extra-trusted-public-keys = [
      "niks3.numtide.com-1:DTx8wZduET09hRmMtKdQDxNNthLQETkc/yaX7M4qK0g="
    ];
    min-free = "2G";
    max-free = "5G";
  };
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };
  nix.optimise.automatic = true;

  services.journald.settings.Journal = {
    SystemMaxUse = lib.mkDefault "500M";
    RuntimeMaxUse = lib.mkDefault "100M";
    MaxRetentionSec = lib.mkDefault "14day";
  };

  system.autoUpgrade = {
    enable = true;
    flake = "/etc/nixos#${config.networking.hostName}";
    upgrade = false;
    flags = [ "--no-update-lock-file" ];
  };
  systemd.services.nixos-upgrade = {
    preStart = ''
      git=(${pkgs.util-linux}/bin/runuser -u david -- env HOME=${config.users.users.david.home} git -C /etc/nixos)
      test "$("''${git[@]}" branch --show-current)" = main
      "''${git[@]}" pull --ff-only --no-rebase --no-autostash origin main
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
