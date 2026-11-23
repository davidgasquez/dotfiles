{
  inputs,
  lib,
  pkgs,
  ...
}:

let
  qmd = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.qmd;
  agentSkills = pkgs.runCommand "agent-skills" { } ''
    cp -r ${./skills} "$out"
    chmod -R u+w "$out"
    for skill in "$out"/*; do
      mkdir -p "$skill/agents"
      printf 'policy:\n  allow_implicit_invocation: false\n' > "$skill/agents/openai.yaml"
    done
  '';
in
{
  imports = [
    ./claude.nix
    ./codex.nix
    ./pi.nix
    ./t3code.nix
  ];

  home.packages = [
    pkgs.file
    pkgs.poppler-utils
    pkgs.unzip
    (pkgs.symlinkJoin {
      inherit (qmd) name meta;
      paths = [ qmd ];
      nativeBuildInputs = [ pkgs.makeWrapper ];
      postBuild = ''
        wrapProgram "$out/bin/qmd" \
          --set-default QMD_SKILLS_DIR "${qmd}/share/skills/qmd"
      '';
    })
  ];

  home.file = lib.concatMapAttrs (name: _: {
    ".agents/skills/${name}".source = "${agentSkills}/${name}";
    ".claude/skills/${name}".source = "${agentSkills}/${name}";
  }) (builtins.readDir ./skills);
}
