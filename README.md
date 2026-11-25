# wave 1.1

**Webster Actions, Visibility & Execution**

A premium, connected business development and marketing command centre for planning, publishing, recurring execution, and progress tracking across Webster's eight growth verticals.

- Live: https://webster-wave.vercel.app
- Repository: https://github.com/vishaldudhal/webster-wave

## Included

- Visual-first Overview with a consolidated live daily snapshot, interactive focus list, weekly momentum, outcome metrics, upcoming work, and vertical balance
- Branded local workspace login, intentionally designed collapsible navigation, notifications, and profile controls
- Approved custom lowercase wave identity with its integrated sage wave symbol and subtle by Webster endorsement
- Focused Overview, Planner, and Settings navigation backed by one shared data model
- Planner-based activity search, filtering, management, and historical access without a duplicate Activities module
- Separate minimal **Plan an Activity** and **Plan Content** creation workflows
- Content lifecycle from Planned through Published, with independent status per publishing channel
- Realistic 23-activity demo workspace for new browsers plus a protected Settings loader for existing workspaces
- Synchronized monthly calendar and Monday-to-Sunday spreadsheet planner
- Channel-by-day weekly marketing board with inline titles and independent publishing status per channel
- Weekly planning fields for platform, activity type, category, topic, assignment, and details
- Weekly, monthly, and weekday-based recurring schedules with fresh occurrence progress
- Individual-occurrence and future-series editing without duplication
- Detailed activity workspace with checklists, notes, local attachments, resource links, outcomes, and history
- Central assignments plus vertical, status, and owner filtering without team logins
- Eight business development verticals with customizable checklist templates
- Capacity-aware working-day carry-forward with fixed-date and completed-work protection
- Follow-up tracking, actionable notifications, and an independent configurable daily briefing
- Categorized Settings for profile, team, templates, preferences, notifications, integrations, and data management
- Frontend-ready integration surfaces that never imply a connection before real authorization exists
- Backward-compatible version 5 migration of existing activity data
- Local browser storage with no account or backend
- Complete JSON backup and validated restore, including schedules and local attachments
- Persistent navigation, planner view, dates, filters, and activity search across browser reloads
- Responsive desktop and mobile layouts

## Architecture

- `src/store.js` owns activity persistence, migration, recurrence generation, and rescheduling.
- `src/dates.js` contains calendar and working-day calculations.
- `src/config.js` contains vertical, activity, and content templates plus planning suggestions.
- `src/main.js` renders both views against the same shared activity state.

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

WAVE stores activities, publishing targets, workspace settings, and recurring schedules in `localStorage` under the original `growth30.planner.v1` key. The version 4 schema is applied automatically without replacing old activities. Attachments are stored as browser-local data and limited to 1.5 MB per file. Use **Backup & restore** to download a complete portable JSON copy before clearing browser storage or moving to another device.
