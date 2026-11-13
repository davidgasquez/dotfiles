{
  lib,
  stdenv,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
  openssl,
  onnxruntime,
}:

let
  releases = {
    x86_64-linux = {
      arch = "x86_64";
      hash = "sha256-QTBat7pjPpV48uSNqOb06ZI9xunbk8Vu6Rxgcsd4UMw=";
    };
    aarch64-linux = {
      arch = "arm64";
      hash = "sha256-umhWgc/xlGjONauUSdRwRcT1FyPix+mt9hd/T3UdHPo=";
    };
  };
  release = releases.${stdenv.hostPlatform.system};
in
stdenv.mkDerivation (finalAttrs: {
  pname = "memex";
  version = "0.34.0";

  src = fetchurl {
    url = "https://github.com/nicosuave/memex/releases/download/v${finalAttrs.version}/memex-${finalAttrs.version}-linux-${release.arch}.tar.gz";
    inherit (release) hash;
  };

  sourceRoot = ".";
  nativeBuildInputs = [
    autoPatchelfHook
    makeWrapper
  ];
  buildInputs = [
    openssl
    stdenv.cc.cc.lib
  ];

  dontConfigure = true;
  dontBuild = true;

  installPhase = ''
    runHook preInstall
    install -Dm755 memex "$out/bin/memex"
    runHook postInstall
  '';

  postFixup = ''
    wrapProgram "$out/bin/memex" \
      --set ORT_DYLIB_PATH ${onnxruntime}/lib/libonnxruntime${stdenv.hostPlatform.extensions.sharedLibrary}
  '';

  meta = {
    description = "Search local coding agent session history";
    homepage = "https://github.com/nicosuave/memex";
    license = lib.licenses.mit;
    mainProgram = "memex";
    platforms = builtins.attrNames releases;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
})
