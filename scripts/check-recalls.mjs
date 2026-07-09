// Monthly (via GitHub Actions cron) NHTSA recall + complaint check for every
// active vehicle. Recalls are the reliable, high-confidence source; the
// complaints endpoint has proven flaky (times out under load as of testing),
// so it's fetched best-effort and never blocks recall data from saving.
import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

function readYaml(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return yaml.load(fs.readFileSync(filePath, "utf-8")) ?? fallback;
}

function writeYaml(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: 100 }), "utf-8");
}

async function fetchJson(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function checkVehicle(summary) {
  const { slug, make, model, year } = summary;
  const params = new URLSearchParams({ make, model, modelYear: String(year) });
  const recallsFile = path.join(DATA_DIR, "vehicles", slug, "recalls.yaml");
  const existing = readYaml(recallsFile, { lastChecked: null, recalls: [], complaints: [] });

  let recalls = existing.recalls;
  let recallsOk = false;
  try {
    const data = await fetchJson(`https://api.nhtsa.gov/recalls/recallsByVehicle?${params}`);
    recalls = (data.results ?? []).map((r) => ({
      campaignNumber: r.NHTSACampaignNumber,
      component: r.Component,
      summary: r.Summary,
      reportedDate: r.ReportReceivedDate,
    }));
    recallsOk = true;
  } catch (err) {
    console.error(`[${slug}] recalls check failed, keeping previous data:`, err.message);
  }

  let complaints = existing.complaints;
  try {
    const data = await fetchJson(`https://api.nhtsa.gov/complaints/complaintsByVehicle?${params}`);
    complaints = (data.results ?? []).slice(0, 20).map((c) => ({
      component: c.components,
      summary: c.summary,
      dateReceived: c.dateComplaintFiled,
    }));
  } catch (err) {
    console.error(`[${slug}] complaints check failed (known-flaky NHTSA endpoint), keeping previous data:`, err.message);
  }

  writeYaml(recallsFile, {
    // Only bump lastChecked when the primary (recalls) source actually
    // succeeded — otherwise this would misleadingly claim stale fallback
    // data is current.
    lastChecked: recallsOk ? new Date().toISOString().slice(0, 10) : existing.lastChecked,
    recalls,
    complaints,
  });
  console.log(`[${slug}] ${recalls.length} recall(s), ${complaints.length} complaint(s) on file.`);
}

const vehicles = readYaml(path.join(DATA_DIR, "vehicles.yaml"), { vehicles: [] }).vehicles;
const active = vehicles.filter((v) => v.status === "active" && v.make && v.model && v.year);

for (const v of active) {
  await checkVehicle(v);
}
