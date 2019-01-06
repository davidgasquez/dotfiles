[[ -f ~/.Xresources ]] && xrdb -merge -I$HOME ~/.Xresources

exec i3
