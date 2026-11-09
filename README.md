# FordWidget Pro Power

Home Screen and Lock Screen widgets for iPhone, built with [Scriptable](https://scriptable.app). This fork retains the original FordWidget features and adds optional **Pro Power Onboard monitoring**. Developed on a 14th-gen F-150; compatibility with other Ford models and individual features remains unverified. Electric vehicles are outside the current testing scope.

**v0.1.10.** [Install on your iPhone](https://markse123.github.io/FordWidget/) · [Script source](FordWidget%20Pro%20Power.js) · [Setup and usage](docs/USAGE.md)

## What it includes

- Fuel and range, tires, oil life, 12V battery, locks, doors/hood, odometer, outside temperature and parked location.
- Ford's vehicle photo or your own image; small, medium and large Home Screen layouts; circular, rectangular and inline Lock Screen views; light and dark appearance.
- **Widget gallery** with Classic, Showcase and Dashboard designs, selected separately for each Home Screen size.
- **Alerts & attention** with configurable evening conditions and thresholds, plus an optional Home Screen indicator based on cached readings.
- **Vehicle features / compatibility** to review suggested readings and choose controls for your vehicle; selected commands stay unverified until you optionally test and confirm them.
- Confirmed lock/unlock and engine start/stop actions, remote-start countdown, general wake request, evening checks and notifications, and per-widget customization.
- Optional Pro Power A, B, total and capacity estimates, plus a dedicated details view and raw signals. Pro Power fields are **off by default** and can join the original readings or form a separate widget.
- One confirmed **Refresh** action from the widget to request general vehicle and Pro Power status, then read the available cloud data.
- A redacted **Vehicle data report** with outside-temperature values, units, timestamps and cache comparisons for investigating unchanged readings. [Capture instructions](docs/USAGE.md#outside-temperature-capture).

Pro Power outlet or Generator Mode switching is **not implemented**. Engine controls retain their original purpose.

This version incorporates upstream's gallery, alerts and vehicle-feature setup while retaining the Pro Power add-on, fuel clamp and shared general-status cooldown. The five inherited privacy/state fixes are now merged into the original project and included through the updated upstream source.

## Quick setup

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) on your iPhone.
2. Copy the entire [FordWidget Pro Power.js script](https://raw.githubusercontent.com/markse123/FordWidget/main/FordWidget%20Pro%20Power.js) into a new Scriptable script named **FordWidget Pro Power**.
3. Run it in Scriptable, enter your vehicle details locally and follow **Vehicle features / compatibility**. Then choose **Connect FordPass** and finish Ford sign-in.
4. Run **Fetch telemetry**, then rerun **Vehicle features / compatibility** for cloud suggestions. In **Customize widgets**, choose your readings and any Pro Power fields. Use **Widget gallery** to preview a design for each size.
5. Add a Scriptable widget. Choose **FordWidget Pro Power**, set **When Interacting → Run Script**, and leave **Parameter blank** to use the shared customization choices.

The downloadable file is **FordWidget Pro Power.js**. For an existing installation, replace its contents and **keep its current Scriptable name** so existing widgets stay connected; the file name does not require renaming your installed script. Sign-in, settings and cache remain available. If you choose to rename the script, select the new name in each widget's settings. This fork stores its data separately from the original FordWidget; first-time setup requires its own sign-in.

See the [usage guide](docs/USAGE.md) for focused Pro Power widgets, refresh behavior, upgrades and troubleshooting. Developers can [rebuild the script and run the offline checks](docs/DEVELOPMENT.md).

## Designs, alerts and vehicle features

**Widget gallery** previews Classic, Showcase and Dashboard using saved data before applying a design to a chosen Home Screen size. Classic is the default; `classic`, `showcase` and `dashboard` Parameters override the design for an individual widget.

**Alerts & attention** controls which conditions appear in evening notifications and their tire, fuel, oil and 12V battery thresholds. The optional attention indicator shows cached issues and their age without an extra cloud read. Missing data stays unknown; iOS controls redraw and notification timing.

**Vehicle features / compatibility** suggests readings from available cloud or cached data and lets you choose features shown in your Ford app. Missing data does not prove incompatibility. Optional command tests send real commands after confirmation and record the owner's completion report; they do not guarantee future operation. See the [vehicle-feature guide](docs/USAGE.md#check-vehicle-features).

## Pro Power Onboard (PPOB)

Optional Pro Power fields show last-reported A/B power, total output and capacity alongside the original vehicle readings. Use the widget's confirmed **Refresh** action for vehicle and Pro Power status, or **Pro Power → Request status once…** for Pro Power alone. See the [Pro Power usage instructions](docs/USAGE.md#use-pro-power-onboard) for setup, field meanings, refresh behavior and troubleshooting.

## What has been verified

Pro Power requests and monitoring have worked on an iPhone with one **7.2 kW F-150 PowerBoost** system:

- Circuit A was tested at two different loads, corroborating the estimate of one watt per raw unit.
- **A and B were also tested under load simultaneously.** Both circuits displayed nonzero readings and the displayed total was consistent with their sum.

This confirms the A/B display and combined-load calculation in that test. Circuit B has not had a separate accuracy comparison against the truck's dashboard or an independent meter. Physical outlet mapping, other power variants and Canada remain unverified; the inherited sign-in profile is US.

Power is shown as a **last-reported estimate**, not a live meter. **Status result** is the age of the Pro Power command result, not a verified sample timestamp. A successful request or cloud read does not guarantee every measurement changed. Unknown or incomplete data stays unknown.

## Privacy and use

This is an unofficial client using private Ford APIs, which can change or become unavailable. It requires an authorized account and compatible vehicle.

Ford passwords are not saved. Tokens are stored through Scriptable's shared Keychain, which other installed scripts can access. Only install scripts you trust. Parked coordinates are cached while that feature is enabled. The retained remote-start weather fallback can send an approximately 1 km-rounded location to Open-Meteo when the truck's temperature reading is old. Do not share VINs, locations, credentials or unredacted screenshots of vehicle details. Start the engine only when the vehicle is safely parked outdoors.

Turning **Parked location** off in Customize widgets or Vehicle features / compatibility immediately removes cached coordinates/place labels from the primary and backup cache and disables the location-based weather fallback. Saved Home settings stay in Keychain for re-enabling the feature.

## Upstream and license

Derived from [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget), pinned at [`b7f7e2866c014445b2bec831c237925d3ca61b5f`](https://github.com/rushilpunu/FordWidget/commit/b7f7e2866c014445b2bec831c237925d3ca61b5f). Original copyright © 2026 rushilpunu; distributed under the [MIT License](LICENSE).
