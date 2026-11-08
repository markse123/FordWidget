// Ford can report fuel above 100%; cap the percentage and retain raw data separately.
// Negative values remain unknown rather than treating a possible sentinel as empty.
function fordFuelPercent(value) {
  const raw = finite(value);
  if (raw === null || raw < 0) return null;
  return Math.min(raw, 100);
}
