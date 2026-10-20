{
  config,
  lib,
  pkgs,
  ...
}:

{
  imports = [
    ./hardware-configuration.nix
    ./boot.nix
    ../../modules/desktop
    ../../modules/agents
  ];

  fileSystems."/mnt/sandbox" = {
    device = "/dev/disk/by-uuid/2DC244C63A30DA61";
    fsType = "ntfs3";
    options = [
      "uid=1000"
      "gid=100"
      "umask=0022"
      "windows_names"
      "nofail"
    ];
  };

  networking.hostName = "helix";
  environment.systemPackages = [
    (pkgs.writeShellApplication {
      name = "nixos-update";
      runtimeInputs = [
        config.nix.package
        pkgs.gitMinimal
      ];
      text = ''
        cd /etc/nixos
        git diff --quiet
        git diff --cached --quiet
        nix flake update --refresh
        nix flake check --all-systems --no-build --no-update-lock-file
        printf 'Review flake.lock, build both hosts, then commit and push from Helix.\n'
      '';
    })
  ];
  system.autoUpgrade = {
    randomizedDelaySec = "0";
  };
  systemd.timers.nixos-upgrade.timerConfig = {
    OnCalendar = lib.mkForce [ ];
    OnBootSec = "1min";
  };
  nixpkgs.config.allowUnfreePredicate =
    pkg:
    builtins.elem (lib.getName pkg) [
      "google-chrome"
      "chatgpt"
      "spotify"
      "slack"
      "steam"
      "steam-unwrapped"
    ];
  networking.networkmanager = {
    enable = true;
    dns = "systemd-resolved";
    connectionConfig."ipv4.dad-timeout" = 200;
    ensureProfiles.profiles.helix-lan = {
      connection = {
        id = "helix-lan";
        uuid = "ca87566a-9356-45f2-8098-34bf8c9896b2";
        type = "ethernet";
      };
      match.path = "pci-0000:24:00.0";
      ethernet.wake-on-lan = 64;
      ipv4 = {
        method = "auto";
        dhcp-client-id = "mac";
      };
      ipv6.method = "auto";
    };
  };
  systemd.services.NetworkManager-wait-online.enable = false;
  services.resolved.enable = true;
  hardware.bluetooth.enable = true;
  services.pipewire.wireplumber.extraConfig."51-preferred-microphone" = {
    "monitor.alsa.rules" = [
      {
        matches = [ { "node.name" = "~alsa_input.usb-BLUE_MICROPHONE_Blue_Snowball_.*"; } ];
        actions.update-props."priority.session" = 2500;
      }
    ];
  };
  systemd.network.links."10-helix-lan" = {
    matchConfig.Path = "pci-0000:24:00.0";
    linkConfig = {
      NamePolicy = "keep kernel database onboard slot path";
      WakeOnLan = "magic";
    };
  };
  time.timeZone = "Europe/Madrid";
  i18n.defaultLocale = "en_US.UTF-8";
  console.keyMap = "es";

  users.users.david = {
    extraGroups = [ "networkmanager" ];
  };

  programs.nix-ld.enable = true;

  home-manager.users.david.imports = [ ./home.nix ];

  system.stateVersion = "26.05";
}
