# Development

`FordWidget.js` is the generated, installable Scriptable script for **FordWidget Pro Power v0.1.9**. The modular inputs and offline tests are in `source/`. Users install the single script; they do not need the build tools.

## Build and check

Requirements: Python 3 and a recent Node.js with the built-in test runner. There are no downloaded dependencies.

From the repository root:

```sh
python3 source/build.py
node source/widget.test.cjs
node source/core.test.cjs
node source/ui.test.cjs
node source/parser.test.cjs
node --test tests/*.test.cjs
node --input-type=module --check < FordWidget.js
```

The build and tests make no Ford requests. Test requests, credentials, identifiers, positions and vehicle data are synthetic fixtures. The test runner mocks Scriptable's network, storage and UI APIs. Do not replace fixtures with actual vehicle captures or credentials.

The app version is defined in `source/version.json` and must be canonical `major.minor.patch`: three non-negative integers, without leading zeros, suffixes or omitted parts. The builder verifies the pinned upstream script's SHA-256, applies explicit Pro Power and compatibility edits, and records the generated script's hash in `source/build-manifest.json`. Every text edit must match exactly once. Running it twice should produce the same script and manifest. Commit source changes and regenerated output together.

## Release version and installer protection

`source/version.json` is the single app-version source. Rebuild rather than editing the generated widget header, runtime version or manifest independently. Release validation requires one unambiguous version header, a matching runtime version, and agreement between the version file, generated widget and build manifest. The installer refuses downgrades and rejects malformed or conflicting installed version headers before replacement.

Once a widget version has been published, changed widget bytes require a version bump. The release check compares the candidate with the selected base and the existing installer pin so a new payload cannot silently reuse a published version. Documentation or installer-metadata-only changes can retain the app version when the widget bytes are unchanged.

Prepare a release in two commits:

1. Set the new canonical version in `source/version.json`, rebuild, run the offline tests and review the generated `FordWidget.js`. Commit the reviewed widget, version metadata and matching manifest. Record that full 40-character code-commit SHA.
2. From the same checkout, run `python3 source/release.py --commit FULL_CODE_COMMIT_SHA`. The helper verifies the committed widget/version/manifest bytes and prepares the installer's immutable source URL, version and SHA-256 together. Update the page's installed-version/source link to the same pin, review the result, and commit the installer/page metadata separately.

Validate the final release without modifying files:

```sh
python3 source/release.py --check
python3 source/release.py --check --base FULL_BASE_COMMIT_SHA
```

The optional base identifies the earlier reviewed repository state used for version/change comparisons. The pull-request workflow runs the release check against its base, rebuilds deterministically and runs the offline suites. The helper and tests make no Ford calls and do not execute the downloaded widget. Release preparation is offline; after pushing, separately verify that GitHub serves the pinned bytes and that their SHA-256 matches before publishing the install page.

Keep the reviewed code commit reachable in the published repository. A regular merge preserves the code commit referenced by the installer; squashing away that commit can leave the immutable pin without durable history. If history is rewritten, prepare and review a new reachable pin before publishing.

## Upstream relationship

The original script is retained unchanged as `source/FordWidget.upstream.js`, pinned to upstream commit `b7f7e2866c014445b2bec831c237925d3ca61b5f`. The repository retains upstream history and its MIT license. The five inherited-fix PRs have merged upstream; the new pinned source already contains those fixes, so the build must not reapply their earlier overlay. The upstream update adds Classic/Showcase/Dashboard designs, configurable alerts/attention and vehicle-feature setup. Source comparisons and offline tests check the pinned source, retained vehicle behavior and optional Pro Power integration. Fork-specific edits include the combined Refresh action, shared general-status server gate, fuel clamp, isolated storage and safe failure metadata. The inherited-fix regression suites continue to run against the generated script.

Keep upstream fixes separate from optional Pro Power behavior where possible. Updates must retain original vehicle features, opt-in Pro Power fields, per-field measurement times, command confirmations, session checks and cooldowns. A successful cloud read or command receipt must not be relabeled as a fresh measurement.

App ownership uses immutable, bounded leases (15 minutes in the foreground, 90 seconds for the evening check). Lease checks never rewrite the shared owner record, so a displaced run cannot renew itself over its successor. An expired action fails closed and asks the user to rerun the script. Cleanup first displaces and inspects the actual lock record; it restores a competing record with a no-clobber copy or retains it for recovery. This is a fail-closed file protocol, not an atomic transaction across Scriptable processes; a simultaneous takeover may interrupt another run.

## Installation compatibility

New installations use the Scriptable name **FordWidget Pro Power**. Existing installations should replace the script contents and keep their current Scriptable name so existing widgets stay connected. Renaming is optional; if renamed, select the new script name in every widget.

The Keychain prefix `FordWidget.ProPowerPreview.v1.` and local folder `FordWidget Pro Power Preview` are **legacy storage identifiers**, intentionally unchanged for upgrade compatibility. They remain separate from upstream FordWidget. Changing the public product name does not migrate or clear stored data. Do not copy tokens or caches between scripts.

## State and settings safeguards

Settings changes must recheck the active session and configured VIN after user interaction and before saving. A settings sheet opened for an earlier session or vehicle must not write into the current configuration. Lease acquisition must not clobber another run's claim; lost ownership also prevents late requests from changing shared tokens or cooldowns.

Disabling Parked location from Customize widgets or Vehicle features / compatibility removes cached coordinates and place labels immediately from the primary and backup copies. This must not depend on the next telemetry fetch. Location-dependent weather/geocoder paths honor that saved opt-out; the saved Home preference remains available for re-enabling the feature.

## Troubleshooting data

Useful redacted reports remain available through the app's **Troubleshooting** menu. Pro Power reports use cached data. The vehicle report offers one passive cloud read and does not save candidate telemetry or send a vehicle command. Both reports still contain vehicle states and times, so users should review them before sharing.

This repository excludes research tools, app packages, captures, screenshots, personal configurations, cached vehicle data and generated test logs. Add only deliberately reviewed source, tests and documentation. The original license and project attribution must remain intact.

## Install page

The static site lives in `docs/index.html`, `styles.css`, `site.js` and `icon.svg`. GitHub Pages publishes `main` → `/docs`; `.nojekyll` keeps the assets as plain static files. There are no external fonts, analytics or site account forms. Serve `docs/` locally to check desktop/mobile layouts and the copy/manual-copy flow.

`docs/installer.js` is a separate Scriptable script. It downloads an immutable reviewed widget commit, validates its SHA-256, preserves the chosen script name, asks before replacement and backs up existing code. It never executes the widget or reads its Keychain/cache. When releasing a new widget, update `source/version.json`, rebuild and review the generated widget, then pin the installer to the resulting immutable commit and SHA-256. Update the page's installed-version/source link with that release metadata. Run `node --test tests/installer.test.cjs tests/site.test.cjs`, check the existing widget suites, then verify installation/update in native Scriptable when available. The installer's pin is intentionally independent of an unreviewed moving branch.
