# habit-tracker

Habit Tracker with Calendar Heatmap.

A small React + TypeScript web app. Add habits, tick them off each day, and see the last six months as a GitHub-style heatmap. Data is saved in your browser's local storage.

## Features

- Add and delete habits
- Mark today done with one click, or click any heatmap cell to fix past days
- Current streak, longest streak and total completions per habit
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
