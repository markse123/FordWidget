// Passive, redacted lock/door investigation. No cache write or vehicle command.
const STATUS_DIAG_COMPONENTS = Object.freeze(['ALL_DOORS', 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT',
  'LEFT_FRONT', 'RIGHT_FRONT', 'LEFT_REAR', 'RIGHT_REAR', 'HOOD', 'TAILGATE', 'TRUNK', 'CARGO', 'DRIVER', 'PASSENGER',
  'FRUNK', 'INNER_TAILGATE', 'REAR_CARGO_LEFT', 'REAR_CARGO_RIGHT', 'SLIDING_LEFT', 'SLIDING_RIGHT',
  'UNKNOWN_DOOR', 'UNSPECIFIED_DOOR', 'UNSPECIFIED_FRONT', 'UNSPECIFIED_REAR']);
const STATUS_DIAG_LOCKS = Object.freeze(['LOCKED', 'DOUBLE_LOCKED', 'UNLOCKED', 'UNKNOWN']);
const STATUS_DIAG_DOORS = Object.freeze(['OPEN', 'AJAR', 'CLOSED', 'UNKNOWN', 'INVALID']);
const statusDiagRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const statusDiagOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function statusDiagnosticEnum(value, allowed) {
  const canonical = typeof value === 'string' && value.length <= 32 ? allowed.find(item => item.toUpperCase() === value.toUpperCase()) : undefined;
  return { value: canonical === undefined ? null : value, exactEnumMatch: canonical !== undefined && allowed.includes(value),
    withheldCount: value !== undefined && canonical === undefined ? 1 : 0 };
}
function statusDiagnosticTime(value, clock = now()) {
  const inputType = value === undefined ? 'missing' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const out = { inputType, format: inputType === 'missing' || inputType === 'null' ? inputType : 'withheld',
    rawValue: null, normalizerAtMs: null, asMillisecondsISO: null, asEpochSecondsISO: null,
    withheldCount: value === undefined || value === null ? 0 : 1 };
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.length <= 40 && /^\d{1,16}(?:\.\d{1,6})?$/.test(value) ? Number(value) : NaN;
  if (Number.isFinite(numeric) && (numeric === 0 || numeric >= 946684800 && numeric <= clock / 1000 + 60 || numeric >= 946684800000 && numeric <= clock + 60000)) {
    const seconds = numeric >= 946684800 && numeric <= clock / 1000 + 60;
    out.format = numeric === 0 ? 'zero' : seconds ? 'epoch_seconds' : 'epoch_milliseconds';
    out.rawValue = value; out.withheldCount = 0; out.asMillisecondsISO = new Date(numeric).toISOString();
    if (seconds) out.asEpochSecondsISO = new Date(numeric * 1000).toISOString();
    out.normalizerAtMs = timestamp(value);
  } else if (typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed >= 946684800000 && parsed <= clock + 60000) {
      out.format = 'iso'; out.rawValue = value; out.withheldCount = 0; out.normalizerAtMs = timestamp(value); out.asMillisecondsISO = new Date(parsed).toISOString();
    }
  }
  return out;
}
function statusDiagnosticFields(fields, clock) {
  const result = {};
  for (const key of ['lock', 'doors']) {
    const item = statusDiagRecord(fields) && statusDiagOwn(fields, key) && statusDiagRecord(fields[key]) ? fields[key] : null;
    result[key] = item ? { value: statusDiagnosticEnum(item.value, key === 'lock' ? ['Locked', 'Unlocked', 'Unknown'] : ['Closed', 'Ajar', 'Unknown']),
      source: ['FordPass', 'FordConnect'].includes(item.source) ? item.source : null,
      at: statusDiagnosticTime(item.at, clock) } : null;
  }
  return result;
}
function statusDiagnosticEntry(entry, allowed, clock) {
  if (!statusDiagRecord(entry)) return { malformed: true, withheldCount: entry === undefined ? 0 : 1 };
  const tags = statusDiagRecord(entry.tags) ? entry.tags : {};
  const component = statusDiagnosticEnum(entry.vehicleDoor, STATUS_DIAG_COMPONENTS);
  const value = statusDiagnosticEnum(entry.value, allowed);
  const latchValues = ['MECHANICAL', 'ELECTRONIC', 'UNKNOWN'];
  const latch = statusDiagnosticEnum(tags.DOOR_LATCH_TYPE, latchValues);
  const directLatch = statusDiagnosticEnum(entry.doorLatchType, latchValues);
  const side = statusDiagnosticEnum(entry.vehicleSide, ['UNKNOWN', 'DRIVER', 'PASSENGER']);
  const role = statusDiagnosticEnum(entry.vehicleOccupantRole, ['UNKNOWN', 'DRIVER', 'PASSENGER']);
  const updateTime = statusDiagnosticTime(entry.updateTime, clock);
  return { component, value, doorLatchType: latch, directDoorLatchType: directLatch, vehicleSide: side, vehicleOccupantRole: role, updateTime,
    withheldCount: component.withheldCount + value.withheldCount + latch.withheldCount + directLatch.withheldCount + side.withheldCount + role.withheldCount + updateTime.withheldCount +
      (entry.tags !== undefined && !statusDiagRecord(entry.tags) ? 1 : 0) +
      Object.keys(entry).filter(key => !['vehicleDoor', 'value', 'tags', 'updateTime', 'doorLatchType', 'vehicleSide', 'vehicleOccupantRole'].includes(key)).length +
      Object.keys(tags).filter(key => key !== 'DOOR_LATCH_TYPE').length };
}
function statusDiagnosticArray(value, allowed, clock) {
  if (!Array.isArray(value)) return { items: [], count: 0, omittedCount: 0, malformed: value !== undefined, withheldCount: value === undefined ? 0 : 1 };
  return { items: value.slice(0, 32).map(entry => statusDiagnosticEntry(entry, allowed, clock)), count: value.length,
    omittedCount: Math.max(0, value.length - 32), malformed: false };
}
function statusDiagValidateCache(cache, vin) {
  if (!statusDiagRecord(cache) || cache.vin !== vin || !statusDiagRecord(cache.fields)) throw new Error('Diagnostic cache vehicle mismatch.');
}
function statusDiagnosticGeneralRequest(cache, clock) {
  const entry = statusDiagRecord(cache.generalStatusRequest) ? cache.generalStatusRequest : null;
  if (!entry) return null;
  const allowed = ['dispatching', 'device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain'];
  const at = typeof entry.attemptAt === 'number' && Number.isFinite(entry.attemptAt) && entry.attemptAt > 0 && entry.attemptAt <= clock ? entry.attemptAt : null;
  return { outcome: allowed.includes(entry.outcome) ? entry.outcome : null,
    attemptAgeSeconds: at === null ? null : Math.floor((clock - at) / 1000) };
}
function statusDiagnosticReport(raw, before, vin, clock = now(), after = before) {
  if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !statusDiagRecord(raw)) throw new Error('Diagnostic response vehicle mismatch.');
  const root = statusDiagOwn(raw, 'vehicleStatus') ? raw.vehicleStatus : raw;
  if (!statusDiagRecord(root) || !statusDiagRecord(root.metrics)) throw new Error('Diagnostic response schema unsupported.');
  for (const object of [raw, root]) for (const key of ['vin', 'VIN']) {
    if (statusDiagOwn(object, key) && (typeof object[key] !== 'string' || object[key].toUpperCase() !== vin)) throw new Error('Diagnostic response vehicle mismatch.');
  }
  statusDiagValidateCache(before, vin); statusDiagValidateCache(after, vin);
  let candidate = {}, normalization = 'completed';
  try { candidate = normalize(raw, vin, 'FordPass', clock); }
  catch (_) { normalization = 'no_supported_fields_or_schema'; }
  const only = fields => Object.fromEntries(['lock', 'doors'].filter(key => statusDiagOwn(fields, key)).map(key => [key, fields[key]]));
  const merged = mergeFields(only(before.fields), {}, only(candidate));
  return { tool: 'FordWidget door / lock diagnostic', reportVersion: 2, readOnly: true,
    normalization, rootUpdateTime: statusDiagnosticTime(root.updateTime, clock),
    lastGeneralStatusRequest: statusDiagnosticGeneralRequest(after, clock),
    before: statusDiagnosticFields(before.fields, clock), normalizedCandidate: statusDiagnosticFields(candidate, clock),
    wouldMerge: statusDiagnosticFields(merged, clock), cachedAfter: statusDiagnosticFields(after.fields, clock),
    raw: { doorLockStatus: statusDiagnosticArray(root.metrics.doorLockStatus, STATUS_DIAG_LOCKS, clock),
      doorStatus: statusDiagnosticArray(root.metrics.doorStatus, STATUS_DIAG_DOORS, clock),
      hoodStatus: statusDiagnosticEntry(root.metrics.hoodStatus, STATUS_DIAG_DOORS, clock) } };
}
AppController.prototype.vehicleStatusDiagnostic = async function(prefs) {
  requireApp();
  try {
    const vin = prefs && prefs.vin;
    const validate = () => {
      requireApp(); this.store.assertLease();
      const configured = secretGet('vehicle');
      if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !configured || configured.vin !== vin || prefs.vin !== vin) throw new Error('Diagnostic configured vehicle changed.');
    };
    validate();
    if (!secretGet('token.mobile')) { await message('Vehicle data diagnostic', 'Connect FordPass first. No cloud read was sent.'); return null; }
    const choice = new Alert(); choice.title = 'Vehicle data diagnostic';
    choice.message = 'Check the saved cooldowns and compare one passive Ford cloud read with cached temperature, fuel, door and lock readings. No vehicle command or telemetry-cache update is requested. A redacted cached report remains available if the cloud read is blocked.';
    choice.addAction('Preview report'); choice.addAction('Copy report'); choice.addCancelAction('Cancel');
    const selected = await choice.presentAlert(); if (selected < 0) return null;
    validate(); const before = this.store.read(); statusDiagValidateCache(before, vin);
    let raw = null, cloudReadOutcome = 'unavailable';
    try {
      raw = await new FordAPIClient(this.auth, this.store, prefs).mobileTelemetry();
      cloudReadOutcome = 'succeeded';
    } catch (_) { /* Report only safe cached gates/status; never copy raw errors. */ }
    validate(); const after = this.store.read(); statusDiagValidateCache(after, vin);
    const clock = now();
    let report = null;
    if (raw !== null) {
      try {
        report = statusDiagnosticReport(raw, before, vin, clock, after);
        report.fuel = statusFuelDiagnostic(raw, before, vin, clock, after);
        report.temperature = statusTemperatureDiagnostic(raw, before, vin, clock, after);
      } catch (_) { report = null; cloudReadOutcome = 'response_rejected'; }
    }
    if (!report) report = { readOnly: true, before: statusDiagnosticFields(before.fields, clock),
      cachedAfter: statusDiagnosticFields(after.fields, clock), fuel: null, temperature: statusTemperatureCached(before, after, clock) };
    report.tool = 'FordWidget vehicle data diagnostic';
    report.reportVersion = 5;
    report.appVersion = FORDWIDGET_VERSION;
    report.cloudReadOutcome = cloudReadOutcome;
    report.refreshDiagnostics = widgetDiagnosticContext(after, clock);
    const text = JSON.stringify(report, null, 2);
    let copy = selected === 1;
    if (!copy) {
      await QuickLook.present(text); validate();
      const next = new Alert(); next.title = 'Redacted report ready'; next.message = 'Copy this same report to share temperature/fuel/status timestamps and cooldown details. No additional cloud read is needed.';
      next.addAction('Copy report'); next.addCancelAction('Close'); copy = await next.presentAlert() === 0;
    }
    validate();
    if (copy) { Pasteboard.copyString(text); await message('Vehicle data diagnostic', 'Redacted report copied.'); }
    return report;
  } catch (_) { await message('Vehicle data diagnostic', 'The diagnostic could not be completed. Raw errors are withheld. No vehicle command or telemetry-cache update was requested.'); return null; }
};
