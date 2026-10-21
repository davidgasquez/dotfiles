{ ... }:

{
  imports = [
    ./hardware-configuration.nix
    ./boot.nix
    ./update.nix
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
