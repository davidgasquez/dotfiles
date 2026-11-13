{
  lib,
  stdenv,
  fetchFromGitHub,
  cmake,
  ninja,
  openblas,
  shaderc,
  spirv-headers,
  vulkan-headers,
  vulkan-loader,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "transcribe-cpp";
  version = "0.4.2";

  src = fetchFromGitHub {
    owner = "handy-computer";
    repo = "transcribe.cpp";
    tag = "v${finalAttrs.version}";
    hash = "sha256-6zEPd1DA9A19l9rUPzY5SRz5nmQZN/3cDzqbwOG02A0=";
  };

  nativeBuildInputs = [
    cmake
    ninja
    shaderc
  ];

  buildInputs = [
    openblas
    spirv-headers
    vulkan-headers
    vulkan-loader
  ];

  cmakeFlags = [
    (lib.cmakeBool "TRANSCRIBE_VULKAN" true)
    (lib.cmakeBool "TRANSCRIBE_BUILD_TESTS" false)
    (lib.cmakeBool "TRANSCRIBE_INSTALL" false)
    (lib.cmakeBool "GGML_NATIVE" false)
    (lib.cmakeFeature "BLA_VENDOR" "OpenBLAS")
  ];

  installPhase = ''
    runHook preInstall
    install -Dm755 bin/transcribe-cli -t $out/bin
    runHook postInstall
  '';

  meta = {
    description = "Speech-to-text inference on ggml";
    homepage = "https://github.com/handy-computer/transcribe.cpp";
    license = lib.licenses.mit;
    mainProgram = "transcribe-cli";
    platforms = lib.platforms.linux;
  };
})
