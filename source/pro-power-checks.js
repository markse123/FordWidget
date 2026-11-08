// Additional on-device offline checks. No account, cache writes or requests.
function ppoSelfCheck() {
  const assert = (ok, label) => { if (!ok) throw new Error('Pro Power self-test failed: ' + label); };
  const vin = '1FTFW1E50JFA00001', clock = now(), at = Math.floor(clock / 1000) * 1000 - 60000;
  const fields = { DcacOut1Pw2Dsply: 1450, DcacOut2Pw2Dsply: 0, DcacOutPwDsplyMx: 7200,
    DcacOutScndPw2Dsply: 0, DcacOutScndPwDsplyMx: 0, DcacOutETot: 200, UnknownPrivateField: 998877 };
  const raw = { vin, states: { commands: { updatePTTBStatusCommand: {
    commandId: 'synthetic-private-status', timestamp: new Date(at).toISOString(),
    value: { toState: 'COMMAND_SUCCEEDED_ON_DEVICE', oemData: {
      pttbStatusDataV2: { stringValue: JSON.stringify(fields) },
      vehicle_common_correlation_id: { stringValue: 'synthetic-private-correlation' }
    } }
  } } }, events: { customEvents: { 'pttb-power-mode-change-event': {
    updateTime: new Date(at + 30000).toISOString(), oemData: { current_power_mode: { stringValue: 'Off' } }
  } } } };
  const snapshot = ppoNormalize(raw, vin, clock), view = ppoView(snapshot, clock), e = ppoEstimated(snapshot);
  assert(e.a === 1450 && e.b === 0 && e.total === 1450 && e.capacity === 7200, 'independent A/B/total/capacity');
  assert(snapshot.rawSignals.DcacOutETot === 200 && e.total !== 1650, 'energy excluded from power');
  assert(!Object.prototype.hasOwnProperty.call(snapshot.rawSignals, 'UnknownPrivateField'), 'unknown fields withheld');
  assert(view.stale && view.staleReasons.includes('newer_off_mode') && e.a === 1450, 'newer Off retains last-known load');
  assert(snapshot.commandAt === at && ppoView(snapshot, clock + 60000).ageSeconds === view.ageSeconds + 60, 'command age advances');
  const partial = Object.assign({}, snapshot, { rawSignals: Object.assign({}, snapshot.rawSignals) });
  delete partial.rawSignals.DcacOut2Pw2Dsply;
  assert(ppoEstimated(partial).b === null && ppoEstimated(partial).total === null, 'missing B stays unknown');
  partial.rawSignals.DcacOut1Pw2Dsply = 65535;
  assert(ppoEstimated(partial).a === null, 'out-of-capacity raw code is not wattage');
  const text = JSON.stringify(ppoRedactedReport(snapshot));
  assert(!text.includes(vin) && !text.includes('synthetic-private') && !text.includes('998877'), 'copied report redaction');
  const defaults = widgetOptions({}, '');
  assert(PPO_UI_METRICS.every(key => defaults.show[key] === false), 'original layouts remain default');
}
