# Webster WAVE

**Webster Actions, Visibility & Execution**

A calendar-focused business development command centre for planning, assigning, and executing Webster's growth activity over a rolling 30-day period.

- Live: https://webster-wave.vercel.app
- Repository: https://github.com/vishaldudhal/webster-wave

## Included

- Daily command overview for today's work, pending items, follow-ups, and completions
- Rolling 30-day calendar with activity counts, priority signals, progress, and carry-forward states
- Detailed activity workspace with dynamic checklists, notes, resources, progress, and history
- Central owner assignments and owner filtering without team logins
- Eight customizable business development checklist templates
- Automatic working-day carry-forward with fixed-date support
- Follow-up tracking and priority-aware 10:00 AM morning briefing
- Backward-compatible migration of existing activity data
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

WAVE stores activities in `localStorage` under the original `growth30.planner.v1` key to preserve existing browser data. The current schema is applied automatically without replacing old activities. Data stays in the current browser and device. Clearing browser storage removes the plan.
