hl.on("hyprland.start", function()
  -- Install before spawning the app; keep it hidden until an explicit launch.
  hl.window_rule({
    name = "chatgpt-startup",
    match = { class = "^[Cc]hat[Gg][Pp][Tt]$" },
    workspace = "special:chatgpt-startup silent",
    no_focus = true,
    suppress_event = "activate activatefocus",
  })
  hl.exec_cmd("uwsm-app -- spotify")
  hl.exec_cmd("uwsm-app -- brave --no-startup-window --keep-alive-for-test")
  hl.exec_cmd("uwsm-app -- systemd-cat -t chatgpt-autostart chatgpt-launch --autostart")
end)
