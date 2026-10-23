{
  inputs,
  lib,
  pkgs,
  ...
}:

let
  piWorkers = pkgs.writeShellScript "pi-workers" ''
    export PI_WORKER_BIN=${lib.getExe inputs.pi.packages.${pkgs.stdenv.hostPlatform.system}.default}
    exec ${lib.getExe pkgs.nodejs_22} ${./pi-workers.mjs}
  '';
in
{
  programs.codex.settings.mcp_servers.pi_workers = {
    command = "${piWorkers}";
    env_vars = [
      "CODEX_APP_TOOLS_PIPE_PATH"
      "CODEX_APP_TOOLS_CALLER_HOST_ID"
    ];
    tool_timeout_sec = 90;
  };
}
