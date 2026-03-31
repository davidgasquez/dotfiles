# Shared shell config for bash and zsh

# Common aliases
alias cd='z'
alias ls='eza --color=auto --icons=always'
alias ll='eza -l --icons'
alias la='eza -la --icons'
alias tree='eza --tree --icons'
alias cat='bat -pp'
alias up='paru -Syu --devel --skipreview --noconfirm && (uv tool upgrade --all & npm update -g & pull-all-dirs ~/projects & wait)'
alias tn='td task add --project "Personal" --due "today" --priority p1'
alias tnw='td task add --project "Work" --due "today" --priority p1'
alias tls='td today'
alias copy='wl-copy'
alias pasta='wl-paste'

# Common helpers
open() {
  xdg-open "$@" >/dev/null 2>&1
}

# Hyprland
# Only check for starting Hyprland if we're in a TTY and no Wayland session is active
if [[ -z "$WAYLAND_DISPLAY" ]] && [[ "$(tty)" == /dev/tty* ]]; then
  if uwsm check may-start; then
    exec uwsm start default
  fi
fi
