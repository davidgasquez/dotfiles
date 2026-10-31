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
    ./pi.nix
    ./mcp/pi-workers
  ];

  home.packages = [
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

  home.file = lib.mapAttrs' (
    name: _:
    lib.nameValuePair ".agents/skills/${name}" {
      source = "${agentSkills}/${name}";
    }
  ) (builtins.readDir ./skills);

  programs.codex = {
    enable = true;
    mutableSettings = true;
    settings = {
      model = "gpt-6.1-sol";
      model_reasoning_effort = "high";
      service_tier = "priority";
      sandbox_mode = "danger-full-access";
      approval_policy = "never";
      sandbox_workspace_write.network_access = true;
      web_search = "live";
      projects."/etc/nixos".trust_level = "trusted";
      apps = {
        connector_openai_hotline.enabled = false;
        connector_openai_safety_settings.enabled = false;
        connector_openai_chatgpt_pets.enabled = false;
      };
    };
  };
}
