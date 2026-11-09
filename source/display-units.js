// Display preferences only. Cached distances stay miles, temperatures Celsius,
// pressures PSI, and alert thresholds PSI regardless of the chosen formats.
const DISPLAY_PSI_TO_KPA = 6.894757293;
const DISPLAY_PSI_TO_BAR = 0.0689476;
function displayUnitOptions(prefs, parameter = '') {
  const saved = prefs && prefs.widget || {};
  let units = prefs && prefs.units === 'metric' ? 'metric' : 'us', explicit = null;
  const pressureMode = ['psi', 'kpa', 'bar'].includes(saved.unit) ? saved.unit : 'auto';
  for (const word of String(parameter || '').toLowerCase().split(/[\s,;]+/).filter(Boolean)) {
    if (word === 'us' || word === 'metric') units = word;
    if (['psi', 'kpa', 'bar'].includes(word)) explicit = word;
  }
  return { units, unit: explicit || (pressureMode === 'auto' ? units === 'metric' ? 'kpa' : 'psi' : pressureMode), pressureMode };
}
function displayUnitPressureLabel(unit) { return unit === 'kpa' ? 'kPa' : unit === 'bar' ? 'bar' : 'psi'; }
function formatDisplayTemperature(celsius, units = 'us') {
  const value = finite(celsius);
  return value === null ? '—' : units === 'metric' ? Math.round(value) + '°C' : fahrenheit(value) + '°F';
}
function formatDisplayFahrenheit(fahrenheitValue, units = 'us') {
  const value = finite(fahrenheitValue);
  return value === null ? '—' : units === 'metric' ? Math.round((value - 32) * 5 / 9) + '°C' : Math.round(value) + '°F';
}
function formatDisplayPressure(psi, unit = 'psi', detail = false) {
  const value = finite(psi);
  if (value === null) return '—';
  if (unit === 'bar') return (value * DISPLAY_PSI_TO_BAR).toFixed(1);
  if (unit === 'kpa') return String(Math.round(value * DISPLAY_PSI_TO_KPA));
  return String(detail ? Math.round(value * 10) / 10 : Math.round(value));
}
function displayUnitDistance(miles, units = 'us', decimals = 0, suffix = true) {
  const value = finite(miles), factor = Math.pow(10, decimals);
  return value === null ? '—' : String(Math.round(value * (units === 'metric' ? 1.609344 : 1) * factor) / factor) +
    (suffix ? units === 'metric' ? ' km' : ' mi' : '');
}
function displayUnitFieldLabel(key, prefs) {
  const options = displayUnitOptions(prefs), label = FIELD_NAMES[key];
  if (['range', 'odometer'].includes(key) && options.units === 'metric') return label.replace('(mi)', '(km)');
  if (['fl', 'fr', 'rl', 'rr'].includes(key) && options.unit !== 'psi') return label.replace(/PSI$/, displayUnitPressureLabel(options.unit));
  return label;
}
function displayUnitDetailValue(key, value, prefs) {
  const options = displayUnitOptions(prefs);
  if (key === 'outsideTemp') return formatDisplayTemperature(value, options.units);
  if (['range', 'odometer'].includes(key)) return displayUnitDistance(value, options.units, 1, false);
  return formatDisplayPressure(value, options.unit, true);
}
function displayUnitPreferences(prefs, options) {
  return Object.assign({}, prefs, { units: options.units, widget: Object.assign({}, prefs && prefs.widget, { unit: options.unit }) });
}
function displayUnitTirePreferenceLabel(prefs) {
  const options = displayUnitOptions(prefs), label = options.unit === 'psi' ? 'PSI' : displayUnitPressureLabel(options.unit);
  return options.pressureMode === 'auto' ? 'Auto (' + label + ')' : label;
}
function nextDisplayUnitTirePreference(prefs) {
  const order = ['auto', 'psi', 'kpa', 'bar'];
  return order[(order.indexOf(displayUnitOptions(prefs).pressureMode) + 1) % order.length];
}
function displayUnitThreshold(prefs, key, canonical, max) {
  const unit = key === 'tire' ? displayUnitOptions(prefs).unit : '%';
  const factor = unit === 'bar' ? DISPLAY_PSI_TO_BAR : unit === 'kpa' ? DISPLAY_PSI_TO_KPA : 1;
  return { value: key === 'tire' && unit !== 'psi' ? formatDisplayPressure(canonical, unit) : String(canonical),
    max: Number((max * factor).toFixed(9)), unit: key === 'tire' ? displayUnitPressureLabel(unit) : '%', canonicalMax: max };
}
function displayUnitTireThresholdLabel(prefs, psi) {
  const threshold = displayUnitThreshold(prefs, 'tire', psi, 100);
  return threshold.value + ' ' + threshold.unit;
}
function displayUnitLowTire(key, psi, prefs) {
  const options = displayUnitOptions(prefs);
  return key.toUpperCase() + ' ' + formatDisplayPressure(psi, options.unit) + ' ' + displayUnitPressureLabel(options.unit);
}
function parseDisplayUnitThreshold(text, threshold, canonical) {
  // Rounded display values must not alter an existing exact PSI threshold when
  // the owner submits the prefilled value without changing it.
  if (typeof text === 'string' && text.trim() === threshold.value && typeof canonical === 'number' &&
      Number.isFinite(canonical) && canonical >= 0 && canonical <= threshold.canonicalMax) return canonical;
  const value = finite(text);
  if (value === null || value < 0 || value > threshold.max) return null;
  const converted = value / (threshold.unit === 'bar' ? DISPLAY_PSI_TO_BAR : threshold.unit === 'kPa' ? DISPLAY_PSI_TO_KPA : 1);
  if (!Number.isFinite(converted) || converted < 0) return null;
  if (converted > threshold.canonicalMax) {
    const roundoff = Number.EPSILON * Math.max(1, threshold.canonicalMax) * 8;
    return converted - threshold.canonicalMax <= roundoff ? threshold.canonicalMax : null;
  }
  return converted;
}
function displayUnitWeatherTemperature(value, from = 'c') {
  const units = displayUnitOptions(secretGet('vehicle')).units;
  return from === 'f' ? formatDisplayFahrenheit(value, units) : formatDisplayTemperature(value, units);
}

const DISPLAY_ORIGINAL_WIDGET_OPTIONS = widgetOptions;
widgetOptions = function(prefs, parameter) {
  return Object.assign(DISPLAY_ORIGINAL_WIDGET_OPTIONS(prefs, parameter), displayUnitOptions(prefs, parameter));
};
const DISPLAY_ORIGINAL_NUMBER = WidgetRenderer.prototype.number;
WidgetRenderer.prototype.number = function(key, suffix = '') {
  if (this.opts.units !== 'metric' || !['range', 'odometer'].includes(key)) return DISPLAY_ORIGINAL_NUMBER.call(this, key, suffix);
  const number = displayUnitDistance(this.value(key), 'metric', 0, false);
  return number === '—' ? number : number + suffix.replace(/\bmi\b/g, 'km');
};
const DISPLAY_ORIGINAL_TEMP = WidgetRenderer.prototype.temp;
WidgetRenderer.prototype.temp = function() {
  return this.opts.units === 'metric' ? formatDisplayTemperature(this.value('outsideTemp'), 'metric') : DISPLAY_ORIGINAL_TEMP.call(this);
};
const DISPLAY_ORIGINAL_TIRE = WidgetRenderer.prototype.tire;
WidgetRenderer.prototype.tire = function(key) {
  return this.opts.unit === 'kpa' ? formatDisplayPressure(this.value(key), 'kpa') : DISPLAY_ORIGINAL_TIRE.call(this, key);
};
function displayUnitCurrent(controller, prefs) {
  requireApp(); controller.store.assertLease();
  const current = secretGet('vehicle');
  if (!prefs || typeof prefs.vin !== 'string' || prefs.vin.length !== 17 || !vinOK(prefs.vin) || !current || current.vin !== prefs.vin)
    throw new Error('The configured vehicle changed. Run the script again.');
  return current;
}
AppController.prototype.unitsOptions = async function(prefs) {
  for (;;) {
    const current = displayUnitCurrent(this, prefs), options = displayUnitOptions(current);
    const menu = new Alert(); menu.title = 'Units & formats';
    menu.message = 'Choose display units. Auto tire pressure follows the unit preset; an explicit pressure choice stays independent. Widget parameters can override the display without changing saved readings.';
    menu.addAction('Units: ' + (options.units === 'metric' ? 'Metric' : 'US'));
    menu.addAction('Tire pressure: ' + displayUnitTirePreferenceLabel(current)); menu.addCancelAction('Done');
    const choice = await menu.presentSheet(); if (choice < 0) return;
    if (choice !== 0 && choice !== 1) continue;
    const fresh = displayUnitCurrent(this, prefs), next = Object.assign({}, fresh);
    if (choice === 0) next.units = displayUnitOptions(fresh).units === 'metric' ? 'us' : 'metric';
    else next.widget = Object.assign({}, fresh.widget, { unit: nextDisplayUnitTirePreference(fresh) });
    displayUnitCurrent(this, prefs); secretSet('vehicle', next); Object.assign(prefs, next);
  }
};
