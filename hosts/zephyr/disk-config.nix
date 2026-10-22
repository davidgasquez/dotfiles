{
  disko.devices.disk.system = {
    type = "disk";
    device = "/dev/disk/by-id/nvme-Micron_2450_MTFDKBA1T0TFK_214632FAFF22";
    content = {
      type = "gpt";
      partitions = {
        ESP = {
          size = "1G";
          type = "EF00";
          content = {
            type = "filesystem";
            format = "vfat";
            mountpoint = "/boot";
            mountOptions = [ "umask=0077" ];
          };
        };
        root = {
          size = "100%";
          content = {
            type = "luks";
            name = "zephyr-root";
            passwordFile = "/run/zephyr-disk-password";
            settings.allowDiscards = true;
            content = {
              type = "filesystem";
              format = "ext4";
              mountpoint = "/";
            };
          };
        };
      };
    };
  };
}
