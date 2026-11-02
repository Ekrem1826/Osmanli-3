import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSeededRandom,
  getPeninsulaElevation,
  isPeninsulaLand,
  SEVEN_HILLS,
  LANDMARKS,
  GUIDED_TOUR_KEYFRAMES,
  evaluateTourAtTime,
  HISTORICAL_REGIONS,
  findRegionAtPoint,
  resolveNpcCollision,
  HISTORICAL_QUESTS,
  createBoxAABB,
  resolveCircleAABB,
  resolveMultiAABBCollisions,
  clipCameraSegmentAgainstAABBs,
  sanitizeFlyTarget,
  solveTwoBoneFootIK,
  computeIstanbulPrayerTimes,
  getNextPrayerStatus,
  RULERS_AND_VIZIERS,
  getHistoricalFigureSchedule,
  ISTANBUL_QIBLA_RAD,
  convertPdfScaleMeasurement,
  PDF_1546_NAHIYELER,
} from './worldLogic';

test('seeded PRNG produces identical deterministic sequence', () => {
  const rng1 = createSeededRandom(1453);
  const rng2 = createSeededRandom(1453);
  for (let i = 0; i < 20; i++) {
    assert.equal(rng1(), rng2());
  }
});

test('Seven Hills (Yedi Tepe) stand elevated above sea level and water is negative', () => {
  assert.equal(SEVEN_HILLS.length, 7);
  for (const hill of SEVEN_HILLS) {
    const elev = getPeninsulaElevation(hill.x, hill.z);
    assert.ok(elev > 12, `${hill.name} should be elevated (>12m), got ${elev}`);
    assert.equal(isPeninsulaLand(hill.x, hill.z), true, `${hill.name} must be on peninsula land`);
  }
  const halicElev = getPeninsulaElevation(0, -165);
  assert.ok(halicElev < 0, `Golden Horn channel should be underwater (<0), got ${halicElev}`);
  const marmaraElev = getPeninsulaElevation(100, 320);
  assert.ok(marmaraElev < 0, `Marmara Sea should be underwater (<0), got ${marmaraElev}`);
});

test('all 14 required Mekânlar landmarks exist with valid Turkish certainty levels and interior types', () => {
  assert.equal(LANDMARKS.length, 14);
  const validCertainty = new Set(['Belgeli', 'Kısmen belgeli', 'Varsayımsal yeniden kurgu']);
  for (const lm of LANDMARKS) {
    assert.ok(lm.name.length > 3);
    assert.ok(lm.description.length > 40);
    assert.ok(validCertainty.has(lm.certainty), `Invalid certainty on ${lm.id}: ${lm.certainty}`);
  }
  const fatih = LANDMARKS.find((l) => l.id === 'fatih-camii');
  assert.ok(fatih);
  assert.equal(fatih.certainty, 'Varsayımsal yeniden kurgu');
  assert.equal(fatih.periodTag, '1451-1481');
});

test('9 historical regions cover the peninsula and resolve points accurately', () => {
  assert.equal(HISTORICAL_REGIONS.length, 9);
  const topkapiReg = findRegionAtPoint(355, -10);
  assert.equal(topkapiReg.id, 'topkapi-bolgesi');
  const fatihReg = findRegionAtPoint(-125, -45);
  assert.equal(fatihReg.id, 'fatih-bolgesi');
  const edirneReg = findRegionAtPoint(-440, -98);
  assert.equal(edirneReg.id, 'edirnekapi-bolgesi');
});

test('NPC collision avoidance separates overlapping agents so they do not pass through each other', () => {
  const [nx, nz] = resolveNpcCollision(10.0, 10.0, 10.5, 10.0, 1.8);
  const newDist = Math.hypot(nx - 10.5, nz - 10.0);
  assert.ok(newDist > 0.5, `Expected collision separation to push agent away, got dist=${newDist}`);
});

test('5 historical quests cover all requested open-world quest archetypes', () => {
  assert.equal(HISTORICAL_QUESTS.length, 5);
  const types = new Set(HISTORICAL_QUESTS.map((q) => q.type));
  assert.ok(types.has('lost_item'));
  assert.ok(types.has('escort'));
  assert.ok(types.has('explore'));
  assert.ok(types.has('history'));
  assert.ok(types.has('buy_item'));
});

test('guided tour covers at least 3 minutes (180s) and transitions time of day and seasons', () => {
  const lastFrame = GUIDED_TOUR_KEYFRAMES[GUIDED_TOUR_KEYFRAMES.length - 1];
  assert.ok(lastFrame.timeSec >= 180, 'Tour must be at least 180 seconds');
  const startState = evaluateTourAtTime(0);
  const midState = evaluateTourAtTime(90);
  const endState = evaluateTourAtTime(180);
  assert.equal(startState.progress, 0);
  assert.equal(endState.progress, 1);
  assert.notEqual(startState.season, endState.season);
  assert.ok(endState.timeOfDay > midState.timeOfDay);
});

test('AABB building collision pushes player out of rectangular footprint along minimum penetration axis', () => {
  const ayaBox = createBoxAABB(305, 32, 29, 25, 'ayasofya-nave');
  const radius = 0.8;

  const westHit = resolveCircleAABB(290.1, 32, radius, ayaBox);
  assert.equal(westHit.collided, true);
  assert.ok(Math.abs(westHit.x - (290.5 - radius)) < 1e-4, `Expected pushed to ${290.5 - radius}, got ${westHit.x}`);
  assert.equal(westHit.z, 32);

  const insideHit = resolveCircleAABB(305, 20.2, radius, ayaBox);
  assert.equal(insideHit.collided, true);
  assert.ok(Math.abs(insideHit.z - (19.5 - radius)) < 1e-4);

  const wallA = createBoxAABB(0, -10, 20, 2);
  const wallB = createBoxAABB(-10, 0, 2, 20);
  const cornerRes = resolveMultiAABBCollisions(-9.2, -9.2, 0.8, [wallA, wallB], 3);
  assert.ok(cornerRes.hitCount >= 1);
  assert.ok(cornerRes.x >= -9.0 + 0.79 || cornerRes.z >= -9.0 + 0.79);
});

test('camera ray slab intersection clips 3rd-person camera before entering building AABB', () => {
  const wall = createBoxAABB(0, 5, 16, 2, 'wall');
  const clipRes = clipCameraSegmentAgainstAABBs(0, 0, 0, 12, [wall], 0.4);
  assert.equal(clipRes.clipped, true);
  assert.ok(clipRes.z < 4.0, `Camera Z should be pulled in front of wall (z < 4.0), got ${clipRes.z}`);
});

test('sanitizeFlyTarget safely clamps above terrain and falls back to aerial view on NaN/null', () => {
  const badRes = sanitizeFlyTarget([NaN, 10, 20], [10, 20, 30], 15, 15);
  assert.equal(badRes.valid, false);
  assert.equal(badRes.usedFallback, true);
  assert.ok(badRes.targetPos[1] > 200);

  const lowRes = sanitizeFlyTarget([100, 2, 20], [15, -20, 15], 25, 28);
  assert.equal(lowRes.valid, true);
  assert.ok(lowRes.targetLook[1] >= 26.5, 'Look Y must be clamped above terrain');
  assert.ok(lowRes.targetPos[1] >= 32.0, 'Camera Y must be clamped above terrain');
});

test('analytic two-bone foot IK bends knee, lowers pelvis on slopes, and scales stride uphill/downhill', () => {
  const flatIK = solveTwoBoneFootIK(0.7, 0.36, 0.34, 0.0, 0.0, 0.0, 0.0, 1.0, 10);
  assert.equal(flatIK.ikWeight, 1);
  assert.equal(flatIK.pelvisDrop, 0);
  assert.equal(flatIK.strideScale, 1);

  const uphillIK = solveTwoBoneFootIK(0.7, 0.36, 0.34, 0.18, 0.0, 0.35, 0.1, 1.2, 12);
  assert.ok(uphillIK.kneeFlex > flatIK.kneeFlex, 'Knee should flex more when foot is raised on slope');
  assert.ok(uphillIK.pelvisDrop > 0, 'Pelvis should lower toward lower foot on slope');
  assert.ok(uphillIK.strideScale < 1.0, 'Stride should shorten uphill');
  assert.ok(uphillIK.torsoLeanX > 0, 'Torso should lean forward uphill');

  const downhillIK = solveTwoBoneFootIK(0.7, 0.36, 0.34, 0.0, 0.15, -0.3, 0.0, 1.0, 12);
  assert.ok(downhillIK.strideScale > 1.0, 'Stride should widen downhill');

  const farIK = solveTwoBoneFootIK(0.7, 0.36, 0.34, 0.18, 0.0, 0.35, 0.1, 1.2, 95);
  assert.equal(farIK.ikWeight, 0, 'IK weight should fade to 0 at far LOD distances');
});

test('Istanbul 5 daily prayer times and active prayer stages compute accurately', () => {
  const summer = computeIstanbulPrayerTimes('Yaz');
  const winter = computeIstanbulPrayerTimes('Kış');
  assert.ok(summer.imsak < winter.imsak, 'Summer Fajr/İmsak is earlier than winter');
  assert.ok(summer.aksam > winter.aksam, 'Summer Maghrib/Akşam is later than winter');

  // During Öğle prayer window in Summer (~13.25)
  const ogleStatus = getNextPrayerStatus(13.22, 'Yaz', true);
  assert.equal(ogleStatus.ezanActive, true);
  assert.equal(ogleStatus.congregationActive, true);
  assert.equal(ogleStatus.activePrayerName, 'Öğle (Cuma)');
  assert.notEqual(ogleStatus.prayerStage, 'none');
});

test('Rulers and Viziers schedule system provides live Şimdi activities and accurate Qibla/Divan orientations', () => {
  assert.equal(RULERS_AND_VIZIERS.length, 12);
  const suleymanMorningPrayer = getHistoricalFigureSchedule('kanuni-suleyman', 5.2, false);
  assert.ok(suleymanMorningPrayer.activityText.startsWith('Şimdi:'));
  assert.equal(suleymanMorningPrayer.pose, 'pray');
  assert.equal(suleymanMorningPrayer.facingYawRad, ISTANBUL_QIBLA_RAD);

  const rustemDivan = getHistoricalFigureSchedule('rustem-pasa', 9.0, false);
  assert.equal(rustemDivan.isIndoors, true);
  assert.equal(rustemDivan.pose, 'sit');
  assert.equal(rustemDivan.facingYawRad, 0);
});

test('PDF architectural scale converter and 1546 13-Nahiye table match PDF reference specifications', () => {
  // Süleymaniye dome height 53 m -> 2.65 cm (1:2000), 10.6 cm (1:500), 26.5 cm (1:200)
  const sulDome = convertPdfScaleMeasurement(53);
  assert.equal(sulDome.scale1to2000Cm, 2.65);
  assert.equal(sulDome.scale1to500Cm, 10.6);
  assert.equal(sulDome.scale1to200Cm, 26.5);

  // 16th-century Ottoman Başoda 4.5 m -> 22.5 cm at 1:20 scale
  const basoda = convertPdfScaleMeasurement(4.5);
  assert.equal(basoda.scale1to20Cm, 22.5);

  assert.equal(PDF_1546_NAHIYELER.length, 13);
  const totalMahalle = PDF_1546_NAHIYELER.reduce((acc, n) => acc + n.mahalleCount, 0);
  assert.equal(totalMahalle, 219);
});



