{
  boot.tmp.cleanOnBoot = true;
  boot.initrd.kernelModules = [ "amdgpu" ];
  boot.initrd.systemd.tpm2.enable = true;
  boot.initrd.luks.devices."helix-root" = {
    allowDiscards = true;
    crypttabExtraOpts = [ "tpm2-device=auto" ];
  };

  boot.loader.limine = {
    style.interface.resolution = "3440x1440";
    extraEntries = ''
      /Windows
        protocol: efi
        path: boot():/EFI/Microsoft/Boot/bootmgfw.efi
    '';
  };
}
