{ pkgs, ... }:

{
  home.packages = with pkgs; [
    bat
    eza
    gnumake
    jq
    ffmpeg
    ripgrep
    nil
  ];

  programs.btop.enable = true;

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
