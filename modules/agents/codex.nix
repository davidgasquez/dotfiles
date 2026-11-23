{ inputs, pkgs, ... }:

{
  programs.codex = {
    enable = true;
    package = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.codex;
    mutableSettings = true;
    settings = {
      model = "gpt-6.2-sol";
      model_reasoning_effort = "medium";
      service_tier = "ultrafast";
      sandbox_mode = "danger-full-access";
      approval_policy = "never";
      web_search = "live";
      apps = {
        connector_openai_hotline.enabled = false;
        connector_openai_safety_settings.enabled = false;
        connector_openai_chatgpt_pets.enabled = false;
      };
    };
  };
}
