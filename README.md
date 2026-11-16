# 30-Day Growth Planner

A focused, browser-based calendar for planning and tracking business development and marketing actions over a rolling 30-day period.

- Live: https://30-day-growth-planner.vercel.app
- Repository: https://github.com/vishaldudhal/30-day-growth-planner

## Included

- Rolling 30-day calendar with start-date control
- Today and selected-date states
- Activity indicators and progress states
- Eight business development verticals
- Ready-made, editable checklist templates
- Add, edit, complete, and delete activity flows
- Automatic carry-forward of unfinished work to the next working day
- Fixed-date event support
- In-browser 10:00 AM daily reminder
- Local browser storage with no account or backend
- Responsive desktop and mobile layouts

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The deployable output is generated in `dist/`.

## Data model

The planner stores activities in `localStorage` under `growth30.planner.v1`. Data stays in the current browser and device. Clearing browser storage removes the plan.
