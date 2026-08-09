import type {
  Vehicle,
  MaintenanceEntry,
  ScheduleItemStatus,
  DueStatus,
} from "./types";
import { currentMileage } from "./data";
import { daysBetween, today as currentDate } from "./kit/date";
import { dateDue } from "./kit/due";

const DUE_SOON_MILES = 500;
const DUE_SOON_DAYS = 30;

/** today as YYYY-MM-DD, injectable for testing */
export function scheduleStatusesFor(
  vehicle: Vehicle,
  today: string = currentDate()
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

    // The mileage half stays here on purpose. The kit's dateDue() is shared
    // with home-log and knows nothing about odometers; the moment it does,
    // it stops being shared code.
    const dueMileage =
      item.intervalMiles != null && lastDone.mileage != null
        ? lastDone.mileage + item.intervalMiles
        : null;
    const mileageOverdue = dueMileage != null && mileageNow >= dueMileage;
    const mileageDueSoon = dueMileage != null && mileageNow >= dueMileage - DUE_SOON_MILES;

    // The date half comes from the kit.
    const byDate = dateDue({
      lastDone: lastDone.date,
      intervalMonths: item.intervalMonths,
      today,
      dueSoonDays: DUE_SOON_DAYS,
    });

    // Whichever comes first wins, and overdue on either axis suppresses
    // due-soon on both. Same precedence the mileage/date pair has always had.
    const overdue = mileageOverdue || byDate.overdue;
    const dueSoon = !overdue && (mileageDueSoon || byDate.dueSoon);

    const status: DueStatus = overdue ? "overdue" : dueSoon ? "due-soon" : "ok";

    return { item, status, lastDone, dueMileage, dueDate: byDate.dueDate };
  });
}

export function worstStatus(statuses: ScheduleItemStatus[]): DueStatus {
  if (statuses.some((s) => s.status === "overdue")) return "overdue";
  if (statuses.some((s) => s.status === "due-soon")) return "due-soon";
  if (statuses.some((s) => s.status === "never-done")) return "never-done";
  return "ok";
}

export function upcomingAdminDates(vehicle: Vehicle, today: string = currentDate()) {
  return vehicle.adminDates
    .map((d) => ({
      ...d,
      // The kit's daysBetween returns null for a date it cannot parse.
      // Coalescing to Infinity rather than 0 sorts a malformed entry to the
      // END of an upcoming list; 0 would put it at the top, reading as due
      // today.
      daysUntil: daysBetween(today, d.dueDate) ?? Number.POSITIVE_INFINITY,
    }))
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
