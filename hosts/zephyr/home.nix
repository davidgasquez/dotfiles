{ lib, pkgs, ... }:

let
  chargeFull = pkgs.writeShellApplication {
    name = "battery-charge-full";
    runtimeInputs = [
      pkgs.asusctl
      pkgs.libnotify
    ];
    text = ''
      if asusctl battery oneshot; then
        notify-send --app-name="Battery" --icon=battery-full-charging \
          "One-time full charge enabled" "The 80% limit returns when you unplug the charger."
      else
        notify-send --app-name="Battery" --urgency=critical \
          "Could not enable full charging" "The charging limit could not be changed."
        exit 1
      fi
    '';
  };
  acPowerSync = pkgs.writeShellApplication {
    name = "ac-power-sync";
    runtimeInputs = with pkgs; [
      brightnessctl
      hyprland
      systemd
    ];
    text = ''
      last_online=""

      apply() {
        local online mode
        read -r online < /sys/class/power_supply/AC0/online
        if [ "$online" = "$last_online" ]; then
          return
        fi
        if [ "$online" = 1 ]; then
          mode="highrr"
        else
          mode="2560x1600@60"
          if [ -n "$last_online" ]; then
            brightnessctl -q -d asus::kbd_backlight set 0
            brightnessctl -q -d asus::kbd_backlight -s set 0
          fi
        fi
        last_online=$online
        hyprctl eval "for _, output in ipairs({ \"eDP-1\", \"eDP-2\" }) do hl.monitor({ output = output, mode = \"$mode\", position = \"auto\", scale = 5 / 3 }) end" >/dev/null
      }

      apply
      while IFS= read -r _; do
        apply
      done < <(udevadm monitor --udev --subsystem-match=power_supply)
    '';
  };
in
{
  home.stateVersion = "26.05";

  services.poweralertd.enable = true;

  home.sessionVariables = {
    MESA_VK_DEVICE_SELECT = "1002:1681!";
    GAMEMODERUNEXEC = "env -u MESA_VK_DEVICE_SELECT DRI_PRIME=1!";
  };
  xdg.configFile."uwsm/env-hyprland".text = ''
    _aq_drm_devices=""
    for _card in /dev/dri/by-path/pci-0000:07:00.0-card /dev/dri/by-path/pci-0000:03:00.0-card; do
      if [ -e "$_card" ]; then
        _resolved=$(${pkgs.coreutils}/bin/readlink -f "$_card")
        _aq_drm_devices="''${_aq_drm_devices:+$_aq_drm_devices:}$_resolved"
      fi
    done
    if [ -n "$_aq_drm_devices" ]; then
      export AQ_DRM_DEVICES="$_aq_drm_devices"
    fi
    unset _aq_drm_devices _card _resolved
  '';

  programs.google-chrome.commandLineArgs = [
    "--render-node-override=/dev/dri/by-path/pci-0000:07:00.0-render"
    "--enable-features=AcceleratedVideoEncoder"
  ];
  wayland.windowManager.hyprland.extraConfig = lib.mkAfter ''
    hl.config({ xwayland = { force_zero_scaling = true } })

    local function on_ac()
      local file = io.open("/sys/class/power_supply/AC0/online", "r")
      if not file then return true end
      local online = file:read("*l") == "1"
      file:close()
      return online
    end

    local internal_mode = on_ac() and "highrr" or "2560x1600@60"
    for _, output in ipairs({ "eDP-1", "eDP-2" }) do
      hl.monitor({ output = output, mode = internal_mode, position = "auto", scale = 5 / 3 })
    end
    hl.monitor({ output = "HDMI-A-1", mode = "3840x2160@60", position = "auto", scale = 5 / 3 })

    hl.bind("XF86KbdBrightnessUp", hl.dsp.exec_cmd("${pkgs.brightnessctl}/bin/brightnessctl -q -d asus::kbd_backlight set 1+"), { locked = true, repeating = true })
    hl.bind("XF86KbdBrightnessDown", hl.dsp.exec_cmd("${pkgs.brightnessctl}/bin/brightnessctl -q -d asus::kbd_backlight set 1-"), { locked = true, repeating = true })

    hl.on("hyprland.start", function()
      hl.exec_cmd("${pkgs.brightnessctl}/bin/brightnessctl -q -d asus::kbd_backlight set " .. (on_ac() and "3" or "0"))
    end)
  '';

  systemd.user.services.ac-power-sync = {
    Unit = {
      Description = "Sync internal display refresh rate and keyboard backlight with AC power";
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      Requisite = [ "graphical-session.target" ];
    };
    Service = {
      Type = "exec";
      ExecStart = lib.getExe acPowerSync;
      Restart = "on-failure";
      RestartSec = 2;
    };
    Install.WantedBy = [ "graphical-session.target" ];
  };

  services.hypridle.settings.listener = [
    {
      timeout = 60;
      on-timeout = "${pkgs.brightnessctl}/bin/brightnessctl -q -d asus::kbd_backlight -s set 0";
      on-resume = "${pkgs.brightnessctl}/bin/brightnessctl -q -d asus::kbd_backlight -r";
    }
    {
      timeout = 300;
      on-timeout = "${pkgs.brightnessctl}/bin/brightnessctl -q -c backlight -s set 10%";
      on-resume = "${pkgs.brightnessctl}/bin/brightnessctl -q -c backlight -r";
    }
    {
      timeout = 2400;
      on-timeout = "${pkgs.systemd}/bin/systemctl suspend";
    }
  ];

  programs.waybar.settings.mainBar = {
    modules-right = lib.mkBefore [
      "group/battery-controls"
      "backlight"
    ];
    "group/battery-controls" = {
      orientation = "inherit";
      drawer = {
        transition-duration = 200;
        transition-left-to-right = false;
        children-class = "battery-action";
      };
      modules = [
        "battery"
        "custom/battery-full-charge"
      ];
    };
    "custom/battery-full-charge" = {
      format = "󰂄 100% once";
      tooltip-format = "Charge to 100% once; the 80% limit returns when you unplug.";
      on-click = lib.getExe chargeFull;
    };
    backlight = {
      format = "󰃠 {percent}%";
      tooltip-format = "Screen brightness {percent}% · Scroll to adjust";
      on-scroll-up = "${pkgs.brightnessctl}/bin/brightnessctl -q -c backlight -n2 set 1%+";
      on-scroll-down = "${pkgs.brightnessctl}/bin/brightnessctl -q -c backlight -n2 set 1%-";
    };
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
      format-plugged = "󰚥 {capacity}%";
      format-full = "󰂅 {capacity}%";
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
    #battery-controls {
      background: @surface0;
      border-radius: 4px;
      margin-right: 4px;
    }
    #battery-controls #battery { margin-right: 0; }
    #custom-battery-full-charge {
      background: @surface1;
      border-radius: 3px;
      color: @subtext0;
      margin: 2px 0 2px 2px;
      padding: 0 8px;
    }
    #custom-battery-full-charge:hover { background: @mauve; color: @crust; }
    #battery.warning { color: @yellow; }
    #battery.critical { color: @red; }
  '';
}
