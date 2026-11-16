{
  lib,
  stdenv,
  fetchurl,
  dpkg,
  autoPatchelfHook,
  wrapGAppsHook3,
  alsa-lib,
  at-spi2-core,
  cairo,
  cups,
  dbus,
  expat,
  glib,
  gtk3,
  libdrm,
  libgbm,
  libglvnd,
  libnotify,
  libpulseaudio,
  libsecret,
  libx11,
  libxcb,
  libxcomposite,
  libxdamage,
  libxext,
  libxfixes,
  libxkbcommon,
  libxrandr,
  nspr,
  nss,
  pango,
  vulkan-loader,
  wayland,
  xdg-utils,
}:

stdenv.mkDerivation (finalAttrs: {
  pname = "grok-bot";
  version = "1.1.0";

  src = fetchurl {
    url = "https://downloads.cursor.com/grokbot/stable/83d46d618ef4c12afa17edd8e3c29d6caf046d17/linux/x64/grok-bot_${finalAttrs.version}_amd64.deb";
    hash = "sha256-WwL7IVED7e2U7J84GnkNcfZyfwF2gcft0bVvK4z6Vy0=";
  };

  nativeBuildInputs = [
    dpkg
    autoPatchelfHook
    wrapGAppsHook3
  ];

  buildInputs = [
    alsa-lib
    at-spi2-core
    cairo
    cups
    dbus
    expat
    glib
    gtk3
    libdrm
    libgbm
    libx11
    libxcb
    libxcomposite
    libxdamage
    libxext
    libxfixes
    libxkbcommon
    libxrandr
    nspr
    nss
    pango
    stdenv.cc.cc.lib
  ];

  runtimeDependencies = [
    libglvnd
    libnotify
    libpulseaudio
    libsecret
    vulkan-loader
    wayland
  ];

  dontStrip = true;

  unpackPhase = ''
    runHook preUnpack
    dpkg-deb -x "$src" .
    runHook postUnpack
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/bin" "$out/lib"
    mv "opt/Grok Bot" "$out/lib/grok-bot"
    rm "$out/lib/grok-bot/chrome-sandbox"
    cp -r usr/share "$out/share"
    substituteInPlace "$out/share/applications/grok-bot.desktop" \
      --replace-fail 'Exec=grok-bot ' "Exec=$out/bin/grok-bot "
    runHook postInstall
  '';

  preFixup = ''
    makeWrapper "$out/lib/grok-bot/grok-bot" "$out/bin/grok-bot" \
      "''${gappsWrapperArgs[@]}" \
      --set-default CHROME_DESKTOP grok-bot.desktop \
      --suffix PATH : ${lib.makeBinPath [ xdg-utils ]}
  '';
  dontWrapGApps = true;

  meta = {
    description = "Grok Bot desktop agent";
    homepage = "https://x.ai/bot";
    license = lib.licenses.unfree;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
    platforms = [ "x86_64-linux" ];
    mainProgram = "grok-bot";
  };
})
