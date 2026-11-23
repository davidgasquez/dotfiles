{ inputs, pkgs, ... }:

{
  programs.t3code = {
    enable = true;
    package = inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.t3code;
    userSettings.linkedEnvironmentsEnabled = true;
  };
}
