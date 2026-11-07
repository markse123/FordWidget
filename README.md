# FordWidget

iPhone Home Screen and Lock Screen widgets for the Ford F-150, built as a single [Scriptable](https://scriptable.app) script. Made on a 14th‑gen (2021+) F‑150; it should work with any FordPass‑connected Ford.

- **Status at a glance:** fuel and range, lock state, tire pressures, oil life, 12V battery, doors, odometer, outside temperature and where the truck is parked, with your truck's own FordPass photo.
- **Buttons:** Lock, Unlock, Remote start / Stop, and Wake. Every command asks for confirmation first.
- **Remote start countdown** that ticks live on the widget. Tap it to stop the engine.
- **Evening check:** once a night, the widget checks the truck's last state and notifies you if it's unlocked, a door is open, a tire is low, or fuel is low.
- **Every size:** small, medium and large Home Screen widgets, plus circular, rectangular and inline Lock Screen widgets. Light and dark mode.
- **Customizable:** choose what each widget shows.

> **Unofficial.** This uses Ford's private FordPass app API, the same way the open-source [ha-fordpass](https://github.com/marq24/ha-fordpass) Home Assistant integration does. Ford can change or block it at any time, and using it may be against Ford's terms. Use at your own risk. Not affiliated with Ford.

---

## Requirements

- An iPhone running iOS 16 or later, with [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) installed (free).
- A FordPass account with your truck added and its modem activated. If remote commands work in the FordPass app, they'll work here.
- Your 17‑character VIN.

## Install

1. **Get the script onto your phone**, using either method:
   - **Copy and paste:** on your iPhone, open [the raw `FordWidget.js`](https://raw.githubusercontent.com/rushilpunu/FordWidget/main/FordWidget.js) and copy all the text. In Scriptable, tap **+**, paste, then tap the title at the top and rename it **FordWidget**.
   - **Files:** download `FordWidget.js` and move it to **iCloud Drive › Scriptable**.
2. **Run it in the Scriptable app** by tapping the script. It asks for your **VIN** and a name for the truck, like "F‑150 Lariat".
3. In the menu, choose **Connect FordPass**:
   - Enter your FordPass email. The password field is optional: it only fills in Ford's login page, and it's never saved.
   - Choose **Sign in here**, then sign in to Ford and finish the verification code or MFA.
   - When the page says **Signed in**, tap **Close** at the top. You'll see "FordPass connected."
4. Choose **Fetch telemetry**. This downloads your truck's status and its FordPass photo.
5. **Add widgets.** See below.

> The script **must be run in the app first.** Widgets only show what the app has already downloaded.

### Add a Home Screen widget

1. Long‑press the Home Screen, tap **Edit**, then **Add Widget**, and choose **Scriptable**.
2. Pick a size (small, medium or large) and tap **Add Widget**.
3. Long‑press the new widget and choose **Edit Widget**:
   - **Script:** FordWidget
   - **When Interacting:** Run Script
   - **Parameter:** optional, see [Customizing](#customizing)

Add as many widgets as you like; each one can show something different.

### Add a Lock Screen widget

Long‑press the Lock Screen, tap **Customize**, then **Lock Screen**. Tap the widget area, add **Scriptable**, then tap the widget to choose **FordWidget** and a Parameter:

| Widget | Parameter | Shows |
|---|---|---|
| Circle | `fuel` (default) | Fuel ring with % |
| Circle | `lock` | Lock icon |
| Circle | `tires` | Lowest tire pressure |
| Rectangle | `status` (default) | Name, lock, fuel bar and range |
| Rectangle | `tires` | All four pressures, with low ones flagged |
| Rectangle | `parked` | Where the truck is parked |
| Inline | — | Fuel · range · lock, above the clock |

While the engine is running from remote start, the circle and rectangle show the countdown instead.

## Using it

Tap any widget to open the menu:

| Menu item | What it does |
|---|---|
| Fetch telemetry | Downloads the truck's latest status from Ford's cloud. Doesn't wake the truck. |
| Lock / Unlock | Sends the command after you confirm. |
| Remote start | Locks first, waits for the lock to confirm, then starts. Shows outside temperature. |
| Remote stop | Stops a remote start. |
| Wake / refresh | Asks the truck to report fresh data. Limited to once every 15 minutes to protect the 12V battery. |
| View details | Every reading with its time and source. |
| Parked location | Open in Maps, or save the spot as **Home**. The widget then says "Parked · Home". |
| Customize widgets | Choose what all widgets show, tire units, evening check time, and previews. |
| Truck photo | Ford's photo from another angle, your own photo, or a plain icon. |
| Sign out of Ford | Removes the saved Ford tokens and username from this phone. |
| Run self-test | Offline checks. No network and no commands. |

Widget buttons (Lock, Unlock, Start, Refresh) open Scriptable and ask for confirmation before anything is sent.

> A command's receipt means Ford **accepted** it, not that the truck finished it. Fetch telemetry a minute later to confirm.

### Customizing

**Customize widgets** in the menu sets the defaults for every widget. To change a single widget, type words in its **Parameter**:

| Word | Effect |
|---|---|
| `buttons` | Medium widget shows Lock / Unlock / Start / Refresh buttons |
| `status` | Status‑only layout, no buttons |
| `fuel tires lock` … | Show **only** these items |
| `-photo`, `-oil` … | Hide these items |
| `bar` / `psi` | Tire pressure units |

Items: `photo`, `fuel`, `battery`, `tires`, `oil`, `lock`, `odometer`, `doors`, `temp`, `parked`.

Examples: `buttons -photo` · `fuel tires` · `lock oil odometer`

### Evening check

From 9 PM (you can change this or turn it off in Customize), the first widget refresh reads the truck's last reported state once. It doesn't wake the truck, and it sends you a notification if something needs attention. iOS decides exactly when widgets refresh, so the timing is approximate. It runs inside the widget; no Shortcuts automation is needed.

## Security & privacy

**Please read before installing.**

- **Where things are stored:**
  - Your Ford tokens and username are kept in the iOS Keychain through Scriptable's Keychain API.
  - Your password is never saved.
  - The telemetry cache (`Scriptable/FordWidget/ford_vehicle_cache.json`) is local to the phone and contains no secrets.
- **Scriptable's Keychain is shared by all scripts in the app.** Any other Scriptable script you install could read FordWidget's Ford tokens, and those tokens can unlock and start your truck. Only install scripts you have read and trust.
- **Only get this script from this repository**, and read it first. A modified copy could send your Ford login anywhere.
- **Network access is limited:**
  - `login.ford.com` and `*.ford.com` handle login, the truck photo and the garage list.
  - `api.autonomic.ai` is Ford's vehicle cloud, used for status and commands.
  - `api.open-meteo.com` is used only for the remote‑start temperature line, and only when the truck's own reading is over 2 hours old. It receives the location rounded to about 1 km, with no account.
- **Links can trigger a command prompt.** A web page or QR code can open a `scriptable://` link to this script, which is why every command shows a confirmation alert. Only tap **Send command** if you started it.
- **Parked location** is stored on the phone only. Turn it off in Customize widgets.
- **To revoke access:** choose **Sign out of Ford**, then change your Ford password. Changing the password signs out all sessions.
- **When asking for help,** don't post your VIN, location, or screenshots of View details. Error messages never contain tokens or passwords.
- **Remote start safety:** only start the truck when it's parked outdoors, never in a garage.

## Troubleshooting

| Problem | Fix |
|---|---|
| Ford sign‑in page is blank or stuck on "Signing in" | Wait about 20 seconds, then tap **Close**. The login usually went through. If not, choose **Sign in on another device** and follow the steps; you paste back the `fordapp://` address. |
| "FordWidget is already running" | Scriptable was closed mid‑run. If nothing else is open, tap **Take over**. |
| "cooling down; try again in N minutes" | Ford returned an error or rate limit, so the script backs off on its own. Wait it out. |
| Widget says "Open Scriptable to set up / fetch" | Run the script in the app and choose **Fetch telemetry**. |
| Readings say "—" or Unknown | Ford hasn't reported that reading for your truck. Not every truck or modem reports every value. |
| No truck photo | Menu › **Truck photo** › try another view, or choose your own photo. |
| Widget only shows "Scriptable" when adding | Make sure you've run the script in the app at least once. |

## Updating

Replace the script's contents with the new `FordWidget.js` and keep the same name. Your settings, sign‑in and cache are kept.

## Uninstall

Menu › **Sign out of Ford**, then delete the script and the `FordWidget` folder in Scriptable's documents.

## Credits

Ford login and API details are based on [marq24/ha-fordpass](https://github.com/marq24/ha-fordpass), [marq24/ha-fordconnect-query](https://github.com/marq24/ha-fordconnect-query) and [itchannel/fordpass-ha](https://github.com/itchannel/fordpass-ha). Thanks to their authors.

## License

[MIT](LICENSE). Free to use, modify and share. Provided as is, with no warranty. You're responsible for how you use it with your vehicle and Ford account.
