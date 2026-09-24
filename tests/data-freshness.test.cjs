const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function aircraftModule(fetchImpl) {
  const context = vm.createContext({
    CONFIG: {
      proxy: 'https://proxy.invalid/?', opensky: 'https://opensky.invalid/states',
      maxAircraft: 100, aircraftMaxAgeSeconds: 120,
      militaryPrefixes: ['RCH'], adsbExchangeKey: '',
    },
    fetch: fetchImpl, AbortSignal, console,
  });
  vm.runInContext(fs.readFileSync('src/aircraft.js', 'utf8') + '\nthis.module = Aircraft;', context);
  return context.module;
}

function state(icao, observed, callsign = 'TEST1') {
  const s = Array(17).fill(null);
  s[0] = icao; s[1] = callsign; s[3] = observed;
  s[5] = 20; s[6] = 10;
  return s;
}

test('aircraft show recent observed positions only and do not infer military from ICAO prefix', async () => {
  const now = Math.floor(Date.now() / 1000);
  const mod = aircraftModule(async () => ({ ok: true, json: async () => ({ states: [
    state('ae1234', now - 10), state('abc123', now - 200),
    state('def456', now - 20, 'RCH123'), state('ghi789', now + 300),
  ] }) }));
  assert.equal(await mod.fetch(), true);
  assert.equal(mod.list.length, 2);
  assert.equal(mod.list[0].icao24, 'ae1234');
  assert.equal(mod.list[0].military, false);
  assert.equal(mod.list[1].classification, 'callsign hint');
  assert.equal(mod.list[0].time_position, now - 10);
});

test('failed refresh clears previous aircraft snapshot', async () => {
  const now = Math.floor(Date.now() / 1000);
  let fail = false;
  const mod = aircraftModule(async () => {
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => ({ states: [state('abc123', now)] }) };
  });
  assert.equal(await mod.fetch(), true);
  assert.equal(mod.list.length, 1);
  fail = true;
  assert.equal(await mod.fetch(), false);
  assert.equal(mod.list.length, 0);
});

test('missing optional military key makes no provider request', async () => {
  let calls = 0;
  const mod = aircraftModule(async () => { calls++; throw new Error('unexpected request'); });
  assert.equal(await mod.fetchMilitary(), 0);
  assert.equal(calls, 0);
});

test('satellite outage never propagates the bundled outdated sample', async () => {
  const context = vm.createContext({
    CONFIG: { tleGroups: [], fallbackTLE: 'OLD SAMPLE' },
    satellite: {}, console, AbortSignal,
  });
  vm.runInContext(fs.readFileSync('src/satellites.js', 'utf8') + '\nthis.module = Satellites;', context);
  const result = await context.module.fetchAll();
  assert.equal(result.fallback, true);
  assert.equal(result.sats.length, 0);
});

test('provider text is escaped before insertion into HTML', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync('src/utils.js', 'utf8') + '\nthis.module = Utils;', context);
  assert.equal(context.module.escapeHTML('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
