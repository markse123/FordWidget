# FordWidget with Pro Power Onboard

Home Screen and Lock Screen widgets for iPhone, built with [Scriptable](https://scriptable.app). This fork retains the original FordWidget features and adds optional **Pro Power Onboard monitoring**.

**Pro Power preview: v0.1.6.** [Install the script](FordWidget.js) · [Setup and usage](docs/USAGE.md) · [Personal fork](https://github.com/markse123/FordWidget)

## What it includes

- Fuel and range, tires, oil life, 12V battery, locks, doors/hood, odometer, outside temperature and parked location.
- Ford's truck photo or your own image; small, medium and large Home Screen layouts; circular, rectangular and inline Lock Screen views; light and dark appearance.
- Confirmed lock/unlock and engine start/stop actions, remote-start countdown, general wake request, evening checks and notifications, and per-widget customization.
- Optional Pro Power A, B, total and capacity estimates, plus a dedicated details view and raw signals. Pro Power fields are **off by default** and can join the original readings or form a separate widget.
- One confirmed **Refresh** action from the widget to request general vehicle and Pro Power status, then read the available cloud data.

Pro Power outlet or Generator Mode switching is **not implemented**. Engine controls retain their original purpose.

## Quick setup

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) on your iPhone.
2. Copy the entire [FordWidget.js script](https://raw.githubusercontent.com/markse123/FordWidget/main/FordWidget.js) into a new Scriptable script named **FordWidget Pro Power Preview**.
3. Run it in Scriptable, enter your vehicle details locally, then choose **Connect FordPass** and finish Ford sign-in.
4. Run **Fetch telemetry**. In **Customize widgets**, keep the original fields enabled and select any desired Pro Power fields.
5. Add a Scriptable widget. Choose **FordWidget Pro Power Preview**, set **When Interacting → Run Script**, and leave **Parameter blank** to use the shared customization choices.

An existing preview can be updated by replacing its contents under the same script name. Its preview sign-in, settings and cache remain available. The preview stores these separately from the original FordWidget; first-time preview setup requires its own sign-in.

See the [usage guide](docs/USAGE.md) for focused Pro Power widgets, refresh behavior, upgrades and troubleshooting. Developers can [rebuild the script and run the offline checks](docs/DEVELOPMENT.md).

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

## Upstream and license

Derived from [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget), pinned at [`1b129eb6155fa7c0a1d14592be6983366943d31b`](https://github.com/rushilpunu/FordWidget/commit/1b129eb6155fa7c0a1d14592be6983366943d31b). Original copyright © 2026 rushilpunu; distributed under the [MIT License](LICENSE).
