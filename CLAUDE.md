# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repo is one of several siblings under `C:\Claude Code`. **The workspace-level `C:\Claude Code\CLAUDE.md` covers the shared brand system, the public/private split, and the voice rules, which all apply here too.** Read it as well. This file covers what is specific to garage-log.

## What this is

A maintenance tracker for a fleet of real vehicles, deployed as a static site at `https://redfearn.group/garage-log/`. Public repo. The sibling private repo `garage-log-private` holds the scanned source documents.

## Commands

```sh
npm run build            # static build to ./dist/, and the only validity check (no test suite)
npm run publish          # interactive: shows the diff, confirms, commits, pushes private repo then public
npm run check-recalls    # refresh NHTSA recall data into data/vehicles/*/recalls.yaml
npm run monthly-digest   # summary of what is due across the fleet
```

For a dev server use `preview_start` with the `garage-log` entry in `.claude/launch.json` (port 4321), not `npm run dev`. The site is served under its base path, so browse `http://localhost:4321/garage-log/`, not the bare origin.

## Architecture

Vehicle data is YAML committed to the repo. There is no database and no write path in the deployed site. `src/lib/data.ts` reads the YAML at build time and every page is static HTML. Git history is the audit trail, which is why corrections should be real commits with a clear message rather than quiet edits.

```
data/vehicles.yaml              # index; slug must match the folder name
data/vehicles/<slug>/
  schedule.yaml                 # intervals, each name carrying its sourcing citation
  maintenance-log.yaml          # service history
  mileage-log.yaml              # odometer readings
  tasks.yaml  admin-dates.yaml  documents.yaml  watch-list.yaml
  recalls.yaml                  # auto-fetched from NHTSA, overwritten wholesale
  recall-remedies.yaml          # hand-maintained, never auto-written
  private.yaml                  # gitignored
```

### Status is a join on `itemType`

`src/lib/status.ts` computes due status by matching each `schedule.yaml` item's `itemType` against `maintenance-log.yaml` entries carrying the **same** `itemType`. A log entry with an accurate `description` but a missing or wrong `itemType` is invisible to the schedule table, and the item keeps showing as never done. When recording that something was serviced, add a properly tagged entry. Appending prose to an existing entry does not count.

Status is whichever comes first, mileage or date: `DUE_SOON_MILES` 500, `DUE_SOON_DAYS` 30. `scripts/monthly-digest.mjs` duplicates both constants, so change them together.

Schedule `name` fields carry a long citation after `" — "`, and `splitScheduleItemName()` splits on that exact separator to show the short label with the citation behind a disclosure. **That em-dash is structural.** Prose em-dashes elsewhere are prohibited by the voice rules.

### Recalls: two files on purpose

NHTSA's API lists every campaign issued for a make/model/year but cannot say whether a specific VIN was actually repaired. Only the one-VIN-at-a-time form on nhtsa.gov can, and it has no API.

So `recalls.yaml` is auto-fetched and overwritten monthly by a GitHub Action, while `recall-remedies.yaml` is hand-maintained per vehicle and lists the campaigns confirmed fixed. `getVehicle()` subtracts one from the other to produce `openRecalls`, which is what the site renders. Keeping them in separate files is what stops the monthly refresh from destroying manually verified remedy status.

Building a .gov scraper or buying a third-party VIN recall API was considered and rejected on 2026-07-10. The reasoning is inline at the top of `scripts/check-recalls.mjs`. Do not "fix" this without asking.

Known API quirks, already handled in that script: the recalls endpoint 400s on a model name containing a space (strip them, so "ES 300h" becomes "ES300h"), and the complaints endpoint is unreliable for very high-volume vehicles. Both fail without corrupting existing data.

### Everything on the type renders publicly

`data.ts` loads YAML straight through with no field-level filtering, so every field on the interfaces in `src/lib/types.ts` reaches the public site and the CSV/print export. VINs, plates, purchase prices, financing terms, lender and dealer names, and third-party contact details live in the gitignored `private.yaml` instead. A new field carrying that kind of data belongs there, not on the type. The 2026-07-18 redaction pass in git log is what this looked like getting wrong the first time.

## Data conventions

- Dates render as `DD MMM YYYY` via `src/lib/kit/date.ts`. Store them as `YYYY-MM-DD` in YAML.
- Mileage for an entry whose exact odometer reading is unknown is interpolated linearly between surrounding known readings. Say so in the notes and treat it as approximate.
- Watch-list items with `status: addressed` are filtered out of the vehicle page, since they already appear in the maintenance log.
