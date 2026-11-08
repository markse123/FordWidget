// General TCU status push uses the original v1 command, separate from PPO.
const GENERAL_STATUS_STATES = new Set(('REQUESTED REQUEST_DELIVERY_QUEUED CANCELLATION_IN_PROGRESS EXPIRED CANCELLED FAILURE SUCCESS SUCCEEDED_ON_DEVICE OEM_CLOUD_DELIVERY_IN_PROGRESS REQUEST_DELIVERY_IN_PROGRESS OEM_CLOUD_TRANSLATION_IN_PROGRESS REQUEST_QUEUED REQUEST_DELIVERY_FAILURE REQUEST_DELIVERY_TIMED_OUT REQUEST_VALIDATION_IN_PROGRESS REQUEST_VALIDATION_FAILURE CLOUD_VALIDATION_IN_PROGRESS CLOUD_VALIDATION_FAILURE OEM_CLOUD_TO_DEVICE_DELIVERY_IN_PROGRESS ACTUATION_IN_PROGRESS').split(' '));
function generalStatusCommand(raw) {
  const root = ppoRoot(raw);
  return ppoChild(ppoChild(root, 'states'), 'statusRefreshCommand');
}
function generalStatusState(raw) {
  const input = ppoChild(ppoChild(generalStatusCommand(raw), 'value'), 'toState');
  const state = typeof input === 'string' && input.length <= 64 && GENERAL_STATUS_STATES.has(input.toUpperCase()) ? input.toUpperCase() : null;
  return { state, terminal: state === 'SUCCESS' || ['FAILURE', 'CANCELLED', 'EXPIRED'].includes(state),
    outcome: state === 'SUCCESS' ? 'device_succeeded' : ['FAILURE', 'CANCELLED', 'EXPIRED'].includes(state) ? 'device_failed' : 'unconfirmed' };
}
function generalStatusContext(client, vin) {
  requireApp(); client.store.assertLease();
  const configured = secretGet('vehicle'), cache = client.store.read();
  if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !client.prefs || client.prefs.vin !== vin ||
      !configured || configured.vin !== vin || !cache || cache.vin !== vin || !ppoRecord(cache.fields))
    throw new APIError('General status refresh vehicle/session mismatch.');
  return cache;
}
async function generalStatusRead(client, vin, deadline = null) {
  generalStatusContext(client, vin);
  const previous = client.auth.timeout;
  if (deadline !== null) {
    if (deadline <= now()) throw new APIError('General status read window ended.');
    client.auth.timeout = Math.min(previous || SETTINGS.timeout, (deadline - now()) / 1000);
  }
  try {
    const raw = await client.mobileTelemetry();
    if (deadline !== null && now() > deadline) throw new APIError('General status read window ended.');
    generalStatusContext(client, vin); ppoValidate(raw, vin);
    const root = ppoRoot(raw);
    if (!ppoRecord(ppoChild(root, 'metrics')) && !ppoRecord(ppoChild(root, 'states')))
      throw new APIError('General status telemetry schema unsupported.');
    if (deadline !== null && now() > deadline) throw new APIError('General status read window ended.');
    return raw;
  } finally { client.auth.timeout = previous; }
}
function generalStatusResult(client, vin, attemptAt, outcome, dispatched) {
  if (attemptAt !== null) {
    try { const cache = generalStatusContext(client, vin);
      cache.generalStatusRequest = { attemptAt, outcome }; client.store.write(cache);
    } catch (_) { /* A lost session must not write another run's cache. */ }
  }
  const messages = {
    device_succeeded: 'Ford reports the matched general status-refresh command succeeded. Individual measurement times may still differ.',
    device_failed: 'Ford reports the matched general status request failed, expired or was canceled. It was not retried.',
    accepted_unconfirmed: 'General status refresh was accepted; its completion was not confirmed in the read window.',
    delivery_uncertain: 'General status-refresh delivery is uncertain. It was not retried.',
    cooldown: 'General status refresh is cooling down or blocked by an existing request gate. No new general status command was sent.',
    baseline_unavailable: 'The general status baseline could not be read. No general status command was sent.',
    blocked: 'General status refresh stopped because the configured vehicle or app session changed.'
  };
  return { outcome, dispatched, message: messages[outcome] };
}
FordAPIClient.prototype.requestGeneralStatus = async function(confirmed = false) {
  requireApp();
  if (confirmed !== true) throw new APIError('Confirm the general status refresh in the app first.');
  const vin = this.prefs && this.prefs.vin;
  const result = (outcome, dispatched = false, at = null) => generalStatusResult(this, vin, at, outcome, dispatched);
  const available = () => {
    const cache = generalStatusContext(this, vin);
    this.auth.gate('commands');
    this.auth.gate('commands.generalStatus');
    return !(cache.commandAfter > now() || cache.wakeAfter > now());
  };
  try { generalStatusContext(this, vin); } catch (_) { return result('blocked'); }
  try { if (!available()) return result('cooldown'); } catch (_) { return result('cooldown'); }
  let token, baseline;
  try {
    token = await this.auth.token('autonomic');
    if (!available()) return result('cooldown');
    baseline = await generalStatusRead(this, vin);
  } catch (_) { return result('baseline_unavailable'); }
  const historicalID = ppoID(ppoChild(generalStatusCommand(baseline), 'commandId'));
  let cache;
  try { if (!available()) return result('cooldown'); cache = generalStatusContext(this, vin); }
  catch (_) { return result('blocked'); }
  const attemptAt = now();
  cache.commandAfter = attemptAt + SETTINGS.commandInterval;
  cache.wakeAfter = attemptAt + SETTINGS.wakeInterval;
  cache.generalStatusRequest = { attemptAt, outcome: 'dispatching' }; this.store.write(cache);
  let receipt;
  try {
    // Exactly the original v1 body/route, with an independent error backoff.
    // The global legacy command gate was checked immediately before dispatch.
    const body = await this.auth.request('commands.generalStatus',
      'https://api.autonomic.ai/v1/command/vehicles/' + vin + '/commands', 'POST',
      { properties: {}, tags: {}, type: 'statusRefresh', wakeUp: true }, this.auth.mobileHeaders(token));
    receipt = this.receipt(body);
    generalStatusContext(this, vin);
  } catch (_) { return result('delivery_uncertain', true, attemptAt); }
  const id = ppoID(ppoChild(receipt, 'id'));
  if (!id || id === historicalID) return result('accepted_unconfirmed', true, attemptAt);
  const deadline = now() + 40000;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt) await new Promise(resolve => Timer.schedule(Math.min(5000, Math.max(0, deadline - now())), false, resolve));
    if (now() >= deadline) break;
    let raw;
    try { raw = await generalStatusRead(this, vin, deadline); }
    catch (_) { break; } // No further poll after a transport, gate or lease error.
    if (ppoChild(generalStatusCommand(raw), 'commandId') !== id) continue;
    const state = generalStatusState(raw);
    if (state.terminal) return result(state.outcome, true, attemptAt);
  }
  return result('accepted_unconfirmed', true, attemptAt);
};
