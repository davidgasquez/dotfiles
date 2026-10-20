hl.monitor({
  output   = "",
  mode     = "highrr",
  position = "auto",
  scale    = 1,
})

hl.config({
  general = {
    gaps_in  = 6,
    gaps_out = 12,
    border_size = 2,
    col = {
      active_border   = "rgb(ca9ee6)",
      inactive_border = "rgb(737994)",
    },
    resize_on_border = true,
    allow_tearing = false,
    layout = "dwindle",
  },

  decoration = {
    rounding = 8,
    shadow = { enabled = false },
    blur = { enabled = false },
  },

  dwindle = {
    preserve_split = true,
    force_split = 2,
  },

  misc = {
    disable_hyprland_logo = true,
    disable_splash_rendering = true,
    background_color = "rgb(232634)",
    font_family = "Inter",
  },

  input = {
    kb_layout = "es",
    numlock_by_default = true,
  },
})

local tiled_single = "w[tv1]s[false]"
local maximized = "f[1]s[false]"

hl.workspace_rule({ workspace = tiled_single, gaps_out = 0, gaps_in = 0 })
hl.workspace_rule({ workspace = maximized, gaps_out = 0, gaps_in = 0 })

hl.window_rule({
  name = "smart-gaps-single-tiled",
  match = { workspace = tiled_single, float = false },
  border_size = 0,
  rounding = 0,
})

hl.window_rule({
  name = "smart-gaps-maximized",
  match = { workspace = maximized, float = false },
  border_size = 0,
  rounding = 0,
})

hl.animation({ leaf = "global", enabled = true, speed = 1, bezier = "default" })
hl.animation({ leaf = "workspaces", enabled = false })

hl.gesture({
  fingers = 3,
  direction = "horizontal",
  action = "workspace",
})

local mainMod = "SUPER"
local powerSubmap = "power · L bloquear · S suspender · Q salir · R reiniciar · P apagar"
local resizeSubmap = "Redimensionar · ← ↓ ↑ → · Esc salir"

hl.bind(mainMod .. " + SHIFT + A", hl.dsp.exec_cmd("uwsm app -- chatgpt"), { description = "Open ChatGPT" })

hl.bind(mainMod .. " + RETURN", hl.dsp.exec_cmd("ghostty +new-window"))
hl.bind(mainMod .. " + SHIFT + Q", hl.dsp.window.close())

hl.bind(mainMod .. " + M", hl.dsp.submap(powerSubmap))
hl.bind(mainMod .. " + SHIFT + L", hl.dsp.submap(powerSubmap))
hl.define_submap(powerSubmap, "reset", function()
  hl.bind("L", hl.dsp.exec_cmd("loginctl lock-session"), { description = "Lock session" })
  hl.bind("S", hl.dsp.exec_cmd("systemctl suspend"), { description = "Suspend" })
  hl.bind("Q", hl.dsp.exec_cmd("uwsm stop"), { description = "Log out" })
  hl.bind("R", hl.dsp.exec_cmd("systemctl reboot"), { description = "Reboot" })
  hl.bind("P", hl.dsp.exec_cmd("systemctl poweroff"), { description = "Power off" })
  hl.bind("ESCAPE", hl.dsp.submap("reset"))
  hl.bind("RETURN", hl.dsp.submap("reset"))
  hl.bind("catchall", hl.dsp.submap("reset"))
end)
hl.bind(mainMod .. " + SHIFT + X", hl.dsp.exec_cmd("uwsm app -- thunar"))
hl.bind(mainMod .. " + V", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + F", hl.dsp.window.fullscreen({ mode = "fullscreen" }))
hl.bind(mainMod .. " + BACKSPACE", hl.dsp.exec_cmd("uwsm app -- fuzzel"))
hl.bind(mainMod .. " + SHIFT + BACKSPACE", hl.dsp.exec_cmd("uwsm app -- open-project"), { description = "Open project in Zed" })
hl.bind(mainMod .. " + SHIFT + M", hl.dsp.exec_cmd([[uwsm app -- zeditor --new -- "$HOME/projects/personal"]]), { description = "Open personal project" })
hl.bind(mainMod .. " + SHIFT + D", hl.dsp.exec_cmd([[uwsm app -- zeditor --new -- "$HOME/projects/nixos"]]), { description = "Open NixOS project" })
hl.bind(mainMod .. " + SHIFT + B", hl.dsp.exec_cmd("uwsm app -- google-chrome-stable --new-window"), { description = "Open browser" })
hl.bind(mainMod .. " + SHIFT + T", hl.dsp.exec_cmd("uwsm app -- google-chrome-stable --app=https://app.todoist.com/app/today"), { description = "Open Todoist" })
hl.bind(mainMod .. " + SHIFT + I", hl.dsp.exec_cmd("uwsm app -- pi-scratch"), { description = "Open Pi scratch" })
hl.bind(mainMod .. " + CTRL + V", hl.dsp.exec_cmd("uwsm app -- clipboard-history"))
hl.bind(mainMod .. " + CTRL + SHIFT + V", hl.dsp.exec_cmd("uwsm app -- clipboard-history --delete"))
hl.bind(mainMod .. " + P", hl.dsp.window.pseudo())
hl.bind(mainMod .. " + J", hl.dsp.layout("togglesplit"))

hl.bind("PRINT", hl.dsp.exec_cmd("uwsm app -- hyprshot -m output"))
hl.bind("SHIFT + PRINT", hl.dsp.exec_cmd("uwsm app -- hyprshot -m region"))
hl.bind("CTRL + PRINT", hl.dsp.exec_cmd("uwsm app -- hyprshot -m window"))
hl.bind(mainMod .. " + SHIFT + P", hl.dsp.exec_cmd("uwsm app -- hyprshot -m region"))

hl.bind(mainMod .. " + left",  hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + up",    hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + down",  hl.dsp.focus({ direction = "down" }))

hl.bind(mainMod .. " + SHIFT + left",  hl.dsp.window.move({ direction = "left" }))
hl.bind(mainMod .. " + SHIFT + right", hl.dsp.window.move({ direction = "right" }))
hl.bind(mainMod .. " + SHIFT + up",    hl.dsp.window.move({ direction = "up" }))
hl.bind(mainMod .. " + SHIFT + down",  hl.dsp.window.move({ direction = "down" }))

for i = 1, 10 do
  local key = "code:" .. tostring(i + 9)
  hl.bind(mainMod .. " + " .. key,             hl.dsp.focus({ workspace = i}))
  hl.bind(mainMod .. " + SHIFT + " .. key,     hl.dsp.window.move({ workspace = i, follow = false }))
end

hl.bind(mainMod .. " + S",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + S", hl.dsp.window.move({ workspace = "special:magic" }))

hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(),   { mouse = true })
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize(), { mouse = true })

hl.bind(mainMod .. " + R", hl.dsp.submap(resizeSubmap))
hl.define_submap(resizeSubmap, function()
  local steps = {
    RIGHT = { 40, 0 },
    LEFT = { -40, 0 },
    UP = { 0, -40 },
    DOWN = { 0, 40 },
    L = { 40, 0 },
    H = { -40, 0 },
    K = { 0, -40 },
    J = { 0, 40 },
  }

  for key, step in pairs(steps) do
    hl.bind(key, hl.dsp.window.resize({ x = step[1], y = step[2], relative = true }), { repeating = true })
  end

  hl.bind("ESCAPE", hl.dsp.submap("reset"))
  hl.bind("RETURN", hl.dsp.submap("reset"))
end)

hl.bind("XF86AudioRaiseVolume", hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 2%+"), { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume", hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 2%-"),      { locked = true, repeating = true })
hl.bind("XF86AudioMute",        hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"),     { locked = true, repeating = true })
hl.bind("XF86AudioMicMute",     hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"),   { locked = true, repeating = true })
hl.bind("XF86MonBrightnessUp",  hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%+"),                  { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown",hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%-"),                  { locked = true, repeating = true })

hl.bind("XF86AudioNext",  hl.dsp.exec_cmd("playerctl next"),       { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay",  hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev",  hl.dsp.exec_cmd("playerctl previous"),   { locked = true })

hl.window_rule({
  name = "spotify-workspace",
  match = { class = "spotify" },
  workspace = "10 silent",
})

hl.window_rule({
  name  = "suppress-maximize-events",
  match = { class = ".*" },
  suppress_event = "maximize",
})

hl.window_rule({
  name  = "fix-xwayland-drags",
  match = {
    class      = "^$",
    title      = "^$",
    xwayland   = true,
    float      = true,
    fullscreen = false,
    pin        = false,
  },
  no_focus = true,
})
