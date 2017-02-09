#!/bin/bash

# Get the dir of the current script
SCRIPT_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
USER_HOME=$(eval echo ~${SUDO_USER})

ask_for_sudo() {
    # Ask for the administrator password upfront
    sudo -v

    while true; do
        sudo -n true
        echo
        sleep 60
        kill -0 "$$" || exit
    done &> /dev/null &
}

basic_installation (){
    echo "Updating system dotfiles:";

    # Bash
    echo -n " - shell";
    ln -sf $SCRIPT_DIR/shell/bashrc $USER_HOME/.bashrc;
    ln -sf $SCRIPT_DIR/shell/aliases $USER_HOME/.aliases;
    ln -sf $SCRIPT_DIR/shell/localrc $USER_HOME/.localrc;
    ln -sf $SCRIPT_DIR/shell/functions $USER_HOME/.functions;
    ln -sf $SCRIPT_DIR/shell/zshrc $USER_HOME/.zshrc;
    ln -sf $SCRIPT_DIR/shell/antigenrc $USER_HOME/.antigen/.antigenrc;
    echo -e "\t✓";

    # Git
    echo -n " - gitconfig";
    ln -sf $SCRIPT_DIR/git/gitconfig $USER_HOME/.gitconfig;
    echo -e "\t✓";

    # Tmux
    echo -n " - tmux";
    ln -sf $SCRIPT_DIR/tmux/tmux.conf $USER_HOME/.tmux.conf;
    echo -e "\t\t✓";

    # Inputrc
    echo -n " - inputrc";
    ln -sf $SCRIPT_DIR/inputrc $USER_HOME/.inputrc;
    echo -e "\t✓";
}

full_installation (){
    basic_installation;

    # Terminator
    echo -n " - terminator";
    ln -sf $SCRIPT_DIR/terminator/config $USER_HOME/.config/terminator/config;
    echo -e "\t✓";

    # Task
    echo -n " - taskwarrior";
    ln -sf $SCRIPT_DIR/taskwarrior/taskrc $USER_HOME/.taskrc;
    echo -e "\t✓";

    # Fonts
    echo -n " - fonts";
    mkdir -p $USER_HOME/.config/fontconfig/
    ln -sf $SCRIPT_DIR/fonts/local.conf $USER_HOME/.config/fontconfig/local.conf;
    echo -e "\t✓";

    echo -n " - atom";
    ln -sf $SCRIPT_DIR/atom/config.cson $USER_HOME/.atom/config.cson;
    ln -sf $SCRIPT_DIR/atom/keymap.cson $USER_HOME/.atom/keymap.cson;
    ln -sf $SCRIPT_DIR/atom/snippets.cson $USER_HOME/.atom/snippets.cson;
    echo -e "\t\t✓";

    ask_for_sudo;

    echo -n " - scripts";
    sudo cp $SCRIPT_DIR/scripts/* /usr/local/bin
    echo -e "\t✓";
}

printf 'Installation Method [basic/full](basic): '
read -r MODE
echo

case "$MODE" in
  "")        basic_installation ;;
  basic)     basic_installation ;;
  full)      full_installation ;;
  *)         echo 'Invalid Option' ;;
esac

echo
echo "Done!"
echo
