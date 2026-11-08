"""Build an isolated, additive single-file Scriptable widget from pinned upstream."""
from pathlib import Path
import hashlib,json

folder=Path(__file__).resolve().parent
root=folder.parent
out=root
version='0.1.7'
commit='1b129eb6155fa7c0a1d14592be6983366943d31b'
base=(folder/'FordWidget.upstream.js').read_text()
expected='2b3502240739b036746c3ad42a247c40e7c0de2ef1612789f60c8125dcfde2a6'
assert hashlib.sha256(base.encode()).hexdigest()==expected,'Pinned upstream source changed'
source=base
patches=[]
def replace(before,after,label):
 global source
 assert source.count(before)==1,(label,source.count(before))
 source=source.replace(before,after)
 patches.append(label)

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
replace("secretSet('gate.' + name, { failures, next: now() + delay });", "secretSet('gate.' + name, { failures, next: now() + delay,\n      httpStatus: typeof status === 'number' && Number.isInteger(status) && (status === 0 || status >= 100 && status <= 599) ? status : null, failedAt: now() });", 'retain safe status and time for future failures without changing backoff')
replace("['refresh', 'Refresh', 'arrow.clockwise']", "['refreshwidget', 'Refresh', 'arrow.clockwise']", 'widget Refresh runs the combined refresh while legacy Wake remains available')
replace("    w.addSpacer();\n    const known = Object.values(this.fields)", "    if (typeof this._ppoBeforeFooter === 'function') this._ppoBeforeFooter(w);\n    w.addSpacer();\n    const known = Object.values(this.fields)", 'allow the large combined PPO section before flexible footer space')
replace("      const result = await api.getVehicleStatus();\n      await api.updatePlace();","      const result = await api.getVehicleStatus();\n      if (secretGet('token.mobile')) {\n        try {\n          const power = await api.readProPower();\n          result.note += '\\nPro Power: ' + power.note;\n          result.cache = power.cache;\n        } catch (_) { result.note += '\\nPro Power could not be read. Existing telemetry was retained.'; }\n      }\n      await api.updatePlace();",'add foreground-only independent PPO read to Fetch telemetry')
replace("        ['View details', () => this.details(prefs)],","        ['View details', () => this.details(prefs)],\n        ['Troubleshooting', () => this.troubleshooting(prefs)],\n        ['Pro Power', () => this.action('propower', prefs)],",'add Pro Power and optional Troubleshooting menu entries')
replace("menu.title = prefs.name; menu.message =", "menu.title = prefs.name + ' · ' + FORDWIDGET_VERSION; menu.message =", 'identify the installed version in the main menu')
context=(folder/'refresh-diagnostic.js').read_text().replace('__APP_VERSION__',version)
ui=(folder/'fuel-normalization.js').read_text()+'\n'+(folder/'pro-power-ui.js').read_text()+'\n'+(folder/'pro-power-dashboard.js').read_text()+'\n'+context+'\n'+(folder/'fuel-diagnostic.js').read_text()+'\n'+(folder/'vehicle-status-diagnostic.js').read_text()+'\n'+(folder/'general-status-refresh.js').read_text()+'\n'+(folder/'widget-refresh.js').read_text()+'\n'+(folder/'troubleshooting.js').read_text()+'\n'+(folder/'pro-power-checks.js').read_text()
replace('function selfTest() {',ui+'\n\nfunction selfTest() {','add optional PPO renderer and confirmed foreground UI')
replace('function selfTest() {\n  const assert', 'function selfTest() {\n  ppoSelfCheck();\n  const assert', 'extend original offline self-test with pure PPO checks')
replace("try { await new AppController().run(); }","// __FORDWIDGET_ENTRY__\ntry { await new AppController().run(); }",'mark entry for offline verification')
file=out/'FordWidget.js'
file.write_text(source)
manifest={'version':version,'upstream':'https://github.com/rushilpunu/FordWidget','upstreamCommit':commit,'upstreamSHA256':expected,'outputSHA256':hashlib.sha256(source.encode()).hexdigest(),'changes':patches,'scope':'Optional Pro Power monitoring; build and offline checks perform no Ford calls'}
(folder/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Built',file.name,len(source.splitlines()),'lines; SHA256',manifest['outputSHA256'])
