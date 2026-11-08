// Local metadata only: fixed gate names, fixed cache fields, and no token reads.
// Missing historical HTTP metadata stays unknown; a gate is not an HTTP trace.
const FORDWIDGET_PREVIEW_VERSION = '__PREVIEW_VERSION__';
const WIDGET_DIAGNOSTIC_GATES = Object.freeze([
  'commands', 'commands.generalStatus', 'commands.proPower', 'telemetry.mobile',
  'telemetry.proPower', 'auth.mobile', 'auth.autonomic'
]);
const WIDGET_DIAGNOSTIC_TIMERS = Object.freeze([
  'widgetRefreshAfter', 'commandAfter', 'wakeAfter', 'proPowerRequestAfter',
  'proPowerReadAfter', 'nextFetch'
]);
const WIDGET_DIAGNOSTIC_REQUEST_OUTCOMES = Object.freeze([
  'dispatching', 'device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain'
]);
const WIDGET_DIAGNOSTIC_STEPS = Object.freeze({
  generalStatus: ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain',
    'cooldown', 'baseline_unavailable', 'blocked', 'unconfirmed', 'requires_fordpass'],
  proPowerRequest: ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain',
    'unconfirmed', 'unconfirmed_or_cooling_down', 'requires_fordpass'],
  telemetry: ['saved', 'partial', 'cached_or_unavailable', 'failed'],
  proPowerRead: ['checked', 'cached_or_unavailable', 'failed', 'already_checked_by_request', 'requires_fordpass'],
  place: ['checked', 'failed', 'skipped'], photo: ['checked', 'failed', 'skipped']
});
function widgetDiagnosticOwn(object, key) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value') ? descriptor.value : undefined;
  } catch (_) { return undefined; }
}
function widgetDiagnosticNumber(value, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maximum ? value : null;
}
function widgetDiagnosticTime(value) {
  return widgetDiagnosticNumber(value, 8640000000000000) !== null && value > 0 ? value : null;
}
function widgetDiagnosticAge(value, clock) {
  const at = widgetDiagnosticTime(value);
  return at !== null && clock !== null && at <= clock ? Math.floor((clock - at) / 1000) : null;
}
function widgetDiagnosticRemaining(value, clock) {
  const at = widgetDiagnosticTime(value);
  return at !== null && clock !== null ? Math.max(0, Math.ceil((at - clock) / 1000)) : null;
}
function widgetDiagnosticRequest(request, clock) {
  const outcome = widgetDiagnosticOwn(request, 'outcome');
  return WIDGET_DIAGNOSTIC_REQUEST_OUTCOMES.includes(outcome) ? {
    outcome, attemptAgeSeconds: widgetDiagnosticAge(widgetDiagnosticOwn(request, 'attemptAt'), clock)
  } : null;
}
function widgetDiagnosticContext(cache, clock = now()) {
  const time = widgetDiagnosticTime(clock), gates = {}, cooldowns = {};
  for (const name of WIDGET_DIAGNOSTIC_GATES) {
    let gate;
    try { gate = secretGet('gate.' + name); } catch (_) { /* Unavailable metadata stays unknown. */ }
    const remaining = widgetDiagnosticRemaining(widgetDiagnosticOwn(gate, 'next'), time);
    const failures = widgetDiagnosticNumber(widgetDiagnosticOwn(gate, 'failures'), 10);
    const status = widgetDiagnosticNumber(widgetDiagnosticOwn(gate, 'httpStatus'), 599);
    gates[name] = {
      active: remaining === null ? null : remaining > 0, secondsRemaining: remaining,
      failures: failures !== null && Number.isInteger(failures) && failures >= 0 ? failures : null,
      httpStatus: status !== null && Number.isInteger(status) && (status === 0 || status >= 100) ? status : null,
      failedAgeSeconds: widgetDiagnosticAge(widgetDiagnosticOwn(gate, 'failedAt'), time)
    };
  }
  for (const name of WIDGET_DIAGNOSTIC_TIMERS)
    cooldowns[name] = widgetDiagnosticRemaining(widgetDiagnosticOwn(cache, name), time);
  const ppo = widgetDiagnosticOwn(cache, 'proPower');
  const fields = widgetDiagnosticOwn(cache, 'fields'), fuel = widgetDiagnosticOwn(fields, 'fuel');
  const fuelInput = widgetDiagnosticOwn(fuel, 'value');
  const fuelNumber = typeof fuelInput === 'number' || typeof fuelInput === 'string' && fuelInput.length <= 40 ? finite(fuelInput) : null;
  const fuelValue = widgetDiagnosticNumber(fuelNumber, 1000000);
  const fuelRaw = widgetDiagnosticNumber(widgetDiagnosticOwn(fuel, 'rawValue'), 1000000);
  const fuelAt = widgetDiagnosticTime(widgetDiagnosticOwn(fuel, 'at'));
  const fuelSource = widgetDiagnosticOwn(fuel, 'source');
  const last = widgetDiagnosticOwn(cache, 'widgetRefreshLast'), outcome = widgetDiagnosticOwn(last, 'outcome');
  let lastFullRefresh = null;
  if (['in_progress', 'completed', 'cooldown', 'blocked', 'cancelled'].includes(outcome)) {
    const input = widgetDiagnosticOwn(last, 'steps'), steps = {};
    for (const name of Object.keys(WIDGET_DIAGNOSTIC_STEPS)) {
      const value = widgetDiagnosticOwn(input, name);
      if (WIDGET_DIAGNOSTIC_STEPS[name].includes(value)) steps[name] = value;
    }
    lastFullRefresh = { attemptAgeSeconds: widgetDiagnosticAge(widgetDiagnosticOwn(last, 'attemptAt'), time), outcome, steps };
  }
  return {
    previewVersion: FORDWIDGET_PREVIEW_VERSION, gates, cooldowns,
    lastGeneralStatusRequest: widgetDiagnosticRequest(widgetDiagnosticOwn(cache, 'generalStatusRequest'), time),
    lastProPowerStatusRequest: widgetDiagnosticRequest(widgetDiagnosticOwn(cache, 'proPowerRequest'), time),
    cachedProPower: { commandAgeSeconds: widgetDiagnosticAge(widgetDiagnosticOwn(ppo, 'commandAt'), time),
      fetchedAgeSeconds: widgetDiagnosticAge(widgetDiagnosticOwn(ppo, 'fetchedAt'), time) },
    cachedFuel: fuel ? { value: fuelValue, rawValue: fuelRaw, atMs: fuelAt !== null && time !== null && fuelAt <= time ? fuelAt : null,
      ageSeconds: widgetDiagnosticAge(fuelAt, time), source: ['FordPass', 'FordConnect'].includes(fuelSource) ? fuelSource : null } : null,
    lastFullRefresh
  };
}
