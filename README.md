# Caltrain Quick

A fast, mobile-friendly PWA for looking up Caltrain schedules. Designed for quick access from your phone's home screen.

**Live app:** https://ss-naiv.github.io/caltrain-quick/

## Features

- **Auto-detects weekday/weekend** - Shows the correct schedule based on the current day (including holidays)
- **Saves your home station** - Remembers your preferred departure station
- **Favorite destinations** - Quick-access buttons for your last 5 searched destinations
- **Collapsible train buckets** - Next trains always visible, "Later" and "Rest of day" expandable
- **Train types** - Color-coded: Local (gray), Limited (teal), Express (red)
- **Return trip lookup** - Swap button to quickly check trains back home
- **Auto-refresh** - Train list updates every 60 seconds
- **Works offline** - Service worker caches the app after first load

## Installation (iPhone)

1. Open https://ss-naiv.github.io/caltrain-quick/ in Safari
2. Tap the Share button (box with arrow)
3. Scroll down and tap "Add to Home Screen"
4. The app will appear as "Caltrain" on your home screen

## Usage

### Basic lookup
1. Set your home station (first time only)
2. Choose direction: North (SF) or South (SJ)
3. Select a destination
4. View upcoming trains:
   - **Next trains** - First 6 departures, always visible
   - **Later** - Next 6 trains, tap to expand (shows time range)
   - **Rest of day** - Remaining trains, tap to expand

### Check return trains
1. After selecting a destination, tap the **swap button** (circular icon between From/To)
2. A yellow banner shows "Showing return trains"
3. View trains from your destination back to your home station
4. Tap "Back to home" to reset, or just refresh the page

### Change settings
- **Change home station:** Tap "Change home station" link at bottom of page

## Schedule Updates

The app uses embedded schedule data from Caltrain's official GTFS feed.

### Automatic updates
A GitHub Action runs every Monday to check for new schedule data and auto-deploys if changes are found.

### Manual update
To manually trigger a schedule update:
1. Go to [GitHub Actions](https://github.com/ss-naiv/caltrain-quick/actions)
2. Click "Update Caltrain Schedule" workflow
3. Click "Run workflow" button

### Local update (for developers)
```bash
cd caltrain-quick
curl -sL "https://data.trilliumtransit.com/gtfs/caltrain-ca-us/caltrain-ca-us.zip" -o caltrain-gtfs.zip
unzip -o caltrain-gtfs.zip -d gtfs
node process-gtfs.js
git add schedule-data.min.json
git commit -m "Update schedule data"
git push
# Then update gh-pages branch
git checkout gh-pages
git checkout main -- schedule-data.min.json
git commit -m "Deploy updated schedule"
git push
git checkout main
```

## Schedule expiry warning

A red banner appears at the top of the app when the schedule is within 14 days of expiration, reminding you to check for updates.

## Data source

Schedule data comes from Caltrain's official GTFS feed:
- Source: https://www.caltrain.com/developer-resources
- GTFS download: https://data.trilliumtransit.com/gtfs/caltrain-ca-us/caltrain-ca-us.zip

## Tech stack

- Single HTML file with inline CSS/JS
- No build step required
- PWA with service worker for offline support
- Hosted on GitHub Pages
