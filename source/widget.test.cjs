'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const baselineSource = fs.readFileSync(path.join(__dirname, 'FordWidget.upstream.js'), 'utf8');
const widgetPath = process.argv[2] || process.env.FORDWIDGET_SCRIPT || path.join(root, 'FordWidget.js');
const widgetSource = fs.readFileSync(widgetPath, 'utf8');
const entryMarker = '// __FORDWIDGET_ENTRY__';
assert.ok(widgetSource.includes(entryMarker), 'The widget must expose its offline entry boundary');
const VIN = '1FTFW1E50JFA00001'; // Synthetic test vehicle, never used on a network.
const TIME = Date.parse('2026-11-08T14:00:00.000Z');
const families = ['small', 'medium', 'large', 'accessoryCircular', 'accessoryRectangular', 'accessoryInline'];
const plain = value => JSON.parse(JSON.stringify(value));

function scriptable(source, baseline = false) {
  const state = { clock: TIME, files: new Map(), secrets: new Map(), requests: [], responses: [],
    alerts: [], choices: [], notifications: [], widgets: [], logs: [], uuid: 0, geocodes: [], previews: [], clipboard: [], safari: [] };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [state.clock])); }
    static now() { return state.clock; }
  }
  class Color {
    constructor(hex, alpha = 1) { this.hex = hex; this.alpha = alpha; }
    static dynamic(light, dark) { return { light, dark }; }
    static white() { return new Color('white'); }
    static black() { return new Color('black'); }
    static gray() { return new Color('gray'); }
    static red() { return new Color('red'); }
  }
  class Size { constructor(width, height) { this.width = width; this.height = height; } }
  class Point { constructor(x, y) { this.x = x; this.y = y; } }
  class Rect { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  class Node {
    constructor(kind, value) { this.kind = kind; this.children = []; if (value !== undefined) this.value = value; }
    addStack() { const n = new Node('stack'); this.children.push(n); return n; }
    addText(text) { const n = new Node('text', String(text)); this.children.push(n); return n; }
    addImage(image) { const n = new Node('image', image); this.children.push(n); return n; }
    addDate(date) { const n = new Node('date', date.toISOString()); this.children.push(n); return n; }
    addSpacer(size) { this.children.push({ kind: 'spacer', size: size === undefined ? null : size }); }
    setPadding(...padding) { this.padding = padding; }
    layoutHorizontally() { this.layout = 'horizontal'; }
    layoutVertically() { this.layout = 'vertical'; }
    centerAlignContent() { this.contentAlignment = 'center'; }
    topAlignContent() { this.contentAlignment = 'top'; }
    bottomAlignContent() { this.contentAlignment = 'bottom'; }
    centerAlignText() { this.textAlignment = 'center'; }
    leftAlignText() { this.textAlignment = 'left'; }
    rightAlignText() { this.textAlignment = 'right'; }
    applyTimerStyle() { this.dateStyle = 'timer'; }
    applyTimeStyle() { this.dateStyle = 'time'; }
    applyDateStyle() { this.dateStyle = 'date'; }
    useDefaultPadding() { this.padding = 'default'; }
    async presentSmall() { state.widgets.push(this); }
    async presentMedium() { state.widgets.push(this); }
    async presentLarge() { state.widgets.push(this); }
  }
  class ListWidget extends Node { constructor() { super('widget'); } }
  class DrawContext {
    constructor() { this.operations = []; }
    setFillColor(...args) { this.operations.push(['setFillColor', ...args]); }
    fillRect(...args) { this.operations.push(['fillRect', ...args]); }
    addPath(...args) { this.operations.push(['addPath', ...args]); }
    setStrokeColor(...args) { this.operations.push(['setStrokeColor', ...args]); }
    setLineWidth(...args) { this.operations.push(['setLineWidth', ...args]); }
    strokePath(...args) { this.operations.push(['strokePath', ...args]); }
    drawImageInRect(...args) { this.operations.push(['drawImageInRect', ...args]); }
    getImage() { return { kind: 'drawing', size: this.size, operations: this.operations, opaque: this.opaque, respectScreenScale: this.respectScreenScale }; }
  }
  class Path {
    constructor() { this.operations = []; }
    move(point) { this.operations.push(['move', point]); }
    addLine(point) { this.operations.push(['addLine', point]); }
  }
  const fm = {
    documentsDirectory: () => '/mock/documents', joinPath: (a, b) => a + '/' + b,
    fileExists: p => state.files.has(p), createDirectory: p => state.files.set(p, { directory: true }),
    readString: p => { if (!state.files.has(p)) throw new Error('Missing mock file'); return state.files.get(p); },
    writeString: (p, value) => state.files.set(p, String(value)), remove: p => state.files.delete(p),
    move: (from, to) => { assert.ok(state.files.has(from)); assert.ok(!state.files.has(to), 'Native move refuses an existing destination'); state.files.set(to, state.files.get(from)); state.files.delete(from); },
    copy: (from, to) => { assert.ok(state.files.has(from)); state.files.set(to, state.files.get(from)); },
    readImage: p => state.files.get(p), writeImage: (p, img) => state.files.set(p, img),
  };
  class Alert {
    constructor() { this.actions = []; this.fields = []; }
    addAction(title) { this.actions.push({ title, type: 'normal' }); }
    addDestructiveAction(title) { this.actions.push({ title, type: 'destructive' }); }
    addCancelAction(title) { this.cancel = title; }
    addTextField(label, value = '') { this.fields.push({ label, value }); }
    addSecureTextField(label, value = '') { this.fields.push({ label, value, secret: true }); }
    textFieldValue(i) { return this.fields[i].value; }
    async show(kind) {
      state.alerts.push({ kind, title: this.title, message: this.message, actions: this.actions, cancel: this.cancel });
      const choice = state.choices.length ? state.choices.shift() : -1;
      if (typeof choice !== 'string') return choice;
      const index = this.actions.findIndex(action => action.title === choice);
      assert.ok(index >= 0, 'No such mocked alert action: ' + choice);
      return index;
    }
    async presentAlert() { return this.show('alert'); }
    async presentSheet() { return this.show('sheet'); }
  }
  class Request {
    constructor(url) { this.url = url; this.method = 'GET'; this.headers = {}; }
    async responseBody() {
      state.requests.push({ url: this.url, method: this.method, headers: plain(this.headers), body: this.body });
      assert.ok(state.responses.length, 'Unexpected mocked request: ' + this.url);
      const next = state.responses.shift();
      const reply = typeof next === 'function' ? await next(this) : next;
      if (reply instanceof Error) throw reply;
      this.response = { statusCode: reply.status === undefined ? 200 : reply.status, headers: reply.headers || {} };
      return reply.body === undefined ? {} : reply.body;
    }
    async loadString() { const body = await this.responseBody(); return typeof body === 'string' ? body : JSON.stringify(body); }
    async loadJSON() { const body = await this.responseBody(); return typeof body === 'string' ? JSON.parse(body) : body; }
    async load() { return this.responseBody(); }
  }
  class Notification { async schedule() { state.notifications.push({ title: this.title, body: this.body, openURL: this.openURL }); } }
  const config = { runsInApp: true, runsInWidget: false, widgetFamily: 'medium' };
  const args = { queryParameters: {}, widgetParameter: '' };
  const sandbox = { Date: FixedDate, Color, Size, Point, Rect, ListWidget, DrawContext, Path, Request, Notification, Alert,
    Font: new Proxy({}, { get: (_, name) => (...values) => ({ font: String(name), values }) }),
    SFSymbol: { named: name => ({ image: { symbol: name }, applyFont() {} }) },
    FileManager: { local: () => fm },
    Keychain: { contains: k => state.secrets.has(k), get: k => state.secrets.get(k), set: (k, v) => state.secrets.set(k, v), remove: k => state.secrets.delete(k) },
    UUID: { string: () => '00000000-0000-4000-8000-' + String(++state.uuid).padStart(12, '0') },
    Timer: { schedule: (ms, repeats, callback) => { assert.equal(repeats, false); state.clock += ms; callback(); return { invalidate() {} }; } },
    Script: { name: () => 'FordWidget Test', setWidget: w => state.widgets.push(w), complete() {} },
    Location: { reverseGeocode: async (...p) => { state.geocodes.push(p); return []; } },
    Photos: { fromLibrary: async () => ({ kind: 'synthetic-photo', size: { width: 640, height: 320 } }) },
    Data: { fromBase64String: text => ({ base64: text }) }, Image: { fromData: () => ({ kind: 'synthetic-image', size: { width: 640, height: 320 } }) },
    Safari: { openInApp: async (...values) => { state.safari.push({ method: 'openInApp', values }); }, open: async (...values) => { state.safari.push({ method: 'open', values }); } },
    Clipboard: { copyString: () => {}, pasteString: () => '' },
    Pasteboard: { copyString: value => state.clipboard.push(value) }, QuickLook: { present: async value => state.previews.push(value) },
    console: { log: (...values) => state.logs.push(values.join(' ')), warn: () => {}, error: () => {} }, config, args,
  };
  const names = ['SETTINGS', 'COMMANDS', 'FIELD_NAMES', 'METRICS', 'METRIC_ALIASES', 'ACCESSORY_VIEWS',
    'LocalStore', 'FordAuthManager', 'FordAPIClient', 'WidgetRenderer', 'AppController', 'selfTest', 'widgetOptions',
    'normalize', 'mergeFields', 'nightSettings', 'nightProblems', 'findVehicleImageUrl', 'findImageRef', 'isFordHost',
    'downscale', 'challenge', 'secretKey', 'secretGet', 'secretSet', 'fordFuelPercent', 'ppoNormalize', 'ppoView', 'ppoEstimated', 'statusDiagnosticReport', 'statusFuelDiagnostic', 'widgetDiagnosticContext', 'PPO_DASHBOARD_ORIGINAL_BUILD'];
  const boundary = baseline ? source.indexOf('\ntry { await new AppController().run(); }') : source.indexOf(entryMarker);
  assert.ok(boundary > 0);
  const expose = '\nglobalThis.TestAPI = {' + names.map(n => n + ': typeof ' + n + " === 'undefined' ? undefined : " + n).join(',') + '};';
  const context = vm.createContext(sandbox);
  new vm.Script(source.slice(0, boundary) + expose, { filename: baseline ? 'FordWidget.upstream.js' : 'FordWidget Pro Power.js' }).runInContext(context);
  return { api: context.TestAPI, state, config, args, context, fm };
}

function prefs(extra = {}) { return Object.assign({ vin: VIN, name: 'Synthetic F-150', imageMode: 'off', night: { enabled: false }, home: { lat: 42.31, lon: -83.21 } }, extra); }
function cache(extra = {}) {
  const fields = {};
  for (const [key, value] of Object.entries({ fuel: 63, range: 304, battery: 84, batteryHealth: 'Good', oil: 72,
    odometer: 32123, fl: 35, fr: 36, rl: 35, rr: 36, lock: 'Locked', doors: 'Closed', outsideTemp: 20,
    position: { lat: 42.31, lon: -83.21 }, ignition: 'OFF' })) fields[key] = { value, at: TIME - 30000, source: 'FordPass' };
  return Object.assign({ version: 1, vin: VIN, fields, fetchedAt: TIME - 30000 }, extra);
}
function ppoSnapshot(rawSignals, extra = {}) { return Object.assign({ version: 1, vin: VIN, rawSignals, rejectedSignals: [],
  commandAt: TIME - 300000, commandState: 'COMMAND_SUCCEEDED_ON_DEVICE', latestMode: { value: 'HIGH', at: TIME - 301000 }, fetchedAt: TIME }, extra); }
function commandFrame(rawSignals, id = 'synthetic-status-receipt', time = TIME - 30000) {
  return { vin: VIN, states: { commands: { updatePTTBStatusCommand: { commandId: id, timestamp: time,
    value: { toState: 'COMMAND_SUCCEEDED_ON_DEVICE', oemData: { pttbStatusDataV2: { stringValue: JSON.stringify(rawSignals) } } } } } } };
}
function generalFrame(id = 'synthetic-general-receipt', state = 'SUCCESS') {
  return { vin: VIN, metrics: { fuelLevel: { value: 63, updateTime: new Date(TIME).toISOString() } },
    states: { statusRefreshCommand: { commandId: id, value: { toState: state } } } };
}
function statusFixture() {
  const old = TIME - 3600000, quiet = TIME - 10800000, fresh = TIME - 60000;
  const iso = value => new Date(value).toISOString();
  const before = cache();
  before.fields.lock = { value: 'Unlocked', at: old, source: 'FordPass' };
  before.fields.doors = { value: 'Ajar', at: old, source: 'FordPass' };
  const raw = { vin: VIN, updateTime: iso(TIME), metrics: {
    fuelLevel: { value: 63, updateTime: iso(fresh) },
    doorLockStatus: [{ vehicleDoor: 'FRONT_LEFT', value: 'LOCKED', updateTime: iso(fresh) }, { vehicleDoor: 'FRONT_RIGHT', value: 'LOCKED', updateTime: iso(quiet) }],
    doorStatus: [{ vehicleDoor: 'FRONT_LEFT', value: 'CLOSED', updateTime: iso(fresh) }, { vehicleDoor: 'FRONT_RIGHT', value: 'CLOSED', updateTime: iso(fresh) }],
    hoodStatus: { vehicleDoor: 'HOOD', value: 'CLOSED', updateTime: iso(quiet) }
  } };
  return { raw, before, old, quiet, fresh, iso };
}
function texts(tree) { const result = []; const walk = node => { if (!node || typeof node !== 'object') return; if (node.kind === 'text') result.push(node.value); for (const child of node.children || []) walk(child); }; walk(tree); return result; }
function nodes(tree) { const result = []; const walk = node => { if (!node || typeof node !== 'object') return; result.push(node); for (const child of node.children || []) walk(child); }; walk(tree); return result; }
function counts(values) { const result = {}; for (const value of values) result[value] = (result[value] || 0) + 1; return result; }
function actionOf(node) { const match = String(node.url || '').match(/[?&]action=([^&]*)/); return match ? decodeURIComponent(match[1]) : ''; }
function isOriginalRefreshButton(node) { return node.kind === 'stack' && node.size && texts(node).length === 1 && texts(node)[0] === 'Refresh'; }
function normalizeRefreshButtonRoute(tree) {
  const result = plain(tree);
  for (const node of nodes(result)) if (isOriginalRefreshButton(node) && actionOf(node) === 'refreshwidget') node.url = node.url.replace(/([?&]action=)refreshwidget(?=&|$)/, '$1refresh');
  return result;
}
function legacyControlCounts(tree) {
  return counts(nodes(tree).map(node => isOriginalRefreshButton(node) && actionOf(node) === 'refreshwidget' ? 'refresh' : actionOf(node))
    .filter(action => ['lock', 'unlock', 'start', 'stop', 'refresh'].includes(action)));
}
function assertContainsBaseline(actual, baseline, label, { dashboard = false } = {}) {
  const actualText = texts(actual), actualCounts = counts(actualText);
  for (const [value, count] of Object.entries(counts(texts(baseline)))) {
    if (dashboard && ['Running', 'Tap to stop'].includes(value)) continue; // The approved compact header keeps the identical timer/stop link instead.
    if (dashboard && value.startsWith('Last updated:')) {
      assert.ok(actualText.some(text => /^Oldest vehicle reading: (?:unknown|.*ago)/.test(text)), label + ' lost its explicitly relabeled oldest-reading age');
      const suffix = value.split(' · ').slice(1).join(' · ');
      if (suffix && suffix !== 'Cached · source unavailable') assert.ok(actualText.some(text => text.includes(suffix)), label + ' lost its original notice');
      continue;
    }
    assert.ok((actualCounts[value] || 0) >= count, label + ' lost original text: ' + value);
  }
  const actualImages = counts(nodes(actual).filter(node => node.kind === 'image').map(node => JSON.stringify(node.value)));
  for (const [value, count] of Object.entries(counts(nodes(baseline).filter(node => node.kind === 'image').map(node => JSON.stringify(node.value))))) assert.ok((actualImages[value] || 0) >= count, label + ' lost original image');
  for (const value of nodes(baseline).filter(node => node.kind === 'date').map(node => JSON.stringify(plain(node)))) assert.ok(nodes(actual).some(node => node.kind === 'date' && JSON.stringify(plain(node)) === value), label + ' lost the original countdown timer');
  assert.equal(actual.url, baseline.url, label + ' replaced the original widget tap action');
  assert.deepEqual(legacyControlCounts(actual), legacyControlCounts(baseline), label + ' must preserve each original vehicle control exactly once');
}
function seedCustomPhoto(h) { const store = new h.api.LocalStore(); h.state.files.set(store.imagePath(VIN, true), { kind: 'synthetic-photo', size: { width: 640, height: 320 } }); }
async function prepared(h, vehicle = prefs(), snapshot = cache()) {
  h.api.secretSet('vehicle', vehicle);
  h.api.secretSet('token.mobile', { access: 'synthetic-cat', refresh: null, expires: TIME + 3600000 });
  h.api.secretSet('token.autonomic', { access: 'synthetic-autonomic', refresh: null, expires: TIME + 3600000 });
  const app = new h.api.AppController(); await app.store.acquire(); app.store.write(snapshot); return app;
}

test('pinned original source remains the exact reviewed upstream byte copy', () => {
  assert.equal(crypto.createHash('sha256').update(baselineSource).digest('hex'), '2b3502240739b036746c3ad42a247c40e7c0de2ef1612789f60c8125dcfde2a6');
});

test('original and current built-in offline self-tests both pass without network', () => {
  for (const h of [scriptable(baselineSource, true), scriptable(widgetSource)]) { h.api.selfTest(); assert.equal(h.state.requests.length, 0); }
});

test('original field names, commands and v1 endpoints remain unchanged; add-on storage is isolated', () => {
  const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
  assert.deepEqual(plain(p.api.COMMANDS), plain(b.api.COMMANDS));
  assert.deepEqual(plain(p.api.FIELD_NAMES), plain(b.api.FIELD_NAMES));
  assert.deepEqual(plain(p.api.SETTINGS), plain(b.api.SETTINGS));
  assert.equal(p.api.SETTINGS.autonomic, 'https://api.autonomic.ai/v1');
  assert.notEqual(p.api.secretKey('token.mobile'), b.api.secretKey('token.mobile'));
  assert.notEqual(new p.api.LocalStore().dir, new b.api.LocalStore().dir);
  for (const key of Object.keys(b.api.METRICS)) assert.equal(p.api.METRICS[key], b.api.METRICS[key]);
  for (const key of ['ppoa', 'ppob', 'ppototal', 'ppocapacity']) assert.equal(p.api.widgetOptions(prefs(), '').show[key], false);
});

test('the renamed app reuses existing preferences, sign-in tokens, photo and telemetry cache from the exact legacy storage locations', async () => {
  const h = scriptable(widgetSource), prefix = 'FordWidget.ProPowerPreview.v1.';
  const directory = '/mock/documents/FordWidget Pro Power Preview';
  const vehicle = prefs({ imageMode: 'custom', widget: { show: { fuel: true, ppob: true } } });
  const tokens = { mobile: { access: 'synthetic-existing-mobile', refresh: 'synthetic-existing-mobile-refresh', expires: TIME + 3600000 },
    autonomic: { access: 'synthetic-existing-autonomic', refresh: null, expires: TIME + 3600000 } };
  const saved = cache({ nextFetch: TIME + 900000, proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
  h.state.secrets.set(prefix + 'vehicle', JSON.stringify(vehicle));
  for (const [name, token] of Object.entries(tokens)) h.state.secrets.set(prefix + 'token.' + name, JSON.stringify(token));
  h.state.files.set(directory, { directory: true });
  h.state.files.set(directory + '/ford_vehicle_cache.json', JSON.stringify(saved));
  const photo = { kind: 'synthetic-existing-photo', size: { width: 640, height: 320 } };
  h.state.files.set(directory + '/vehicle_' + VIN + '_custom.png', photo);
  const secrets = Array.from(h.state.secrets), cacheText = h.state.files.get(directory + '/ford_vehicle_cache.json');
  const app = new h.api.AppController();
  assert.equal(h.api.secretKey('vehicle'), prefix + 'vehicle'); assert.equal(app.store.dir, directory);
  const restored = h.api.secretGet('vehicle'); assert.deepEqual(plain(restored), vehicle);
  assert.equal(h.api.widgetOptions(restored, '').show.ppob, true); assert.equal(h.api.widgetOptions(restored, '').show.fuel, true);
  assert.deepEqual(plain(app.store.read()), saved); assert.deepEqual(plain(app.store.vehicleImage(restored)), photo);
  await app.store.acquire();
  for (const [name, token] of Object.entries(tokens)) assert.equal(await app.auth.token(name), token.access, 'Existing sign-in must not require reauthentication after a display-name change');
  const client = new h.api.FordAPIClient(app.auth, app.store, restored);
  const result = await client.getVehicleStatus(); assert.equal(result.cache.proPower.rawSignals.DcacOut2Pw2Dsply, 0);
  const b = scriptable(baselineSource, true);
  assert.deepEqual(plain(h.api.COMMANDS), plain(b.api.COMMANDS));
  assert.equal(h.state.requests.length, 0); assert.equal(h.state.safari.length, 0); assert.equal(h.state.alerts.length, 0);
  assert.deepEqual(Array.from(h.state.secrets), secrets); assert.equal(h.state.files.get(app.store.path), cacheText);
  assert.match(widgetSource.slice(0, 150), /FordWidget Pro Power 0\.1\.7/);
  assert.doesNotMatch(widgetSource.slice(0, 150), /FordWidget Pro Power Preview/);
  app.store.release();
});

test('original source changes remain limited to the approved refresh, observation and fuel edits', () => {
  const b = scriptable(baselineSource, true).api, p = scriptable(widgetSource).api;
  const excluded = { WidgetRenderer: new Set(['build', 'buttons']), FordAuthManager: new Set(['backoff']), FordAPIClient: new Set(['getVehicleStatus']), AppController: new Set(['action', 'run']) };
  for (const name of ['LocalStore', 'FordAuthManager', 'FordAPIClient', 'WidgetRenderer', 'AppController']) {
    for (const method of Object.getOwnPropertyNames(b[name].prototype)) {
      if (method === 'constructor' || excluded[name]?.has(method)) continue;
      assert.equal(p[name].prototype[method].toString(), b[name].prototype[method].toString(), name + '.' + method);
    }
  }
  for (const name of ['mergeFields', 'nightSettings', 'nightProblems', 'findVehicleImageUrl', 'findImageRef', 'isFordHost', 'downscale', 'challenge']) assert.equal(p[name].toString(), b[name].toString(), name);
  assert.equal(p.normalize.toString(), b.normalize.toString().replace(
    'const e = m[key]; put(field, bounded(e && e.value, max), e);',
    "const e = m[key]; put(field, field === 'fuel' ? fordFuelPercent(e && e.value) : bounded(e && e.value, max), e);\n    if (field === 'fuel' && out.fuel) out.fuel.rawValue = finite(e && e.value);"),
  'Only the fuel-specific clamp and numeric raw-value retention may change; oil/battery bounds and all other normalization stay original');
  assert.equal(p.WidgetRenderer.prototype.buttons.toString(), b.WidgetRenderer.prototype.buttons.toString()
    .replace("['refresh', 'Refresh', 'arrow.clockwise']", "['refreshwidget', 'Refresh', 'arrow.clockwise']"), 'Only the Refresh button action may change');
  assert.equal(p.FordAPIClient.prototype.getVehicleStatus.toString(), b.FordAPIClient.prototype.getVehicleStatus.toString()
    .replace('async getVehicleStatus()', 'async getVehicleStatus(force = false)').replace('if (c.nextFetch > now())', 'if (!force && c.nextFetch > now())'),
  'Only an explicit local-cooldown bypass may change ordinary telemetry reading');
  assert.equal(p.FordAuthManager.prototype.backoff.toString(), b.FordAuthManager.prototype.backoff.toString().replace(
    "secretSet('gate.' + name, { failures, next: now() + delay });",
    "secretSet('gate.' + name, { failures, next: now() + delay,\n      httpStatus: typeof status === 'number' && Number.isInteger(status) && (status === 0 || status >= 100 && status <= 599) ? status : null, failedAt: now() });"),
  'Only future backoff observation metadata may change; all delay, Retry-After and token rules remain original');
});

for (const family of families) {
  test('PPO-disabled ' + family + ' render matches the complete original tree', () => {
    for (const variant of ['parked', 'running', 'missing']) {
      const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
      const c = variant === 'missing' ? { version: 1, vin: VIN, fields: {} } : cache();
      c.proPower = ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 });
      if (variant === 'running') c.fields.remoteStart = { value: { until: TIME + 120000 }, at: TIME - 1000, source: 'FordPass' };
      const bTree = new b.api.WidgetRenderer(prefs(), plain(c)).build(family);
      const pTree = new p.api.WidgetRenderer(prefs(), plain(c)).build(family);
      assert.deepEqual(normalizeRefreshButtonRoute(pTree), plain(bTree), variant);
      assert.equal(p.state.requests.length, 0); assert.equal(b.state.requests.length, 0);
    }
  });
}

test('PPO-disabled custom-photo controls and alternate accessory views retain original rendering', () => {
  for (const [family, parameter] of [['medium', 'controls'], ['large', 'status'], ['accessoryCircular', 'lock'], ['accessoryCircular', 'tires'], ['accessoryRectangular', 'parked'], ['accessoryRectangular', 'tires']]) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource), vehicle = prefs({ imageMode: 'custom' });
    for (const h of [b, p]) { const store = new h.api.LocalStore(); h.state.files.set(store.imagePath(VIN, true), { kind: 'synthetic-photo', size: { width: 640, height: 320 } }); }
    assert.deepEqual(normalizeRefreshButtonRoute(new p.api.WidgetRenderer(vehicle, cache(), parameter).build(family)), plain(new b.api.WidgetRenderer(vehicle, cache(), parameter).build(family)), family + '/' + parameter);
  }
});

// Customize changes global saved defaults. A blank Parameter must keep those
// original selections and add PPO. A positive Parameter such as "ppob" retains
// upstream's separate "show only these named fields" behavior.
for (const family of ['small', 'medium', 'large']) {
  test('global mixed Customize selection with blank Parameter adds PPO to the original ' + family, () => {
    for (const selected of [['ppoa'], ['ppoa', 'ppob', 'ppototal', 'ppocapacity']]) for (const running of [false, true]) {
      const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
      const originalShow = Object.fromEntries(Object.keys(b.api.METRICS).map(key => [key, true]));
      const mixedShow = Object.assign({}, originalShow, Object.fromEntries(selected.map(key => [key, true])));
      const basePrefs = prefs({ imageMode: 'custom', widget: { show: originalShow } });
      const mixedPrefs = prefs({ imageMode: 'custom', widget: { show: mixedShow } });
      const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0,
        DcacOutPwDsplyMx: 7200, DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 }) });
      if (running) c.fields.remoteStart = { value: { until: TIME + 120000 }, at: TIME - 1000, source: 'FordPass' };
      seedCustomPhoto(b); seedCustomPhoto(p);
      const original = new b.api.WidgetRenderer(basePrefs, plain(c), '').build(family);
      const renderer = new p.api.WidgetRenderer(mixedPrefs, plain(c), '');
      const before = Object.fromEntries(['text', 'buttons', 'truck', 'symbol', 'frame', 'pill', 'tires', '_ppoBeforeFooter'].map(key => [key, { fn: renderer[key], own: Object.hasOwn(renderer, key) }]));
      const actual = renderer.build(family);
      assertContainsBaseline(actual, original, family + '/' + selected.join(',') + '/running=' + running, { dashboard: family === 'large' });
      const summaries = nodes(actual).filter(node => actionOf(node) === 'propower');
      assert.equal(summaries.length, 1, 'Mixed PPO should have a separate, single details link');
      const summary = texts(summaries[0]);
      if (family !== 'large') {
        const summaryBudget = family === 'small' ? (selected.length <= 2 ? 3 : 4) : selected.length <= 2 ? 2 : 3;
        assert.ok(summary.length <= summaryBudget, 'The additive summary must stay compact');
      } else {
        const cards = nodes(summaries[0]).filter(node => node.kind === 'stack' && node.children.some(child => child.kind === 'text' && child.font?.values?.[0] === 16));
        assert.equal(cards.length, selected.length, 'The dashboard must render exactly the selected PPO fields');
      }
      assert.match(summary.join(' '), /PPO|Pro Power/i); assert.match(summary.join(' '), /last/i);
      assert.match(summary.join(' '), family === 'large' ? /Status result:\s*5m ago/ : /cmd\s*5m/i);
      assert.match(summary.join(' '), /~1\.50?\s*kW/);
      const expectedValues = { ppoa: /\bA\s+~1\.50?\s*kW/, ppob: /\bB\s+~0\s*W/,
        ppototal: /\bTotal\s+~1\.50?\s*kW/, ppocapacity: family === 'large' ? /\bCapacity\s+~7\.20?\s*kW/ : /\bCap\s+~7\.20?\s*kW/ };
      for (const key of selected) assert.match(summary.join(' '), expectedValues[key], 'The compact summary must retain selected field ' + key);
      for (const [key, value] of Object.entries(before)) { assert.equal(renderer[key], value.fn, 'Temporary ' + key + ' hook leaked'); assert.equal(Object.hasOwn(renderer, key), value.own); }
      for (const key of selected) renderer.opts.show[key] = false;
      assert.deepEqual(normalizeRefreshButtonRoute(renderer.build(family)), plain(original), 'A later PPO-disabled widget must return to the unchanged original rendering');
      assert.equal(p.state.requests.length, 0);
    }
  });
}

test('mixed medium controls and large controls keep the original vehicle grid once', () => {
  for (const family of ['medium', 'large']) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
    const basePrefs = prefs({ imageMode: 'custom', widget: { medium: 'controls' } });
    const mixedPrefs = prefs({ imageMode: 'custom', widget: { medium: 'controls', show: { ppoa: true, ppob: true, ppototal: true, ppocapacity: true } } });
    const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    seedCustomPhoto(b); seedCustomPhoto(p);
    const original = new b.api.WidgetRenderer(basePrefs, c, '').build(family);
    const actual = new p.api.WidgetRenderer(mixedPrefs, c, '').build(family);
    assertContainsBaseline(actual, original, family + '/controls', { dashboard: family === 'large' });
    assert.deepEqual(legacyControlCounts(actual), { lock: 1, unlock: 1, start: 1, refresh: 1 });
    assert.equal(p.state.requests.length, 0);
  }
});

test('approved mixed large dashboard retains all vehicle data and puts selected two-column PPO cards before the bottom controls', () => {
  for (const family of ['large', 'extraLarge']) for (const running of [false, true]) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
    const vehicle = prefs({ imageMode: 'custom', widget: { show: { ppoa: true, ppob: true, ppototal: true, ppocapacity: true } } });
    const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0,
      DcacOutPwDsplyMx: 7200, DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 }) });
    if (running) c.fields.remoteStart = { value: { until: TIME + 120000 }, at: TIME - 1000, source: 'FordPass' };
    seedCustomPhoto(b); seedCustomPhoto(p);
    const original = new b.api.WidgetRenderer(prefs({ imageMode: 'custom' }), plain(c), '').build(family);
    const actual = new p.api.WidgetRenderer(vehicle, plain(c), '').build(family);
    assertContainsBaseline(actual, original, family + '/dashboard/running=' + running, { dashboard: true });
    const controlIndex = actual.children.findIndex(node => {
      const controls = legacyControlCounts(node);
      return controls.lock === 1 && controls.unlock === 1 && controls.refresh === 1 && (controls.start || controls.stop) === 1;
    });
    const summaryIndex = actual.children.findIndex(node => actionOf(node) === 'propower');
    const flexIndex = actual.children.findIndex(node => node.kind === 'spacer' && node.size === null);
    const footerIndex = actual.children.findIndex(node => node.kind === 'text' && node.value.startsWith('Oldest vehicle reading:'));
    assert.ok(summaryIndex >= 0 && flexIndex > summaryIndex && controlIndex > flexIndex && footerIndex > controlIndex,
      'PPO belongs above the bottom vehicle controls in the approved dashboard');
    assert.ok(actual.children.slice(controlIndex + 1, footerIndex).every(node => node.kind === 'spacer' && node.size !== null && node.size <= 6),
      'No additional content or flexible gap may follow the bottom controls');
    const panel = actual.children[summaryIndex];
    const cards = nodes(panel).filter(node => node.kind === 'stack' && node.children.filter(child => child.kind === 'text').length === 2 &&
      node.children.some(child => child.kind === 'text' && child.font?.values?.[0] === 16));
    assert.equal(cards.length, 4);
    const cardRows = panel.children.filter(node => node.kind === 'stack' && node.children.some(child => cards.includes(child)));
    assert.equal(cardRows.length, 2); for (const row of cardRows) assert.equal(row.children.filter(child => cards.includes(child)).length, 2);
    for (const card of cards) {
      const label = card.children.find(node => node.kind === 'text' && node.font?.values?.[0] === 9);
      const value = card.children.find(node => node.kind === 'text' && node.font?.values?.[0] === 16);
      assert.ok(label); assert.match(value.value, /^~/);
    }
    assert.match(texts(panel).join(' '), /Status result: 5m ago/); assert.doesNotMatch(texts(panel).join(' '), /\bcmd\b/i);
    assert.ok(nodes(panel).some(node => node.kind === 'text' && node.value === 'Sample time unknown'));
    assert.equal(p.state.requests.length, 0);
  }
});

test('large dashboard dates lock and door readings separately and never draws a full-looking unknown-fuel gauge', () => {
  const h = scriptable(widgetSource), c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
  c.fields.lock = { value: 'Unlocked', at: TIME - 3600000, source: 'FordPass' };
  c.fields.doors = { value: 'Ajar', at: TIME - 7200000, source: 'FordPass' };
  const vehicle = prefs({ widget: { show: { ppoa: true } } });
  const tree = new h.api.WidgetRenderer(vehicle, c, '').build('large');
  const lockCell = nodes(tree).find(node => node.kind === 'stack' && texts(node).includes('Unlocked') && node.children.some(child => child.kind === 'text' && child.value.startsWith('Reported:')));
  const doorCell = nodes(tree).find(node => node.kind === 'stack' && texts(node).includes('Doors Ajar') && node.children.some(child => child.kind === 'text' && child.value.startsWith('Reported:')));
  assert.ok(lockCell); assert.ok(doorCell);
  assert.ok(texts(lockCell).includes('Reported: 1h 0m ago')); assert.ok(texts(doorCell).includes('Reported: 2h 0m ago'));
  assert.match(texts(tree).join(' '), /Oldest vehicle reading: 2h 0m ago/);
  const unknown = plain(c); unknown.fields.fuel.value = null;
  const unknownTree = new h.api.WidgetRenderer(vehicle, unknown, 'fuel ppoa status').build('large');
  assert.match(texts(unknownTree).join(' '), /Fuel unavailable/);
  assert.equal(nodes(unknownTree).filter(node => node.kind === 'image' && node.value?.kind === 'drawing').length, 0, 'Unknown fuel must not draw even a misleading background gauge');
  assert.deepEqual(legacyControlCounts(unknownTree), {}, 'Explicit status layout must hide vehicle controls');
  unknown.fields.fuel.value = 0;
  const zeroTree = new h.api.WidgetRenderer(vehicle, unknown, 'fuel ppoa status').build('large');
  assert.match(texts(zeroTree).join(' '), /Fuel 0%/); assert.doesNotMatch(texts(zeroTree).join(' '), /Fuel unavailable/);
  unknown.fields.fuel.value = 101.2;
  const above100Tree = new h.api.WidgetRenderer(vehicle, unknown, 'fuel ppoa status').build('large');
  const original = scriptable(baselineSource, true);
  const originalTree = new original.api.WidgetRenderer(vehicle, unknown, 'fuel status').build('large');
  assert.ok(texts(originalTree).some(text => text.includes('Fuel 101%')), 'The original renderer accepts a finite cached percentage above 100');
  assert.ok(texts(above100Tree).some(text => text.includes('Fuel 101%')), 'The dashboard must preserve the original cached-fuel display');
  assert.doesNotMatch(texts(above100Tree).join(' '), /Fuel unavailable/);
  const candidate = h.api.normalize({ vin: VIN, metrics: { fuelLevel: { value: 101.2 }, fuelRange: { value: 160.9344 } } }, VIN, 'FordPass', TIME);
  assert.equal(candidate.fuel.value, 100, 'A newly normalized above-100 reading is clamped without rewriting an existing cached renderer value');
  assert.equal(h.state.requests.length, 0);
});

test('the new dashboard delegates small, medium, pure PPO, accessory and PPO-disabled views unchanged', () => {
  const h = scriptable(widgetSource), mixed = prefs({ widget: { show: { ppoa: true, ppob: true } } });
  const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
  const cases = [['small', mixed, ''], ['medium', mixed, ''], ['large', prefs(), ''], ['extraLarge', prefs(), ''],
    ['large', mixed, 'ppoa'], ['extraLarge', mixed, 'ppob'], ...families.filter(family => family.startsWith('accessory')).flatMap(family => [[family, mixed, ''], [family, mixed, 'ppoa']])];
  for (const [family, vehicle, parameter] of cases) {
    const actual = new h.api.WidgetRenderer(vehicle, c, parameter).build(family);
    const expected = h.api.PPO_DASHBOARD_ORIGINAL_BUILD.call(new h.api.WidgetRenderer(vehicle, c, parameter), family);
    assert.deepEqual(plain(actual), plain(expected), family + '/' + parameter);
  }
  assert.equal(h.state.requests.length, 0);
});

test('positive PPO-only parameters remain distinct from global mixed Customize defaults', () => {
  const h = scriptable(widgetSource), vehicle = prefs({ widget: { show: { ppob: true } } });
  const saved = h.api.widgetOptions(vehicle, '');
  assert.equal(saved.show.fuel, true); assert.equal(saved.show.photo, true); assert.equal(saved.show.ppob, true);
  const onlyB = h.api.widgetOptions(vehicle, 'ppob');
  assert.equal(onlyB.show.ppob, true);
  for (const key of Object.keys(h.api.FIELD_NAMES).filter(key => Object.hasOwn(h.api.METRICS, key))) assert.equal(onlyB.show[key], false);
  for (const key of ['photo', 'fuel', 'battery', 'tires', 'oil', 'lock', 'odometer', 'doors', 'temp', 'parked']) assert.equal(onlyB.show[key], false);
  const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
  for (const family of ['small', 'medium', 'large']) {
    const pure = new h.api.WidgetRenderer(vehicle, c, 'ppob').build(family);
    assert.match(texts(pure).join(' '), /PPO|Pro Power/i);
    assert.doesNotMatch(texts(pure).join(' '), /Fuel 63|TIRES|12V 84|Odometer 32123/);
    assert.equal(actionOf(pure), 'propower');
    const mixed = new h.api.WidgetRenderer(vehicle, c, 'fuel ppob').build(family);
    assert.match(texts(mixed).join(' '), /Fuel 63/); assert.match(texts(mixed).join(' '), /PPO|Pro Power/i);
    assert.equal(actionOf(mixed), '');
  }
});

test('global mixed PPO preferences do not change existing accessory views or first-view semantics', () => {
  for (const family of families.filter(value => value.startsWith('accessory'))) for (const parameter of ['', 'fuel ppob', 'lock ppob', 'tires ppob', 'parked ppob']) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
    const vehicle = prefs({ widget: { show: { ppoa: true, ppob: true, ppototal: true, ppocapacity: true } } });
    const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    assert.deepEqual(normalizeRefreshButtonRoute(new p.api.WidgetRenderer(vehicle, c, parameter).build(family)), plain(new b.api.WidgetRenderer(vehicle, c, parameter).build(family)), family + '/' + parameter);
  }
});

test('mixed-render helper overrides are restored even when the original render throws', () => {
  for (const family of ['medium', 'large']) {
    const h = scriptable(widgetSource), renderer = new h.api.WidgetRenderer(prefs({ widget: { show: { ppoa: true } } }), cache(), '');
    renderer.truck = () => { throw new Error('Synthetic native rendering failure'); };
    const before = Object.fromEntries(['text', 'buttons', 'truck', 'symbol', 'frame', 'pill', 'tires', '_ppoBeforeFooter'].map(key => [key, { fn: renderer[key], own: Object.hasOwn(renderer, key) }]));
    assert.throws(() => renderer.build(family), /Synthetic native rendering failure/);
    for (const [key, value] of Object.entries(before)) { assert.equal(renderer[key], value.fn, 'Temporary ' + key + ' hook survived the ' + family + ' error'); assert.equal(Object.hasOwn(renderer, key), value.own); }
  }
});

test('mixed PPO summary is inserted before an arbitrary original footer notice without replacing it', () => {
  for (const family of ['small', 'medium', 'large']) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
    const note = 'Synthetic source unavailable notice';
    const vehicle = prefs({ widget: { show: { ppoa: true } } });
    const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    const original = new b.api.WidgetRenderer(prefs(), c, '').build(family, note);
    const actual = new p.api.WidgetRenderer(vehicle, c, '').build(family, note);
    assertContainsBaseline(actual, original, family + '/notice', { dashboard: family === 'large' });
    const summaryIndex = actual.children.findIndex(node => actionOf(node) === 'propower');
    const footerIndex = actual.children.findIndex(node => node.kind === 'text' && node.value.includes(note));
    assert.ok(summaryIndex >= 0 && footerIndex > summaryIndex, 'The summary should precede the unchanged source notice');
    assert.equal(p.state.requests.length, 0);
  }
});

test('legacy vehicle commands still delegate through the augmented foreground action', async () => {
  for (const action of ['lock', 'unlock', 'start', 'stop', 'refresh']) {
    const h = scriptable(widgetSource), app = await prepared(h), sent = [];
    h.api.FordAPIClient.prototype.sendCommand = async (vin, command) => { sent.push({ vin, command }); return 'Synthetic confirmation'; };
    h.state.choices.push(0);
    await app.action(action, prefs());
    assert.deepEqual(sent, [{ vin: VIN, command: action }]);
    assert.equal(h.state.notifications.length, 1);
    assert.equal(h.state.notifications[0].title, 'FordWidget');
    assert.equal(h.state.requests.length, 0);
    app.store.release();
  }
});

test('legacy lock command retains its original v1 wire format', async () => {
  const h = scriptable(widgetSource), app = await prepared(h);
  h.state.responses.push({ body: { id: 'synthetic-lock-receipt', status: 'accepted' } });
  const api = new h.api.FordAPIClient(app.auth, app.store, prefs());
  await api.postCommand(VIN, 'lock', 'synthetic-autonomic');
  assert.equal(h.state.requests.length, 1);
  const request = h.state.requests[0];
  assert.equal(request.url, 'https://api.autonomic.ai/v1/command/vehicles/' + VIN + '/commands');
  assert.deepEqual(JSON.parse(request.body), { properties: {}, tags: {}, type: 'lock', wakeUp: true });
  app.store.release();
});

test('canceling the Pro Power status confirmation sends no request', async () => {
  const h = scriptable(widgetSource), app = await prepared(h);
  h.state.choices.push(-1);
  await app.action('ppostatus', prefs());
  assert.equal(h.state.requests.length, 0);
  assert.ok(h.state.alerts.some(a => /Pro Power/i.test(a.title || '') && a.cancel), 'The new action must display explicit confirmation');
  app.store.release();
});

test('a Pro Power status deep link still requires the foreground confirmation', async () => {
  const h = scriptable(widgetSource), app = await prepared(h); app.store.release();
  h.args.queryParameters.action = 'ppostatus'; h.state.choices.push(-1);
  await app.run();
  assert.equal(h.state.requests.length, 0);
  assert.ok(h.state.alerts.some(a => /Pro Power/i.test(a.title || '') && a.cancel));
});

test('PPO widget rendering with evening checks off sends no commands or network requests', async () => {
  for (const family of families) for (const action of ['ppostatus', 'refreshwidget']) {
    const h = scriptable(widgetSource), vehicle = prefs({ widget: { show: { ppoa: true } } });
    const c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    const app = await prepared(h, vehicle, c); app.store.release();
    h.config.runsInApp = false; h.config.runsInWidget = true; h.config.widgetFamily = family;
    h.args.widgetParameter = 'ppoa'; h.args.queryParameters.action = action;
    await app.run();
    assert.equal(h.state.requests.length, 0, family); assert.equal(h.state.alerts.length, 0, family); assert.equal(h.state.widgets.length, 1, family);
    assert.match(texts(h.state.widgets[0]).join(' '), /PPO|Pro Power/i, family);
  }
});

test('a failed original telemetry read still permits the independent foreground PPO cache read', async () => {
  const h = scriptable(widgetSource), app = await prepared(h);
  h.state.responses.push({ status: 503, body: {} }, { body: commandFrame({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
  await app.action('fetch', prefs());
  assert.equal(h.state.requests.length, 2);
  assert.equal(h.state.requests[0].url, 'https://api.autonomic.ai/v1/telemetry/sources/fordpass/vehicles/' + VIN);
  assert.equal(h.state.requests[0].method, 'GET');
  assert.equal(h.state.requests[1].url, 'https://api.autonomic.ai/v1beta/telemetry/sources/fordpass/vehicles/' + VIN + ':query');
  assert.equal(h.state.requests[1].method, 'POST'); assert.deepEqual(JSON.parse(h.state.requests[1].body), {});
  const saved = app.store.read();
  assert.equal(saved.fields.fuel.value, 63);
  assert.equal(saved.proPower.rawSignals.DcacOut1Pw2Dsply, 1500);
  assert.ok(!JSON.stringify(saved).includes('synthetic-status-receipt'), 'Raw command IDs must not enter the file cache');
  app.store.release();
});

test('unsupported PPO endpoint backoff does not disable original vehicle controls', async () => {
  const h = scriptable(widgetSource), app = await prepared(h);
  const api = new h.api.FordAPIClient(app.auth, app.store, prefs());
  h.state.responses.push(
    { body: commandFrame({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) },
    { status: 400, body: { error: 'synthetic_unsupported_ppo' } }
  );
  const result = await api.requestProPowerStatus(true);
  assert.equal(result.outcome, 'delivery_uncertain');
  assert.equal(h.state.requests.length, 2);
  assert.equal(h.api.secretGet('gate.commands'), null);
  assert.ok(h.api.secretGet('gate.commands.proPower').next > h.state.clock);
  assert.equal(app.store.read().commandAfter, TIME + 30000);
  h.state.clock += 30001;
  h.state.responses.push({ body: { id: 'synthetic-lock-after-ppo', status: 'accepted' } });
  await api.sendCommand(VIN, 'lock');
  assert.equal(h.state.requests.length, 3);
  assert.equal(h.state.requests[2].url, 'https://api.autonomic.ai/v1/command/vehicles/' + VIN + '/commands');
  assert.equal(JSON.parse(h.state.requests[2].body).type, 'lock');
  await assert.rejects(api.requestProPowerStatus(true), /cooling down|just sent/);
  assert.equal(h.state.requests.length, 3, 'PPO backoff must stop even another baseline read');
  app.store.release();
});

test('estimates preserve zero and reject missing B, sentinel values and energy-as-power', () => {
  const h = scriptable(widgetSource), estimate = raw => h.api.ppoEstimated(ppoSnapshot(raw));
  const rated = { DcacOutPwDsplyMx: 7200, DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 };
  const zero = estimate({ ...rated, DcacOut1Pw2Dsply: 0, DcacOut2Pw2Dsply: 0 });
  assert.equal(zero.a, 0); assert.equal(zero.b, 0); assert.equal(zero.abTotal, 0); assert.equal(zero.total, 0);
  const partial = estimate({ ...rated, DcacOut1Pw2Dsply: 1500 });
  assert.equal(partial.a, 1500); assert.equal(partial.b, null); assert.equal(partial.abTotal, null); assert.equal(partial.total, null);
  for (const value of [-1, 65535, 4294967295]) {
    const invalid = estimate({ ...rated, DcacOut1Pw2Dsply: value, DcacOut2Pw2Dsply: 0 });
    assert.equal(invalid.a, null); assert.equal(invalid.abTotal, null); assert.equal(invalid.total, null);
  }
  const energy = estimate({ ...rated, DcacOutETot: 87654321 });
  assert.equal(energy.a, null); assert.equal(energy.b, null); assert.equal(energy.total, null);
});

test('secondary output is included only with known scope and complete usage', () => {
  const h = scriptable(widgetSource), estimate = raw => h.api.ppoEstimated(ppoSnapshot(raw));
  const main = { DcacOut1Pw2Dsply: 1200, DcacOut2Pw2Dsply: 300, DcacOutPwDsplyMx: 7200 };
  const split = estimate({ ...main, DcacOutScndPw2Dsply: 100, DcacOutScndPwDsplyMx: 2400 });
  assert.equal(split.abTotal, 1500); assert.equal(split.secondary, 100); assert.equal(split.total, 1600); assert.equal(split.capacity, 9600);
  assert.equal(split.secondaryScopeKnown, true); assert.equal(split.capacityScope, 'Combined capacity');
  const unknownScope = estimate({ ...main, DcacOutScndPw2Dsply: 100 });
  assert.equal(unknownScope.abTotal, 1500); assert.equal(unknownScope.secondary, null); assert.equal(unknownScope.total, null);
  assert.equal(unknownScope.capacity, 7200); assert.equal(unknownScope.capacityScope, 'A+B capacity');
  const missingSecondary = estimate({ ...main, DcacOutScndPwDsplyMx: 2400 });
  assert.equal(missingSecondary.capacity, 9600); assert.equal(missingSecondary.total, null);
});

for (const family of families) {
  test('PPO-enabled ' + family + ' exposes report age/mode age and keeps missing B unknown', () => {
    const h = scriptable(widgetSource);
    const snapshot = ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOutPwDsplyMx: 7200,
      DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 }, { latestMode: { value: 'OFF', at: TIME - 1000 } });
    const c = cache({ proPower: snapshot });
    const text = texts(new h.api.WidgetRenderer(prefs(), c, 'ppob').build(family)).join(' ');
    assert.match(text, /last/i); assert.match(text, /cmd\s*5m/i); assert.match(text, /OFF(?:1s|\s*·\s*0m ago)/i);
    assert.match(text, /—/); assert.doesNotMatch(text, /~0\s*W/);
    assert.equal(h.api.ppoView(snapshot).stale, true);
    assert.ok(h.api.ppoView(snapshot).staleReasons.includes('newer_off_mode'));
    const known = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0,
      DcacOutPwDsplyMx: 7200, DcacOutETot: 87654321, DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 }) });
    const estimateText = texts(new h.api.WidgetRenderer(prefs(), known, 'ppoa').build(family)).join(' ');
    assert.match(estimateText, /~1\.50?\s*kW/); assert.doesNotMatch(estimateText, /87654321/);
    assert.equal(h.state.requests.length, 0);
  });
}

test('raw-signal details and reviewed report copy retain energy as raw data and omit private extras', async () => {
  for (const view of ['raw', 'copy']) {
    const h = scriptable(widgetSource);
    const snapshot = ppoSnapshot({ DcacOut1Pw2Dsply: 0, DcacOutPwDsplyMx: 7200, DcacOutETot: 87654321,
      PRIVATE_EXTRA: 987654 }, { privateReceipt: 'PRIVATE_RECEIPT', latestMode: { value: 'PRIVATE_MODE', at: TIME - 1000 } });
    const app = await prepared(h, prefs(), cache({ proPower: snapshot,
      widgetRefreshLast: { attemptAt: TIME - 9000, outcome: 'completed', steps: { generalStatus: 'cooldown', telemetry: 'saved', proPowerRequest: 'accepted_unconfirmed', proPowerRead: 'failed', PRIVATE_STAGE: 'PRIVATE_STATE' }, message: 'PRIVATE_MESSAGE' } }));
    h.api.secretSet('gate.telemetry.proPower', { next: TIME + 90000, failures: 2, httpStatus: 429, failedAt: TIME - 5000, token: 'PRIVATE_GATE_TOKEN' });
    const before = h.state.files.get(app.store.path), secrets = Array.from(h.state.secrets);
    h.state.choices.push(...(view === 'raw' ? ['Pro Power raw signals', -1] : ['Copy redacted Pro Power report', 'Copy report', -1, -1]));
    await app.troubleshooting(prefs());
    const displayed = view === 'raw' ? h.state.previews[0] : h.state.clipboard[0];
    assert.equal(typeof displayed, 'string');
    assert.match(displayed, /DcacOutETot/); assert.match(displayed, /87654321/);
    assert.doesNotMatch(displayed, /PRIVATE_|987654|1FTFW1E50JFA00001/);
    if (view === 'copy') {
      const report = JSON.parse(displayed);
      assert.equal(report.estimates.a, 0); assert.equal(report.estimates.b, null); assert.equal(report.estimates.total, null);
      assert.equal(report.embeddedSampleAgeSeconds, null);
      assert.equal(report.reportVersion, 3); assert.equal(report.appVersion, '0.1.7');
      assert.equal(report.tool, 'FordWidget Pro Power'); assert.equal(Object.hasOwn(report, 'previewVersion'), false);
      assert.equal(report.refreshDiagnostics.gates['telemetry.proPower'].httpStatus, 429);
      assert.equal(report.refreshDiagnostics.gates['telemetry.proPower'].secondsRemaining, 90);
      assert.deepEqual(report.refreshDiagnostics.lastFullRefresh, { attemptAgeSeconds: 9, outcome: 'completed', steps: {
        generalStatus: 'cooldown', proPowerRequest: 'accepted_unconfirmed', telemetry: 'saved', proPowerRead: 'failed' } });
      assert.ok(h.state.alerts.some(a => a.title === 'Review redacted Pro Power report' && a.cancel), 'Copy requires a separate review step');
    }
    assert.equal(h.state.requests.length, 0);
    assert.equal(h.state.safari.length, 0, 'A report must not open an external upload or sharing destination');
    assert.equal(h.state.files.get(app.store.path), before); assert.deepEqual(Array.from(h.state.secrets), secrets);
    app.store.release();
  }
});

test('main and routine Pro Power menus keep optional reports in the separate Troubleshooting menu', async () => {
  const baseline = scriptable(baselineSource, true), original = await prepared(baseline);
  original.store.release(); baseline.state.choices.push(-1); await original.run();
  const originalLabels = baseline.state.alerts.find(alert => alert.kind === 'sheet').actions.map(action => action.title);
  for (const route of ['Pro Power', 'Troubleshooting']) {
    const h = scriptable(widgetSource), app = await prepared(h, prefs(), cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 0 }) }));
    const before = h.state.files.get(app.store.path), secrets = Array.from(h.state.secrets);
    app.store.release(); h.state.choices.push(route, -1); await app.run();
    const main = h.state.alerts[0], labels = main.actions.map(action => action.title);
    assert.deepEqual(labels.filter(label => !['Pro Power', 'Troubleshooting'].includes(label)), originalLabels, 'Every original main-menu action must remain in its original order');
    assert.equal(labels.filter(label => label === 'Troubleshooting').length, 1); assert.equal(labels.filter(label => label === 'Pro Power').length, 1);
    assert.doesNotMatch(labels.join(' '), /raw signals|redacted|report|diagnostic/i);
    assert.match(main.title, /0\.1\.7/);
    const submenu = h.state.alerts[1];
    assert.deepEqual(submenu.actions.map(action => action.title), route === 'Pro Power' ?
      ['Read cached Pro Power', 'Request status once…'] : ['Vehicle data report', 'Pro Power raw signals', 'Copy redacted Pro Power report']);
    assert.equal(submenu.title, route === 'Pro Power' ? 'Pro Power · last reported' : 'Troubleshooting');
    if (route === 'Troubleshooting') assert.match(submenu.message, /Nothing is uploaded automatically/);
    assert.equal(h.state.requests.length, 0); assert.equal(h.state.safari.length, 0);
    assert.equal(h.state.previews.length, 0); assert.equal(h.state.clipboard.length, 0);
    assert.equal(h.state.files.get(app.store.path), before); assert.deepEqual(Array.from(h.state.secrets), secrets);
  }
});

test('closing Troubleshooting or canceling either report choice performs no read, upload, copy or telemetry update', async () => {
  for (const choices of [[-1], ['Vehicle data report', -1, -1], ['Copy redacted Pro Power report', -1, -1]]) {
    const h = scriptable(widgetSource), app = await prepared(h), before = h.state.files.get(app.store.path), secrets = Array.from(h.state.secrets);
    let tokenCalls = 0, writes = 0;
    app.auth.token = async () => { tokenCalls += 1; throw new Error('Unexpected diagnostic authentication'); };
    const write = app.store.write.bind(app.store); app.store.write = value => { writes += 1; return write(value); };
    h.state.choices.push(...choices); await app.troubleshooting(prefs());
    assert.equal(h.state.choices.length, 0); assert.equal(tokenCalls, 0); assert.equal(writes, 0);
    assert.equal(h.state.requests.length, 0); assert.equal(h.state.safari.length, 0);
    assert.equal(h.state.previews.length, 0); assert.equal(h.state.clipboard.length, 0); assert.equal(h.state.notifications.length, 0);
    assert.equal(h.state.files.get(app.store.path), before); assert.deepEqual(Array.from(h.state.secrets), secrets);
    if (choices[0] === 'Vehicle data report') assert.ok(h.state.alerts.some(alert => alert.title === 'Vehicle data diagnostic' && alert.cancel === 'Cancel'), 'Vehicle report selection must delegate to the existing separately confirmed passive diagnostic');
    if (choices[0] === 'Copy redacted Pro Power report') assert.ok(h.state.alerts.some(alert => alert.title === 'Review redacted Pro Power report' && alert.cancel === 'Cancel'), 'Copy selection must show the separate review before copying');
    app.store.release();
  }
});

test('Troubleshooting refuses a changed vehicle or expired session before exposing another report or copying', async () => {
  for (const scenario of ['entry', 'menu', 'review', 'raw-preview', 'lease']) {
    const h = scriptable(widgetSource), app = await prepared(h, prefs(), cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 0 }) }));
    const before = h.state.files.get(app.store.path);
    const switchVehicle = () => h.api.secretSet('vehicle', prefs({ vin: '1FTFW1E50JFA00002' }));
    if (scenario === 'entry') switchVehicle();
    if (scenario === 'menu') {
      const show = h.context.Alert.prototype.presentSheet;
      h.context.Alert.prototype.presentSheet = async function() { const choice = await show.call(this); if (this.title === 'Troubleshooting') switchVehicle(); return choice; };
    }
    if (scenario === 'review' || scenario === 'lease') {
      const show = h.context.Alert.prototype.presentAlert;
      h.context.Alert.prototype.presentAlert = async function() {
        const choice = await show.call(this);
        if (this.title === 'Review redacted Pro Power report') { if (scenario === 'lease') app.store.release(); else switchVehicle(); }
        return choice;
      };
    }
    if (scenario === 'raw-preview') {
      const present = h.context.QuickLook.present;
      h.context.QuickLook.present = async value => { await present(value); switchVehicle(); };
    }
    h.state.choices.push(...(['review', 'lease'].includes(scenario) ? ['Copy redacted Pro Power report', 'Copy report'] : ['Pro Power raw signals']));
    await assert.rejects(app.troubleshooting(prefs()), /vehicle\/session changed|App session expired/);
    assert.equal(h.state.clipboard.length, 0); assert.equal(h.state.previews.length, scenario === 'raw-preview' ? 1 : 0);
    assert.equal(h.state.alerts.filter(alert => alert.title === 'Troubleshooting').length, scenario === 'entry' ? 0 : 1, 'A changed binding must not reopen the report menu');
    assert.equal(h.state.requests.length, 0); assert.equal(h.state.safari.length, 0); assert.equal(h.state.notifications.length, 0);
    assert.equal(h.state.files.get(app.store.path), before, 'A rejected report must not alter saved telemetry');
    app.store.release();
  }
});

test('cached refresh diagnostics expose only fixed gate names, relative timing and safe current-stage metadata without I/O', () => {
  const h = scriptable(widgetSource), c = cache({
    widgetRefreshAfter: TIME + 60001, commandAfter: TIME - 1, wakeAfter: TIME + 900000,
    proPowerRequestAfter: TIME + 120000, proPowerReadAfter: TIME + 30000, nextFetch: 'PRIVATE_TIMER', PRIVATE_COOLDOWN: TIME + 999999,
    proPower: ppoSnapshot({}, { commandAt: TIME - 5400000, fetchedAt: TIME - 4000, id: 'PRIVATE_PPO_RECEIPT' }),
    generalStatusRequest: { attemptAt: TIME - 3000, outcome: 'device_succeeded', id: 'PRIVATE_GENERAL_ID' },
    proPowerRequest: { attemptAt: TIME - 2000, outcome: 'accepted_unconfirmed', id: 'PRIVATE_PPO_ID' },
    widgetRefreshLast: { attemptAt: TIME - 5000, outcome: 'in_progress', steps: {
      generalStatus: 'cooldown', telemetry: 'saved', proPowerRequest: 'accepted_unconfirmed', proPowerRead: 'PRIVATE_STAGE_VALUE',
      place: 'checked', photo: 'skipped', PRIVATE_STAGE_KEY: 'failed' }, message: 'PRIVATE_MESSAGE', vin: VIN }
  });
  c.fields.fuel = { value: 101.2, rawValue: 103.25, source: 'FordPass', at: TIME - 90000, PRIVATE_EXTRA: 'PRIVATE_FUEL' };
  h.api.secretSet('gate.commands', { next: TIME + 61001, failures: 2, httpStatus: 409, failedAt: TIME - 3000, headers: { authorization: 'PRIVATE_HEADER' } });
  h.api.secretSet('gate.commands.proPower', { next: TIME + 90000, failures: 1 }); // Historical record: no observed status.
  h.api.secretSet('gate.telemetry.proPower', { next: TIME + 60000, failures: 1, httpStatus: 0, failedAt: TIME - 1000 });
  h.api.secretSet('gate.telemetry.mobile', { next: TIME - 1000, failures: 1, httpStatus: 503, failedAt: TIME - 62000 });
  h.api.secretSet('gate.auth.mobile', { next: 'PRIVATE_NEXT', failures: '2', httpStatus: 1e100, failedAt: 'PRIVATE_FAILURE_TIME' });
  h.api.secretSet('gate.PRIVATE_UNKNOWN_SCOPE', { next: TIME + 999999, failures: 1, token: 'PRIVATE_UNKNOWN_TOKEN' });
  h.api.secretSet('token.mobile', { access: 'PRIVATE_TOKEN' });
  const input = JSON.stringify(c), secrets = Array.from(h.state.secrets), reads = [];
  const get = h.context.Keychain.get; h.context.Keychain.get = key => { reads.push(key); return get(key); };
  const report = plain(h.api.widgetDiagnosticContext(c, TIME));
  assert.equal(report.appVersion, '0.1.7');
  assert.equal(Object.hasOwn(report, 'previewVersion'), false);
  assert.deepEqual(Object.keys(report.gates), ['commands', 'commands.generalStatus', 'commands.proPower', 'telemetry.mobile', 'telemetry.proPower', 'auth.mobile', 'auth.autonomic']);
  assert.deepEqual(report.gates.commands, { active: true, secondsRemaining: 62, failures: 2, httpStatus: 409, failedAgeSeconds: 3 });
  assert.deepEqual(report.gates['commands.proPower'], { active: true, secondsRemaining: 90, failures: 1, httpStatus: null, failedAgeSeconds: null });
  assert.equal(report.gates['telemetry.proPower'].httpStatus, 0, 'A future no-response observation is distinct from missing historical HTTP metadata');
  assert.equal(report.gates['telemetry.proPower'].failedAgeSeconds, 1);
  assert.equal(report.gates['telemetry.mobile'].active, false); assert.equal(report.gates['telemetry.mobile'].secondsRemaining, 0);
  assert.deepEqual(report.gates['auth.mobile'], { active: null, secondsRemaining: null, failures: null, httpStatus: null, failedAgeSeconds: null });
  assert.deepEqual(report.cooldowns, { widgetRefreshAfter: 61, commandAfter: 0, wakeAfter: 900, proPowerRequestAfter: 120, proPowerReadAfter: 30, nextFetch: null });
  assert.deepEqual(report.cachedProPower, { commandAgeSeconds: 5400, fetchedAgeSeconds: 4 });
  assert.deepEqual(report.cachedFuel, { value: 101.2, rawValue: 103.25, atMs: TIME - 90000, ageSeconds: 90, source: 'FordPass' });
  assert.deepEqual(report.lastGeneralStatusRequest, { outcome: 'device_succeeded', attemptAgeSeconds: 3 });
  assert.deepEqual(report.lastProPowerStatusRequest, { outcome: 'accepted_unconfirmed', attemptAgeSeconds: 2 });
  assert.deepEqual(report.lastFullRefresh, { attemptAgeSeconds: 5, outcome: 'in_progress', steps: {
    generalStatus: 'cooldown', proPowerRequest: 'accepted_unconfirmed', telemetry: 'saved', place: 'checked', photo: 'skipped' } });
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|1FTFW1E50JFA00001|42\.31|-83\.21|1e\+100/);
  assert.ok(reads.every(key => Object.keys(report.gates).some(scope => key === h.api.secretKey('gate.' + scope))), 'Context must never read a token or enumerate arbitrary scopes');
  assert.equal(JSON.stringify(c), input); assert.deepEqual(Array.from(h.state.secrets), secrets);
  c.fields.fuel.value = '101.2';
  assert.equal(h.api.widgetDiagnosticContext(c, TIME).cachedFuel.value, 101.2, 'Cached numeric text is exported only as a number');
  c.fields.fuel.value = 'PRIVATE_CACHED_FUEL';
  assert.equal(h.api.widgetDiagnosticContext(c, TIME).cachedFuel.value, null);
  c.fields.fuel.rawValue = { token: 'PRIVATE_RAW_FUEL' };
  assert.equal(h.api.widgetDiagnosticContext(c, TIME).cachedFuel.rawValue, null);
  assert.equal(h.state.requests.length, 0); assert.equal(h.state.files.size, 0);
});

test('passive status diagnostic exposes aggregation freezes, raw seconds and unknown/history evidence without fixing or mutating them', () => {
  const h = scriptable(widgetSource), f = statusFixture();
  const beforeJSON = JSON.stringify(f.before), rawJSON = JSON.stringify(f.raw);
  const report = h.api.statusDiagnosticReport(f.raw, f.before, VIN, TIME);
  assert.equal(report.normalizedCandidate.lock.value.value, 'Locked');
  assert.equal(report.normalizedCandidate.doors.value.value, 'Closed');
  assert.equal(report.normalizedCandidate.doors.at.normalizerAtMs, f.quiet);
  assert.equal(report.wouldMerge.lock.value.value, 'Unlocked'); assert.equal(report.wouldMerge.doors.value.value, 'Ajar');
  assert.deepEqual(plain(report.cachedAfter), plain(report.before));
  assert.equal(JSON.stringify(f.before), beforeJSON); assert.equal(JSON.stringify(f.raw), rawJSON);

  const seconds = f.fresh / 1000, numeric = plain(f.raw);
  numeric.updateTime = seconds;
  numeric.metrics.doorLockStatus = [{ vehicleDoor: 'ALL_DOORS', value: 'LOCKED', updateTime: seconds }];
  numeric.metrics.doorStatus = [{ vehicleDoor: 'FRONT_LEFT', value: 'CLOSED', updateTime: seconds }];
  delete numeric.metrics.hoodStatus;
  const numericReport = h.api.statusDiagnosticReport(numeric, f.before, VIN, TIME);
  const time = numericReport.raw.doorLockStatus.items[0].updateTime;
  assert.equal(time.rawValue, seconds); assert.equal(time.format, 'epoch_seconds');
  assert.match(time.asMillisecondsISO, /^1970-/); assert.equal(time.asEpochSecondsISO, f.iso(f.fresh));
  assert.equal(numericReport.wouldMerge.lock.value.value, 'Unlocked');

  const unknown = plain(f.raw);
  unknown.metrics.doorLockStatus = [{ vehicleDoor: 'ALL_DOORS', value: 'UNKNOWN', updateTime: f.iso(f.fresh) }];
  unknown.metrics.doorStatus = [{ vehicleDoor: 'FRONT_LEFT', value: 'UNKNOWN', updateTime: f.iso(f.fresh) }];
  unknown.metrics.hoodStatus.value = 'UNKNOWN';
  const unknownReport = h.api.statusDiagnosticReport(unknown, f.before, VIN, TIME);
  assert.equal(unknownReport.normalizedCandidate.lock, null); assert.equal(unknownReport.normalizedCandidate.doors, null);
  assert.equal(unknownReport.raw.doorStatus.items[0].value.value, 'UNKNOWN');
  assert.equal(unknownReport.wouldMerge.doors.value.value, 'Ajar');

  const history = plain(f.raw);
  history.metrics.doorLockStatus = [{ vehicleDoor: 'ALL_DOORS', value: 'UNLOCKED', updateTime: f.iso(f.old) }, { vehicleDoor: 'ALL_DOORS', value: 'LOCKED', updateTime: f.iso(f.fresh) }];
  history.metrics.doorStatus = [{ vehicleDoor: 'FRONT_LEFT', value: 'OPEN', updateTime: f.iso(f.old) }, { vehicleDoor: 'FRONT_LEFT', value: 'CLOSED', updateTime: f.iso(f.fresh) }];
  const historyReport = h.api.statusDiagnosticReport(history, f.before, VIN, TIME);
  assert.deepEqual(plain(historyReport.raw.doorStatus.items.map(item => item.value.value)), ['OPEN', 'CLOSED']);
  assert.equal(historyReport.normalizedCandidate.doors.value.value, 'Ajar'); assert.equal(historyReport.normalizedCandidate.lock.value.value, 'Unlocked');
  assert.equal(h.state.requests.length, 0);
});

test('fuel diagnostic retains typed raw evidence while showing the current fuel normalization and merge decision', () => {
  const h = scriptable(widgetSource), before = cache(), after = plain(before);
  before.fields.fuel = { value: 101.2, source: 'FordPass', at: TIME - 90000 };
  after.fields.fuel = plain(before.fields.fuel);
  const raw = { vin: VIN, updateTime: new Date(TIME).toISOString(), metrics: {
    fuelLevel: { value: '101.2', unit: '%', unitSymbol: 'percent', updateTime: new Date(TIME - 1000).toISOString(), PRIVATE_EXTRA: 'PRIVATE_VALUE' },
    fuelRange: { value: '500.25', unit: 'km', unitSymbol: 'km', updateTime: (TIME - 1000) / 1000 },
    fuelPercent: { value: 82 }, position: { value: { lat: 42.12345, lon: -83.12345 } }
  }, token: 'PRIVATE_TOKEN', correlationId: 'PRIVATE_CORRELATION' };
  const originals = [raw, before, after].map(value => JSON.stringify(value));
  const report = h.api.statusFuelDiagnostic(raw, before, VIN, TIME, after);
  assert.equal(report.readOnly, true); assert.equal(report.reason, 'clamped_to_100');
  assert.deepEqual(plain(report.raw.fuelLevel.value), { inputType: 'string', numericValue: 101.2, withheldCount: 0 });
  assert.equal(report.raw.fuelRange.value.numericValue, 500.25);
  assert.equal(report.raw.fuelRange.updateTime.format, 'epoch_seconds');
  assert.equal(report.before.fuel.value.numericValue, 101.2); assert.equal(report.normalizedCandidate.fuel.value.numericValue, 100);
  assert.equal(report.wouldMerge.fuel.value.numericValue, 100); assert.deepEqual(plain(report.cachedAfter), plain(report.before));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|1FTFW1E50JFA00001|42\.12345|-83\.12345|fuelPercent/);
  for (const group of ['before', 'normalizedCandidate', 'wouldMerge', 'cachedAfter']) assert.deepEqual(Object.keys(report[group]), ['fuel']);
  assert.deepEqual([raw, before, after].map(value => JSON.stringify(value)), originals);

  raw.metrics.fuelLevel.value = '82.5';
  const accepted = h.api.statusFuelDiagnostic(raw, before, VIN, TIME, after);
  assert.equal(accepted.reason, 'accepted'); assert.equal(accepted.normalizedCandidate.fuel.value.numericValue, 82.5);
  assert.equal(accepted.wouldMerge.fuel.value.numericValue, 82.5);
  delete raw.metrics.fuelLevel;
  assert.equal(h.api.statusFuelDiagnostic(raw, before, VIN, TIME).reason, 'fuel_missing', 'An unrelated fuelPercent alias must not be invented');

  before.fields.fuel = { value: { token: 'PRIVATE_CACHED_TOKEN' }, rawValue: 'PRIVATE_RAW_FUEL', source: 'PRIVATE_PROVIDER', at: 'PRIVATE_TIME' };
  raw.metrics.fuelLevel = { value: 'PRIVATE_NUMERIC_TEXT', unit: 'PRIVATE_UNIT', unitSymbol: VIN, updateTime: 'PRIVATE_TIMESTAMP' };
  raw.metrics.fuelRange = { value: { token: 'PRIVATE_RANGE_TOKEN' }, unit: 'PRIVATE_RANGE_UNIT', updateTime: 1e100 };
  const withheld = h.api.statusFuelDiagnostic(raw, before, VIN, TIME, before);
  assert.equal(withheld.reason, 'non_numeric'); assert.equal(withheld.raw.fuelLevel.value.numericValue, null);
  assert.equal(withheld.raw.fuelRange.value.numericValue, null); assert.equal(withheld.before.fuel.value.numericValue, null);
  assert.equal(withheld.before.fuel.rawValue.numericValue, null);
  assert.equal(withheld.before.fuel.source, null);
  assert.doesNotMatch(JSON.stringify(withheld), /PRIVATE_|1FTFW1E50JFA00001|1e\+100/);
  for (const value of [true, [], {}, 1000001, -1000001]) {
    raw.metrics.fuelLevel.value = value;
    const unsafe = h.api.statusFuelDiagnostic(raw, before, VIN, TIME, before);
    assert.equal(unsafe.raw.fuelLevel.value.numericValue, null);
    assert.equal(unsafe.raw.fuelLevel.value.withheldCount, 1);
  }
  assert.throws(() => h.api.statusFuelDiagnostic(raw, before, VIN + '\n', TIME), /vehicle mismatch/);
  assert.equal(h.state.requests.length, 0); assert.equal(h.state.files.size, 0); assert.equal(h.state.secrets.size, 0);
});

test('synthetic unitless fuel over-read now fills a missing cached percentage with 100 while preserving its timestamp and raw evidence', () => {
  const h = scriptable(widgetSource), original = scriptable(baselineSource, true), before = cache();
  delete before.fields.fuel;
  const at = TIME - 10000, raw = { vin: VIN, updateTime: new Date(TIME - 1000).toISOString(), metrics: {
    fuelLevel: { value: 103.25, updateTime: new Date(at).toISOString(), PRIVATE_EXTRA: 'PRIVATE_FUEL_EXTRA' },
    fuelRange: { value: 304, unit: 'mi', updateTime: new Date(at).toISOString() },
    oilLifeRemaining: { value: 103.25, updateTime: new Date(at).toISOString() },
    batteryStateOfCharge: { value: 103.25, updateTime: new Date(at).toISOString() }
  }, token: 'PRIVATE_TOKEN', correlationId: 'PRIVATE_CORRELATION' };
  const rawText = JSON.stringify(raw), beforeText = JSON.stringify(before);
  assert.equal(original.api.normalize(raw, VIN, 'FordPass', TIME).fuel, undefined, 'The pinned original drops a finite above-100 raw reading');
  const normalized = h.api.normalize(raw, VIN, 'FordPass', TIME);
  assert.equal(normalized.fuel.value, 100); assert.equal(normalized.fuel.at, at);
  assert.equal(normalized.fuel.source, 'FordPass'); assert.equal(normalized.fuel.fetchedAt, TIME);
  assert.equal(normalized.fuel.rawValue, 103.25);
  assert.equal(normalized.oil, undefined); assert.equal(normalized.battery, undefined, 'Fuel clamping must not relax another metric bound');
  const saved = { ...before, fields: h.api.mergeFields(before.fields, {}, normalized), proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 0, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) };
  assert.equal(saved.fields.fuel.value, 100); assert.equal(saved.fields.fuel.at, at);
  const tree = new h.api.WidgetRenderer(prefs({ widget: { show: { ppoa: true } } }), saved, 'fuel ppoa status').build('large');
  assert.match(texts(tree).join(' '), /Fuel 100%/); assert.doesNotMatch(texts(tree).join(' '), /Fuel unavailable|Fuel 103%/);
  const report = h.api.statusFuelDiagnostic(raw, before, VIN, TIME, before);
  assert.equal(report.reason, 'clamped_to_100'); assert.equal(report.raw.fuelLevel.value.numericValue, 103.25);
  assert.equal(report.raw.fuelLevel.unit.value, null); assert.equal(report.raw.fuelLevel.unitSymbol.value, null);
  assert.equal(report.before.fuel, null); assert.equal(report.cachedAfter.fuel, null, 'A diagnostic compares without saving its candidate');
  assert.equal(report.normalizedCandidate.fuel.value.numericValue, 100); assert.equal(report.wouldMerge.fuel.value.numericValue, 100);
  assert.equal(report.normalizedCandidate.fuel.rawValue.numericValue, 103.25); assert.equal(report.wouldMerge.fuel.rawValue.numericValue, 103.25);
  assert.equal(report.normalizedCandidate.fuel.at.normalizerAtMs, at);
  assert.doesNotMatch(JSON.stringify({ normalized, report }), /PRIVATE_|1FTFW1E50JFA00001/);
  assert.throws(() => h.api.normalize(raw, '1FTFW1E50JFA00002', 'FordPass', TIME), /VIN/);
  assert.equal(JSON.stringify(raw), rawText); assert.equal(JSON.stringify(before), beforeText);

  for (const [input, expected] of [[0, 0], ['0', 0], [75.5, 75.5], ['75.5', 75.5], [100, 100], ['103.25', 100], [103.25, 100],
    [-0.1, null], ['-1', null], [true, null], [false, null], [null, null], [undefined, null], [[], null], [{ value: 75 }, null], ['', null], ['   ', null], [NaN, null], [Infinity, null], ['PRIVATE_NUMBER', null]]) {
    assert.equal(h.api.fordFuelPercent(input), expected, 'Unexpected fuel conversion for ' + String(input));
  }
  raw.metrics.fuelLevel.value = 75.5;
  const ordinary = h.api.normalize(raw, VIN, 'FordPass', TIME).fuel;
  assert.equal(ordinary.value, 75.5); assert.equal(ordinary.at, at); assert.equal(ordinary.source, 'FordPass');
  assert.equal(h.state.requests.length, 0); assert.equal(original.state.requests.length, 0);
  assert.equal(h.state.files.size, 0); assert.equal(h.state.secrets.size, 0);
});

test('status diagnostic strictly whitelists fields, enum text and timestamps while bounding raw arrays', () => {
  const h = scriptable(widgetSource), f = statusFixture();
  f.before.fields.lock.source = 'PRIVATE_PROVIDER';
  const entry = { vehicleDoor: VIN, value: 'PRIVATE_STATE', updateTime: 'PRIVATE_TIMESTAMP',
    tags: { DOOR_LATCH_TYPE: 'PRIVATE_LATCH', PRIVATE_TAG: 'PRIVATE_TAG_VALUE' }, PRIVATE_CUSTOM_KEY: 'PRIVATE_CUSTOM_VALUE',
    doorLatchType: 'PRIVATE_DIRECT_LATCH', vehicleSide: VIN, vehicleOccupantRole: 'PRIVATE_OCCUPANT' };
  f.raw.metrics.doorLockStatus = Array.from({ length: 70 }, () => plain(entry));
  f.raw.metrics.doorStatus = Array.from({ length: 70 }, () => ({ vehicleDoor: 'FRONT_LEFT', value: 'Closed', updateTime: f.iso(f.fresh) }));
  const provenComponents = ['FRUNK', 'INNER_TAILGATE', 'REAR_CARGO_LEFT', 'REAR_CARGO_RIGHT', 'SLIDING_LEFT', 'SLIDING_RIGHT',
    'UNKNOWN_DOOR', 'UNSPECIFIED_DOOR', 'UNSPECIFIED_FRONT', 'UNSPECIFIED_REAR'];
  for (const [index, component] of provenComponents.entries()) Object.assign(f.raw.metrics.doorStatus[index], {
    vehicleDoor: component, vehicleSide: 'DRIVER', vehicleOccupantRole: 'PASSENGER', doorLatchType: 'ELECTRONIC', tags: { DOOR_LATCH_TYPE: 'UNKNOWN' } });
  f.raw.metrics.hoodStatus = { vehicleDoor: 'HOOD', value: 'PRIVATE_HOOD', updateTime: 1e100 };
  f.raw.metrics.position = { value: { location: { lat: 42.12345, lon: -83.12345 } } };
  f.raw.token = 'PRIVATE_TOKEN'; f.raw.correlationId = 'PRIVATE_CORRELATION'; f.raw.custom = 'PRIVATE_ROOT';
  f.before.generalStatusRequest = { attemptAt: TIME - 5000, outcome: 'device_succeeded', id: 'PRIVATE_GENERAL_RECEIPT', privateExtra: 'PRIVATE_GENERAL_EXTRA' };
  const report = h.api.statusDiagnosticReport(f.raw, f.before, VIN, TIME), text = JSON.stringify(report);
  assert.equal(report.raw.doorLockStatus.items.length, 32); assert.equal(report.raw.doorLockStatus.count, 70); assert.equal(report.raw.doorLockStatus.omittedCount, 38);
  assert.equal(report.raw.doorStatus.items.length, 32); assert.equal(report.raw.doorStatus.omittedCount, 38);
  assert.equal(report.raw.doorLockStatus.items[0].component.value, null); assert.equal(report.raw.doorLockStatus.items[0].value.value, null);
  assert.equal(report.raw.doorLockStatus.items[0].updateTime.rawValue, null);
  for (const key of ['doorLatchType', 'directDoorLatchType', 'vehicleSide', 'vehicleOccupantRole']) assert.equal(report.raw.doorLockStatus.items[0][key].value, null);
  for (const [index, component] of provenComponents.entries()) {
    const item = report.raw.doorStatus.items[index];
    assert.deepEqual(plain(item.component), { value: component, exactEnumMatch: true, withheldCount: 0 });
    assert.equal(item.vehicleSide.value, 'DRIVER'); assert.equal(item.vehicleOccupantRole.value, 'PASSENGER');
    assert.equal(item.directDoorLatchType.value, 'ELECTRONIC'); assert.equal(item.doorLatchType.value, 'UNKNOWN');
  }
  assert.equal(report.raw.doorStatus.items[0].value.value, 'Closed'); assert.equal(report.raw.doorStatus.items[0].value.exactEnumMatch, false);
  assert.doesNotMatch(text, /PRIVATE_|1FTFW1E50JFA00001|42\.12345|-83\.12345|1e\+100/);
  assert.equal(report.reportVersion, 2); assert.deepEqual(plain(report.lastGeneralStatusRequest), { outcome: 'device_succeeded', attemptAgeSeconds: 5 });
  f.before.generalStatusRequest.outcome = 'PRIVATE_UNKNOWN_OUTCOME';
  assert.equal(h.api.statusDiagnosticReport(f.raw, f.before, VIN, TIME).lastGeneralStatusRequest.outcome, null);
  for (const group of ['before', 'normalizedCandidate', 'wouldMerge', 'cachedAfter']) assert.deepEqual(Object.keys(report[group]).sort(), ['doors', 'lock']);
  assert.throws(() => h.api.statusDiagnosticReport({ ...f.raw, vin: '1FTFW1E50JFA00002' }, f.before, VIN, TIME), /vehicle mismatch/);
  assert.throws(() => h.api.statusDiagnosticReport(f.raw, f.before, VIN + '\n', TIME), /vehicle mismatch/);
  assert.equal(h.state.requests.length, 0);
});

test('status diagnostic cancellation and missing sign-in refuse the passive GET before authentication or cache writes', async () => {
  for (const scenario of ['cancel', 'signed-out']) {
    const h = scriptable(widgetSource), app = await prepared(h), before = h.state.files.get(app.store.path);
    let tokenCalls = 0, writes = 0;
    app.auth.token = async () => { tokenCalls += 1; return 'PRIVATE_DIAGNOSTIC_TOKEN'; };
    const originalWrite = app.store.write.bind(app.store); app.store.write = value => { writes += 1; return originalWrite(value); };
    if (scenario === 'signed-out') h.state.secrets.delete(h.api.secretKey('token.mobile'));
    h.state.choices.push(-1);
    assert.equal(await app.vehicleStatusDiagnostic(prefs()), null);
    assert.equal(h.state.requests.length, 0); assert.equal(tokenCalls, 0); assert.equal(writes, 0);
    assert.equal(h.state.files.get(app.store.path), before);
    if (scenario === 'signed-out') assert.ok(h.state.alerts.some(alert => /Connect FordPass first/.test(alert.message || '')));
    app.store.release();
  }
});

test('status diagnostic Preview then Copy reuses one passive v1 GET and leaves the telemetry cache byte-identical', async () => {
  const h = scriptable(widgetSource), f = statusFixture(), app = await prepared(h, prefs(), f.before);
  const before = h.state.files.get(app.store.path); let writes = 0, tokenCalls = 0;
  app.auth.token = async name => { tokenCalls += 1; assert.equal(name, 'autonomic'); return 'PRIVATE_DIAGNOSTIC_TOKEN'; };
  const originalWrite = app.store.write.bind(app.store); app.store.write = value => { writes += 1; return originalWrite(value); };
  h.state.responses.push(() => {
    assert.ok(h.state.alerts.some(alert => alert.title === 'Vehicle data diagnostic' && alert.actions.some(action => action.title === 'Preview report')),
      'The diagnostic consent must already be visible before transport');
    return { body: f.raw };
  });
  h.state.choices.push('Preview report', 'Copy report', -1);
  const report = await app.vehicleStatusDiagnostic(prefs());
  assert.equal(report.readOnly, true); assert.equal(h.state.requests.length, 1); assert.equal(tokenCalls, 1);
  assert.equal(report.reportVersion, 4); assert.equal(report.appVersion, '0.1.7'); assert.equal(report.cloudReadOutcome, 'succeeded');
  assert.equal(Object.hasOwn(report, 'previewVersion'), false);
  assert.equal(report.fuel.raw.fuelLevel.value.numericValue, 63);
  assert.equal(report.fuel.normalizedCandidate.fuel.value.numericValue, 63);
  assert.equal(report.refreshDiagnostics.appVersion, '0.1.7');
  assert.equal(report.refreshDiagnostics.cachedFuel.value, 63);
  const request = h.state.requests[0];
  assert.equal(request.method, 'GET'); assert.equal(request.url, 'https://api.autonomic.ai/v1/telemetry/sources/fordpass/vehicles/' + VIN);
  assert.equal(request.body, undefined); assert.equal(writes, 0); assert.equal(h.state.files.get(app.store.path), before);
  assert.equal(h.state.previews.length, 1); assert.equal(h.state.clipboard.length, 1); assert.equal(h.state.previews[0], h.state.clipboard[0]);
  assert.deepEqual(JSON.parse(h.state.clipboard[0]), plain(report));
  assert.doesNotMatch(h.state.clipboard[0], /PRIVATE_|1FTFW1E50JFA00001/);
  assert.deepEqual(plain(report.cachedAfter), plain(report.before));
  app.store.release();
});

test('a failed or gated passive diagnostic returns safe cached context without retry, telemetry writes or raw errors', async () => {
  for (const scenario of ['http-error', 'historical-gate']) {
    const h = scriptable(widgetSource), app = await prepared(h), before = h.state.files.get(app.store.path); let writes = 0;
    app.auth.token = async () => 'PRIVATE_DIAGNOSTIC_TOKEN';
    const originalWrite = app.store.write.bind(app.store); app.store.write = value => { writes += 1; return originalWrite(value); };
    if (scenario === 'http-error') h.state.responses.push({ status: 503, body: { token: 'PRIVATE_RESPONSE_TOKEN', vin: VIN, error: 'PRIVATE_SERVER_ERROR' } });
    else h.api.secretSet('gate.telemetry.mobile', { failures: 1, next: TIME + 90000 });
    h.state.choices.push('Preview report', -1);
    const report = await app.vehicleStatusDiagnostic(prefs());
    assert.equal(report.reportVersion, 4); assert.equal(report.cloudReadOutcome, 'unavailable'); assert.equal(report.fuel, null);
    assert.equal(h.state.requests.length, scenario === 'http-error' ? 1 : 0, 'A failed GET is attempted once; a historical gate permits no request');
    if (h.state.requests.length) assert.equal(h.state.requests[0].method, 'GET');
    const gate = report.refreshDiagnostics.gates['telemetry.mobile'];
    assert.equal(gate.httpStatus, scenario === 'http-error' ? 503 : null);
    assert.equal(gate.secondsRemaining, scenario === 'http-error' ? 60 : 90);
    assert.equal(gate.failedAgeSeconds, scenario === 'http-error' ? 0 : null);
    assert.equal(writes, 0); assert.equal(h.state.files.get(app.store.path), before);
    assert.equal(h.state.previews.length, 1); assert.equal(h.state.clipboard.length, 0);
    assert.deepEqual(JSON.parse(h.state.previews[0]), plain(report));
    assert.doesNotMatch(JSON.stringify({ report, alerts: h.state.alerts, logs: h.state.logs }), /PRIVATE_|1FTFW1E50JFA00001/);
    app.store.release();
  }
});

test('the existing widget Refresh button routes directly to the combined refresh in original and PPO views', () => {
  for (const family of ['medium', 'large']) for (const parameter of ['controls', 'ppoa controls']) {
    const h = scriptable(widgetSource), c = cache({ proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 1500, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    const tree = new h.api.WidgetRenderer(prefs(), c, parameter).build(family);
    const buttons = nodes(tree).filter(isOriginalRefreshButton);
    assert.equal(buttons.length, 1); assert.equal(actionOf(buttons[0]), 'refreshwidget');
    assert.equal(h.api.COMMANDS.refresh, 'statusRefresh', 'The original app Wake command keeps its separate wire operation');
    assert.equal(h.state.requests.length, 0);
  }
});

test('canceling the combined widget refresh has no transport, telemetry-cache write or completion side effect', async () => {
  const h = scriptable(widgetSource), prior = { attemptAt: TIME - 3600000, outcome: 'completed', steps: { telemetry: 'saved' } };
  const app = await prepared(h, prefs(), cache({ widgetRefreshLast: prior })), before = h.state.files.get(app.store.path);
  let writes = 0;
  const originalWrite = app.store.write.bind(app.store); app.store.write = value => { writes += 1; return originalWrite(value); };
  h.state.choices.push(-1);
  const result = await app.action('refreshwidget', prefs());
  assert.equal(result.outcome, 'cancelled'); assert.equal(h.state.requests.length, 0); assert.equal(writes, 0);
  assert.equal(h.state.files.get(app.store.path), before); assert.equal(app.store.read().widgetRefreshAfter, undefined);
  assert.deepEqual(plain(app.store.read().widgetRefreshLast), prior, 'Cancel must retain the prior completed attempt');
  assert.equal(h.state.widgets.length, 0); assert.equal(h.state.notifications.length, 0);
  assert.equal(h.state.alerts.length, 1); assert.equal(h.state.alerts[0].title, 'Refresh all widget data?');
  assert.equal(h.state.alerts[0].kind, 'alert');
  app.store.release();
});

test('forced ordinary telemetry bypasses the local interval but continues to respect server backoff', async () => {
  const h = scriptable(widgetSource), app = await prepared(h, prefs(), cache({ nextFetch: TIME + 900000 }));
  const api = new h.api.FordAPIClient(app.auth, app.store, prefs());
  await api.getVehicleStatus(); assert.equal(h.state.requests.length, 0, 'The default local read interval remains intact');
  const backoff = { next: TIME + 3600000, failures: 1 };
  h.api.secretSet('gate.telemetry.mobile', backoff);
  const blocked = await api.getVehicleStatus(true);
  assert.equal(h.state.requests.length, 0, 'Force must not bypass the authentication/server gate');
  assert.match(blocked.note, /cooling down/); assert.equal(app.store.read().fields.fuel.value, 63);
  assert.deepEqual(plain(h.api.secretGet('gate.telemetry.mobile')), backoff);
  app.store.release();
});

test('future backoff observations retain original delays and distinguish no response from an observed HTTP status', async () => {
  for (const status of [0, 400, 401, 403, 409, 429, 500]) {
    const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
    const original = new b.api.FordAuthManager(new b.api.LocalStore()), changed = new p.api.FordAuthManager(new p.api.LocalStore());
    for (const auth of [original, changed]) auth.backoff('commands.generalStatus', status, { response: { headers: {} } }, {});
    const oldGate = plain(b.api.secretGet('gate.commands.generalStatus')), newGate = plain(p.api.secretGet('gate.commands.generalStatus'));
    assert.deepEqual({ failures: newGate.failures, next: newGate.next }, oldGate, 'Original backoff changed for status ' + status);
    assert.equal(newGate.next - TIME, [400, 401, 403].includes(status) ? 900000 : 60000);
    assert.equal(newGate.httpStatus, status); assert.equal(newGate.failedAt, TIME);
    assert.equal(p.state.requests.length, 0); assert.equal(b.state.requests.length, 0);
  }
  const b = scriptable(baselineSource, true), p = scriptable(widgetSource);
  const original = new b.api.FordAuthManager(new b.api.LocalStore()), changed = new p.api.FordAuthManager(new p.api.LocalStore());
  for (let failure = 0; failure < 12; failure += 1) for (const auth of [original, changed]) auth.backoff('commands.generalStatus', 429, { response: { headers: {} } }, {});
  assert.equal(p.api.secretGet('gate.commands.generalStatus').failures, 10);
  assert.equal(p.api.secretGet('gate.commands.generalStatus').next - TIME, 21600000);
  assert.equal(p.api.secretGet('gate.commands.generalStatus').next, b.api.secretGet('gate.commands.generalStatus').next);
  for (const auth of [original, changed]) auth.backoff('commands.generalStatus', 429, { response: { headers: { 'rEtRy-AfTeR': '86400' } } }, {});
  assert.equal(p.api.secretGet('gate.commands.generalStatus').next - TIME, 86400000, 'Retry-After may exceed the six-hour exponential base cap');
  assert.equal(p.api.secretGet('gate.commands.generalStatus').next, b.api.secretGet('gate.commands.generalStatus').next);

  for (const scenario of ['timeout', 'http', 'invalid-json']) {
    const h = scriptable(widgetSource), app = await prepared(h);
    h.state.responses.push(scenario === 'timeout' ? new Error('PRIVATE_TIMEOUT') :
      scenario === 'http' ? { status: 503, body: { error: 'PRIVATE_SERVER_ERROR' } } : { status: 200, body: 'PRIVATE_INVALID_JSON' });
    await assert.rejects(app.auth.request('telemetry.proPower', 'https://synthetic.invalid/offline-fixture'));
    const gate = plain(h.api.secretGet('gate.telemetry.proPower'));
    assert.equal(gate.httpStatus, scenario === 'timeout' ? 0 : scenario === 'http' ? 503 : 200);
    assert.equal(gate.failedAt, TIME); assert.equal(gate.failures, 1); assert.equal(gate.next, TIME + 60000);
    assert.equal(h.api.widgetDiagnosticContext(app.store.read(), TIME).gates['telemetry.proPower'].httpStatus, gate.httpStatus,
      'Exports must preserve an observed status, including a 200 response that failed JSON validation');
    const count = h.state.requests.length;
    await assert.rejects(app.auth.request('telemetry.proPower', 'https://synthetic.invalid/offline-fixture'), /cooling down/);
    assert.equal(h.state.requests.length, count); assert.deepEqual(plain(h.api.secretGet('gate.telemetry.proPower')), gate, 'A gated tap must not replace the observed failure or increase its count');
    assert.doesNotMatch(JSON.stringify(gate), /PRIVATE_|synthetic\.invalid/);
    app.store.release();
  }
});

test('general status refresh uses the original wire body and only a matching terminal SUCCESS confirms completion', async () => {
  const h = scriptable(widgetSource), app = await prepared(h), api = new h.api.FordAPIClient(app.auth, app.store, prefs());
  h.state.responses.push({ body: generalFrame('PRIVATE_HISTORICAL_GENERAL', 'SUCCESS') }, { body: { id: 'PRIVATE_CURRENT_GENERAL' } },
    { body: generalFrame('PRIVATE_UNRELATED_GENERAL', 'SUCCESS') }, { body: generalFrame('PRIVATE_CURRENT_GENERAL', 'SUCCEEDED_ON_DEVICE') },
    { body: generalFrame('PRIVATE_CURRENT_GENERAL', 'SUCCESS') });
  const result = await api.requestGeneralStatus(true);
  assert.equal(result.outcome, 'device_succeeded'); assert.equal(result.dispatched, true);
  assert.equal(h.state.requests.length, 5, 'Unrelated success and nonterminal on-device state must not end polling');
  const commands = h.state.requests.filter(request => request.method === 'POST'); assert.equal(commands.length, 1);
  assert.equal(commands[0].url, 'https://api.autonomic.ai/v1/command/vehicles/' + VIN + '/commands');
  assert.deepEqual(JSON.parse(commands[0].body), { properties: {}, tags: {}, type: 'statusRefresh', wakeUp: true });
  assert.ok(h.state.clock <= TIME + 40000); assert.equal(app.auth.timeout, h.api.SETTINGS.timeout);
  assert.doesNotMatch(JSON.stringify({ result, cache: app.store.read() }), /PRIVATE_/);
  app.store.release();
  for (const state of ['FAILURE', 'CANCELLED', 'EXPIRED']) {
    const f = scriptable(widgetSource), controller = await prepared(f), client = new f.api.FordAPIClient(controller.auth, controller.store, prefs());
    f.state.responses.push({ body: generalFrame('old', 'SUCCESS') }, { body: { id: 'fresh' } }, { body: generalFrame('fresh', state) });
    const failed = await client.requestGeneralStatus(true);
    assert.equal(failed.outcome, 'device_failed'); assert.equal(failed.dispatched, true);
    assert.equal(f.state.requests.filter(request => request.method === 'POST').length, 1);
    controller.store.release();
  }
});

test('general refresh refuses missing confirmation, unusable baselines, historical receipts and late success', async () => {
  const refused = scriptable(widgetSource), app = await prepared(refused), api = new refused.api.FordAPIClient(app.auth, app.store, prefs());
  await assert.rejects(api.requestGeneralStatus(false), /Confirm/); assert.equal(refused.state.requests.length, 0);
  const badVIN = new refused.api.FordAPIClient(app.auth, app.store, { ...prefs(), vin: VIN + '\n' });
  assert.equal((await badVIN.requestGeneralStatus(true)).outcome, 'blocked'); assert.equal(refused.state.requests.length, 0); app.store.release();
  for (const body of [{ error: 'PRIVATE_BASELINE_ERROR' }, null]) {
    const h = scriptable(widgetSource), controller = await prepared(h), client = new h.api.FordAPIClient(controller.auth, controller.store, prefs());
    h.state.responses.push(body === null ? { status: 503, body: {} } : { body });
    const result = await client.requestGeneralStatus(true);
    assert.equal(result.outcome, 'baseline_unavailable'); assert.equal(result.dispatched, false);
    assert.equal(h.state.requests.length, 1); assert.equal(h.state.requests[0].method, 'GET');
    assert.equal(controller.store.read().commandAfter, undefined); controller.store.release();
  }
  for (const mode of ['historical', 'late']) {
    const h = scriptable(widgetSource), controller = await prepared(h), client = new h.api.FordAPIClient(controller.auth, controller.store, prefs());
    h.state.responses.push({ body: generalFrame('old', 'SUCCESS') }, { body: { id: mode === 'historical' ? 'old' : 'fresh' } });
    if (mode === 'late') h.state.responses.push(() => { h.state.clock += 50000; return { body: generalFrame('fresh', 'SUCCESS') }; });
    const result = await client.requestGeneralStatus(true);
    assert.equal(result.outcome, 'accepted_unconfirmed'); assert.equal(result.dispatched, true);
    assert.equal(h.state.requests.length, mode === 'historical' ? 2 : 3);
    assert.equal(h.state.requests.filter(request => request.method === 'POST').length, 1); controller.store.release();
  }
});

test('general-refresh backoff preserves the original lock control after shared spacing', async () => {
  const h = scriptable(widgetSource), app = await prepared(h), api = new h.api.FordAPIClient(app.auth, app.store, prefs());
  h.state.responses.push({ body: generalFrame('old', 'SUCCESS') }, { status: 400, body: { error: 'PRIVATE_GENERAL_FAILURE' } });
  const result = await api.requestGeneralStatus(true);
  assert.equal(result.outcome, 'delivery_uncertain'); assert.equal(result.dispatched, true);
  assert.equal(h.api.secretGet('gate.commands'), null); assert.ok(h.api.secretGet('gate.commands.generalStatus').next > h.state.clock);
  assert.equal(app.store.read().wakeAfter, TIME + h.api.SETTINGS.wakeInterval);
  assert.equal(app.store.read().commandAfter, TIME + h.api.SETTINGS.commandInterval);
  h.state.clock += 30001; h.state.responses.push({ body: { id: 'synthetic-lock-after-general', status: 'accepted' } });
  await api.sendCommand(VIN, 'lock');
  assert.equal(h.state.requests.length, 3); assert.equal(JSON.parse(h.state.requests[2].body).type, 'lock');
  const blocked = await api.requestGeneralStatus(true);
  assert.equal(blocked.outcome, 'cooldown'); assert.equal(blocked.dispatched, false); assert.equal(h.state.requests.length, 3);
  app.store.release();
});

test('one confirmed widget refresh independently updates available sources and preserves PPO/cache cooldown across partial failures', async () => {
  for (const scenario of ['ppo-command-fails', 'ordinary-telemetry-fails', 'general-command-fails', 'general-cooldown', 'server-backoff']) {
    const h = scriptable(widgetSource), vehicle = prefs({ imageMode: 'auto' });
    const initial = cache({ nextFetch: TIME + 900000, proPower: ppoSnapshot({ DcacOut1Pw2Dsply: 800, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200 }) });
    if (scenario === 'general-cooldown') initial.wakeAfter = TIME + 900000;
    const app = await prepared(h, vehicle, initial), localWork = [], events = [];
    h.api.FordAPIClient.prototype.updatePlace = async () => { localWork.push('place'); };
    h.api.FordAPIClient.prototype.updateVehicleImage = async force => { assert.equal(force, false); localWork.push('photo'); return 'synthetic-photo-source'; };
    const backoff = { next: TIME + 3600000, failures: 1 };
    if (scenario === 'server-backoff') { h.api.secretSet('gate.commands.proPower', backoff); h.api.secretSet('gate.telemetry.mobile', backoff); }
    let betaReads = 0, lastPPOValue = 800, generalDispatched = false, generalDone = false, ppoStarted = false, generalAttemptAt = null;
    const respond = request => {
      assert.ok(h.state.alerts.some(alert => alert.title === 'Refresh all widget data?'), 'Combined consent must precede every request');
      assert.ok(app.store.read().widgetRefreshAfter >= TIME + 60000, 'Own cooldown must be persisted before dispatch');
      assert.equal(app.store.read().widgetRefreshLast.attemptAt, TIME, 'The current attempt must be recorded before any I/O');
      assert.equal(app.store.read().widgetRefreshLast.outcome, 'in_progress');
      if (request.url === 'https://api.autonomic.ai/v1beta/telemetry/sources/fordpass/vehicles/' + VIN + ':query') {
        ppoStarted = true;
        betaReads += 1; lastPPOValue = betaReads === 1 ? 1100 : 1520;
        return { body: commandFrame({ DcacOut1Pw2Dsply: lastPPOValue, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200,
          DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0 }, betaReads === 1 ? 'synthetic-previous-ppo-receipt' : 'synthetic-widget-refresh-receipt', h.state.clock) };
      }
      if (request.url === 'https://api.autonomic.ai/v1beta/command/vehicles/' + VIN + '/commands') {
        events.push({ phase: 'ppo-command', index: h.state.requests.length - 1, at: h.state.clock });
        if (generalDispatched) assert.ok(h.state.clock >= generalAttemptAt + 30000, 'Shared command spacing must precede PPO');
        assert.deepEqual(JSON.parse(request.body), { type: 'updatePTTBStatusCommand', version: '1.0.0', wakeUp: true, properties: {} });
        return scenario === 'ppo-command-fails' ? { status: 400, body: { error: 'PRIVATE_PPO_FAILURE' } } : { body: { id: 'synthetic-widget-refresh-receipt' } };
      }
      if (request.url === 'https://api.autonomic.ai/v1/command/vehicles/' + VIN + '/commands') {
        assert.deepEqual(JSON.parse(request.body), { properties: {}, tags: {}, type: 'statusRefresh', wakeUp: true });
        generalDispatched = true; generalAttemptAt = h.state.clock;
        events.push({ phase: 'general-command', index: h.state.requests.length - 1, at: h.state.clock });
        if (scenario === 'general-command-fails') { generalDone = true; return { status: 400, body: { error: 'PRIVATE_GENERAL_FAILURE' } }; }
        return { body: { id: 'synthetic-general-refresh-receipt' } };
      }
      assert.equal(request.url, 'https://api.autonomic.ai/v1/telemetry/sources/fordpass/vehicles/' + VIN);
      assert.equal(request.method, 'GET');
      if (!ppoStarted && !generalDispatched) { events.push({ phase: 'general-baseline', index: h.state.requests.length - 1 }); return { body: generalFrame('synthetic-old-general', 'SUCCESS') }; }
      if (!ppoStarted && generalDispatched && !generalDone) { generalDone = true; events.push({ phase: 'general-poll', index: h.state.requests.length - 1 }); return { body: generalFrame('synthetic-general-refresh-receipt', 'SUCCESS') }; }
      events.push({ phase: 'ordinary', index: h.state.requests.length - 1 });
      return scenario === 'ordinary-telemetry-fails' ? { status: 503, body: { error: 'PRIVATE_TELEMETRY_FAILURE' } } :
        { body: { vin: VIN, metrics: { fuelLevel: { value: 77, updateTime: new Date(h.state.clock).toISOString() } } } };
    };
    h.state.responses.push(...Array(12).fill(respond));
    h.state.choices.push('Refresh widget');
    const result = await app.action('refreshwidget', vehicle);
    assert.equal(result.outcome, 'completed');
    const commands = h.state.requests.filter(request => /\/command\/vehicles\//.test(request.url));
    const ppoCommands = commands.filter(request => JSON.parse(request.body).type === 'updatePTTBStatusCommand');
    const generalCommands = commands.filter(request => JSON.parse(request.body).type === 'statusRefresh');
    const ordinary = events.filter(event => event.phase === 'ordinary');
    if (scenario === 'server-backoff') {
      assert.equal(commands.length, 0); assert.equal(ordinary.length, 0); assert.equal(h.state.clock, TIME, 'No spacing wait may occur without this run dispatching general status');
      assert.deepEqual(plain(h.api.secretGet('gate.commands.proPower')), backoff);
      assert.deepEqual(plain(h.api.secretGet('gate.telemetry.mobile')), backoff);
    } else {
      assert.equal(ppoCommands.length, 1, 'The full flow sends at most its single confirmed PPO command');
      assert.equal(generalCommands.length, scenario === 'general-cooldown' ? 0 : 1);
      assert.equal(ordinary.length, 1, 'Ordinary telemetry must still be read after the PPO attempt');
      const ppoEvent = events.find(event => event.phase === 'ppo-command');
      assert.ok(ordinary[0].index > ppoEvent.index, 'Standard telemetry is read after the PPO status attempt');
      if (generalCommands.length) assert.ok(events.find(event => event.phase === 'general-command').index < ppoEvent.index);
      else assert.equal(h.state.clock, TIME, 'A preexisting general wake cooldown must not delay PPO or ordinary reads');
    }
    const saved = app.store.read();
    assert.equal(saved.fields.fuel.value, ['ordinary-telemetry-fails', 'server-backoff'].includes(scenario) ? 63 : 77);
    assert.equal(saved.proPower.rawSignals.DcacOut1Pw2Dsply, lastPPOValue, 'Ordinary telemetry writes must not discard newly saved PPO');
    assert.ok(saved.widgetRefreshAfter >= TIME + 60000, 'PPO and ordinary writes must retain the full-refresh cooldown');
    assert.deepEqual(plain(saved.widgetRefreshLast), { attemptAt: TIME, outcome: 'completed', steps: plain(result.steps) },
      'Safe stage checkpoints must retain the full current result without clobbering the telemetry or PPO writes');
    assert.deepEqual(Object.keys(saved.widgetRefreshLast).sort(), ['attemptAt', 'outcome', 'steps']);
    assert.doesNotMatch(JSON.stringify(saved), /synthetic-widget-refresh-receipt|synthetic-previous-ppo-receipt|synthetic-general-refresh-receipt|synthetic-old-general|PRIVATE_/);
    assert.deepEqual(localWork, ['place', 'photo']);
    assert.equal(h.state.widgets.length, 1); assert.equal(h.state.notifications.length, 1);
    assert.equal(h.state.alerts.filter(alert => alert.title === 'Refresh all widget data?').length, 1);
    assert.equal(h.state.alerts.filter(alert => alert.kind === 'sheet').length, 0, 'A widget refresh must not enter a menu/details loop');
    const requestCount = h.state.requests.length;
    const repeated = await app.action('refreshwidget', vehicle);
    assert.equal(repeated.outcome, 'cooldown'); assert.equal(h.state.requests.length, requestCount, 'An immediate second tap must not repeat any cloud work');
    assert.deepEqual(plain(app.store.read().widgetRefreshLast), plain(saved.widgetRefreshLast), 'A cooldown tap must retain the completed attempt rather than mislabel it as new work');
    app.store.release();
  }
});
