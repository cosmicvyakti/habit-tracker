# habit-tracker

Habit Tracker with daily, weekly, monthly and yearly streaks.

A small React + TypeScript web app. Add habits that repeat daily, weekly, monthly or yearly, tick them off, and build streaks. Data is saved in your browser's local storage.

## Features

- Add and delete habits, each with its own frequency: daily, weekly, monthly or yearly
- Mark the current day, week, month or year done with one click
- A row of recent periods on each habit, so you can fix past check-ins
- Current streak, longest streak and total completions, counted in the habit's own unit
- Dark theme modelled on OpenRouter, with a lime accent and a monospace font

## Live app

https://cosmicvyakti.github.io/habit-tracker/

Every push to `main` runs the tests, builds the app and deploys it to GitHub Pages.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run unit tests
npm run build    # type-check and build to dist/
```
