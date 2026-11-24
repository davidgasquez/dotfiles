{ inputs, pkgs, ... }:

{
  programs.t3code = {
    enable = true;
    package =
      inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.t3code.overrideAttrs
        (previous: {
          postInstall = (previous.postInstall or "") + ''
            wrapProgram "$out/bin/t3" --set T3CODE_TELEMETRY_ENABLED false
            wrapProgram "$desktop/bin/t3code-desktop" --set T3CODE_TELEMETRY_ENABLED false
          '';
        });
    userSettings.linkedEnvironmentsEnabled = true;
  };
}
