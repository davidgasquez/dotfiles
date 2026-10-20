{ config, ... }:

{
  nixpkgs.hostPlatform = "aarch64-linux";

  boot.loader.generic-extlinux-compatible.configurationLimit = 30;
  boot.initrd.systemd.tpm2.enable = false;
  boot.kernelParams = [ "8250.nr_uarts=1" ];
  hardware.wirelessRegulatoryDatabase = true;
  hardware.deviceTree.overlays = [
    {
      name = "bcm2712d0";
      filter = "bcm2712-d-rpi-5-b.dtb";
      dtboFile = "${config.boot.kernelPackages.kernel}/dtbs/overlays/bcm2712d0.dtbo";
    }
    {
      name = "pi5-cooling-fan";
      filter = "bcm2712-d-rpi-5-b.dtb";
      dtsText = ''
        /dts-v1/;
        /plugin/;

        / {
          compatible = "brcm,bcm2712";
        };

        &fan {
          status = "okay";
        };

        &rp1_pwm1 {
          status = "okay";
        };
      '';
    }
  ];

  fileSystems."/" = {
    device = "/dev/disk/by-label/NIXOS_SD";
    fsType = "ext4";
  };
}
