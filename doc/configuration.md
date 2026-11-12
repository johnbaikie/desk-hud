# Configuration

## Location

By default, the configuration file, `desk-hud-config.json` is read from the root directory of the project. However, if you wish to use an alternative location for the config file, you can set the environment variable `DHUD_CONFIG` to the desired file path. This allows for flexibility in specifying the location of the config file to suit your needs. 

To assist you in creating the config file, a template named `desk-hud-config.default.json` is provided within the project. You can refer to this template as a starting point to define your own configurations and customize Desk-HUD according to your preferences.

## Config parameters

The configuration for Desk-HUD is stored in a JSON file.

- **core**: This section contains core settings for Desk-HUD.
  - `port` (number): The port number on which Desk-HUD's server runs.
  - `host` (string, optional): the address the server and livereload listen on. Defaults to `127.0.0.1`, so only the kiosk browser on the same machine can open the page or its socket. Set `"0.0.0.0"` to open the dashboard to other machines on the network.
  - `distance` (object): The distance settings for the distance sensor, specifying the threshold values for waking up and going to sleep modes.
    - `wakeUp` (number): The distance threshold (in centimeters) at which Desk-HUD wakes up from sleep mode.
    - `goSleep` (number): The distance threshold (in centimeters) at which Desk-HUD goes into sleep mode.
  - `powerOffTime` (number): The duration in milliseconds after which Desk-HUD's monitor powers off.

- **dateTime**: This section handles date and time widget configuration
  - `timezones` (array): Defines an array of time zones with their IDs and corresponding names.
    - Each timezone object has the following properties:
      - `id` (string): The ID of the time zone.
      - `name` (string): The corresponding name of the time zone.
      - `lat`, `lon` (numbers, optional): Where to mark it on the TIME screen's world map. Common zones (e.g. `America/Boise`, `Australia/Sydney`) are placed at their main city automatically (see `src/widgets/dateTime/places.js`); others need these. The zone the screen itself runs in is shown as HOME at the `weather` location.

- **weather**: Location for weather, forecasts and alerts from the US National Weather Service (api.weather.gov; US locations only, no API key).
  - `lat` (number): The latitude of the location.
  - `lon` (number): The longitude of the location.
  - `units` (string, optional): `"metric"` (°C, the default) or `"imperial"` (°F).

- **google** (only used when `"google": true` in `src/widgets/features.json`; switched off by default): This section pertains to Google integration.
  - `clientId` (string): The client ID for Google integration.
  - `clientSecret` (string): The client secret for Google integration.
  - `clientToken` (string): The client token for Google integration.
  - `calendars` (array): An array of Google Calendars IDs.

  The Tasks widget shows every task from all of your Google Tasks lists: open tasks first, then tasks completed in the last 7 days.

- **outlook**: A work calendar, shown on the WORK tab of the Calendar widget (Google Calendar is the PERSONAL tab when the Google features are on).
  - `icsUrl` (string): The ICS link from Outlook's "Publish a calendar" setting (Settings → Calendar → Shared calendars). A `webcal://` link works too. Anyone with the link can read the calendar, so keep it out of git. The calendar is reloaded every 5 minutes, but Outlook itself may only refresh a published calendar every few hours.

- **stockdata** - allows you to configure the [StockData](http://www.stockdata.org) service integration for Desk-HUD. StockData provides financial market data and analytics.
  - `apiKey` (string): The API key for accessing the StockData service.
  - `symbol` (string or array): The ticker to show, or several (`["ORCL", "IBM"]` or `"ORCL,IBM"`). With several, the widget switches between them every 20 minutes. Each extra symbol costs about 4 requests a day; the free plan allows about 100.

- **sports** (optional): favourite teams for the Sports widget, from ESPN's public scores API (no key).
  - `teams` (object): a list of team abbreviations for each of `nfl`, `mlb`, `nhl`, `mls` and `nwsl`, e.g. `{"nfl": ["KC"], "nhl": ["DAL"], "mls": ["SKC"], "nwsl": []}`. Use ESPN's abbreviations (the ones on espn.com scoreboards, such as `KC`, `DAL`, `SKC`, `NYY`); ESPN team ids work too. A league with an empty list gets no button. With several teams in a league, swipe up or down to switch.

- **horoscope** (optional): the Horoscope widget.
  - `sign` (string): one of the 12 zodiac signs, e.g. `"Cancer"` (any case).
  - `apiKey` (string, optional): a [FreeAstroAPI](https://www.freeastroapi.com) key (free plan: 80 requests a day; the widget uses about 10). With it, TODAY adds FreeAstroAPI's love, career, money and health scores, lucky colour, number and time, and the Moon to FreeHoroscopeAPI's daily reading (FreeAstroAPI's own text, a template that barely changes from day to day, is used only when FreeHoroscopeAPI fails). Without it (or while FreeAstroAPI is down), TODAY comes from [FreeHoroscopeAPI](https://freehoroscopeapi.com), which also supplies WEEK and MONTH and needs no key. The key can also come from the `FREE_ASTRO_API_KEY` environment variable. Keep it out of git.

- **bambu** (optional): Bambu Lab printers for the Printers widget, read over the local network (MQTT on port 8883; the Pi must be able to reach the printers). Nothing is ever sent to a printer except a request for its full status, so the widget cannot affect a print.
  - `printers` (array): one entry per printer:
    - `name` (string, optional): the name shown on the HUD.
    - `host` (string): the printer's IP address (give it a DHCP reservation so it doesn't change).
    - `serial` (string): the printer's serial number (Settings → Device on the printer, or in Bambu Studio/Handy).
    - `accessCode` (string): the 8-character LAN access code (Settings → Network / WLAN on the printer's screen). It changes if you refresh it on the printer. Keep it out of git; it is never sent to the browser.
    - `model` (string, optional): e.g. `"H2S"`; worked out from the serial number when left out.

Every key is required unless marked optional. The server stops with a "Config prop not found" error if a key it reads is missing or empty. Leave `google.clientId`, `google.clientSecret` and `google.clientToken` empty in a new config; `node ./google_auth.js` fills them in.

## Integrations

### Google

To set up Google access keys for integration with Desk-HUD, follow these steps:

- In the Google Cloud console, go to Menu `APIs & Services` > `Credentials`.
- Click `Create Credentials` > `OAuth client ID`.
- Click `Application type` > `Desktop app`.
- In the `Name` field, type a name for the credential. This name is only shown in the Google Cloud console.
- Click `Create`. The OAuth client created screen appears, showing your new Client ID and Client secret.
- Click `OK`. The newly created credential appears under OAuth 2.0 Client IDs.
- Save the downloaded JSON file as `credentials.json`
- Open `OAuth consent screen` and add yourself to `Test users`
- Once you have `credentials.json`, run the `node ./google_auth.js` script. Follow the instructions provided to complete the authentication process.

Detailed process of obtaining `credentials.json` is described here [here](https://developers.google.com/tasks/quickstart/nodejs)

**Refreshing the access token**
If your access token has expired, you need to remove `clientSecret` and `clientToken` from `desk-hud-config.json` and rerun `node ./google_auth.js` script.

### StockData

- Visit the StockData website: Go to the StockData website at http://www.stockdata.org.
- Click "Sign In"
- Create an account
- Get API token and copy it to config file