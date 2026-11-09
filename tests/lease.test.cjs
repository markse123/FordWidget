'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { load, plain, TIME } = require('./scriptable.cjs');

const transports = [
  { name: 'JSON', scope: 'telemetry.mobile', headers: { Authorization: 'Bearer synthetic-access' },
    send: (auth, scope, headers) => auth.request(scope, 'https://example.test/telemetry', 'GET', null, headers) },
  { name: 'image', scope: 'photo.mobile', headers: { 'auth-token': 'synthetic-access' },
    send: (auth, scope, headers) => auth.requestImage(scope, 'https://example.test/photo', headers) }
];
function token(h) {
  h.api.secretSet('token.autonomic', { access: 'synthetic-access', refresh: null, expires: TIME + 7200000 });
}
async function foreground(h) {
  h.config.runsInApp = true; h.config.runsInWidget = false;
  const store = new h.api.LocalStore(); await store.acquire();
  return { store, auth: new h.api.FordAuthManager(store) };
}

for (const transport of transports) {
  for (const reply of [
    { name: '200 response', value: { status: 200, body: { ok: true } } },
    { name: '429 response', value: { status: 429, headers: { 'Retry-After': '60' } } },
    { name: '401 response', value: { status: 401 } },
    { name: 'transport failure', value: new Error('Synthetic transport failure') }
  ]) {
    test(`${transport.name}: a displaced background ${reply.name} preserves the foreground gate and token`, async () => {
      const h = load(), oldStore = new h.api.LocalStore();
      h.fm.createDirectory(oldStore.dir);
      h.config.runsInApp = false; h.config.runsInWidget = true;
      assert.equal(oldStore.acquireBackground(), true);
      const oldAuth = new h.api.FordAuthManager(oldStore);
      token(h);
      let finish;
      const pending = new Promise(resolve => { finish = resolve; });
      h.state.responses.push(() => pending);
      const oldRequest = transport.send(oldAuth, transport.scope, transport.headers);
      const completed = oldRequest.then(value => ({ value }), error => ({ error }));
      assert.equal(h.state.requests.length, 1);

      // Foreground acquisition legitimately supersedes a background lease.
      const current = await foreground(h);
      h.state.responses.push({ status: 429, headers: { 'Retry-After': '3600' } });
      await assert.rejects(transport.send(current.auth, transport.scope, transport.headers), /HTTP 429/);
      const gate = plain(h.api.secretGet('gate.' + transport.scope));
      assert.equal(gate.next, TIME + 3600000);
      const saved = Array.from(h.state.secrets);
      finish(reply.value);
      const outcome = await completed;

      assert.deepEqual(Array.from(h.state.secrets), saved);
      assert.deepEqual(plain(h.api.secretGet('gate.' + transport.scope)), gate);
      assert.equal(h.api.secretGet('token.autonomic').expires, TIME + 7200000);
      assert.match(outcome.error && outcome.error.message || '', /App session expired/);
      assert.equal(h.state.requests.length, 2);
      current.store.assertLease(); current.store.release();
    });
  }

  test(`${transport.name}: a displaced transport failure cannot create a new gate`, async () => {
    const h = load(), oldStore = new h.api.LocalStore();
    h.fm.createDirectory(oldStore.dir); assert.equal(oldStore.acquireBackground(), true);
    const oldAuth = new h.api.FordAuthManager(oldStore);
    let finish;
    h.state.responses.push(() => new Promise(resolve => { finish = resolve; }));
    const completed = transport.send(oldAuth, transport.scope, transport.headers).then(value => ({ value }), error => ({ error }));
    const current = await foreground(h);
    const saved = Array.from(h.state.secrets);
    finish(new Error('Synthetic transport failure'));
    const outcome = await completed;
    assert.deepEqual(Array.from(h.state.secrets), saved);
    assert.equal(h.api.secretGet('gate.' + transport.scope), null);
    assert.match(outcome.error && outcome.error.message || '', /App session expired/);
    current.store.release();
  });

  test(`${transport.name}: a current owner's successful response clears only its old gate`, async () => {
    const h = load(), current = await foreground(h);
    token(h);
    h.api.secretSet('gate.' + transport.scope, { failures: 3, next: TIME - 1 });
    h.api.secretSet('gate.unrelated', { failures: 1, next: TIME + 300000 });
    h.state.responses.push({ status: 200, body: { ok: true }, headers: { 'Content-Type': 'IMAGE/PNG' } });
    const result = await transport.send(current.auth, transport.scope, transport.headers);
    assert.equal(h.api.secretGet('gate.' + transport.scope), null);
    assert.equal(h.api.secretGet('gate.unrelated').next, TIME + 300000);
    assert.equal(h.api.secretGet('token.autonomic').expires, TIME + 7200000);
    if (transport.name === 'JSON') assert.deepEqual(plain(result), { ok: true });
    else { assert.equal(result.type, 'image/png'); assert.deepEqual(plain(result.data), { ok: true }); }
    current.store.release();
  });

  for (const status of [400, 401, 403, 429, 503]) {
    test(`${transport.name}: current HTTP ${status} retains status, retry delay and matching-token rules`, async () => {
      const h = load(), current = await foreground(h);
      token(h);
      h.api.secretSet('token.mobile', { access: 'synthetic-unrelated', expires: TIME + 7200000 });
      h.api.secretSet('gate.' + transport.scope, { failures: 2, next: TIME - 1 });
      h.state.responses.push({ status, headers: status === 429 ? { 'rEtRy-AfTeR': '3600' } : {} });
      await assert.rejects(transport.send(current.auth, transport.scope, transport.headers), error => {
        assert.equal(error.status, status); assert.match(error.message, new RegExp('HTTP ' + status)); return true;
      });
      const gate = h.api.secretGet('gate.' + transport.scope);
      const delay = status === 429 ? 3600000 : [400, 401, 403].includes(status) ? 900000 : 240000;
      assert.equal(gate.failures, 3); assert.equal(gate.next, TIME + delay);
      assert.equal(h.api.secretGet('token.autonomic').expires, status === 401 ? 0 : TIME + 7200000);
      assert.equal(h.api.secretGet('token.mobile').expires, TIME + 7200000);
      current.store.release();
    });
  }

  test(`${transport.name}: current transport failure retains the safe error and normal backoff`, async () => {
    const h = load(), current = await foreground(h);
    h.state.responses.push(new Error('Synthetic untrusted transport detail'));
    await assert.rejects(transport.send(current.auth, transport.scope, transport.headers), error => {
      assert.equal(error.status, 0); assert.match(error.message, /connection failed or timed out/);
      assert.doesNotMatch(error.message, /untrusted transport detail/); return true;
    });
    assert.deepEqual(plain(h.api.secretGet('gate.' + transport.scope)), { failures: 1, next: TIME + 60000, httpStatus: 0, failedAt: TIME });
    current.store.release();
  });
}

test('a current JSON parse failure retains the safe error and normal backoff', async () => {
  const h = load(), current = await foreground(h);
  h.state.responses.push({ status: 200, body: '{invalid' });
  await assert.rejects(current.auth.request('telemetry.mobile', 'https://example.test/telemetry'), error => {
    assert.equal(error.status, 200); assert.match(error.message, /invalid JSON response/); return true;
  });
  assert.deepEqual(plain(h.api.secretGet('gate.telemetry.mobile')), { failures: 1, next: TIME + 60000, httpStatus: 200, failedAt: TIME });
  current.store.release();
});

test('a valid current owner retains HTTP-date Retry-After behavior', async () => {
  const h = load(), current = await foreground(h);
  h.state.responses.push({ status: 429, headers: { 'Retry-After': new Date(TIME + 7200000).toUTCString() } });
  await assert.rejects(current.auth.request('telemetry.mobile', 'https://example.test/telemetry'), /HTTP 429/);
  assert.deepEqual(plain(h.api.secretGet('gate.telemetry.mobile')), { failures: 1, next: TIME + 7200000, httpStatus: 429, failedAt: TIME });
  current.store.release();
});

test('built-in offline self-test still passes', () => {
  const h = load(); h.api.selfTest();
  assert.equal(h.state.requests.length, 0);
});
