// One foreground refresh requests general status, then PPO, then reads telemetry.
// Original Wake, engine and lock actions keep their existing handlers.
AppController.prototype.refreshWidget = async function(prefs) {
  requireApp();
  const vin = prefs && prefs.vin, steps = {};
  let attemptAt = null;
  const stageCodes = {
    generalStatus: ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain', 'cooldown', 'baseline_unavailable', 'blocked', 'unconfirmed', 'requires_fordpass'],
    proPowerRequest: ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain', 'unconfirmed', 'unconfirmed_or_cooling_down', 'requires_fordpass'],
    telemetry: ['saved', 'partial', 'cached_or_unavailable', 'failed'],
    proPowerRead: ['checked', 'cached_or_unavailable', 'failed', 'already_checked_by_request', 'requires_fordpass'],
    place: ['checked', 'failed', 'skipped'], photo: ['checked', 'failed', 'skipped']
  };
  const validate = () => {
    requireApp(); this.store.assertLease();
    const configured = secretGet('vehicle'), cache = this.store.read();
    if (typeof vin !== 'string' || vin.length !== 17 || !vinOK(vin) || !configured || configured.vin !== vin || prefs.vin !== vin ||
        !cache || cache.vin !== vin || !cache.fields || typeof cache.fields !== 'object' || Array.isArray(cache.fields))
      throw new Error('Widget refresh vehicle/session mismatch.');
    return cache;
  };
  const marker = outcome => ({ attemptAt, outcome: ['in_progress', 'completed', 'blocked'].includes(outcome) ? outcome : 'in_progress',
    steps: Object.fromEntries(Object.keys(stageCodes).filter(key => stageCodes[key].includes(steps[key])).map(key => [key, steps[key]])) });
  const checkpoint = (outcome = 'in_progress') => {
    if (attemptAt === null) return;
    // Re-read after every await so a marker never replaces newly saved fields.
    const current = validate(); current.widgetRefreshLast = marker(outcome); this.store.write(current);
  };
  const cooling = cache => typeof cache.widgetRefreshAfter === 'number' && Number.isFinite(cache.widgetRefreshAfter) && cache.widgetRefreshAfter > now();
  const finish = async (outcome, body) => {
    try { checkpoint(outcome); const cache = validate(); Script.setWidget(new WidgetRenderer(prefs, cache).build('large')); }
    catch (_) { /* Never render another vehicle or overwrite cache after session loss. */ }
    await this.notify(body);
    return { outcome, steps, message: body };
  };
  let cache;
  try { cache = validate(); }
  catch (_) { return finish('blocked', 'Widget refresh stopped because the configured vehicle or app session changed.'); }
  if (cooling(cache)) return finish('cooldown', 'Widget refresh is cooling down. No cloud read or vehicle request was sent. Showing cached data.');

  const confirmation = new Alert(); confirmation.title = 'Refresh all widget data?';
  confirmation.message = 'Request vehicle and Pro Power status, then read Ford\'s latest available data. This may wake connected electronics; it does not start or stop the engine or switch outlets. Keep Scriptable open while it finishes. A full refresh can take around a minute, and existing cooldowns apply.';
  confirmation.addAction('Refresh widget'); confirmation.addCancelAction('Cancel');
  if (await confirmation.presentAlert() < 0) return { outcome: 'cancelled', steps, message: 'Canceled.' };
  try {
    cache = validate();
    if (cooling(cache)) return finish('cooldown', 'Widget refresh is cooling down. No cloud read or vehicle request was sent. Showing cached data.');
    // Persist before dispatch; never rewrite this old cache object after an await.
    attemptAt = now(); cache.widgetRefreshAfter = attemptAt + 60000;
    cache.widgetRefreshLast = marker('in_progress'); this.store.write(cache);
  } catch (_) { return finish('blocked', 'Widget refresh stopped before dispatch because the vehicle or app session changed.'); }

  const client = new FordAPIClient(this.auth, this.store, prefs);
  const mobile = !!secretGet('token.mobile');
  try {
    if (mobile) {
      let generalDispatched = false;
      try {
        const general = await client.requestGeneralStatus(true);
        steps.generalStatus = general && ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain', 'cooldown', 'baseline_unavailable', 'blocked'].includes(general.outcome) ? general.outcome : 'unconfirmed';
        generalDispatched = !!(general && general.dispatched === true);
      } catch (_) { steps.generalStatus = 'unconfirmed'; }
      checkpoint();
      if (generalDispatched) {
        // Wait only this run's remaining shared command spacing. Never wait out
        // a preexisting wake/auth/PPO backoff or retry the general command.
        const remaining = validate().commandAfter - now();
        if (remaining > 0 && remaining <= SETTINGS.commandInterval) {
          await new Promise(resolve => Timer.schedule(remaining, false, resolve));
          checkpoint();
        }
      }
      try {
        const result = await client.requestProPowerStatus(true);
        steps.proPowerRequest = result && ['device_succeeded', 'device_failed', 'accepted_unconfirmed', 'delivery_uncertain'].includes(result.outcome) ? result.outcome : 'unconfirmed';
      } catch (_) { steps.proPowerRequest = 'unconfirmed_or_cooling_down'; }
    } else { steps.generalStatus = 'requires_fordpass'; steps.proPowerRequest = 'requires_fordpass'; }

    checkpoint();
    try {
      // Read ordinary telemetry after the wake/status attempt. Only the local
      // nextFetch interval is bypassed; existing authentication gates still apply.
      const result = await client.getVehicleStatus(true);
      const note = result && typeof result.note === 'string' ? result.note : '';
      steps.telemetry = note.startsWith('Cloud telemetry saved.') ? 'saved' :
        note.startsWith('Some sources failed; available telemetry was saved.') ? 'partial' : 'cached_or_unavailable';
    } catch (_) { steps.telemetry = 'failed'; }

    checkpoint();
    if (mobile && steps.proPowerRequest !== 'device_succeeded') {
      try {
        const result = await client.readProPower(true);
        steps.proPowerRead = result && typeof result.note === 'string' && result.note.startsWith('Pro Power cloud cache checked.') ? 'checked' : 'cached_or_unavailable';
      } catch (_) { steps.proPowerRead = 'failed'; }
    } else steps.proPowerRead = mobile ? 'already_checked_by_request' : 'requires_fordpass';

    checkpoint();
    if (widgetOptions(prefs, '').show.parked) {
      try { await client.updatePlace(); steps.place = 'checked'; }
      catch (_) { steps.place = 'failed'; }
    } else steps.place = 'skipped';
    checkpoint();
    if ((prefs.imageMode || 'auto') === 'auto' && secretGet('token.mobile')) {
      try { await client.updateVehicleImage(false); steps.photo = 'checked'; }
      catch (_) { steps.photo = 'failed'; }
    } else steps.photo = 'skipped';
    checkpoint();
  } catch (_) {
    return finish('blocked', 'Widget refresh stopped because the configured vehicle or app session changed. Completed portions were kept; remaining portions were not sent.');
  }

  const lines = ['Widget refresh checked the available sources.'];
  const generalText = {
    device_succeeded: 'Ford reports the general vehicle status command succeeded; individual field times may still differ.',
    device_failed: 'Ford reports the general status request failed, expired or was canceled.',
    accepted_unconfirmed: 'General vehicle status refresh was accepted; completion is unconfirmed.',
    delivery_uncertain: 'General vehicle status-refresh delivery is uncertain; it was not retried.',
    cooldown: 'General vehicle status is cooling down. No new general status request was sent.',
    baseline_unavailable: 'General vehicle status could not be read before requesting an update. No general status request was sent.',
    blocked: 'General status refresh stopped because the vehicle or app session changed.',
    unconfirmed: 'General status-refresh completion is unconfirmed.',
    requires_fordpass: 'Requesting new vehicle status from the truck requires FordPass.'
  };
  lines.push(generalText[steps.generalStatus]);
  lines.push(steps.telemetry === 'saved' ? 'Vehicle telemetry saved.' : steps.telemetry === 'partial' ?
    'Available vehicle telemetry saved; some sources failed.' : 'Vehicle telemetry could not be confirmed; cached values were retained.');
  const proPowerText = {
    device_succeeded: 'Ford reports the Pro Power status request succeeded on the device.',
    device_failed: 'Ford reports the Pro Power request failed, expired or was canceled.',
    accepted_unconfirmed: 'Ford accepted the Pro Power request; device completion is unconfirmed.',
    delivery_uncertain: 'Pro Power request delivery is uncertain; it was not retried.',
    requires_fordpass: 'Pro Power requires FordPass; the other connected source was still checked.',
    unconfirmed: 'Pro Power request completion is unconfirmed.',
    unconfirmed_or_cooling_down: 'Pro Power status was not confirmed or is cooling down; no command retry was sent.'
  };
  lines.push(proPowerText[steps.proPowerRequest]);
  if (steps.proPowerRead === 'checked') lines.push('The Pro Power cloud cache was checked separately.');
  else if (['failed', 'cached_or_unavailable'].includes(steps.proPowerRead)) lines.push('The Pro Power cache read was unavailable; saved readings were retained.');
  if (steps.place === 'failed' || steps.photo === 'failed') lines.push('Location or automatic-photo processing was unavailable; the other results were kept.');
  lines.push('Readings keep Ford\'s measurement times. Pro Power sample time remains unverified.');
  return finish('completed', lines.join('\n'));
};
const WIDGET_REFRESH_ORIGINAL_ACTION = AppController.prototype.action;
AppController.prototype.action = async function(action, prefs) {
  if (action === 'refreshwidget') return this.refreshWidget(prefs);
  return WIDGET_REFRESH_ORIGINAL_ACTION.call(this, action, prefs);
};
