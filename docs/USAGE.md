# FordWidget Pro Power — usage

These instructions describe **v0.1.9** of [markse123/FordWidget](https://github.com/markse123/FordWidget), derived from [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget). The complete original widget remains available, with optional Pro Power monitoring added.

## Install and connect

You need an iPhone with Scriptable, a FordPass account authorized for the vehicle, and an activated vehicle modem. Feature availability depends on the vehicle and account. Development and Pro Power testing have used an F-150; other Ford models and individual features remain unverified. Electric vehicles are outside the current testing scope. US sign-in has been tested; Canada has not.

For the guided installer, open [the install page](https://markse123.github.io/FordWidget/) on your iPhone. Copy the installer into a separate Scriptable script named **Install FordWidget Pro Power** and run it. Choose your script storage and **New installation** or **Update an existing script**. For an update, enter the exact name of your existing fork script, including an older or custom name. The installer checks the pinned download's SHA-256, refuses downgrades or ambiguous version information, asks before replacing an existing fork script and saves a backup of its code. It leaves sign-in, settings and vehicle data in place. Run the installed widget separately afterward. You can also install manually:

1. Open [FordWidget.js](https://raw.githubusercontent.com/markse123/FordWidget/main/FordWidget.js) and copy all its contents.
2. In Scriptable, create a script, paste the code and name it **FordWidget Pro Power**.
3. Run it inside Scriptable. Enter your VIN and a vehicle name locally. The offline self-test and **Vehicle features / compatibility** check follow setup. Review the suggested features or finish and rerun the check after connecting FordPass; missing readings are unverified.
4. Choose **Connect FordPass**. Complete Ford sign-in and any verification. The optional password field can stay blank so you enter the password directly on Ford's page. Close the sign-in window when it finishes.
5. Run the script again and choose **Fetch telemetry**, then **Vehicle features / compatibility** to review cloud suggestions and select available readings/controls. FordConnect is optional; its separate setup requires an approved Ford developer application.
6. Open **Customize widgets**. Choose the original readings and any Pro Power fields you want. Pro Power fields start disabled. Scroll to reach all choices. **Widget gallery** previews a design for each Home Screen size; **Alerts & attention** configures notifications and the optional cached-status indicator.

No running engine or electrical load is needed for installation or a cached read.

## Add the widget

1. Add a **Scriptable** widget to your Home Screen and choose a size.
2. Edit the widget and select **FordWidget Pro Power**.
3. Set **When Interacting → Run Script**.
4. Leave **Parameter blank** to follow **Customize widgets**.

The large combined view shows vehicle readings, Pro Power cards and vehicle controls. Small and medium views retain their size-specific selection of original readings with a compact Pro Power summary. They cannot show every field at once. Medium controls can be enabled with **Medium layout: Buttons** in Customize widgets.

For a Lock Screen widget, add Scriptable while customizing the Lock Screen, then choose the same script and the desired Parameter. Circular, rectangular and inline views are supported. The first recognized view word selects the Lock Screen view; the original remote-start display behavior remains available.

### Choose a design

Open **Widget gallery**, choose Small, Medium or Large, then tap **Classic**, **Showcase** or **Dashboard** to preview it using your saved readings. Close the preview and choose **Use design** to apply it to that size. Classic remains the default. An individual widget's `classic`, `showcase` or `dashboard` Parameter overrides the shared design choice. Lock Screen views retain their separate Parameters.

Pro Power fields stay optional. Preview the selected size/design to see which readings fit; small and medium widgets cannot show every field at once.

### Optional Parameters

Naming fields means **show only those fields** and overrides the shared checkboxes. A blank Parameter uses the shared choices.

| Parameter | Result |
| --- | --- |
| Blank | Shared Customize widgets and gallery choices |
| `classic`, `showcase` or `dashboard` | Override the Home Screen design |
| `ppoa ppob ppototal ppocapacity` | Focused Pro Power widget |
| `fuel tires lock ppoa ppob ppototal` | Those original readings plus Pro Power |
| `ppob` | Pro Power B only |
| `buttons -photo` | Vehicle controls layout without the photo |
| `status` | Status layout without the control grid |
| `bar` or `psi` | Tire pressure units |

Pro Power fields are `ppoa`, `ppob`, `ppototal` (alias `ppo`) and `ppocapacity`. Original field names remain `photo`, `fuel`, `battery`, `tires`, `oil`, `lock`, `odometer`, `doors`, `temp` and `parked`. Prefix a field with `-` to hide it.

## Check vehicle features

**Vehicle features / compatibility** runs the offline self-test, then uses available cloud or saved data to suggest readings. On first setup, connect FordPass and run Fetch telemetry before rerunning this check for useful cloud suggestions. A missing metric is unverified rather than proof of an unsupported feature; saved data can also be old.

Select the readings and controls available in your Ford app. **Enable reported readings** turns on available suggestions; original choices remain editable in Customize widgets. Existing installations keep their settings until the owner runs this check. Pro Power fields are selected separately in Customize widgets.

Selected controls are unverified until an optional **Test a command…** sends a real command after confirmation and you report whether the vehicle completed it. A Ford receipt alone does not confirm completion. Remote start first requests a lock; test start only with the vehicle parked outdoors. Command and wake cooldowns still apply. Owner confirmation records that test, not a guarantee of future availability. You can skip command testing and rerun the check later.

## Alerts and attention

Open **Alerts & attention** to enable or disable unlocked, door/hood/tailgate open, low tire, low fuel, low oil, low 12V battery and remote-start-running conditions. Adjust tire, fuel, oil and battery thresholds there. These choices apply to the evening check; set its time and optional positive notice in Customize widgets.

**Widget attention** is off by default. When enabled, Home Screen widgets show the first matching condition and the age of cached readings, with a count when more conditions match. It performs no extra cloud read and is unavailable on Lock Screen widgets. Missing data remains unknown; a displayed warning may be old. iOS controls widget redraw and notification timing.

## Use Pro Power Onboard

Pro Power is optional and starts disabled. It can appear alongside the original vehicle readings or as a focused widget.

| Reading | Meaning |
| --- | --- |
| **A** / `ppoa` | Last-reported estimated power on circuit A |
| **B** / `ppob` | Last-reported estimated power on circuit B |
| **Total** / `ppototal` | Estimated combined output; A+B on the tested 7.2 kW system |
| **Capacity** / `ppocapacity` | Reported output capacity, not current consumption |

1. Enable **Pro Power A**, **Pro Power B**, **Pro Power total** and/or **Pro Power capacity** in **Customize widgets**. Keep the original vehicle fields enabled for a combined dashboard, and leave the widget's Parameter blank.
2. For output monitoring, enable Pro Power/Generator Mode using the truck's own controls and connect the desired load. The script does not enable Generator Mode or outlets.
3. Open **Pro Power** from the script's main menu. On medium and large widgets, tapping the Pro Power section also opens this view. It shows the saved estimates, the status-result age, Ford mode with its own age, and the last status-request outcome.
4. Choose **Request status once…** and confirm when you want to ask the truck for a new Pro Power report. Keep Scriptable open until the result appears. The action sends one status command, checks its matched result, and saves available Pro Power data.
5. Choose **Read cached Pro Power** when you only want Ford's stored snapshot. This still contacts Ford's cloud; it does not send a vehicle-status command and may return the same older report.

Use the widget's **Refresh** button for a combined vehicle-and-Pro Power refresh, described below. You do not need to choose **Wake / refresh** first.

The A and B labels identify the reported circuits, not a verified physical outlet position. Capacity describes reported output capability rather than current power draw. Missing or unusable fields show **—**. With Pro Power or the truck off, Ford may return zeros for hardware/capacity as well as usage; that does not establish a valid zero-watt measurement, so estimates can remain unavailable.

## Refresh, Fetch and Wake

| Action | Behavior |
| --- | --- |
| Widget **Refresh** | One confirmation covers separate general-vehicle and Pro Power status requests, bounded result checks, then cloud reads. Keep Scriptable open until completion. |
| Main menu **Fetch telemetry** | Reads available cloud vehicle data and the separate Pro Power snapshot, plus existing location/photo processing. It does not request a vehicle wake. |
| Main menu **Wake / refresh** | Sends the original general wake/status request. Use **Fetch telemetry** afterward to load the available measurements. |
| **Pro Power → Read cached Pro Power** | Reads Ford's stored Pro Power snapshot without a vehicle-status command. |
| **Pro Power → Request status once…** | After confirmation, requests Pro Power status once and checks the matched result for up to 30 seconds after acceptance. |

The combined Refresh may take around a minute. It can wake connected electronics; it does not start/stop the engine or switch outlets. Commands are not automatically retried. Portions that succeed are kept when another portion fails or is cooling down.

To use the combined flow, tap **Refresh**, confirm **Refresh all widget data? → Refresh widget**, and keep Scriptable open until its completion message appears. It checks general vehicle status first, waits any remaining shared command spacing from that attempt, requests Pro Power status, then reads cloud telemetry and checks the existing location/photo processing. Read the message to see which stages completed or were skipped; a completed flow can still contain partial results.

The main-menu **Wake / refresh** is a separate legacy action. It is not needed before combined Refresh or a Pro Power-only request. Running it first starts the shared general-wake timer and may cause the combined flow to skip its general-status request until that timer expires.

Existing limits apply:

| Limit | Interval |
| --- | --- |
| General wake/status request | 15 minutes |
| Shared cooldown between separate vehicle actions | 30 seconds |
| Pro Power status request | 60 seconds |
| Combined widget Refresh | 60 seconds |
| Ordinary Fetch telemetry local read interval | 5 minutes |

Server error backoff can require a longer wait. Combined Refresh bypasses only the local Fetch interval. A general-request cooldown still allows other available portions to run. An accepted request is distinct from matched device success; even device success does not prove every field's measurement time advanced.

The general-status portion of combined Refresh and the legacy Wake action share Ford's server backoff. Switching between those actions does not bypass a `Retry-After` wait. Pro Power and unrelated controls retain their separate limits.

## Read the measurements

Vehicle fields keep their individual measurement times. **View details** shows each field's source and time. **Doors** includes the hood. The large dashboard's **Oldest vehicle reading** footer summarizes the oldest known cached vehicle-field timestamp; it is separate from Pro Power timing.

Door and lock readings merge by component before the overall state is calculated. An unchanged old hood reading no longer prevents a newer door transition from appearing. Partial responses keep previously reported components; unknown evidence stays unknown. Older aggregate-only Ajar/Unlocked records can display **Unknown** when a later partial response cannot identify which component changed. An unresolved prior Ajar continues to block remote start until trusted whole-vehicle evidence resolves it.

Pro Power shows estimated A, B, total and capacity when the available data supports them. Estimates assume **one watt per raw unit**, corroborated on one 7.2 kW PowerBoost system with two different circuit A loads. **Both A and B have also been tested under load at the same time:** each showed a nonzero reading and the displayed total was consistent with A+B. Circuit B still needs a separate comparison against the truck's dashboard or an independent meter. Physical outlet assignments and other power variants remain unverified. Missing B is not treated as zero. Total stays unknown when the participating output data is incomplete; accumulated energy is not used as instantaneous power.

**Status result** dates the Pro Power command result. The embedded power sample time is unverified. A newly successful request may still contain an older report. Ford mode has its own age; a later OFF event does not erase historical load readings. Raw signals remain available in **Troubleshooting → Pro Power raw signals**.

There are no outlet or Generator Mode controls in this version. The Lock, Unlock, Start and Stop controls operate the vehicle through the retained original confirmations. Remote start first requests a lock and checks its result. Its countdown can initially be an estimate until Ford supplies a countdown reading. An accepted Stop request preserves the last known running countdown and Stop control while that countdown remains valid. Newer Ford telemetry or countdown expiry ends that running display; an estimated timer is not physical confirmation that the engine stopped.

The optional evening all-good notice requires explicit Locked and Closed readings with their own measurement times within five minutes. Missing, stale or unknown security readings produce limited status; enabled reported problems still trigger alerts.

iOS decides when Home Screen widgets redraw. The script requests an update after actions, but the displayed widget may lag the app's saved data. Evening checks retain the original read-only behavior and also depend on iOS scheduling.

## Update an existing installation

Replace the contents of your existing script and **keep its current Scriptable name**. Run it and check the version in the main-menu title. The Keychain namespace and cache folder remain unchanged, preserving sign-in, settings and saved data.

The public name is now **FordWidget Pro Power**. Renaming an existing script is optional. If you rename it, edit every Home Screen and Lock Screen widget to select the new script name, then preview the desired size in **Customize widgets**. Allow iOS to redraw the Home Screen copy.

This fork is isolated from the original FordWidget. Installing it for the first time requires a separate sign-in; it does not import the original's cache or settings. Keep the original script if you want both available.

## Troubleshooting

- **Only Pro Power appears:** clear the widget's Parameter, then enable the desired original and Pro Power fields in Customize widgets. A Parameter such as `ppob` deliberately selects only that field.
- **Readings disagree with the truck:** compare individual source times in View details, run Fetch telemetry and compare again. Reports captured at different times are not equivalent comparisons. Use combined Refresh when a new status request is needed, respecting cooldowns.
- **A successful request still shows an old reading:** check the field's measurement time and the Pro Power Status result separately. Request completion does not guarantee a new sample.
- **Fuel was unavailable in an earlier version:** update to v0.1.9 and Fetch telemetry. Ford can report above 100%; the fuel-only fix caps the displayed percentage at 100 and retains the raw reading. Negative or invalid values remain unknown.
- **Cooling down:** wait for the indicated interval. Do not clear cooldowns or repeatedly send commands.
- **“Already running”:** take over only if the earlier Scriptable run has actually stopped.
- **App session expired:** reopen the script and repeat the action. Foreground sessions last up to 15 minutes; a long-paused dialog cannot save changes or send commands after expiry.
- **App data changed but the widget did not:** verify the selected script and Run Script interaction setting, preview the size in Scriptable, and allow iOS to redraw it.
- **Refresh only opens Scriptable without the confirmation:** confirm that the widget selects the updated script and that **When Interacting** is **Run Script**. This intermittent behavior has been observed; a later tap reached the correct prompt, but its cause has not been established. For a Pro Power-only check, open the script's **Pro Power → Request status once…** action directly. If it recurs, note whether Scriptable shows its scripts list or the script's menu, plus the installed version.

If these checks do not explain the issue, open **Troubleshooting → Vehicle data report** from the main menu. Choose **Preview report** or **Copy report**. It attempts one passive cloud read and compares relevant raw values with the saved cache and hypothetical normalization/merge results; it does not update saved vehicle telemetry or send a vehicle command. A safe cached report remains available if the read fails. **Troubleshooting → Copy redacted Pro Power report** uses saved data without a cloud read.

Inspect reports before sharing. Reports still contain vehicle states and timestamps; they are redacted, not anonymous. The supplied reports omit VIN, location, tokens, request identifiers and raw errors. Nothing is uploaded automatically. Share the app version, relevant field ages, request outcome and what the truck displayed. Do not share raw caches, credentials or unredacted View details screenshots.

## Privacy and license

Passwords are not saved. Ford tokens and the username use Scriptable's shared Keychain; other installed scripts may access it. The device-local cache keeps the **legacy storage identifier** `FordWidget Pro Power Preview/ford_vehicle_cache.json` for upgrade compatibility and can retain parked coordinates while that feature is enabled. **Sign out of Ford** removes saved credentials/tokens, while telemetry, photos and widget settings remain.

The retained remote-start weather fallback can query Open-Meteo with an approximately 1 km-rounded vehicle location when the truck's own temperature reading is old. It sends no Ford account or token. Location labels use the device's reverse geocoder. Troubleshooting reports are never automatically uploaded.

Turning **Parked location** off in **Customize widgets** or **Vehicle features / compatibility** immediately removes position/place data from both cache copies, hides maps/location output and disables the weather location fallback. A per-widget Parameter cannot override that app-wide privacy choice. Saved Home settings remain in Keychain for when you re-enable the feature.

To uninstall, sign out, delete the script and widgets, and remove the folder with the **legacy storage identifier** `FordWidget Pro Power Preview` from Scriptable's local documents if you also want to remove saved telemetry and photos.

This unofficial client depends on private Ford APIs and compatible, authorized vehicle services. Availability may change. Use engine start only with the vehicle safely parked outdoors.

The fork retains the [MIT License](../LICENSE), original copyright © 2026 rushilpunu, and attribution to [rushilpunu/FordWidget](https://github.com/rushilpunu/FordWidget) at [`b7f7e2866c014445b2bec831c237925d3ca61b5f`](https://github.com/rushilpunu/FordWidget/commit/b7f7e2866c014445b2bec831c237925d3ca61b5f).
