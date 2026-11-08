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
    hash = "sha256-XbM9qUnvOuXYhHhA3btvQjK4Iys+l2y7x1sm3H0Pa28=";
  };
  postPatch = (previous.postPatch or "") + ''
    substituteInPlace src/tray.rs \
      --replace-fail '@hyprctl@' '${lib.getExe' pkgs.hyprland "hyprctl"}' \
      --replace-fail '@timeout@' '${lib.getExe' pkgs.coreutils "timeout"}' \
      --replace-fail '@icon@' "$out/share/icons/hicolor/scalable/apps/herdr-app.svg"
  '';
})
