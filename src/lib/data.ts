import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import type {
  VehicleSummary,
  Vehicle,
  MileageEntry,
  MaintenanceEntry,
  ScheduleItem,
  TaskItem,
  AdminDate,
  DocumentEntry,
  RecallsData,
  RecallRemedy,
  WatchListItem,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), "data");

function readYaml<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw);
  return (parsed as T) ?? fallback;
}

export function getVehicleSummaries(): VehicleSummary[] {
  const indexPath = path.join(DATA_DIR, "vehicles.yaml");
  const parsed = readYaml<{ vehicles: VehicleSummary[] }>(indexPath, { vehicles: [] });
  return parsed.vehicles ?? [];
}

export function getVehicle(slug: string): Vehicle {
  const summaries = getVehicleSummaries();
  const summary = summaries.find((v) => v.slug === slug);
  if (!summary) throw new Error(`Unknown vehicle slug: ${slug}`);

  const dir = path.join(DATA_DIR, "vehicles", slug);
  const mileageLog = readYaml<{ entries: MileageEntry[] }>(
    path.join(dir, "mileage-log.yaml"),
    { entries: [] }
  ).entries;
  const maintenanceLog = readYaml<{ entries: MaintenanceEntry[] }>(
    path.join(dir, "maintenance-log.yaml"),
    { entries: [] }
  ).entries;
  const schedule = readYaml<{ items: ScheduleItem[] }>(
    path.join(dir, "schedule.yaml"),
    { items: [] }
  ).items;
  const tasks = readYaml<{ tasks: TaskItem[] }>(path.join(dir, "tasks.yaml"), {
    tasks: [],
  }).tasks;
  const adminDates = readYaml<{ dates: AdminDate[] }>(
    path.join(dir, "admin-dates.yaml"),
    { dates: [] }
  ).dates;
  const documents = readYaml<{ documents: DocumentEntry[] }>(
    path.join(dir, "documents.yaml"),
    { documents: [] }
  ).documents;
  const recallsData = readYaml<RecallsData>(path.join(dir, "recalls.yaml"), {
    lastChecked: null,
    recalls: [],
  });
  // Manually maintained, separate from recalls.yaml so the monthly NHTSA
  // auto-fetch (which overwrites recalls.yaml wholesale) never clobbers it.
  // The NHTSA API has no per-VIN remedy status, so this has to be hand-kept.
  const remedies = readYaml<{ remedies: RecallRemedy[] }>(
    path.join(dir, "recall-remedies.yaml"),
    { remedies: [] }
  ).remedies;
  const remediedCampaigns = new Set(remedies.map((r) => r.campaignNumber));
  const openRecalls = recallsData.recalls.filter(
    (r) => !remediedCampaigns.has(r.campaignNumber)
  );
  const watchList = readYaml<{ items: WatchListItem[] }>(
    path.join(dir, "watch-list.yaml"),
    { items: [] }
  ).items;

  return {
    ...summary,
    mileageLog,
    maintenanceLog,
    schedule,
    tasks,
    adminDates,
    documents,
    recallsData,
    openRecalls,
    watchList,
  };
}

export function getAllVehicles(): Vehicle[] {
  return getVehicleSummaries().map((v) => getVehicle(v.slug));
}

export function getActiveVehicles(): Vehicle[] {
  return getAllVehicles().filter((v) => v.status === "active");
}

export function getArchivedVehicles(): Vehicle[] {
  return getAllVehicles().filter((v) => v.status === "archived");
}

export function currentMileage(vehicle: Vehicle): number | null {
  const candidates: { date: string; mileage: number | null }[] = [
    ...vehicle.mileageLog,
    ...vehicle.maintenanceLog.map((m) => ({ date: m.date, mileage: m.mileage })),
  ];
  const known = candidates.filter((c) => c.mileage != null);
  if (known.length === 0) return null;
  known.sort((a, b) => (a.date < b.date ? 1 : -1));
  return known[0].mileage;
}

export function vehicleLabel(vehicle: VehicleSummary): string {
  const nickname = vehicle.nickname ? ` "${vehicle.nickname}"` : "";
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${nickname}${vehicle.trim ? " " + vehicle.trim : ""}`;
}

// Same as vehicleLabel but without trim — for tight mobile spaces (e.g. the
// dashboard's critical-items alert) where the full trim text wraps badly.
export function vehicleShortLabel(vehicle: VehicleSummary): string {
  const nickname = vehicle.nickname ? ` "${vehicle.nickname}"` : "";
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${nickname}`;
}
