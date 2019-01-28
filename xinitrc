[[ -f ~/.Xresources ]] && xrdb -merge -I$HOME ~/.Xresources

numlockx &
exec i3
