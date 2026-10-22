{ lib, pkgs, ... }:

{
  home.stateVersion = "26.05";

  programs.google-chrome.commandLineArgs = [
    "--render-node-override=/dev/dri/by-path/pci-0000:07:00.0-render"
    "--enable-features=AcceleratedVideoEncoder"
  ];
  wayland.windowManager.hyprland.extraConfig = lib.mkAfter ''
    for _, output in ipairs({ "eDP-1", "eDP-2" }) do
      hl.monitor({ output = output, mode = "highrr", position = "auto", scale = 5 / 3 })
    end
    hl.monitor({ output = "HDMI-A-1", mode = "3840x2160@60", position = "auto", scale = 5 / 3 })
  '';

  services.hypridle.settings.listener = lib.mkForce [
    {
      timeout = 60;
      on-timeout = "${pkgs.brightnessctl}/bin/brightnessctl -s set 10%";
      on-resume = "${pkgs.brightnessctl}/bin/brightnessctl -r";
    }
    {
      timeout = 300;
      on-timeout = "${pkgs.systemd}/bin/loginctl lock-session";
    }
    {
      timeout = 600;
      on-timeout = "hyprctl dispatch 'hl.dsp.dpms({ action = \"disable\" })'";
      on-resume = "hyprctl dispatch 'hl.dsp.dpms({ action = \"enable\" })'";
    }
  ];

  programs.waybar.settings.mainBar = {
    modules-right = lib.mkBefore [ "battery" ];
    battery = {
      bat = "BAT0";
      adapter = "AC0";
      interval = 30;
      states = {
        warning = 20;
        critical = 10;
      };
      format = "{icon} {capacity}%";
      format-charging = "󰂄 {capacity}%";
      format-icons = [
        "󰁺"
        "󰁼"
        "󰁾"
        "󰂀"
        "󰁹"
      ];
      tooltip-format = "{timeTo} · {power:.1f} W";
    };
  };
  programs.waybar.style = lib.mkAfter ''
    #battery { padding: 0 10px; }
    #battery.warning { color: @yellow; }
    #battery.critical { color: @red; }
  '';
}
