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

hl.window_rule({
  name = "slack-workspace",
  match = { class = "^slack$" },
  workspace = "3 silent",
})

hl.window_rule({
  name = "spotify-workspace",
  match = { class = "^Spotify$" },
  workspace = "10 silent",
})

hl.window_rule({
  name = "gaming",
  match = { class = "^(steam_app_[0-9]+|gamescope)$" },
  content = "game",
  immediate = true,
  border_size = 0,
  rounding = 0,
})

hl.window_rule({
  name = "suppress-maximize-events",
  match = { class = ".*" },
  suppress_event = "maximize",
})
