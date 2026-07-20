# Garage Log

A maintenance tracker for a small fleet of real vehicles, built as a static site with version-controlled data instead of a database.

**Live:** [redfearn.group/garage-log](https://redfearn.group/garage-log/)

## What it does

Five vehicles, tracked against maintenance schedules sourced from actual owner's manuals and warranty guides rather than generic dealer intervals. Every schedule item carries its citation inline, so the reasoning behind a due date is still visible a year later, not just the number.

- **Due-status dashboard** — each vehicle's schedule is checked against logged mileage and dates, and flagged overdue, due soon, or on track, whichever comes first between mileage and time.
- **Recall tracking** — pulled live from the NHTSA API by VIN, refreshed automatically on a schedule.
- **Full maintenance history** — every oil change, part, and repair, with mileage interpolated from surrounding odometer readings when an exact reading isn't on file.
- **Admin app** — a local-only Express app (`npm run admin`) for day-to-day data entry, so nobody has to hand-edit YAML to log an oil change.

## Architecture

No database. Vehicle data lives as YAML files committed directly to this repo, which means git history doubles as a free audit trail: every correction, every backfilled record, every re-sourced interval is a diff you can go back and read.

```
data/vehicles.yaml              # index of all vehicles
data/vehicles/<slug>/
  schedule.yaml                 # cited maintenance intervals
  maintenance-log.yaml          # service history
  mileage-log.yaml              # odometer readings
  tasks.yaml                    # open to-dos per vehicle
  recalls.yaml                  # NHTSA recall data
  private.yaml                  # gitignored — door codes, policy numbers, anything that shouldn't be public
```

The site itself is pure Astro with no UI framework and no database driver — `src/lib/` reads the YAML at build time and every page is static HTML. The only thing that writes data is the local admin app; the deployed site is read-only.

```
src/
  pages/            # dashboard, per-vehicle detail pages, archive
  components/       # shared UI (StatusBadge, etc.)
  layouts/          # page shell
  lib/              # data loading, due-status logic, types
  styles/           # design tokens + shared CSS
admin/              # local-only Express app for data entry (never deployed)
scripts/            # recall-check + publish automation
```

Deployed via GitHub Actions to GitHub Pages on every push to `main`. A second, private sibling repo holds uploaded documents (titles, invoices, service records) — this repo's `documents.yaml` only ever stores metadata, never the files themselves.

## Development

```sh
npm install
npm run dev      # local dev server at localhost:4321
npm run admin    # local data-entry app
npm run build    # static build to ./dist/
```

| Script | What it does |
| :--- | :--- |
| `npm run dev` | Astro dev server |
| `npm run admin` | Local-only Express app for editing vehicle data |
| `npm run build` | Production build to `./dist/` |
| `npm run check-recalls` | Refresh recall data from the NHTSA API |
| `npm run publish` | Push data changes to both this repo and the private documents repo |
