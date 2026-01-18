#!/usr/bin/env node
/**
 * Unit tests for Caltrain Quick
 * Run with: node tests.js
 */

const assert = require('assert');

// ============================================================================
// Extract pure functions from index.html for testing
// ============================================================================

// Format minutes to time string (handles times past midnight)
function formatTime(minutes) {
  let h = Math.floor(minutes / 60) % 24;  // Wrap to 0-23 for times past midnight
  const m = minutes % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')}${ampm}`;
}

// Get current minutes since midnight (or since previous midnight for late-night)
// GTFS service day runs ~4am to ~3am next day
function getCurrentMinutes(hoursOverride = null, minutesOverride = null) {
  const now = new Date();
  const hours = hoursOverride !== null ? hoursOverride : now.getHours();
  const mins = minutesOverride !== null ? minutesOverride : now.getMinutes();
  const totalMins = hours * 60 + mins;
  // Before 3am, add 24 hours to treat as previous day's late-night service
  return totalMins < 180 ? totalMins + 24 * 60 : totalMins;
}

// Get service type based on date and holidays
// Returns: 'weekday', 'weekend', or 'modified'
function getServiceType(date, holidays = {}) {
  let now = new Date(date);

  // Before 3am, use previous day's service type
  if (now.getHours() < 3) {
    now = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const day = now.getDay();

  // Check holidays first (1=weekend schedule, 2=modified schedule)
  const holidayType = holidays[dateStr];
  if (holidayType === 2) {
    return 'modified';
  }
  if (holidayType === 1) {
    return 'weekend';
  }

  // Weekend
  if (day === 0 || day === 6) {
    return 'weekend';
  }

  return 'weekday';
}

// Filter trains that stop at both origin and destination
function filterTrainsByDestination(originTrains, destTrains, serviceFilter, currentMinutes) {
  const endOfDay = 24 * 60 + 120; // Until 2am

  // Get set of train numbers that stop at destination
  const destTrainNums = new Set(
    destTrains
      .filter(t => t[3] === serviceFilter)
      .map(t => t[1])
  );

  // Filter origin trains
  return originTrains.filter(t => {
    const [time, trainNum, , svc] = t;
    return svc === serviceFilter &&
           time >= currentMinutes &&
           time <= endOfDay &&
           destTrainNums.has(trainNum);
  });
}

// ============================================================================
// Test Runner
// ============================================================================

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${name}`);
    console.log(`  ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${msg ? ': ' + msg : ''}`);
  }
}

function assertArrayEqual(actual, expected, msg = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${msg ? ': ' + msg : ''}`);
  }
}

// ============================================================================
// Tests
// ============================================================================

console.log('\n=== formatTime tests ===\n');

test('formatTime: morning time 5:10am', () => {
  assertEqual(formatTime(310), '5:10am');
});

test('formatTime: noon 12:00pm', () => {
  assertEqual(formatTime(720), '12:00pm');
});

test('formatTime: afternoon 3:45pm', () => {
  assertEqual(formatTime(945), '3:45pm');
});

test('formatTime: midnight as 12:00am', () => {
  assertEqual(formatTime(0), '12:00am');
});

test('formatTime: 11:59pm', () => {
  assertEqual(formatTime(1439), '11:59pm');
});

test('formatTime: past midnight 12:14am (stored as 24:14 = 1454)', () => {
  assertEqual(formatTime(1454), '12:14am');
});

test('formatTime: past midnight 12:54am (stored as 24:54 = 1494)', () => {
  assertEqual(formatTime(1494), '12:54am');
});

test('formatTime: past midnight 1:30am (stored as 25:30 = 1530)', () => {
  assertEqual(formatTime(1530), '1:30am');
});

test('formatTime: single digit minutes padded', () => {
  assertEqual(formatTime(301), '5:01am');
});

console.log('\n=== getCurrentMinutes tests ===\n');

test('getCurrentMinutes: 10:30am returns 630', () => {
  assertEqual(getCurrentMinutes(10, 30), 630);
});

test('getCurrentMinutes: 11:56pm returns 1436', () => {
  assertEqual(getCurrentMinutes(23, 56), 1436);
});

test('getCurrentMinutes: 12:04am (after midnight) returns 1444 (previous day late-night)', () => {
  assertEqual(getCurrentMinutes(0, 4), 1444);
});

test('getCurrentMinutes: 1:30am returns 1530 (previous day late-night)', () => {
  assertEqual(getCurrentMinutes(1, 30), 1530);
});

test('getCurrentMinutes: 2:59am returns 1619 (still previous day)', () => {
  assertEqual(getCurrentMinutes(2, 59), 1619);
});

test('getCurrentMinutes: 3:00am returns 180 (new service day)', () => {
  assertEqual(getCurrentMinutes(3, 0), 180);
});

test('getCurrentMinutes: 4:00am returns 240', () => {
  assertEqual(getCurrentMinutes(4, 0), 240);
});

console.log('\n=== getServiceType tests ===\n');

const testHolidays = {
  '20260119': 2,  // MLK Day - modified
  '20260101': 1,  // New Year's Day - weekend schedule
  '20251225': 1,  // Christmas - weekend schedule
  '20251224': 2,  // Christmas Eve - modified
};

test('getServiceType: regular Monday is weekday', () => {
  assertEqual(getServiceType('2026-01-12T10:00:00', testHolidays), 'weekday');
});

test('getServiceType: Saturday is weekend', () => {
  assertEqual(getServiceType('2026-01-17T10:00:00', testHolidays), 'weekend');
});

test('getServiceType: Sunday is weekend', () => {
  assertEqual(getServiceType('2026-01-18T10:00:00', testHolidays), 'weekend');
});

test('getServiceType: MLK Day (Monday holiday) is modified', () => {
  assertEqual(getServiceType('2026-01-19T10:00:00', testHolidays), 'modified');
});

test('getServiceType: New Year\'s Day is weekend (holiday override)', () => {
  assertEqual(getServiceType('2026-01-01T10:00:00', testHolidays), 'weekend');
});

test('getServiceType: Christmas Eve is modified', () => {
  assertEqual(getServiceType('2025-12-24T10:00:00', testHolidays), 'modified');
});

test('getServiceType: 1am Sunday uses Saturday service (before 3am rule)', () => {
  // 1am Sunday Jan 18 should use Saturday Jan 17's service type
  assertEqual(getServiceType('2026-01-18T01:00:00', testHolidays), 'weekend');
});

test('getServiceType: 1am Monday uses Sunday service (before 3am rule)', () => {
  // 1am Monday Jan 19 (MLK Day) should use Sunday Jan 18's service type
  // Sunday is weekend, not MLK Day's modified
  assertEqual(getServiceType('2026-01-19T01:00:00', testHolidays), 'weekend');
});

test('getServiceType: 4am Monday MLK Day uses modified', () => {
  assertEqual(getServiceType('2026-01-19T04:00:00', testHolidays), 'modified');
});

console.log('\n=== filterTrainsByDestination tests ===\n');

// Sample train data: [time, trainNum, routeType, serviceType]
// serviceType: 0=weekday, 1=weekend, 2=modified
const sampleOriginTrains = [
  [310, '101', 0, 0],   // 5:10am weekday
  [344, '102', 0, 0],   // 5:44am weekday
  [400, '201', 0, 1],   // 6:40am weekend
  [450, '202', 0, 1],   // 7:30am weekend
  [500, 'M101', 0, 2],  // 8:20am modified
  [1454, '664', 0, 1],  // 12:14am (next day) weekend
];

const sampleDestTrains = [
  [330, '101', 0, 0],   // Train 101 stops here
  [420, '201', 0, 1],   // Train 201 stops here
  [520, 'M101', 0, 2],  // Train M101 stops here
  [1474, '664', 0, 1],  // Train 664 stops here
  // Note: 102, 202 do NOT stop at destination (express?)
];

test('filterTrainsByDestination: weekday service filters correctly', () => {
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 0, 300);
  assertEqual(result.length, 1);
  assertEqual(result[0][1], '101');
});

test('filterTrainsByDestination: weekend service filters correctly', () => {
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 1, 300);
  assertEqual(result.length, 2);
  assertEqual(result[0][1], '201');
  assertEqual(result[1][1], '664');
});

test('filterTrainsByDestination: modified service filters correctly', () => {
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 2, 300);
  assertEqual(result.length, 1);
  assertEqual(result[0][1], 'M101');
});

test('filterTrainsByDestination: respects currentMinutes filter', () => {
  // After 6:40am, should not include 201
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 1, 410);
  assertEqual(result.length, 1);
  assertEqual(result[0][1], '664');
});

test('filterTrainsByDestination: excludes trains not stopping at destination', () => {
  // Train 102 departs origin but doesn't stop at destination
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 0, 300);
  const trainNums = result.map(t => t[1]);
  assertEqual(trainNums.includes('102'), false);
});

test('filterTrainsByDestination: late-night train included when currentMinutes > 1440', () => {
  // At 12:04am (1444 mins in service-day time), train 664 at 1454 should show
  const result = filterTrainsByDestination(sampleOriginTrains, sampleDestTrains, 1, 1444);
  assertEqual(result.length, 1);
  assertEqual(result[0][1], '664');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('');

process.exit(failed > 0 ? 1 : 0);
