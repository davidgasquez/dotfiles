{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  imports = [
    inputs.disko.nixosModules.disko
    ./hardware.nix
    ./disk-config.nix
    ../../modules/desktop
    ../../modules/agents
  ];

  networking.hostName = "zephyr";
  boot.loader.limine.style.interface.resolution = "2560x1600";

  systemd.services.nixos-upgrade.preStart = lib.mkBefore ''
    ${pkgs.networkmanager}/bin/nm-online --quiet --timeout=120
  '';

  services.power-profiles-daemon.enable = true;
  services.asusd.asusdConfig.text = ''
    (
      charge_control_end_threshold: 80,
      base_charge_control_end_threshold: 80,
      disable_nvidia_powerd_on_battery: true,
      ac_command: "",
      bat_command: "",
      platform_profile_linked_epp: false,
      platform_profile_on_battery: Quiet,
      change_platform_profile_on_battery: false,
      platform_profile_on_ac: Performance,
      change_platform_profile_on_ac: false,
      profile_quiet_epp: Power,
      profile_balanced_epp: BalancePower,
      profile_custom_epp: Performance,
      profile_performance_epp: Performance,
      ac_profile_tunings: {},
      dc_profile_tunings: {},
      armoury_settings: {},
    )
  '';
  systemd.services.asusd.restartTriggers = [
    config.environment.etc."asusd/asusd.ron".source
  ];

  services.upower = {
    enable = true;
    percentageLow = 20;
    percentageCritical = 10;
    percentageAction = 5;
    criticalPowerAction = "PowerOff";
  };
  systemd.services.upower.restartTriggers = [
    config.environment.etc."UPower/UPower.conf".source
  ];
  services.fwupd.enable = true;
  services.logind.settings.Login = {
    HandleLidSwitch = "suspend";
    HandleLidSwitchExternalPower = "suspend";
    HandleLidSwitchDocked = "ignore";
  };

  services.openssh = {
    enable = true;
    settings = {
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
      PermitRootLogin = "no";
    };
  };
  users.users.david = {
    hashedPasswordFile = "/var/lib/secrets/david-password-hash";
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIP/Zjl7ztFYGhOvvXaHxjzdDQUCtMUjouh5SJM4z8UlT"
    ];
  };

  home-manager.users.david.imports = [ ./home.nix ];
  system.stateVersion = "26.05";
}
