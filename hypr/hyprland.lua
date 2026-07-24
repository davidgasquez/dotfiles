local home = assert(os.getenv("HOME"), "HOME is required to load the monitor configuration")
dofile(home .. "/.config/hypr/monitors.lua")

require("input")
require("looknfeel")
require("windows")
require("bindings")
require("autostart")
