#!/bin/bash

# Get the dir of the current script
script_dir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

basic_installation (){
    echo "Updating system dotfiles:";

    # Bash
    echo -n " - bash";
    ln -sf $script_dir/bash/bashrc ~/.bashrc;
    ln -sf $script_dir/bash/bash_aliases ~/.bash_aliases;
    cp $script_dir/bash/bash_local ~/.bash_local;
    echo -e "\t\t✓";

    # Git
    echo -n " - gitconfig";
    ln -sf $script_dir/git/gitconfig ~/.gitconfig;
    echo -e "\t✓";

    echo -n " - tmux";
    ln -sf $script_dir/tmux/tmux.conf ~/.tmux.conf;
    echo -e "\t\t✓";
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
