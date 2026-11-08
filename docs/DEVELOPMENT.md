# Development

`FordWidget.js` is the generated, installable Scriptable script for **FordWidget Pro Power v0.1.7**. The modular inputs and offline tests are in `source/`. Users install the single script; they do not need the build tools.

## Build and check

Requirements: Python 3 and a recent Node.js with the built-in test runner. There are no downloaded dependencies.

From the repository root:

```sh
python3 source/build.py
node source/widget.test.cjs
node source/core.test.cjs
node source/ui.test.cjs
node source/parser.test.cjs
node --input-type=module --check < FordWidget.js
```

The build and tests make no Ford requests. Test requests, credentials, identifiers, positions and vehicle data are synthetic fixtures. The test runner mocks Scriptable's network, storage and UI APIs. Do not replace fixtures with actual vehicle captures or credentials.

The builder verifies the pinned upstream script's SHA-256, applies explicit edits and records the generated script's hash in `source/build-manifest.json`. Running it twice should produce the same script and manifest. Commit source changes and regenerated output together.

## Upstream relationship

The original script is retained unchanged as `source/FordWidget.upstream.js`, pinned to upstream commit `1b129eb6155fa7c0a1d14592be6983366943d31b`. The repository retains upstream history and its MIT license. Source comparisons check original methods, fields, command payloads and all six default widget layouts, with documented exceptions for the combined Refresh action, fuel clamp and safe failure metadata.

Keep upstream fixes separate from optional Pro Power behavior where possible. Updates must retain original vehicle features, opt-in Pro Power fields, per-field measurement times, command confirmations, session checks and cooldowns. A successful cloud read or command receipt must not be relabeled as a fresh measurement.

## Installation compatibility

New installations use the Scriptable name **FordWidget Pro Power**. Existing installations should replace the script contents and keep their current Scriptable name so existing widgets stay connected. Renaming is optional; if renamed, select the new script name in every widget.

The Keychain prefix `FordWidget.ProPowerPreview.v1.` and local folder `FordWidget Pro Power Preview` are **legacy storage identifiers**, intentionally unchanged for upgrade compatibility. They remain separate from upstream FordWidget. Changing the public product name does not migrate or clear stored data. Do not copy tokens or caches between scripts.

## Troubleshooting data

Useful redacted reports remain available through the app's **Troubleshooting** menu. Pro Power reports use cached data. The vehicle report offers one passive cloud read and does not save candidate telemetry or send a vehicle command. Both reports still contain vehicle states and times, so users should review them before sharing.

This repository excludes research tools, app packages, captures, screenshots, personal configurations, cached vehicle data and generated test logs. Add only deliberately reviewed source, tests and documentation. The original license and project attribution must remain intact.
