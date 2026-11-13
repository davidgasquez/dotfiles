{ inputs, pkgs, ... }:

{
  imports = [ inputs.nixos-hardware.nixosModules.raspberry-pi-5 ];

  nixpkgs.hostPlatform = "aarch64-linux";

  boot.loader.generic-extlinux-compatible.configurationLimit = 30;
  boot.initrd.systemd.tpm2.enable = false;
  boot.kernelPackages = pkgs.linuxPackages_latest;
  boot.kernelParams = [ "8250.nr_uarts=1" ];
  hardware.deviceTree.name = "broadcom/bcm2712-d-rpi-5-b.dtb";
  hardware.wirelessRegulatoryDatabase = true;

  systemd.network.links."10-tau-lan" = {
    matchConfig.MACAddress = "88:a2:9e:a7:dc:92";
    linkConfig.Name = "end0";
  };

  fileSystems."/" = {
    device = "/dev/disk/by-label/NIXOS_SD";
    fsType = "ext4";
  };
}
