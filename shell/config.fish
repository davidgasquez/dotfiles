# Add local bin
set PATH /home/david/.local/bin/ $PATH

# Editor
alias c="code-insiders --enable-features=UseOzonePlatform --ozone-platform=wayland"
alias code="code-insiders --enable-features=UseOzonePlatform --ozone-platform=wayland"

# System Management
alias up="yay -Syu --noconfirm --noansweredit --sudoloop"
alias upup="yay -Syu --noconfirm --noansweredit --devel --sudoloop"
alias pastebin="curl -F c @- https://ptpb.pw"

# Tasks
alias t="todo --color l -f 'today'"
alias tn="todo q"
alias ts="todo s"
alias td="todo c"

# Docker
alias drmsc="docker rm (docker ps -a -q)"
alias drmdi="docker rmi (docker images -f dangling true -q)"
alias dj="docker run -p 8888:8888 -it --rm davidgasquez/dopyter:latest"
alias djlo="docker run -p 8888:8888 -it --user (id -u):(id -g) --rm -v $PWD:/work davidgasquez/dopyter:latest"

# Custom
alias handbook="code ~/projects/handbook"

# SSH Agent
function __ssh_agent_is_started -d "check if ssh agent is already started"
	if begin; test -f $SSH_ENV; and test -z "$SSH_AGENT_PID"; end
		source $SSH_ENV > /dev/null
	end

	if begin; test -z "$SSH_AGENT_PID"; and test -z "$SSH_CONNECTION"; end
		return 1
	end

	ssh-add -l > /dev/null 2>&1
	if test $status -eq 2
		return 1
	end
end

function __ssh_agent_start -d "start a new ssh agent"
  ssh-agent -c | sed 's/^echo/#echo/' > $SSH_ENV
  chmod 600 $SSH_ENV
  source $SSH_ENV > /dev/null
end

if test -z "$SSH_ENV"
    set -xg SSH_ENV $HOME/.ssh/environment
end

if not __ssh_agent_is_started
    __ssh_agent_start
	ssh-add
end

# Starship
starship init fish | source
