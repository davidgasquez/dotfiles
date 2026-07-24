local function bind(keys, description, dispatcher, options)
  local bind_options = { description = description }
  for key, value in pairs(options or {}) do
    bind_options[key] = value
  end

  if type(dispatcher) == "string" then
    dispatcher = hl.dsp.exec_cmd(dispatcher)
  end

  hl.bind(keys, dispatcher, bind_options)
end

local function launch(command)
  return "uwsm-app -- " .. command
end

bind("SUPER + RETURN", "Open terminal", launch("ghostty +new-window"))
bind("SUPER + SHIFT + Q", "Close window", hl.dsp.window.close())
bind("SUPER + M", "Open power mode", hl.dsp.submap("power"))
bind("SUPER + SHIFT + X", "Open file manager", launch("thunar"))
bind("SUPER + V", "Toggle window floating", hl.dsp.window.float({ action = "toggle" }))
bind("SUPER + F", "Toggle fullscreen", hl.dsp.window.fullscreen({ mode = "fullscreen" }))
bind("SUPER + BACKSPACE", "Open application launcher", launch("fuzzel"))
bind("SUPER + P", "Toggle pseudotiling", hl.dsp.window.pseudo())
bind("SUPER + J", "Toggle split direction", hl.dsp.layout("togglesplit"))

local directions = {
  { key = "LEFT", direction = "l", label = "left" },
  { key = "RIGHT", direction = "r", label = "right" },
  { key = "UP", direction = "u", label = "up" },
  { key = "DOWN", direction = "d", label = "down" },
}

for _, direction in ipairs(directions) do
  bind(
    "SUPER + " .. direction.key,
    "Focus " .. direction.label,
    hl.dsp.focus({ direction = direction.direction })
  )
  bind(
    "SUPER + SHIFT + " .. direction.key,
    "Move window " .. direction.label,
    hl.dsp.window.move({ direction = direction.direction })
  )
end

for workspace = 1, 10 do
  local key = "code:" .. tostring(workspace + 9)
  bind(
    "SUPER + " .. key,
    "Switch to workspace " .. workspace,
    hl.dsp.focus({ workspace = workspace })
  )
  bind(
    "SUPER + SHIFT + " .. key,
    "Move window to workspace " .. workspace,
    hl.dsp.window.move({ workspace = workspace, follow = false })
  )
end

bind("SUPER + S", "Toggle scratchpad", hl.dsp.workspace.toggle_special("magic"))
bind(
  "SUPER + SHIFT + S",
  "Move window to scratchpad",
  hl.dsp.window.move({ workspace = "special:magic" })
)
bind("SUPER + mouse_down", "Next workspace", hl.dsp.focus({ workspace = "e+1" }))
bind("SUPER + mouse_up", "Previous workspace", hl.dsp.focus({ workspace = "e-1" }))
bind("SUPER + mouse:272", "Move window", hl.dsp.window.drag(), { mouse = true })
bind("SUPER + mouse:273", "Resize window", hl.dsp.window.resize(), { mouse = true })

bind(
  "SUPER + CTRL + V",
  "Open clipboard history",
  [[selection=$(cliphist list | fuzzel --dmenu --with-nth=2 --only-match --no-run-if-empty --prompt='Clipboard > ') && [ -n "$selection" ] && printf '%s\n' "$selection" | cliphist decode | wl-copy]]
)

bind("PRINT", "Capture output", "hyprshot -m output")
bind("SHIFT + PRINT", "Capture region", "hyprshot -m region")
bind("SUPER + SHIFT + P", "Capture region", "hyprshot -m region")
bind("CTRL + PRINT", "Capture window", "hyprshot -m window")

bind(
  "SUPER + SHIFT + BACKSPACE",
  "Open editor project",
  [[project=$(find "$HOME/projects" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | fuzzel -x 20 -d -I --prompt='🖥️ > ') && uwsm-app -- zeditor -n "$HOME/projects/$project"]]
)
bind("SUPER + SHIFT + minus", "Open AI agent in project", "open-ai-agent")
bind("SUPER + SHIFT + I", "Open Pi sandbox", "pi-sandbox")
bind("SUPER + SHIFT + A", "Open ChatGPT", launch("brave --app=https://chatgpt.com"))
bind("SUPER + SHIFT + T", "Open Todoist", launch("brave --app=https://app.todoist.com/app/today"))
bind("SUPER + SHIFT + B", "Open browser", launch("brave"))
bind("SUPER + SHIFT + N", "Open notes project", launch([[zeditor -n "$HOME/projects/notes"]]))
bind("SUPER + SHIFT + M", "Open personal project", launch([[zeditor -n "$HOME/projects/personal"]]))
bind("SUPER + SHIFT + D", "Open dotfiles project", launch([[zeditor -n "$HOME/projects/dotfiles"]]))
bind("SUPER + SHIFT + H", "Open handbook project", launch([[zeditor -n "$HOME/projects/handbook"]]))
bind("SUPER + SHIFT + E", "Open emoji picker", launch("bemoji -n"))
bind("SUPER + SHIFT + O", "Toggle voice recording", "voxtype record toggle")

local repeat_locked = { locked = true, repeating = true }
local locked = { locked = true }

bind(
  "XF86AudioRaiseVolume",
  "Raise volume",
  "wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 2%+",
  repeat_locked
)
bind(
  "XF86AudioLowerVolume",
  "Lower volume",
  "wpctl set-volume @DEFAULT_AUDIO_SINK@ 2%-",
  repeat_locked
)
bind(
  "XF86AudioMute",
  "Toggle audio mute",
  "wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle",
  repeat_locked
)
bind(
  "XF86AudioMicMute",
  "Toggle microphone mute",
  "wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle",
  repeat_locked
)
bind("XF86AudioNext", "Next track", "playerctl next", locked)
bind("XF86AudioPause", "Toggle playback", "playerctl play-pause", locked)
bind("XF86AudioPlay", "Toggle playback", "playerctl play-pause", locked)
bind("XF86AudioPrev", "Previous track", "playerctl previous", locked)
bind(
  "XF86MonBrightnessUp",
  "Raise brightness",
  "brightnessctl -e4 -n2 set 5%+",
  repeat_locked
)
bind(
  "XF86MonBrightnessDown",
  "Lower brightness",
  "brightnessctl -e4 -n2 set 5%-",
  repeat_locked
)

bind("SUPER + R", "Open resize mode", hl.dsp.submap("resize"))
hl.define_submap("resize", function()
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
    bind(
      key,
      "Resize window",
      hl.dsp.window.resize({ x = step[1], y = step[2], relative = true }),
      { repeating = true }
    )
  end

  bind("ESCAPE", "Exit resize mode", hl.dsp.submap("reset"))
  bind("RETURN", "Exit resize mode", hl.dsp.submap("reset"))
  bind("catchall", "Exit resize mode", hl.dsp.submap("reset"))
end)

bind("SUPER + SHIFT + L", "Open power mode", hl.dsp.submap("power"))
hl.define_submap("power", "reset", function()
  bind("L", "Lock session", "loginctl lock-session")
  bind("S", "Suspend", "systemctl suspend")
  bind("Q", "Exit session", "uwsm stop")
  bind("R", "Reboot", "systemctl reboot")
  bind("P", "Power off", "systemctl poweroff")
  bind("ESCAPE", "Exit power mode", hl.dsp.submap("reset"))
  bind("RETURN", "Exit power mode", hl.dsp.submap("reset"))
  bind("catchall", "Exit power mode", hl.dsp.submap("reset"))
end)
