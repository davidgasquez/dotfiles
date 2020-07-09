starship init fish | source

# Editor
alias c "code ."

# System Management
alias up "yay -Syu --noconfirm --noansweredit --sudoloop"
alias upup "yay -Syu --noconfirm --noansweredit --devel --sudoloop"
alias pastebin "curl -F c @- https://ptpb.pw"

# Taskwarrior
alias tn "task add"
alias t "task"
alias tl "task list"
alias ts "task sync"

# Docker
alias drmsc "docker rm (docker ps -a -q)"
alias drmdi "docker rmi (docker images -f dangling true -q)"
alias dj "docker run -p 8888:8888 -it --rm davidgasquez/dopyter:latest"
alias djlo "docker run -p 8888:8888 -it --user (id -u):(id -g) --rm -v $PWD:/work davidgasquez/dopyter:latest"

# Custom
alias handbook "code ~/projects/handbook"
