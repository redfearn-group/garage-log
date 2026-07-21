import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

// Mirrors src/lib/status.ts's due-soon thresholds — keep these in sync if
// that file's DUE_SOON_MILES/DUE_SOON_DAYS ever change.
const DUE_SOON_MILES = 500;
const DUE_SOON_DAYS = 30;
const STALE_MILEAGE_DAYS = 30;

const DATA_DIR = path.resolve(process.cwd(), "data");
const today = new Date().toISOString().slice(0, 10);

function readYaml(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return yaml.load(fs.readFileSync(filePath, "utf-8")) ?? fallback;
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / msPerDay);
}

function currentMileageAndDate(vehicle) {
  const candidates = [
    ...vehicle.mileageLog.map((m) => ({ date: m.date, mileage: m.mileage })),
    ...vehicle.maintenanceLog.map((m) => ({ date: m.date, mileage: m.mileage })),
  ].filter((c) => c.mileage != null);
  if (candidates.length === 0) return { mileage: null, date: null };
  candidates.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { mileage: candidates[0].mileage, date: candidates[0].date };
}

function lastMileageLogDate(vehicle) {
  if (vehicle.mileageLog.length === 0) return null;
  return [...vehicle.mileageLog].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date;
}

function vehicleLabel(v) {
  return `${v.year} ${v.make} ${v.model}${v.nickname ? ` "${v.nickname}"` : ""}`;
}

// schedule.yaml item names carry long sourcing citations after " — "; keep
// only the short lead for a phone-readable digest (the full name with its
// citation still shows on the site itself).
function shortName(name) {
  return name.split(" — ")[0].trim();
}

const index = readYaml(path.join(DATA_DIR, "vehicles.yaml"), { vehicles: [] });
const overdue = [];
const dueSoon = [];
const staleMileage = [];
const neverLoggedCounts = new Map(); // label -> count; full item names are too numerous/noisy for a digest, many not due for years yet
const watchListDue = [];

for (const summary of index.vehicles) {
  if (summary.status !== "active") continue;
  const dir = path.join(DATA_DIR, "vehicles", summary.slug);
  const vehicle = {
    ...summary,
    mileageLog: readYaml(path.join(dir, "mileage-log.yaml"), { entries: [] }).entries,
    maintenanceLog: readYaml(path.join(dir, "maintenance-log.yaml"), { entries: [] }).entries,
    schedule: readYaml(path.join(dir, "schedule.yaml"), { items: [] }).items,
    adminDates: readYaml(path.join(dir, "admin-dates.yaml"), { dates: [] }).dates,
    watchList: readYaml(path.join(dir, "watch-list.yaml"), { items: [] }).items,
  };
  const label = vehicleLabel(vehicle);
  const { mileage: mileageNow } = currentMileageAndDate(vehicle);

  for (const item of vehicle.schedule) {
    const matching = vehicle.maintenanceLog
      .filter((e) => e.itemType === item.itemType)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const lastDone = matching[0] ?? null;
    if (!lastDone) {
      neverLoggedCounts.set(label, (neverLoggedCounts.get(label) ?? 0) + 1);
      continue;
    }

    const dueMileage =
      item.intervalMiles != null && lastDone.mileage != null ? lastDone.mileage + item.intervalMiles : null;
    const dueDate = item.intervalMonths != null ? addMonths(lastDone.date, item.intervalMonths) : null;

    const mileageOverdue = dueMileage != null && mileageNow != null && mileageNow >= dueMileage;
    const dateOverdue = dueDate != null && today >= dueDate;
    if (mileageOverdue || dateOverdue) {
      overdue.push(`${label} — ${shortName(item.name)} (last done ${lastDone.date}${lastDone.mileage != null ? ` @ ${lastDone.mileage.toLocaleString()} mi` : ""})`);
      continue;
    }
    const mileageDueSoon = dueMileage != null && mileageNow != null && mileageNow >= dueMileage - DUE_SOON_MILES;
    const dateDueSoon = dueDate != null && daysBetween(today, dueDate) <= DUE_SOON_DAYS;
    if (mileageDueSoon || dateDueSoon) {
      dueSoon.push(`${label} — ${shortName(item.name)} (due ${dueDate ?? ""}${dueMileage != null ? ` / ${dueMileage.toLocaleString()} mi` : ""})`);
    }
  }

  for (const d of vehicle.adminDates) {
    if (!d.dueDate) continue;
    const diff = daysBetween(today, d.dueDate);
    if (diff < 0) overdue.push(`${label} — ${d.label} (was due ${d.dueDate})`);
    else if (diff <= DUE_SOON_DAYS) dueSoon.push(`${label} — ${d.label} (due ${d.dueDate})`);
  }

  const lastMileageDate = lastMileageLogDate(vehicle);
  if (lastMileageDate == null || daysBetween(lastMileageDate, today) >= STALE_MILEAGE_DAYS) {
    staleMileage.push(`${label} — last mileage entry ${lastMileageDate ?? "never"}`);
  }

  // Nudge for watch-list items nobody's revisited: if an item is still
  // marked "not-yet-at-mileage" but the vehicle has actually reached (or
  // passed) its typicalMileage, that status is stale and worth flagging —
  // mirrors the "Mileage reached" badge shown on the vehicle's own page.
  for (const w of vehicle.watchList) {
    if (w.status === "not-yet-at-mileage" && w.typicalMileage != null && mileageNow != null && mileageNow >= w.typicalMileage) {
      watchListDue.push(`${label} — ${w.issue} (typical ${w.typicalMileage.toLocaleString()} mi, now at ${mileageNow.toLocaleString()} mi)`);
    }
  }
}

const lines = [];
lines.push(`Garage Log monthly check — ${today}`, "");
lines.push(`OVERDUE (${overdue.length})`);
lines.push(...(overdue.length ? overdue.map((l) => `  - ${l}`) : ["  - none"]), "");
lines.push(`DUE SOON, within ${DUE_SOON_DAYS} days/${DUE_SOON_MILES} mi (${dueSoon.length})`);
lines.push(...(dueSoon.length ? dueSoon.map((l) => `  - ${l}`) : ["  - none"]), "");
lines.push(`MILEAGE NOT LOGGED IN ${STALE_MILEAGE_DAYS}+ DAYS (${staleMileage.length})`);
lines.push(...(staleMileage.length ? staleMileage.map((l) => `  - ${l}`) : ["  - none"]), "");
const neverLoggedLines = [...neverLoggedCounts.entries()].map(([label, count]) => `${label} — ${count} schedule item${count === 1 ? "" : "s"} with no history on file (full list: https://redfearn.group/garage-log/)`);
lines.push(`NEVER LOGGED — schedule items with zero history (not necessarily due yet) (${neverLoggedLines.length} vehicle${neverLoggedLines.length === 1 ? "" : "s"} affected)`);
lines.push(...(neverLoggedLines.length ? neverLoggedLines.map((l) => `  - ${l}`) : ["  - none"]), "");
lines.push(`WATCH-LIST ITEMS AT/PAST TYPICAL MILEAGE (${watchListDue.length})`);
lines.push(...(watchListDue.length ? watchListDue.map((l) => `  - ${l}`) : ["  - none"]));

console.log(lines.join("\n"));
