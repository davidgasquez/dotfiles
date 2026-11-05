{
  symlinkJoin,
  signal-desktop,
  fetchFromGitHub,
  asar,
  flavor,
}:

let
  theme = fetchFromGitHub {
    owner = "CalfMoon";
    repo = "signal-desktop";
    rev = "658cb182d49dc6ba3085c7b63db0987e875a29bf";
    hash = "sha256-dWT3hG2uGhwpNgGHjwVmzci68upUVe5ktoeaPrNZ3q8=";
  };
in
symlinkJoin {
  name = "signal-desktop-catppuccin-${signal-desktop.version}";
  paths = [ signal-desktop ];
  nativeBuildInputs = [ asar ];
  postBuild = ''
    asar extract ${signal-desktop}/share/signal-desktop/app.asar app
    install -m644 ${theme}/themes/catppuccin-${flavor}.css app/stylesheets/catppuccin.css
    test -f app/stylesheets/manifest.css
    sed -i '1i @import "catppuccin.css";' app/stylesheets/manifest.css

    rm "$out/share/signal-desktop/app.asar"
    rm -rf "$out/share/signal-desktop/app.asar.unpacked"
    asar pack app "$out/share/signal-desktop/app.asar" --unpack-dir node_modules

    rm "$out/bin/signal-desktop"
    cp ${signal-desktop}/bin/signal-desktop "$out/bin/signal-desktop"
    chmod u+w "$out/bin/signal-desktop"
    substituteInPlace "$out/bin/signal-desktop" \
      --replace-fail '${signal-desktop}/share/signal-desktop/app.asar' "$out/share/signal-desktop/app.asar"
  '';
  meta = signal-desktop.meta // {
    description = "${signal-desktop.meta.description} with Catppuccin";
  };
}
