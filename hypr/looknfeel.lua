local active_border = {
  colors = { "rgb(8caaee)", "rgb(a6d189)" },
  angle = 90,
}

hl.config({
  general = {
    gaps_in = 6,
    gaps_out = 12,
    border_size = 3,
    col = {
      active_border = active_border,
      inactive_border = "rgb(232634)",
    },
    layout = "dwindle",
    allow_tearing = true,
  },
  ecosystem = {
    no_update_news = true,
    enforce_permissions = true,
  },
  xwayland = {
    force_zero_scaling = true,
  },
  decoration = {
    rounding = 0,
    shadow = {
      enabled = false,
    },
    blur = {
      enabled = false,
    },
  },
  dwindle = {
    preserve_split = true,
    force_split = 2,
  },
  misc = {
    force_default_wallpaper = 0,
    disable_hyprland_logo = true,
    disable_splash_rendering = true,
  },
})

hl.animation({ leaf = "global", enabled = true, speed = 4, bezier = "default" })

hl.permission({ binary = "/usr/bin/grim", type = "screencopy", mode = "allow" })
hl.permission({
  binary = "/usr/(lib|libexec|lib64)/xdg-desktop-portal-hyprland",
  type = "screencopy",
  mode = "allow",
})
