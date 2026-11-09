// New settings dialogs may outlive their foreground session while awaiting UI.
function saveVehiclePreferences(store, prefs) {
  requireApp(); store.assertLease();
  const current = secretGet('vehicle');
  if (!current || !prefs || current.vin !== prefs.vin)
    throw new Error('The configured vehicle changed. Run the script again.');
  secretSet('vehicle', prefs);
  if (!parkedLocationEnabled(prefs)) store.purgeLocation();
}
