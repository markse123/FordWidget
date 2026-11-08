// Large mixed dashboard only. Data, authentication and vehicle actions are unchanged.
function ppoDashboardAge(at, clock = now()) {
  if (typeof at !== 'number' || !Number.isFinite(at) || at <= 0 || at > clock) return 'unknown';
  const seconds = Math.floor((clock - at) / 1000), minutes = Math.floor(seconds / 60);
  if (seconds < 60) return seconds + 's ago';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? hours + 'h ' + minutes % 60 + 'm ago' : Math.floor(hours / 24) + 'd ' + hours % 24 + 'h ago';
}

function ppoDashboardVehicle(renderer, widget) {
  const vehicle = widget.addStack(); vehicle.layoutVertically(); vehicle.spacing = 3;
  const header = vehicle.addStack(); header.layoutHorizontally(); header.centerAlignContent(); header.spacing = 6;
  renderer.truck(header, 64, 24);
  const name = header.addStack(); name.layoutVertically();
  renderer.text(name, renderer.prefs.name || 'F-150', 14, true);
  renderer.text(name, 'Vehicle · last reported', 8, false, renderer.muted);
  header.addSpacer(); renderer.runningBadge(header, 12, false);

  if (renderer.on('fuel') || renderer.on('battery')) {
    const row = vehicle.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 8;
    if (renderer.on('fuel')) {
      const fuel = row.addStack(); fuel.layoutVertically(); fuel.spacing = 1;
      // Unknown fuel must not resemble a full gauge, even in the light theme.
      if (finite(renderer.value('fuel')) === null) {
        renderer.text(fuel, 'Fuel unavailable', 11, true);
        renderer.text(fuel, 'Range ' + renderer.number('range', ' mi'), 9, false, renderer.muted);
      } else renderer.fuel(fuel, 132);
    }
    row.addSpacer(); renderer.batteryPill(row);
  }

  if (renderer.on('tires')) {
    const row = vehicle.addStack(); row.layoutHorizontally(); row.centerAlignContent(); row.spacing = 9;
    renderer.text(row, 'TIRES · ' + renderer.opts.unit.toUpperCase(), 8, true, renderer.muted);
    for (const key of ['fl', 'fr', 'rl', 'rr']) {
      const cell = row.addStack(); cell.layoutVertically();
      renderer.text(cell, key.toUpperCase(), 8, false, renderer.muted);
      renderer.text(cell, renderer.tire(key), 11, true);
    }
  }

  const extras = [];
  if (renderer.on('oil')) extras.push('Oil ' + renderer.number('oil', '%'));
  if (renderer.on('odometer')) extras.push('Odometer ' + renderer.number('odometer', ' mi'));
  if (renderer.on('temp')) extras.push('Outside ' + renderer.temp());
  if (extras.length) {
    const row = vehicle.addStack(); row.layoutHorizontally(); row.spacing = 10;
    for (const line of extras) renderer.text(row, line, 10, true);
  }

  if (renderer.on('lock') || renderer.on('doors')) {
    const row = vehicle.addStack(); row.layoutHorizontally(); row.spacing = 8;
    for (const key of ['lock', 'doors']) {
      if (!renderer.on(key)) continue;
      const cell = row.addStack(); cell.layoutVertically(); cell.spacing = 1; cell.size = new Size(138, 0);
      if (key === 'lock') renderer.lockPill(cell);
      else renderer.text(cell, 'Doors ' + (renderer.value('doors') || 'Unknown'), 10, true);
      const field = renderer.fields[key];
      renderer.text(cell, 'Reported: ' + ppoDashboardAge(field && field.at), 8, false, renderer.muted);
    }
  }

  if (renderer.on('parked')) {
    if (renderer.place()) renderer.parkedRow(vehicle, 9);
    else renderer.text(vehicle, 'Parked location unavailable', 9, false, renderer.muted);
  }
  return vehicle;
}

function ppoDashboardPanel(renderer, widget, selected) {
  const snapshot = ppoSnapshotFor(renderer.cache, renderer.prefs), view = ppoView(snapshot);
  const entries = ppoEntries(ppoEstimated(snapshot), selected);
  const panel = widget.addStack(); panel.layoutVertically(); panel.spacing = 2; panel.url = renderer.url('propower');
  const header = panel.addStack(); header.layoutHorizontally(); header.centerAlignContent(); header.spacing = 6;
  renderer.text(header, 'Pro Power · last reported estimates', 9, true);
  header.addSpacer(); renderer.text(header, 'Sample time unknown', 8, false, renderer.muted);
  renderer.text(panel, 'Status result: ' + ppoDashboardAge(view.commandAt), 8, false, renderer.muted);
  const mode = view.latestMode || {}, modeValue = ['OFF', 'LOW', 'HIGH'].includes(mode.value) ? mode.value : 'unknown';
  renderer.text(panel, 'Ford mode: ' + modeValue + ' · reported ' + ppoDashboardAge(mode.at), 8, false, renderer.muted);
  for (let i = 0; i < entries.length; i += 2) {
    const row = panel.addStack(); row.layoutHorizontally(); row.spacing = 8;
    row.addSpacer();
    for (const item of entries.slice(i, i + 2)) {
      const card = row.addStack(); card.layoutVertically(); card.spacing = 1;
      card.size = new Size(138, 0); card.setPadding(4, 7, 4, 7); card.cornerRadius = 8; card.backgroundColor = renderer.panel;
      renderer.text(card, item.label, 9, true, renderer.muted);
      renderer.text(card, ppoPowerText(item.value), 16, true);
    }
    row.addSpacer();
  }
  return panel;
}

function ppoBuildDashboard(renderer, family, notice, selected) {
  const widget = renderer.frame([8, 12, 8, 12]);
  // The root retains the main-menu target; only the PPO panel opens its details.
  ppoDashboardVehicle(renderer, widget);
  widget.addSpacer(6); ppoDashboardPanel(renderer, widget, selected);
  widget.addSpacer();
  if (renderer.opts.layout.large === 'controls') {
    renderer.text(widget, 'Vehicle controls', 8, true, renderer.muted);
    widget.addSpacer(2); renderer.buttons(widget, 4, 64, 34);
  }
  widget.addSpacer(3);
  const status = notice || (renderer.cache.notice ? 'cached source unavailable' : '');
  renderer.text(widget, 'Oldest vehicle reading: ' + ppoDashboardAge(renderer.oldest()) +
    (status ? ' · ' + status : ''), 8, false, renderer.muted);
  return widget;
}

const PPO_DASHBOARD_ORIGINAL_BUILD = WidgetRenderer.prototype.build;
WidgetRenderer.prototype.build = function(family = 'medium', notice = '') {
  const selected = ppoSelected(this);
  if ((family === 'large' || family === 'extraLarge') && selected.length && ppoHasOriginalSelection(this))
    return ppoBuildDashboard(this, family, notice, selected);
  return PPO_DASHBOARD_ORIGINAL_BUILD.call(this, family, notice);
};
