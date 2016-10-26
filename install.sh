#!/bin/bash

# Get the dir of the current script
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

basic_installation (){
    echo "Updating system dotfiles:";

    # Bash
    echo -n " - shell";
    ln -sf $script_dir/shell/bashrc ~/.bashrc;
    ln -sf $script_dir/shell/aliases ~/.aliases;
    ln -sf $script_dir/shell/bash_local ~/.bash_local;
    ln -sf $script_dir/shell/functions ~/.functions;
    ln -sf $script_dir/shell/zshrc ~/.zshrc;
    echo -e "\t✓";

    # Git
    echo -n " - gitconfig";
    ln -sf $script_dir/git/gitconfig ~/.gitconfig;
    echo -e "\t✓";

    # Tmux
    echo -n " - tmux";
    ln -sf $script_dir/tmux/tmux.conf ~/.tmux.conf;
    echo -e "\t\t✓";

    # Inputrc
    echo -n " - inputrc";
    ln -sf $script_dir/inputrc ~/.inputrc;
    echo -e "\t✓";
}

full_installation (){
    basic_installation;

    # Terminator
    echo -n " - terminator";
    ln -sf $script_dir/terminator/config ~/.config/terminator/config;
    echo -e "\t✓";

    # Task
    echo -n " - taskwarrior";
    ln -sf $script_dir/taskwarrior/taskrc ~/.taskrc;
    echo -e "\t✓";

    echo -n " - atom";
    ln -sf $script_dir/atom/config.cson ~/.atom/config.cson;
    ln -sf $script_dir/atom/keymap.cson ~/.atom/keymap.cson;
    ln -sf $script_dir/atom/snippets.cson ~/.atom/snippets.cson;
    echo -e "\t\t✓";

    echo -n " - redshift";
    ln -sf $script_dir/redshift/redshift.conf ~/.config/redshift.conf;
    echo -e "\t✓";

    echo -n " - scripts";
    sudo cp $script_dir/scripts/* /usr/local/bin
    echo -e "\t✓";
}

printf 'Installation Method [basic/full](basic): '
read -r mode
echo

case "$mode" in
  "")        basic_installation ;;
  basic)     basic_installation ;;
  full)      full_installation ;;
  *)         echo 'Invalid Option' ;;
esac

echo
echo "Done!"
echo
