import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
export const DATA_DIR = path.join(ROOT, "data");
export const UPLOADS_DIR = path.join(ROOT, "public", "uploads");
export const VEHICLES_INDEX = path.join(DATA_DIR, "vehicles.yaml");

export function readYaml(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw);
  return parsed ?? fallback;
}

export function writeYaml(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: 100 }), "utf-8");
}

export function vehicleDir(slug) {
  return path.join(DATA_DIR, "vehicles", slug);
}

export function getVehicleSummaries() {
  return readYaml(VEHICLES_INDEX, { vehicles: [] }).vehicles ?? [];
}

export function saveVehicleSummaries(vehicles) {
  writeYaml(VEHICLES_INDEX, { vehicles });
}

export function getVehicleSummary(slug) {
  return getVehicleSummaries().find((v) => v.slug === slug);
}

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function loadVehicleFile(slug, name, fallback) {
  return readYaml(path.join(vehicleDir(slug), `${name}.yaml`), fallback);
}

export function saveVehicleFile(slug, name, data) {
  writeYaml(path.join(vehicleDir(slug), `${name}.yaml`), data);
}

export function currentMileage(slug) {
  const mileageLog = loadVehicleFile(slug, "mileage-log", { entries: [] }).entries;
  const maintenanceLog = loadVehicleFile(slug, "maintenance-log", { entries: [] }).entries;
  const candidates = [
    ...mileageLog,
    ...maintenanceLog.map((m) => ({ date: m.date, mileage: m.mileage })),
  ];
  if (candidates.length === 0) return null;
  return Math.max(...candidates.map((c) => c.mileage));
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
