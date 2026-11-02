{
  inputs,
  lib,
  pkgs,
  ...
}:

let
  piWorkers = pkgs.writeShellScript "pi-workers" ''
    export PI_WORKERS_HC=${
      lib.getExe inputs.llm-agents.packages.${pkgs.stdenv.hostPlatform.system}.herdr-core
    }
    exec ${lib.getExe pkgs.nodejs_22} ${./pi-workers.mjs}
  '';
in
{
  programs.codex.settings = {
    agents.enabled = false;
    features.multi_agent = false;
    features.multi_agent_v2 = false;
    mcp_servers.pi_workers = {
      command = "${piWorkers}";
      env_vars = [
        "CODEX_APP_TOOLS_PIPE_PATH"
        "CODEX_APP_TOOLS_CALLER_HOST_ID"
      ];
      tool_timeout_sec = 90;
    };
  };
}
