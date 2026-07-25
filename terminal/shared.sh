# Shared shell config for bash and zsh

# Common aliases
alias ls='eza --color=auto --icons=always'
alias ll='eza -l --icons'
alias la='eza -la --icons'
alias tree='eza --tree --icons'
alias cat='bat -pp'
alias up='paru -Syu --skipreview --noconfirm && uv tool upgrade --all && pi update && pull-all-dirs ~/projects'
alias copy='wl-copy'
alias pasta='wl-paste'

# Common helpers
open() {
  xdg-open "$@" >/dev/null 2>&1
}
