#!/usr/bin/env node
// Script to process GTFS data into a compact JSON format for the webapp

const fs = require('fs');
const path = require('path');

const GTFS_DIR = path.join(__dirname, 'gtfs');

function parseCSV(filename) {
  const content = fs.readFileSync(path.join(GTFS_DIR, filename), 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

// Parse all necessary files
const stops = parseCSV('stops.txt');
const trips = parseCSV('trips.txt');
const stopTimes = parseCSV('stop_times.txt');
const calendar = parseCSV('calendar.txt');
const calendarDates = parseCSV('calendar_dates.txt');
const routes = parseCSV('routes.txt');

// Get main stations (parent stations only, excluding elevators and shuttles)
const mainStations = stops.filter(s =>
  s.location_type === '1' &&
  !s.stop_name.includes('Shuttle') &&
  !s.stop_name.includes('Elevator')
).map(s => ({
  id: s.stop_id,
  name: s.stop_name.replace(' Station', '').replace(' Caltrain', ''),
  lat: parseFloat(s.stop_lat),
  lon: parseFloat(s.stop_lon)
})).sort((a, b) => b.lat - a.lat); // Sort north to south

// Map stop_id to parent station
const stopToStation = {};
stops.forEach(s => {
  if (s.parent_station) {
    stopToStation[s.stop_id] = s.parent_station;
  }
});

// Map trip_id to service info
const tripInfo = {};
trips.forEach(t => {
  tripInfo[t.trip_id] = {
    serviceId: t.service_id,
    direction: parseInt(t.direction_id), // 0 = northbound, 1 = southbound
    headsign: t.trip_headsign,
    routeId: t.route_id,
    trainNum: t.trip_short_name
  };
});

// Map route_id to route type
const routeInfo = {};
routes.forEach(r => {
  routeInfo[r.route_id] = {
    name: r.route_short_name,
    color: r.route_color
  };
});

// Build service calendar
const services = {};
calendar.forEach(c => {
  services[c.service_id] = {
    weekday: c.monday === '1',
    weekend: c.saturday === '1',
    startDate: c.start_date,
    endDate: c.end_date
  };
});

// Holiday exceptions
const holidays = {};
calendarDates.forEach(cd => {
  if (!holidays[cd.date]) holidays[cd.date] = {};
  holidays[cd.date][cd.service_id] = {
    type: parseInt(cd.exception_type), // 1 = added, 2 = removed
    name: cd.holiday_name
  };
});

// Build schedule: station -> direction -> [{time, trainNum, routeType, serviceType}]
const schedule = {};

stopTimes.forEach(st => {
  const trip = tripInfo[st.trip_id];
  if (!trip) return;

  const stationId = stopToStation[st.stop_id];
  if (!stationId) return;

  const direction = trip.direction === 0 ? 'northbound' : 'southbound';
  const service = services[trip.serviceId];
  const serviceType = service?.weekday ? 'weekday' : (service?.weekend ? 'weekend' : 'holiday');

  if (!schedule[stationId]) schedule[stationId] = { northbound: [], southbound: [] };

  // Parse time (HH:MM:SS)
  const [h, m] = st.departure_time.split(':').map(Number);
  const minutes = h * 60 + m;

  schedule[stationId][direction].push({
    t: minutes, // minutes since midnight
    n: trip.trainNum,
    r: routeInfo[trip.routeId]?.name || 'Local',
    s: serviceType,
    h: trip.headsign
  });
});

// Sort schedules by time and dedupe
Object.keys(schedule).forEach(stationId => {
  ['northbound', 'southbound'].forEach(dir => {
    schedule[stationId][dir] = schedule[stationId][dir]
      .sort((a, b) => a.t - b.t)
      .filter((item, idx, arr) =>
        idx === 0 || item.t !== arr[idx-1].t || item.n !== arr[idx-1].n
      );
  });
});

// Build station order (for determining valid destinations)
const stationOrder = mainStations.map(s => s.id);

// Compact the schedule - only keep times as array of [minutes, trainNum, routeType(0=local,1=limited,2=express), serviceType(0=weekday,1=weekend)]
const routeTypeMap = { 'Local Weekday': 0, 'Local Weekend': 0, 'Local': 0, 'Limited': 1, 'Express': 2, 'South County': 3 };
const compactSchedule = {};

Object.keys(schedule).forEach(stationId => {
  compactSchedule[stationId] = {
    n: schedule[stationId].northbound.map(t => [
      t.t,
      t.n,
      routeTypeMap[t.r] ?? 0,
      t.s === 'weekday' ? 0 : 1
    ]),
    s: schedule[stationId].southbound.map(t => [
      t.t,
      t.n,
      routeTypeMap[t.r] ?? 0,
      t.s === 'weekday' ? 0 : 1
    ])
  };
});

// Compact holidays - just date -> weekend service flag
const compactHolidays = {};
Object.keys(holidays).forEach(date => {
  // If weekday service is removed on this date, it's a holiday
  const hasWeekdayRemoved = Object.values(holidays[date]).some(h => h.type === 2);
  if (hasWeekdayRemoved) {
    compactHolidays[date] = true;
  }
});

// Output data
const data = {
  stations: mainStations.map(s => ({ id: s.id, name: s.name })),
  schedule: compactSchedule,
  holidays: compactHolidays,
  validFrom: calendar[0]?.start_date,
  validTo: calendar[0]?.end_date
};

// Write to file
fs.writeFileSync(
  path.join(__dirname, 'schedule-data.json'),
  JSON.stringify(data, null, 2)
);

// Also write a minified version for production
fs.writeFileSync(
  path.join(__dirname, 'schedule-data.min.json'),
  JSON.stringify(data)
);

console.log('Generated schedule data:');
console.log(`- ${mainStations.length} stations`);
console.log(`- Valid from ${data.validFrom} to ${data.validTo}`);
console.log(`- ${Object.keys(compactHolidays).length} holiday exceptions`);
console.log(`- Minified size: ${(fs.statSync(path.join(__dirname, 'schedule-data.min.json')).size / 1024).toFixed(1)} KB`);
