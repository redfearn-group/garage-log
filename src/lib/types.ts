// Every field on these interfaces renders on the public site (or the CSV/
// print export) by default, since src/lib/data.ts loads YAML straight
// through with no field-level filtering. If a new field is meant to carry
// account numbers, contract details, or anything else that shouldn't be
// public, it belongs in a vehicle's gitignored private.yaml instead, not
// as a new field here. See the 2026-07-21 redaction pass (git log) for what
// this looked like getting wrong the first time.

export interface VehicleSummary {
  slug: string;
  make: string;
  model: string;
  year: number;
  nickname?: string;
  trim?: string;
  // A VIN is readable through any windshield, so it is not private and
  // renders publicly. There is deliberately no licensePlate field: a VIN
  // plus a plate together identify the owner in a way neither does alone,
  // and this type has no field-level filtering, so the only reliable way
  // to keep a plate off the public site is to give it nowhere to go.
  // Plates live in the gitignored private.yaml. Do not re-add this field.
  vin?: string;
  tireSize?: string;
  purchaseDate?: string;
  previousOwner?: string;
  // Absent means Brady owns it, which is the case for all but one. Set
  // false for a vehicle he only maintains for someone else. This drives
  // the "not owned" badge, and anything totalling cost of ownership must
  // filter on it, since money spent on someone else's car is not his.
  owned?: boolean;
  status: "active" | "archived";
  photo?: string | null;
}

export interface MileageEntry {
  date: string;
  mileage: number;
}

export interface MaintenanceEntry {
  date: string;
  mileage: number | null;
  itemType: string;
  description: string;
  notes?: string;
  documents?: string[];
}

export interface ScheduleItem {
  itemType: string;
  name: string;
  intervalMiles?: number | null;
  intervalMonths?: number | null;
}

export interface TaskItem {
  id: number;
  title: string;
  notes?: string;
  status: "open" | "done";
  priority?: "critical";
  createdDate: string;
  completedDate?: string | null;
}

export interface AdminDate {
  type: string;
  label: string;
  dueDate: string;
  notes?: string;
}

export interface DocumentEntry {
  filename: string;
  category: string;
  dateAdded: string;
  description?: string;
}

export interface RecallEntry {
  campaignNumber: string;
  component: string;
  summary: string;
  reportedDate?: string;
}

export interface RecallsData {
  lastChecked: string | null;
  recalls: RecallEntry[];
}

export interface RecallRemedy {
  campaignNumber: string;
  remediedDate: string;
  notes?: string;
}

export interface WatchListItem {
  issue: string;
  typicalMileage?: number | null;
  description: string;
  sources?: string[];
  status: "not-yet-at-mileage" | "due-for-inspection" | "inspected-ok" | "addressed";
}

export interface Vehicle extends VehicleSummary {
  mileageLog: MileageEntry[];
  maintenanceLog: MaintenanceEntry[];
  schedule: ScheduleItem[];
  tasks: TaskItem[];
  adminDates: AdminDate[];
  documents: DocumentEntry[];
  recallsData: RecallsData;
  openRecalls: RecallEntry[];
  watchList: WatchListItem[];
}

export type DueStatus = "overdue" | "due-soon" | "ok" | "never-done";

export interface ScheduleItemStatus {
  item: ScheduleItem;
  status: DueStatus;
  lastDone: MaintenanceEntry | null;
  dueMileage: number | null;
  dueDate: string | null;
}
