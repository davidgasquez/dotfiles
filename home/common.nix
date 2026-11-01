{ config, pkgs, ... }:

{
  home.packages = with pkgs; [
    bat
    eza
    gnumake
    jq
    ffmpeg
    yt-dlp
    ripgrep
  ];

  programs.btop = {
    enable = true;
    settings = {
      save_config_on_exit = false;
      color_theme = "TTY";
      theme_background = false;
    };
  };

  programs.git = {
    enable = true;
    package = pkgs.gitMinimal;
    lfs.enable = true;
    ignores = [
      "*.local.*"
      "*.local"
    ];
    settings = {
      user = {
        name = "David Gasquez";
        email = "davidgasquez@gmail.com";
      };
      column.ui = "auto";
      alias = {
        cm = "commit -m";
        st = "status";
      };
      push = {
        autoSetupRemote = true;
        followTags = true;
      };
      pull.rebase = true;
      rebase.autoStash = true;
      init.defaultBranch = "main";
      fetch = {
        prune = true;
        pruneTags = true;
        all = true;
      };
      help.autocorrect = "prompt";
    };
  };
  programs.gh.enable = true;
  programs.zsh = {
    enable = true;
    autocd = true;
    autosuggestion.enable = true;
    syntaxHighlighting.enable = true;
    history.size = 50000;
    completionInit =
      let
        zsh = config.programs.zsh.package;
        gitCompletion = pkgs.runCommand "zsh-git-completion" { nativeBuildInputs = [ zsh ]; } ''
          mkdir -p "$out/share/zsh/site-functions"
          cp ${zsh}/share/zsh/${zsh.version}/functions/_git "$out/share/zsh/site-functions/_git"
          zsh -fc 'zcompile -U -- "$1"' -- "$out/share/zsh/site-functions/_git"
        '';
      in
      ''
        fpath=("${gitCompletion}/share/zsh/site-functions" "''${fpath[@]:A}")
        autoload -U compinit && compinit
      '';
    initContent = ''
      bindkey '^[[1;3D' backward-word
      bindkey '^[[1;3C' forward-word
      bindkey '^[[1;5D' backward-word
      bindkey '^[[1;5C' forward-word
    '';
    shellAliases = {
      cat = "bat -pp";
      ls = "eza --color=auto --icons=always";
      ll = "eza -l --icons";
      la = "eza -la --icons";
      tree = "eza --tree --icons";
    };
  };
  programs.fzf.enable = true;
  programs.zoxide.enable = true;
  programs.starship.enable = true;
}
