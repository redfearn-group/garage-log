import type {
  Vehicle,
  MaintenanceEntry,
  ScheduleItemStatus,
  DueStatus,
} from "./types";
import { currentMileage } from "./data";

const DUE_SOON_MILES = 500;
const DUE_SOON_DAYS = 30;

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / msPerDay);
}

/** today as YYYY-MM-DD, injectable for testing */
export function scheduleStatusesFor(
  vehicle: Vehicle,
  today: string = new Date().toISOString().slice(0, 10)
): ScheduleItemStatus[] {
  const mileageNow = currentMileage(vehicle) ?? 0;

  return vehicle.schedule.map((item) => {
    const matching = vehicle.maintenanceLog
      .filter((e) => e.itemType === item.itemType)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const lastDone: MaintenanceEntry | null = matching[0] ?? null;

    if (!lastDone) {
      return {
        item,
        status: "never-done" as DueStatus,
        lastDone: null,
        dueMileage: null,
        dueDate: null,
      };
    }

    const dueMileage =
      item.intervalMiles != null && lastDone.mileage != null
        ? lastDone.mileage + item.intervalMiles
        : null;
    const dueDate =
      item.intervalMonths != null ? addMonths(lastDone.date, item.intervalMonths) : null;

    let overdue = false;
    let dueSoon = false;

    if (dueMileage != null && mileageNow >= dueMileage) overdue = true;
    if (dueDate != null && today >= dueDate) overdue = true;

    if (!overdue) {
      if (dueMileage != null && mileageNow >= dueMileage - DUE_SOON_MILES) dueSoon = true;
      if (dueDate != null && daysBetween(today, dueDate) <= DUE_SOON_DAYS) dueSoon = true;
    }

    const status: DueStatus = overdue ? "overdue" : dueSoon ? "due-soon" : "ok";

    return { item, status, lastDone, dueMileage, dueDate };
  });
}

export function worstStatus(statuses: ScheduleItemStatus[]): DueStatus {
  if (statuses.some((s) => s.status === "overdue")) return "overdue";
  if (statuses.some((s) => s.status === "due-soon")) return "due-soon";
  if (statuses.some((s) => s.status === "never-done")) return "never-done";
  return "ok";
}

export function upcomingAdminDates(vehicle: Vehicle, today: string = new Date().toISOString().slice(0, 10)) {
  return vehicle.adminDates
    .map((d) => ({ ...d, daysUntil: daysBetween(today, d.dueDate) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// schedule.yaml item names carry a long sourcing citation after " — " (owner's
// manual references, forum corroboration, correction history) that's valuable
// on the full vehicle page but too long for a dashboard tag or table row on a
// phone. Split it off so callers can show the short lead and, where there's
// room, the full citation behind a tap.
export function splitScheduleItemName(name: string): { short: string; citation: string | null } {
  const idx = name.indexOf(" — ");
  if (idx === -1) return { short: name, citation: null };
  return { short: name.slice(0, idx), citation: name.slice(idx + 3) };
}

export function currentMileageAtOrAbove(mileageNow: number | null, typicalMileage: number | null | undefined): boolean {
  return mileageNow != null && typicalMileage != null && mileageNow >= typicalMileage;
}
