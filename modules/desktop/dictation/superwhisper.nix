{
  lib,
  stdenv,
  fetchurl,
  autoPatchelfHook,
  makeWrapper,
  wrapGAppsHook4,
  gobject-introspection,
  zstd,
  python3,
  gtk4,
  gtk4-layer-shell,
  librsvg,
  at-spi2-core,
  libxkbcommon,
  libxcb,
  fontconfig,
  vulkan-loader,
  wayland,
  libGL,
  pipewire,
  pulseaudio,
  wl-clipboard,
  wtype,
  libnotify,
  ffmpeg,
  systemd,
  coreutils,
  procps,
  bash,
  curl,
  hyprland,
}:

let
  python = python3.withPackages (p: [
    p.pygobject3
    p.pycairo
  ]);
  sources = {
    x86_64-linux = {
      arch = "x86_64";
      hash = "sha256-KLxXWO1s9CRouX75QOwqlrEU5rbqA7yywEvGeIV9AvA=";
    };
    aarch64-linux = {
      arch = "aarch64";
      hash = "sha256-sA448gPdW4xjS3bf2VwxEoWP3myQTniKN0GYHA6uafg=";
    };
  };
  source = sources.${stdenv.hostPlatform.system};
in
stdenv.mkDerivation (finalAttrs: {
  pname = "superwhisper";
  version = "1.2.0";

  src = fetchurl {
    url = "https://github.com/superultrainc/superwhisper-linux-releases/releases/download/v${finalAttrs.version}/superwhisper-linux-${source.arch}-${finalAttrs.version}.tar.zst";
    inherit (source) hash;
  };

  nativeBuildInputs = [
    autoPatchelfHook
    makeWrapper
    wrapGAppsHook4
    gobject-introspection
    zstd
  ];
  buildInputs = [
    stdenv.cc.cc.lib
    gtk4
    gtk4-layer-shell
    librsvg
    at-spi2-core
    libxkbcommon
    libxcb
    fontconfig
    vulkan-loader
    wayland
    libGL
  ];

  dontWrapGApps = true;
  dontStrip = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/superwhisper $out/bin
    cp -r app/. $out/lib/superwhisper/
    rm -rf $out/lib/superwhisper/lib/fcitx5
    patchShebangs $out/lib/superwhisper
    for icon in app/assets/app-icon/*.png; do
      size=$(basename "$icon" .png)
      install -Dm644 "$icon" "$out/share/icons/hicolor/''${size}x''${size}/apps/superwhisper.png"
    done
    install -Dm644 app/assets/linux-status/SuperwhisperTUI.ttf \
      $out/share/fonts/truetype/SuperwhisperTUI.ttf
    runHook postInstall
  '';

  postFixup = ''
    makeWrapper $out/lib/superwhisper/run.sh $out/bin/superwhisper \
      --prefix PATH : ${
        lib.makeBinPath [
          python
          pipewire
          pulseaudio
          wl-clipboard
          wtype
          libnotify
          ffmpeg
          systemd
          coreutils
          procps
          bash
          curl
          hyprland
        ]
      } \
      --prefix LD_LIBRARY_PATH : ${
        lib.makeLibraryPath [
          wayland
          libGL
          vulkan-loader
          libxkbcommon
          gtk4-layer-shell
        ]
      } \
      "''${gappsWrapperArgs[@]}"
  '';

  meta = {
    description = "Local and cloud voice dictation for Wayland";
    homepage = "https://superwhisper.com/linux";
    license = lib.licenses.unfree;
    mainProgram = "superwhisper";
    platforms = builtins.attrNames sources;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
})
