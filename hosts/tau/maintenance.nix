{
  nix.gc.automatic = true;
  nix.gc.options = "--delete-older-than 60d";

  system.autoUpgrade = {
    allowReboot = true;
    rebootWindow = {
      lower = "02:00";
      upper = "05:00";
    };
  };

  services.journald.settings.Journal = {
    SystemMaxUse = "100M";
    RuntimeMaxUse = "100M";
    MaxRetentionSec = "7day";
  };
}
