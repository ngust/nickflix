/* NickFlix configuration.
   Copy this file to private/config.js (outside git), fill it in, then run: python tools/build.py
   The build copies it into the package as js/config.js. Never commit the real file. */
var NF_CONFIG = {
  server: "http://your-provider.example.com:80",   // Xtream-codes compatible portal (player_api.php)
  username: "YOUR_USERNAME",
  password: "YOUR_PASSWORD",
  nasBase: "http://192.168.1.50:9050",              // Twonky / DLNA server for "My Media" (optional, "" to disable)
  extraOrigins: []                                  // extra stream/redirect hosts your provider uses, e.g. ["http://cdn.example.net"]
};
