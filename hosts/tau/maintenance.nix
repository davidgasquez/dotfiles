{
  system.autoUpgrade = {
    dates = "02:00";
    persistent = false;
    randomizedDelaySec = "15min";
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
