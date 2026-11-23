{ inputs, pkgs, ... }:

{
  programs.claude-code = {
    enable = true;
    package = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.claude-code;
    mutableSettings = true;
    settings = {
      theme = "dark";
      modelSettings."claude-opus-5-5".effortLevel = "high";
      skillOverrides = {
        "anthropic-skills:docs" = "off";
        "anthropic-skills:docx" = "off";
        "anthropic-skills:pptx" = "off";
        "anthropic-skills:xlsx" = "off";
        "anthropic-skills:pdf" = "off";
        "anthropic-skills:google-workspace" = "off";
        "anthropic-skills:pl-infra-brain" = "off";
        "anthropic-skills:morning" = "off";
        "anthropic-skills:import-memory" = "off";
        "anthropic-skills:skill-creator" = "off";
      };
    };
  };
}
