"""Build an isolated, additive single-file Scriptable widget from pinned upstream."""
from pathlib import Path
import hashlib,json
from release import read_version

folder=Path(__file__).resolve().parent
root=folder.parent
out=root
version=read_version((folder/'version.json').read_bytes())
commit='b7f7e2866c014445b2bec831c237925d3ca61b5f'
base=(folder/'FordWidget.upstream.js').read_text()
expected='605ba8cfba29214ad0e40f3d4b7e6b71d8fd9b9fcd0f42131ec6104485037fab'
if hashlib.sha256(base.encode()).hexdigest()!=expected:
 raise ValueError('Pinned upstream source changed')
source=base
patches=[]
def replace(before,after,label):
 global source
 if source.count(before)!=1:
  raise ValueError(f'{label}: expected one patch target, got {source.count(before)}')
 source=source.replace(before,after)
 patches.append(label)

# The five reviewed fixes are part of this upstream pin, not duplicate overlays.
merged_fix_prs=['https://github.com/rushilpunu/FordWidget/pull/'+str(i) for i in range(1,6)]

# Keep the location opt-out effective before a cooldown return and from new setup UI.
replace("  async getVehicleStatus() {\n    this.store.assertLease();", "  async getVehicleStatus() {\n    this.store.assertLease();\n    if (!parkedLocationEnabled(this.prefs) || !parkedLocationEnabled()) this.store.purgeLocation();", 'purge disabled location before returning cooldown data')
replace("      prefs.widget = Object.assign({}, cfg, { show }); prefs.compatibility = { commands, verified }; secretSet('vehicle', prefs);", "      prefs.widget = Object.assign({}, cfg, { show }); prefs.compatibility = { commands, verified }; saveVehiclePreferences(this.store, prefs);", 'guard Vehicle features changes and purge disabled location')
replace("    prefs.widget = Object.assign({}, cfg, { show }); prefs.compatibility = { commands, verified }; secretSet('vehicle', prefs);\n  }", "    prefs.widget = Object.assign({}, cfg, { show }); prefs.compatibility = { commands, verified }; saveVehiclePreferences(this.store, prefs);\n  }", 'guard final Vehicle features save and purge disabled location')
replace("if (await confirm.presentAlert() === 0) { prefs.widget = previewPrefs.widget; secretSet('vehicle', prefs); return; }", "if (await confirm.presentAlert() === 0) { prefs.widget = previewPrefs.widget; saveVehiclePreferences(this.store, prefs); return; }", 'guard gallery saves against a displaced app session or changed vehicle')
replace("      prefs.alerts = next; secretSet('vehicle', prefs);", "      prefs.alerts = next; saveVehiclePreferences(this.store, prefs);", 'guard alert saves against a displaced app session or changed vehicle')
replace("class AppController {", (folder/'ui-preferences.js').read_text()+"\nclass AppController {", 'add a foreground session and vehicle guard for new settings saves')

replace("  async acquire() {", (folder/'lease-retirement.js').read_text()+"  async acquire() {", 'add displacement-verified lease retirement without compare-and-delete assumptions')
replace("      this.fm.remove(this.lockPath);\n    }\n    const owner = uid(), temp = this.lockPath + '.' + owner;\n    this.fm.writeString(temp, JSON.stringify({ owner, started: now(), until: now() + SETTINGS.lease }));", "      if (!this.retireLease(old)) throw new Error('Another run owns the app session. Try again later.');\n    }\n    const owner = uid(), temp = this.lockPath + '.' + owner;\n    this.fm.writeString(temp, JSON.stringify({ owner, started: now(), until: now() + SETTINGS.lease }));", 'retire only the foreground lease actually reviewed before takeover')
replace("      this.fm.remove(this.lockPath);\n    }\n    const owner = uid(), temp = this.lockPath + '.' + owner;\n    this.fm.writeString(temp, JSON.stringify({ owner, started: now(), until: now() + 90000, background: true }));", "      if (!this.retireLease(old)) return false;\n    }\n    const owner = uid(), temp = this.lockPath + '.' + owner;\n    this.fm.writeString(temp, JSON.stringify({ owner, started: now(), until: now() + 90000, background: true }));", 'retire only the expired background lease actually inspected')
replace("    if (this.owner && l && l.owner === this.owner) this.fm.remove(this.lockPath);", "    if (this.owner && l && l.owner === this.owner) this.retireLease(l);", 'release only the actual displaced owner record without deleting a successor')

# FileManager.move replaces its target; an exclusive lease claim must use copy.
replace("    // Native move refuses an existing destination: concurrent app runs fail closed.\n    try { this.fm.move(temp, this.lockPath); this.owner = owner; this.assertLease(); }\n    catch (_) { if (this.fm.fileExists(temp)) this.fm.remove(temp); throw new Error('Another run owns the app session. Try again later.'); }",
        "    // Native copy refuses an existing destination: concurrent app runs fail closed.\n    try { this.fm.copy(temp, this.lockPath); this.owner = owner; this.assertLease(); }\n    catch (_) { this.owner = null; throw new Error('Another run owns the app session. Try again later.'); }\n    finally { try { if (this.fm.fileExists(temp)) this.fm.remove(temp); } catch (_) {} }",
        'claim foreground leases without overwriting a concurrent owner')
replace("    try { this.fm.move(temp, this.lockPath); }\n    catch (_) { if (this.fm.fileExists(temp)) this.fm.remove(temp); return false; }\n    this.owner = owner; this.background = true;\n    return true;",
        "    try {\n      this.fm.copy(temp, this.lockPath); this.owner = owner; this.background = true; this.assertLease();\n      return true;\n    } catch (_) { this.owner = null; this.background = false; return false; }\n    finally { try { if (this.fm.fileExists(temp)) this.fm.remove(temp); } catch (_) {} }",
        'claim background leases without overwriting a concurrent owner')

replace("    // Sliding lease: an active run keeps ownership; a killed run frees it after `lease`.\n    this.fm.writeString(this.lockPath, JSON.stringify({ owner: this.owner, started: l.started,\n      until: now() + (this.background ? 90000 : SETTINGS.lease), background: !!this.background }));", "    // Ownership is immutable until release/takeover/expiry. A stale run must\n    // never rewrite this shared file and restore itself over a newer owner.", 'keep lease checks read-only so stale runs cannot reclaim a newer session')

license=(root/'LICENSE').read_text()
header='''/*
FordWidget Pro Power VERSION
Derived from rushilpunu/FordWidget, pinned commit COMMIT.
All original layouts, controls, telemetry, photos and notifications remain available.
New optional parameters: ppoa ppob ppototal ppocapacity (alias: ppo).
Selected Pro Power fields join the original Home Screen layout when original
fields are also selected. Parameters naming only PPO fields keep a focused view.
No Pro Power fields appear until selected. The Pro Power menu reads cached status
and offers a separately confirmed, once-only status request. No outlet controls
or continuous reporting are added. Widget rendering never sends vehicle commands.
Troubleshooting offers redacted vehicle and Pro Power reports. A vehicle
report uses one passive cloud read, with no command or saved telemetry changes.
The widget Refresh button runs a confirmed full refresh: separate general-vehicle
and Pro Power status requests with bounded result checks, plus cloud reads.
The legacy Wake action stays available in the main menu. Existing command,
wake and server cooldowns apply, along with the full refresh's own cooldown.
Power is an estimate at 1 W per decoded unit, corroborated on one 7.2 kW truck.
Other variants and enum/sentinel mappings still require validation. Every PPO
view shows last-reported data and command age; embedded sample time is unknown.

This fork uses its own Keychain prefix and cache folder, so it requires its
own setup/sign-in when moving from upstream. Existing users keep the same
script name and saved setup. Ford tokens use Scriptable's shared Keychain.
The original North American USA sign-in profile is retained. Canada is untested.
See README.md and docs/USAGE.md before running.

Original license (also applies to this derivative):
LICENSE_BODY
*/
'''.replace('VERSION',version).replace('COMMIT',commit).replace('LICENSE_BODY',license)
replace('/**\n * FordWidget —',header+'\n/**\n * FordWidget —','fork provenance and full upstream license')
replace(' * Only install it from there, and read it first (see SECURITY & PRIVACY).',' * This fork derives from that source. Read the notes above and SECURITY & PRIVACY.','clarify derivative provenance')
replace('action=fetch    (cloud GET only)', 'action=fetch    (cloud reads only)', 'document the additional read-only POST query')
replace('`FordWidget.v1.${name}`','`FordWidget.ProPowerPreview.v1.${name}`','retain the existing isolated Keychain namespace')
replace("this.dir = this.fm.joinPath(this.fm.documentsDirectory(), 'FordWidget');","this.dir = this.fm.joinPath(this.fm.documentsDirectory(), 'FordWidget Pro Power Preview');",'retain the existing isolated cache folder')
replace('Local FordWidget/ford_vehicle_cache.json','Legacy local storage: FordWidget Pro Power Preview/ford_vehicle_cache.json','document the retained cache path')
core=(folder/'pttb-v2.js').read_text()+'\n'+(folder/'pro-power-core.js').read_text()
replace('// Display options: app-wide defaults from Customize widgets, overridable per widget',core+'\n\n// Display options: app-wide defaults from Customize widgets, overridable per widget','add portable PPO parser and independent API/cache methods')
replace("  parked: 'Parked location' });","  parked: 'Parked location', ppoa: 'Pro Power A (estimated)', ppob: 'Pro Power B (estimated)',\n  ppototal: 'Pro Power total (estimated)', ppocapacity: 'Pro Power capacity (estimated)' });",'register four optional PPO fields')
replace("  weather: 'temp', temperature: 'temp', location: 'parked', gps: 'parked', map: 'parked' });","  weather: 'temp', temperature: 'temp', location: 'parked', gps: 'parked', map: 'parked',\n  ppo: 'ppototal', propower: 'ppototal', generator: 'ppototal' });",'register new PPO parameter aliases')
replace("const ACCESSORY_VIEWS = ['fuel', 'lock', 'tires', 'parked', 'status'];","const ACCESSORY_VIEWS = ['fuel', 'lock', 'tires', 'parked', 'status', 'ppoa', 'ppob', 'ppototal', 'ppocapacity'];",'allow opt-in PPO Lock Screen views')
replace("Object.keys(METRICS).map(k => [k, true])","Object.keys(METRICS).map(k => [k, !k.startsWith('ppo')])",'keep new PPO fields off by default')
replace("    const e = m[key]; put(field, bounded(e && e.value, max), e);", "    const e = m[key]; put(field, field === 'fuel' ? fordFuelPercent(e && e.value) : bounded(e && e.value, max), e);\n    if (field === 'fuel' && out.fuel) out.fuel.rawValue = finite(e && e.value);", 'clamp positive fuel over-read to 100 while retaining the raw percentage')
replace("  async getVehicleStatus() {", "  async getVehicleStatus(force = false) {", 'allow an explicit full-widget cloud read')
replace("    if (c.nextFetch > now()) return", "    if (!force && c.nextFetch > now()) return", 'manual full refresh bypasses only the local read interval')
replace("const data = await this.auth.request('commands', `${SETTINGS.autonomic}/command/vehicles/${vin}/commands`, 'POST',",
        "const scope = command === 'refresh' ? 'commands.generalStatus' : 'commands';\n    const data = await this.auth.request(scope, `${SETTINGS.autonomic}/command/vehicles/${vin}/commands`, 'POST',",
        'share the server backoff for both general-status entry points')
replace("    this.auth.gate('commands');\n    let c = this.store.read() || { version: 1, vin, fields: {} };",
        "    this.auth.gate('commands');\n    if (command === 'refresh') this.auth.gate('commands.generalStatus');\n    let c = this.store.read() || { version: 1, vin, fields: {} };",
        'honor the general-status server gate before legacy Wake dispatch')
replace("secretSet('gate.' + name, { failures, next: now() + delay });", "secretSet('gate.' + name, { failures, next: now() + delay,\n      httpStatus: typeof status === 'number' && Number.isInteger(status) && (status === 0 || status >= 100 && status <= 599) ? status : null, failedAt: now() });", 'retain safe status and time for future failures without changing backoff')
replace("b.url = this.url(action);", "b.url = this.url(action === 'refresh' ? 'refreshwidget' : action);", 'route widget Refresh to combined refresh after upstream compatibility filtering')
replace("    if (!this.runningBadge(w, 11)) this.lockPill(w);\n    w.addSpacer();", "    if (!this.runningBadge(w, 11)) this.lockPill(w);\n    if (typeof this._ppoBeforeFooter === 'function') this._ppoBeforeFooter(w);\n    w.addSpacer();", 'allow an additive PPO section in Classic small')
replace("w.addSpacer(4); this.parkedRow(w, 10); w.addSpacer(); this.buttons(w, 4, 62, 38);", "w.addSpacer(4); this.parkedRow(w, 10); if (typeof this._ppoBeforeControls === 'function') this._ppoBeforeControls(w); w.addSpacer(); this.buttons(w, 4, 62, 38);", 'allow an additive PPO section before Showcase medium controls')
replace("        w.addSpacer(); this.buttons(w, 4, 65, 38);", "        if (typeof this._ppoBeforeControls === 'function') this._ppoBeforeControls(w);\n        w.addSpacer(); this.buttons(w, 4, 65, 38);", 'allow an additive PPO section before gallery large controls')
replace("    w.addSpacer();\n    const known = Object.values(this.fields).some", "    if (typeof this._ppoBeforeFooter === 'function') this._ppoBeforeFooter(w);\n    w.addSpacer();\n    const known = Object.values(this.fields).some", 'allow an additive PPO section before gallery footer')
replace("      if (large && controls) { w.addSpacer(8); this.buttons(w, 4, 70, 46); }", "      if (large && controls) { if (typeof this._ppoBeforeControls === 'function') this._ppoBeforeControls(w); w.addSpacer(8); this.buttons(w, 4, 70, 46); }", 'allow an additive PPO section before Classic large controls')
replace("    w.addSpacer();\n    const known = Object.values(this.fields).filter", "    if (typeof this._ppoBeforeFooter === 'function') this._ppoBeforeFooter(w);\n    w.addSpacer();\n    const known = Object.values(this.fields).filter", 'allow an additive PPO section before Classic footer')
replace("      const result = await api.getVehicleStatus();\n      await api.updatePlace();","      const result = await api.getVehicleStatus();\n      if (secretGet('token.mobile')) {\n        try {\n          const power = await api.readProPower();\n          result.note += '\\nPro Power: ' + power.note;\n          result.cache = power.cache;\n        } catch (_) { result.note += '\\nPro Power could not be read. Existing telemetry was retained.'; }\n      }\n      await api.updatePlace();",'add foreground-only independent PPO read to Fetch telemetry')
replace("        ['View details', () => this.details(prefs)],","        ['View details', () => this.details(prefs)],\n        ['Troubleshooting', () => this.troubleshooting(prefs)],\n        ['Pro Power', () => this.action('propower', prefs)],",'add Pro Power and optional Troubleshooting menu entries')
replace("menu.title = prefs.name; menu.message =", "menu.title = prefs.name + ' · ' + FORDWIDGET_VERSION; menu.message =", 'identify the installed version in the main menu')
context=(folder/'refresh-diagnostic.js').read_text().replace('__APP_VERSION__',version)
ui=(folder/'fuel-normalization.js').read_text()+'\n'+(folder/'pro-power-ui.js').read_text()+'\n'+(folder/'pro-power-dashboard.js').read_text()+'\n'+context+'\n'+(folder/'fuel-diagnostic.js').read_text()+'\n'+(folder/'vehicle-status-diagnostic.js').read_text()+'\n'+(folder/'general-status-refresh.js').read_text()+'\n'+(folder/'widget-refresh.js').read_text()+'\n'+(folder/'troubleshooting.js').read_text()+'\n'+(folder/'pro-power-checks.js').read_text()
replace('function selfTest() {',ui+'\n\nfunction selfTest() {','add optional PPO renderer and confirmed foreground UI')
replace('function selfTest() {\n  const assert', 'function selfTest() {\n  ppoSelfCheck();\n  const assert', 'extend original offline self-test with pure PPO checks')
replace("try { await new AppController().run(); }","// __FORDWIDGET_ENTRY__\ntry { await new AppController().run(); }",'mark entry for offline verification')
file=out/'FordWidget Pro Power.js'
file.write_text(source)
manifest={'version':version,'upstream':'https://github.com/rushilpunu/FordWidget','upstreamCommit':commit,'upstreamSHA256':expected,'mergedUpstreamFixPRs':merged_fix_prs,'outputSHA256':hashlib.sha256(source.encode()).hexdigest(),'changes':patches,'scope':'Optional Pro Power monitoring on current pinned upstream; build and offline checks perform no Ford calls'}
(folder/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Built',file.name,len(source.splitlines()),'lines; SHA256',manifest['outputSHA256'])
