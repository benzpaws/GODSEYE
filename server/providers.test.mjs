import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAIS, providerTime, validBoxes } from './providers.mjs';

test('provider timestamp parsing is UTC and invalid timestamps are rejected', () => {
  assert.equal(providerTime('2026-09-24 12:30:00 UTC'), Date.parse('2026-09-24T12:30:00Z') / 1000);
  assert.ok(Number.isNaN(providerTime('not a timestamp')));
});

test('AIS position is normalized and receipt time is used when metadata has no timestamp', () => {
  const now = 1790253000;
  const v = normalizeAIS({
    MessageType: 'PositionReport',
    MetaData: { MMSI: 368207620, ShipName: 'TEST VESSEL', Latitude: 25.7, Longitude: -80.1 },
    Message: { PositionReport: { UserID: 368207620, Valid: true, Latitude: 25.7, Longitude: -80.1, Sog: 12.4, Cog: 86.7, TrueHeading: 87 } },
  }, now);
  assert.equal(v.name, 'TEST VESSEL');
  assert.equal(v.observedAt, now);
  assert.equal(v.speed, 12.4);
});

test('invalid AIS coordinates and malformed bounding boxes are rejected', () => {
  assert.equal(normalizeAIS({MessageType:'PositionReport',MetaData:{MMSI:'123456789',Latitude:99,Longitude:0},Message:{PositionReport:{Valid:true}}}, 100), null);
  assert.deepEqual(validBoxes('[[[40,27],[47,42]]]'), [[[40,27],[47,42]]]);
  assert.throws(() => validBoxes('[[[100,27],[47,42]]]'));
});
