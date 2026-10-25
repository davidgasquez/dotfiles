let
  flake = builtins.getFlake (toString ../.);
  lib = flake.inputs.nixpkgs.lib;
  tested = flake.nixosConfigurations.zephyr.extendModules {
    modules = [
      {
        disko.devices.disk.system.content.partitions.root.content.passwordFile =
          lib.mkForce "/tmp/secret.key";
        disko.tests = {
          efi = true;
          enableOCR = true;
          extraConfig = { config, pkgs, ... }: {
            boot.loader.efi.canTouchEfiVariables = lib.mkForce false;
            boot.loader.limine = {
              efiInstallAsRemovable = true;
              style.interface.resolution = lib.mkForce "800x600";
              style.graphicalTerminal.font.scale = lib.mkForce "1x1";
            };
            fileSystems."/nix/.ro-store" = {
              device = "nix-store";
              fsType = "9p";
              neededForBoot = true;
              options = [
                "trans=virtio"
                "version=9p2000.L"
                "cache=loose"
                "ro"
              ];
            };
            fileSystems."/nix/store" = lib.mkOverride 40 {
              neededForBoot = true;
              overlay = {
                lowerdir = [ "/nix/.ro-store" ];
                upperdir = "/nix/.rw-store/upper";
                workdir = "/nix/.rw-store/work";
              };
            };
            # Disko's boot test shares store files without registering the target database.
            systemd.services.register-home-store = {
              wantedBy = [ "home-manager-david.service" ];
              before = [ "home-manager-david.service" ];
              serviceConfig.Type = "oneshot";
              script = ''
                ${config.nix.package}/bin/nix-store --load-db < ${
                  pkgs.closureInfo {
                    rootPaths = [ config.home-manager.users.david.home.activationPackage ];
                  }
                }/registration
              '';
            };
            boot.plymouth.enable = lib.mkForce false;
            boot.consoleLogLevel = lib.mkForce 7;
            services.greetd.enable = lib.mkForce false;
            system.autoUpgrade.enable = lib.mkForce false;
            services.tailscale.enable = lib.mkForce false;
            services.asusd.enable = lib.mkForce false;
            users.users.david.hashedPasswordFile = lib.mkForce null;
            users.users.david.hashedPassword = lib.mkForce "!";
            environment.systemPackages = [ pkgs.cryptsetup ];
          };
          bootCommands = ''
            machine.wait_for_text("[Pp]assphrase|[Pp]assword")
            machine.send_chars("secretsecret\n")
          '';
          extraChecks = ''
            try:
                machine.wait_for_unit("home-manager-david.service")
            finally:
                print(machine.succeed("journalctl -b -u register-home-store -u home-manager-david --no-pager"))
            machine.succeed("test -s /home/david/.config/hypr/hyprland.lua")
            machine.succeed("cryptsetup isLuks --type luks2 /dev/vda2")
            machine.succeed("test $(findmnt -n -o FSTYPE /) = ext4")
            machine.succeed("test $(findmnt -n -o SOURCE /) = /dev/mapper/zephyr-root")
            machine.succeed("mountpoint /boot")
            machine.succeed("test -s /boot/EFI/BOOT/BOOTX64.EFI")
            machine.succeed("test ! -e /run/zephyr-disk-password")
            machine.succeed("test ! -e /tmp/secret.key")
            machine.succeed("test $(hostname) = zephyr")
          '';
        };
      }
    ];
  };
in
tested.config.system.build.installTest
