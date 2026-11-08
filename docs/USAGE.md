# FordWidget Pro Power Preview — usage

These instructions describe **v0.1.6** of [markse123/FordWidget](https://github.com/markse123/FordWidget), derived from [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget). The complete original widget remains available, with optional Pro Power monitoring added.

## Install and connect

You need an iPhone with Scriptable, a FordPass account authorized for the vehicle, and an activated vehicle modem. Feature availability depends on the vehicle and account. US sign-in has been tested; Canada has not.

1. Open [FordWidget.js](https://raw.githubusercontent.com/markse123/FordWidget/main/FordWidget.js) and copy all its contents.
2. In Scriptable, create a script, paste the code and name it **FordWidget Pro Power Preview**.
3. Run it inside Scriptable. Enter your VIN and a vehicle name locally.
4. Choose **Connect FordPass**. Complete Ford sign-in and any verification. The optional password field can stay blank so you enter the password directly on Ford's page. Close the sign-in window when it finishes.
5. Run the script again and choose **Fetch telemetry**. FordConnect is optional; its separate setup requires an approved Ford developer application.
6. Open **Customize widgets**. Choose the original readings and any Pro Power fields you want. Pro Power fields start disabled. Scroll to reach all choices.

No running engine or electrical load is needed for installation or a cached read.

## Add the widget

1. Add a **Scriptable** widget to your Home Screen and choose a size.
2. Edit the widget and select **FordWidget Pro Power Preview**.
3. Set **When Interacting → Run Script**.
4. Leave **Parameter blank** to follow **Customize widgets**.

The large combined view shows vehicle readings, Pro Power cards and vehicle controls. Small and medium views retain their size-specific selection of original readings with a compact Pro Power summary. They cannot show every field at once. Medium controls can be enabled with **Medium layout: Buttons** in Customize widgets.

For a Lock Screen widget, add Scriptable while customizing the Lock Screen, then choose the same script and the desired Parameter. Circular, rectangular and inline views are supported. The first recognized view word selects the Lock Screen view; the original remote-start display behavior remains available.

### Optional Parameters

Naming fields means **show only those fields** and overrides the shared checkboxes. A blank Parameter uses the shared choices.

| Parameter | Result |
| --- | --- |
| Blank | Shared Customize widgets choices |
| `ppoa ppob ppototal ppocapacity` | Focused Pro Power widget |
| `fuel tires lock ppoa ppob ppototal` | Those original readings plus Pro Power |
| `ppob` | Pro Power B only |
| `buttons -photo` | Vehicle controls layout without the photo |
| `status` | Status layout without the control grid |
| `bar` or `psi` | Tire pressure units |

Pro Power fields are `ppoa`, `ppob`, `ppototal` (alias `ppo`) and `ppocapacity`. Original field names remain `photo`, `fuel`, `battery`, `tires`, `oil`, `lock`, `odometer`, `doors`, `temp` and `parked`. Prefix a field with `-` to hide it.

## Refresh, Fetch and Wake

| Action | Behavior |
| --- | --- |
| Widget **Refresh** | One confirmation covers separate general-vehicle and Pro Power status requests, bounded result checks, then cloud reads. Keep Scriptable open until completion. |
| Main menu **Fetch telemetry** | Reads available cloud vehicle data and the separate Pro Power snapshot, plus existing location/photo processing. It does not request a vehicle wake. |
| Main menu **Wake / refresh** | Sends the original general wake/status request. Use **Fetch telemetry** afterward to load the available measurements. |
| **Pro Power → Read cached Pro Power** | Reads Ford's stored Pro Power snapshot without a vehicle-status command. |
| **Pro Power → Request status once…** | After confirmation, requests Pro Power status once and checks the matched result for up to 30 seconds after acceptance. |

The combined Refresh may take around a minute. It can wake connected electronics; it does not start/stop the engine or switch outlets. Commands are not automatically retried. Portions that succeed are kept when another portion fails or is cooling down.

Existing limits apply:

| Limit | Interval |
| --- | --- |
| General wake/status request | 15 minutes |
| Shared vehicle-command spacing | 30 seconds |
| Pro Power status request | 60 seconds |
| Combined widget Refresh | 60 seconds |
| Ordinary Fetch telemetry local read interval | 5 minutes |

Server error backoff can require a longer wait. Combined Refresh bypasses only the local Fetch interval. A general-request cooldown still allows other available portions to run. An accepted request is distinct from matched device success; even device success does not prove every field's measurement time advanced.

## Read the measurements

Vehicle fields keep their individual measurement times. **View details** shows each field's source and time. **Doors** includes the hood. The large dashboard's **Oldest vehicle reading** footer summarizes the oldest known cached vehicle-field timestamp; it is separate from Pro Power timing.

Pro Power shows estimated A, B, total and capacity when the available data supports them. Estimates assume **one watt per raw unit**, corroborated on one 7.2 kW PowerBoost system with two different circuit A loads. Circuit B accuracy, physical outlet assignments and other power variants remain unverified. Missing B is not treated as zero. Total stays unknown when the participating output data is incomplete; accumulated energy is not used as instantaneous power.

**Status result** dates the Pro Power command result. The embedded power sample time is unverified. A newly successful request may still contain an older report. Ford mode has its own age; a later OFF event does not erase historical load readings. Raw signals remain available in **Troubleshooting → Pro Power raw signals**.

There are no outlet or Generator Mode controls in this version. The Lock, Unlock, Start and Stop controls operate the vehicle through the retained original confirmations. Remote start first requests a lock and checks its result. Its countdown can initially be an estimate until Ford supplies a countdown reading.

iOS decides when Home Screen widgets redraw. The script requests an update after actions, but the displayed widget may lag the app's saved data. Evening checks retain the original read-only behavior and also depend on iOS scheduling.

## Update an existing preview

Replace the contents of **FordWidget Pro Power Preview** with the new script and save it under the same name. Run it and check the version in the main-menu title. Preview versions keep the same Keychain namespace and cache folder, preserving preview sign-in, settings and saved data.

The preview is isolated from the original FordWidget. Installing it for the first time requires a separate sign-in; it does not import the original's cache or settings. Keep the original script if you want both available. After updating, preview your chosen size in **Customize widgets** and allow iOS to redraw the Home Screen copy.

## Troubleshooting

- **Only Pro Power appears:** clear the widget's Parameter, then enable the desired original and Pro Power fields in Customize widgets. A Parameter such as `ppob` deliberately selects only that field.
- **Readings disagree with the truck:** compare individual source times in View details, run Fetch telemetry and compare again. Reports captured at different times are not equivalent comparisons. Use combined Refresh when a new status request is needed, respecting cooldowns.
- **A successful request still shows an old reading:** check the field's measurement time and the Pro Power Status result separately. Request completion does not guarantee a new sample.
- **Fuel was unavailable in an earlier version:** update to v0.1.6 and Fetch telemetry. Ford can report above 100%; the fuel-only fix caps the displayed percentage at 100 and retains the raw reading. Negative or invalid values remain unknown.
- **Cooling down:** wait for the indicated interval. Do not clear cooldowns or repeatedly send commands.
- **“Already running”:** take over only if the earlier Scriptable run has actually stopped.
- **App data changed but the widget did not:** verify the selected script and Run Script interaction setting, preview the size in Scriptable, and allow iOS to redraw it.

If these checks do not explain the issue, open **Troubleshooting → Vehicle data report** from the main menu. Choose **Preview report** or **Copy report**. It attempts one passive cloud read and compares relevant raw values with the saved cache and hypothetical normalization/merge results; it does not update saved vehicle telemetry or send a vehicle command. A safe cached report remains available if the read fails. **Troubleshooting → Copy redacted Pro Power report** uses saved data without a cloud read.

Inspect reports before sharing. Reports still contain vehicle states and timestamps; they are redacted, not anonymous. The supplied reports omit VIN, location, tokens, request identifiers and raw errors. Nothing is uploaded automatically. Share the app version, relevant field ages, request outcome and what the truck displayed. Do not share raw caches, credentials or unredacted View details screenshots.

## Privacy and license

Passwords are not saved. Ford tokens and the username use Scriptable's shared Keychain; other installed scripts may access it. The preview's device-local cache uses **FordWidget Pro Power Preview/ford_vehicle_cache.json** and can retain parked coordinates while that feature is enabled. **Sign out of Ford** removes saved credentials/tokens, while telemetry, photos and widget settings remain.

The retained remote-start weather fallback can query Open-Meteo with an approximately 1 km-rounded vehicle location when the truck's own temperature reading is old. It sends no Ford account or token. Location labels use the device's reverse geocoder. Troubleshooting reports are never automatically uploaded.

To uninstall, sign out, delete the script and widgets, and remove the **FordWidget Pro Power Preview** folder from Scriptable's local documents if you also want to remove saved telemetry and photos.

This unofficial client depends on private Ford APIs and compatible, authorized vehicle services. Availability may change. Use engine start only with the vehicle safely parked outdoors.

The fork retains the [MIT License](../LICENSE), original copyright © 2026 rushilpunu, and attribution to [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget) at [`1b129eb6155fa7c0a1d14592be6983366943d31b`](https://github.com/rushilpunu/FordWidget/commit/1b129eb6155fa7c0a1d14592be6983366943d31b).
