// Pure fuel investigation using an already-fetched response. No I/O or cache write.
const statusFuelType = value => value === undefined ? 'missing' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
function statusFuelNumber(value) {
  const inputType = statusFuelType(value);
  const n = inputType === 'number' || inputType === 'string' && value.length <= 40 ? finite(value) : null;
  const safe = n !== null && Math.abs(n) <= 1000000;
  return { inputType, numericValue: safe ? n : null, withheldCount: value !== undefined && value !== null && !safe ? 1 : 0 };
}
function statusFuelEntry(entry, units, clock) {
  const record = statusDiagRecord(entry), own = key => record && statusDiagOwn(entry, key) ? entry[key] : undefined;
  return { entryType: statusFuelType(entry),
    value: statusFuelNumber(own('value')),
    unit: statusDiagnosticEnum(own('unit'), units),
    unitSymbol: statusDiagnosticEnum(own('unitSymbol'), units),
    updateTime: statusDiagnosticTime(own('updateTime'), clock) };
}
function statusFuelFields(fields, clock) {
  const item = statusDiagRecord(fields) && statusDiagOwn(fields, 'fuel') && statusDiagRecord(fields.fuel) ? fields.fuel : null;
  return { fuel: item ? { value: statusFuelNumber(item.value),
    rawValue: statusFuelNumber(item.rawValue),
    source: ['FordPass', 'FordConnect'].includes(item.source) ? item.source : null,
    at: statusDiagnosticTime(item.at, clock) } : null };
}
function statusFuelDiagnostic(raw, before, vin, clock = now(), after = before) {
  if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !statusDiagRecord(raw))
    throw new Error('Fuel diagnostic response vehicle mismatch.');
  const root = statusDiagOwn(raw, 'vehicleStatus') ? raw.vehicleStatus : raw;
  if (!statusDiagRecord(root) || !statusDiagRecord(root.metrics)) throw new Error('Fuel diagnostic response schema unsupported.');
  for (const object of [raw, root]) for (const key of ['vin', 'VIN']) {
    if (statusDiagOwn(object, key) && (typeof object[key] !== 'string' || object[key].toUpperCase() !== vin))
      throw new Error('Fuel diagnostic response vehicle mismatch.');
  }
  statusDiagValidateCache(before, vin); statusDiagValidateCache(after, vin);
  const metrics = root.metrics, fuel = statusDiagOwn(metrics, 'fuelLevel') ? metrics.fuelLevel : undefined;
  const value = statusDiagRecord(fuel) && statusDiagOwn(fuel, 'value') ? fuel.value : undefined;
  const n = finite(value);
  const reason = fuel === undefined || fuel === null || statusDiagRecord(fuel) && (value === undefined || value === null) ? 'fuel_missing' :
    n === null ? 'non_numeric' : n < 0 ? 'out_of_0_100' : n > 100 ? 'clamped_to_100' : 'accepted';
  let candidate = {}, normalization = 'completed';
  try { candidate = normalize(raw, vin, 'FordPass', clock); }
  catch (_) { normalization = 'no_supported_fields_or_schema'; }
  const only = fields => statusDiagOwn(fields, 'fuel') ? { fuel: fields.fuel } : {};
  const merged = mergeFields(only(before.fields), {}, only(candidate));
  return { readOnly: true, scope: 'fuelLevel percentage; positive over-100 readings clamp to 100 with raw value retained. No aliases or unit conversion applied.',
    normalization, reason, rootUpdateTime: statusDiagnosticTime(root.updateTime, clock),
    raw: { fuelLevel: statusFuelEntry(fuel, ['%', 'percent', 'percentage'], clock),
      fuelRange: statusFuelEntry(statusDiagOwn(metrics, 'fuelRange') ? metrics.fuelRange : undefined,
        ['km', 'kilometer', 'kilometers', 'mi', 'mile', 'miles'], clock) },
    before: statusFuelFields(before.fields, clock), normalizedCandidate: statusFuelFields(candidate, clock),
    wouldMerge: statusFuelFields(merged, clock), cachedAfter: statusFuelFields(after.fields, clock) };
}
