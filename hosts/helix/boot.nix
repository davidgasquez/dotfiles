{
  lib,
  ...
}:

{
  boot.loader.efi.canTouchEfiVariables = true;
  boot.initrd.luks.devices."helix-root".allowDiscards = true;
  fileSystems."/boot".options = lib.mkForce [
    "fmask=0077"
    "dmask=0077"
  ];

  boot.loader.timeout = 5;
  boot.plymouth = {
    enable = true;
    theme = "spinner";
  };
  boot.consoleLogLevel = 3;
  boot.initrd.verbose = false;
  boot.initrd.kernelModules = [ "amdgpu" ];
  boot.kernelParams = [
    "quiet"
    "rd.udev.log_level=3"
    "udev.log_level=3"
    "rd.systemd.show_status=false"
    "systemd.show_status=false"
    "vt.global_cursor_default=0"
  ];

  boot.initrd.systemd.enable = true;
  boot.initrd.systemd.tpm2.enable = true;
  boot.initrd.luks.devices."helix-root".crypttabExtraOpts = [ "tpm2-device=auto" ];

  boot.loader.systemd-boot.enable = false;
  boot.loader.limine = {
    enable = true;
    maxGenerations = 4;
    enableEditor = false;
    enrollConfig = true;
    validateChecksums = true;
    panicOnChecksumMismatch = true;
    style = {
      wallpapers = [ ];
      backdrop = "303446";
      interface = {
        resolution = "3440x1440";
        branding = "helix";
        brandingColor = "ca9ee6";
        helpColor = "ca9ee6";
        helpColorBright = "ca9ee6";
        helpHidden = true;
      };
      graphicalTerminal = {
        font.scale = "2x2";
        margin = 64;
        palette = "303446;e78284;a6d189;e5c890;8caaee;f4b8e4;81c8be;c6d0f5";
        brightPalette = "626880;e78284;a6d189;e5c890;8caaee;f4b8e4;81c8be;c6d0f5";
        background = "303446";
        foreground = "c6d0f5";
        brightBackground = "626880";
        brightForeground = "c6d0f5";
      };
    };
    extraConfig = ''
      terse: yes
    '';
    secureBoot = {
      enable = true;
      autoGenerateKeys = true;
      # Add the public signing certificate in firmware, preserving factory keys.
      autoEnrollKeys.enable = false;
    };
    extraEntries = ''
      /Windows
        protocol: efi
        path: boot():/EFI/Microsoft/Boot/bootmgfw.efi
    '';
  };
}
