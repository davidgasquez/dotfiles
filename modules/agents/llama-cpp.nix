{ lib, pkgs, ... }:

{
  services.llama-cpp = {
    enable = true;
    package = pkgs.llama-cpp-vulkan;
    settings = {
      models-max = 1;
      models-preset = (pkgs.formats.ini { }).generate "llama-cpp-models.ini" {
        "unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_M" = {
          hf-repo = "unsloth/Qwen3.8-27B-GGUF:UD-Q4_K_M";
          spec-type = "draft-mtp";
          spec-draft-n-max = 3;
          spec-draft-sampling = "probabilistic";
          backend-sampling = true;
          flash-attn = "on";
          cache-type-k = "q8_0";
          cache-type-v = "q8_0";
          cache-type-k-draft = "q8_0";
          cache-type-v-draft = "q8_0";
          load-mode = "dio";
          fit-target = 2048;
          parallel = 1;
          min-p = 0.0;
        };
      };
      sleep-idle-seconds = 300;
    };
  };
  systemd.services.llama-cpp = {
    wantedBy = lib.mkForce [ ];
    environment.XDG_CACHE_HOME = "/var/cache/llama-cpp";
  };
}
