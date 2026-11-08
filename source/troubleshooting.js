// Optional reports stay separate from routine vehicle and Pro Power actions.
function troubleshootingCache(controller, prefs) {
  requireApp(); controller.store.assertLease();
  const configured = secretGet('vehicle'), cache = controller.store.read();
  if (!prefs || !configured || prefs.vin !== configured.vin || !cache || cache.vin !== prefs.vin)
    throw new Error('Troubleshooting vehicle/session changed.');
  return cache;
}
AppController.prototype.troubleshooting = async function(prefs) {
  requireApp();
  for (;;) {
    troubleshootingCache(this, prefs);
    const menu = new Alert(); menu.title = 'Troubleshooting';
    menu.message = 'Optional redacted vehicle reports. Review before sharing: reports still include vehicle states and times. Nothing is uploaded automatically. Pro Power tools use saved data; the vehicle report offers one passive cloud read.';
    ['Vehicle data report', 'Pro Power raw signals', 'Copy redacted Pro Power report'].forEach(label => menu.addAction(label));
    menu.addCancelAction('Close');
    const choice = await menu.presentSheet();
    const cache = troubleshootingCache(this, prefs);
    if (choice < 0) return;
    if (choice === 0) { await this.vehicleStatusDiagnostic(prefs); continue; }
    const snapshot = ppoSnapshotFor(cache, prefs), request = cache.proPowerRequest || null;
    const report = ppoRedactedReport(snapshot, request);
    if (choice === 1) {
      const lines = ['Pro Power raw signals · last reported', 'Status result: ' + ppoCommandAge(ppoView(snapshot)),
        ppoRequestLine(request), ppoModeLine(ppoView(snapshot)),
        'Raw units, enum meanings, sample time and sentinel codes remain unverified.', ''];
      for (const key of PPO_UI_RAW_KEYS) lines.push(key + ': ' + (Object.prototype.hasOwnProperty.call(report.rawSignals, key) ? report.rawSignals[key] : 'not reported'));
      await QuickLook.present(lines.join('\n'));
    } else if (choice === 2) {
      report.reportVersion = 2;
      report.previewVersion = FORDWIDGET_PREVIEW_VERSION;
      report.refreshDiagnostics = widgetDiagnosticContext(cache);
      const text = JSON.stringify(report, null, 2);
      const review = new Alert(); review.title = 'Review redacted Pro Power report';
      review.message = text;
      review.addAction('Copy report'); review.addCancelAction('Cancel');
      const selected = await review.presentAlert(); troubleshootingCache(this, prefs);
      if (selected === 0) { Pasteboard.copyString(text); await message('Pro Power', 'Redacted report copied.'); }
    }
  }
};
