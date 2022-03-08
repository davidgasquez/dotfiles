# Add local bin
set PATH /home/david/.local/bin/ $PATH

# Editor
alias c="code ."

# System Management
alias up="yay -Syu --noconfirm --noansweredit --sudoloop"
alias upup="yay -Syu --noconfirm --noansweredit --devel --sudoloop"

# Tasks
alias t="todo --color l -f 'today'"
alias tn="todo q"
alias ts="todo s"
alias td="todo c"

alias notes='open "obsidian://open?vault=notes"'
alias hb='open "obsidian://open?vault=handbook"'

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

if test -z $DISPLAY; and test (tty) = "/dev/tty1"
  sway
end
