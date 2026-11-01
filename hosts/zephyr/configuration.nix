{
  config,
  inputs,
  lib,
  pkgs,
  ...
}:

let
  animeHexagon = pkgs.runCommand "anime-hexagon.png" { } ''
    ${pkgs.python3}/bin/python - "$out" <<'PY'
    import math
    import struct
    import sys
    import zlib

    width, height = 74, 39
    center_x, center_y = 24, 27
    radius = 5
    column_pitch_cm, row_pitch_cm = 0.77, 0.283
    diagonal_rows = 2 * radius
    side_length_cm = math.hypot(radius * column_pitch_cm, diagonal_rows * row_pitch_cm)
    vertical_rows = 2 * round(side_length_cm / (2 * row_pitch_cm)) - 2
    half_height = diagonal_rows + vertical_rows // 2
    top, bottom = center_y - half_height, center_y + half_height
    pixels = [bytearray(width * 3) for _ in range(height)]
    for row in range(61):
        count = 34 if row < 12 else 39 - row // 2
        diagonal_start = (row + 1) // 2 if row < 12 else row - 5
        diagonal_offset = max(5 - row // 2, 0)
        half_width = min(radius, (row - top) / 2, (bottom - row) / 2)
        for column in range(count):
            u = diagonal_start + column
            x = u - row / 2
            if abs(x - center_x) <= half_width:
                v = height - 1 - diagonal_offset - column
                pixels[v][u * 3:u * 3 + 3] = bytes([255, 255, 255])

    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data)))

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    scanlines = b"".join(bytes([0]) + row for row in pixels)
    with open(sys.argv[1], "wb") as image:
        image.write(bytes([137, 80, 78, 71, 13, 10, 26, 10]))
        image.write(chunk(b"IHDR", header))
        image.write(chunk(b"IDAT", zlib.compress(scanlines)))
        image.write(chunk(b"IEND", b""))
    PY
  '';
in
{
  imports = [
    inputs.disko.nixosModules.disko
    ./hardware.nix
    ./disk-config.nix
    ../../modules/desktop
    ../../modules/agents
    ../../modules/agents/llama-cpp.nix
  ];

  networking.hostName = "zephyr";
  boot.loader.limine.style.interface.resolution = "2560x1600";

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
  services.asusd.animeConfig.text = ''
    (
      system: [],
      boot: [],
      wake: [],
      shutdown: [],
      display_enabled: true,
      display_brightness: Low,
      builtin_anims_enabled: false,
      off_when_unplugged: true,
      off_when_suspended: true,
      off_when_lid_closed: true,
      brightness_on_battery: Low,
      builtin_anims: (
        boot: GlitchConstruction,
        awake: BinaryBannerScroll,
        sleep: BannerSwipe,
        shutdown: GlitchOut,
      ),
    )
  '';
  systemd.services.asusd = lib.mkIf config.services.asusd.enable {
    restartTriggers = [
      config.environment.etc."asusd/asusd.ron".source
      config.environment.etc."asusd/anime.ron".source
    ];
    serviceConfig.ExecStartPost = [
      "${config.services.asusd.package}/bin/asusctl anime pixel-image --path ${animeHexagon} --bright 1"
    ];
  };
  powerManagement.resumeCommands = ''
    ${pkgs.systemd}/bin/systemctl try-restart asusd.service
  '';

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

  users.users.david.hashedPasswordFile = "/var/lib/secrets/david-password-hash";

  home-manager.users.david.imports = [ ./home.nix ];
  system.stateVersion = "26.05";
}
