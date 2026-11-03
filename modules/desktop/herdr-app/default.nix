{
  lib,
  pkgs,
  package,
}:

let
  src = pkgs.applyPatches {
    inherit (package) src;
    patches = [ ./close-to-tray.patch ];
  };
in
package.overrideAttrs (previous: {
  inherit src;
  cargoDeps = pkgs.rustPlatform.fetchCargoVendor {
    inherit src;
    name = "herdr-app-${package.version}";
    hash = "sha256-c9rHxNQrbjad+Hz75epymNWE4wW6Rl9G3Yahbr2VULs=";
  };
  postPatch = (previous.postPatch or "") + ''
    substituteInPlace src/tray.rs \
      --replace-fail '@hyprctl@' '${lib.getExe' pkgs.hyprland "hyprctl"}' \
      --replace-fail '@timeout@' '${lib.getExe' pkgs.coreutils "timeout"}' \
      --replace-fail '@icon@' "$out/share/icons/hicolor/scalable/apps/herdr-app.svg"
  '';
})
