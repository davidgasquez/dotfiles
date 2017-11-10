#!/usr/bin/env sh

icon=""

player_status=$(playerctl status 2> /dev/null)

if [[ $? -eq 0 ]]; then
    metadata="$(playerctl metadata artist) - $(playerctl metadata title)"
fi

if [[ $player_status = "Playing" ]]; then
    echo "$icon %{F#C8D6E9}$metadata"
elif [[ $player_status = "Paused" ]]; then
    echo "$icon %{F#888}$metadata"
else
    echo ""
fi
