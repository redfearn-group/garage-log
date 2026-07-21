export interface VehicleSummary {
  slug: string;
  make: string;
  model: string;
  year: number;
  nickname?: string;
  trim?: string;
  vin?: string;
  licensePlate?: string;
  tireSize?: string;
  purchaseDate?: string;
  previousOwner?: string;
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
