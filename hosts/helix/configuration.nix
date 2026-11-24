{ ... }:

{
  imports = [
    ./hardware-configuration.nix
    ./boot.nix
    ../../modules/desktop
    ../../modules/agents
    ../../modules/agents/llama-cpp.nix
  ];

  boot.kernelModules = [
    "tcp_bbr"
    "sch_fq"
  ];
  boot.kernel.sysctl = {
    "net.core.default_qdisc" = "fq";
    "net.ipv4.tcp_congestion_control" = "bbr";
    "net.core.rmem_default" = 1048576;
    "net.core.wmem_default" = 1048576;
    "net.core.rmem_max" = 67108864;
    "net.core.wmem_max" = 67108864;
    "net.ipv4.tcp_rmem" = "4096 131072 67108864";
    "net.ipv4.tcp_wmem" = "4096 131072 67108864";
    "net.core.netdev_max_backlog" = 16384;
    "net.ipv4.tcp_mtu_probing" = 1;
  };

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
    connectionConfig."ipv4.dad-timeout" = 200;
    ensureProfiles.profiles.helix-lan = {
      connection = {
        id = "helix-lan";
        uuid = "ca87566a-9356-45f2-8098-34bf8c9896b2";
        type = "ethernet";
      };
      match.path = "pci-0000:24:00.0";
      ipv4 = {
        method = "auto";
        dhcp-client-id = "mac";
      };
      ipv6.method = "auto";
    };
  };

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
      LargeReceiveOffload = false;
    };
  };

  home-manager.users.david.imports = [ ./home.nix ];

  system.stateVersion = "26.05";
}
