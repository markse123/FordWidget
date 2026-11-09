// Observe the existing temperature parser and merge without changing saved data.
const STATUS_TEMP_UNITS = Object.freeze(['C', '°C', 'celsius', 'degC', 'CELSIUS', 'DEGREES_CELSIUS',
  'F', '°F', 'fahrenheit', 'degF', 'FAHRENHEIT', 'DEGREES_FAHRENHEIT', 'K', 'kelvin']);
const STATUS_TEMP_SCOPE = 'One FordPass response compared with saved cache; no simultaneous FordConnect read. Existing outsideTemperature parser assumes Celsius and ignores unit labels. No conversion, alias, range or merge changes applied.';
function statusTemperatureFields(fields, clock) {
  const item = statusDiagRecord(fields) && statusDiagOwn(fields, 'outsideTemp') && statusDiagRecord(fields.outsideTemp) ? fields.outsideTemp : null;
  const value = item ? statusFuelNumber(item.value) : null;
  return { outsideTemp: item ? { value, asDisplayedFahrenheit: value.numericValue === null ? null : Math.round(value.numericValue * 9 / 5 + 32),
    source: ['FordPass', 'FordConnect'].includes(item.source) ? item.source : null,
    at: statusDiagnosticTime(item.at, clock) } : null };
}
function statusTemperatureCached(before, after, clock) {
  return { readOnly: true, scope: STATUS_TEMP_SCOPE, normalization: 'not_attempted', reason: 'cloud_unavailable',
    timestampSource: 'unknown', mergeDecision: 'not_evaluated', raw: null,
    before: statusTemperatureFields(before.fields, clock), normalizedCandidate: statusTemperatureFields({}, clock),
    wouldMerge: statusTemperatureFields(before.fields, clock), cachedAfter: statusTemperatureFields(after.fields, clock) };
}
function statusTemperatureDiagnostic(raw, before, vin, clock = now(), after = before) {
  if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !statusDiagRecord(raw))
    throw new Error('Temperature diagnostic response vehicle mismatch.');
  const root = statusDiagOwn(raw, 'vehicleStatus') ? raw.vehicleStatus : raw;
  if (!statusDiagRecord(root) || !statusDiagRecord(root.metrics)) throw new Error('Temperature diagnostic response schema unsupported.');
  for (const object of [raw, root]) for (const key of ['vin', 'VIN']) {
    if (statusDiagOwn(object, key) && (typeof object[key] !== 'string' || object[key].toUpperCase() !== vin))
      throw new Error('Temperature diagnostic response vehicle mismatch.');
  }
  statusDiagValidateCache(before, vin); statusDiagValidateCache(after, vin);
  const entry = statusDiagOwn(root.metrics, 'outsideTemperature') ? root.metrics.outsideTemperature : undefined;
  const own = key => statusDiagRecord(entry) && statusDiagOwn(entry, key) ? entry[key] : undefined;
  const value = own('value'), number = finite(value);
  const reason = entry === undefined || entry === null ? 'metric_missing' : !statusDiagRecord(entry) ? 'invalid_metric_shape' :
    value === undefined || value === null ? 'value_missing' : number === null ? 'non_numeric' :
    number <= -60 || number >= 70 ? 'out_of_parser_range' : 'accepted';
  let candidate = {}, normalization = 'completed';
  try { candidate = normalize(raw, vin, 'FordPass', clock); }
  catch (_) { normalization = 'no_supported_fields_or_schema'; }
  const only = fields => statusDiagOwn(fields, 'outsideTemp') ? { outsideTemp: fields.outsideTemp } : {};
  const merged = mergeFields(only(before.fields), {}, only(candidate));
  const incoming = candidate.outsideTemp, previous = before.fields.outsideTemp;
  const mergeDecision = !incoming ? 'no_candidate' : !previous ? 'accepted_no_cached_value' : !previous.at ? 'accepted_cached_time_missing' :
    !incoming.at ? 'retained_candidate_time_missing' : incoming.at >= previous.at ? 'accepted_not_older' : 'retained_candidate_older';
  return { readOnly: true, scope: STATUS_TEMP_SCOPE, normalization, reason,
    timestampSource: !incoming ? 'unknown' : timestamp(own('updateTime')) !== null ? 'metric' : timestamp(root.updateTime) !== null ? 'root' : 'unknown',
    mergeDecision, rootUpdateTime: statusDiagnosticTime(root.updateTime, clock),
    raw: { outsideTemperature: statusFuelEntry(entry, STATUS_TEMP_UNITS, clock) },
    before: statusTemperatureFields(before.fields, clock), normalizedCandidate: statusTemperatureFields(candidate, clock),
    wouldMerge: statusTemperatureFields(merged, clock), cachedAfter: statusTemperatureFields(after.fields, clock) };
}
