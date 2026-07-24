local scale = 5 / 3

hl.monitor({
  output = "",
  mode = "highrr",
  position = "auto",
  scale = scale,
})

hl.monitor({
  output = "HDMI-A-1",
  mode = "3840x2160@60",
  position = "auto",
  scale = scale,
})
