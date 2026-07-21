// Monthly (via GitHub Actions cron) NHTSA recall check for every active
// vehicle. Only official recalls are fetched/shown — owner complaints were
// deliberately dropped 2026-07-21: unverified anecdotes, several graphic,
// and the main thing bloating the mobile page. See README for the reasoning.
//
// Deliberately NOT included: VIN-specific recall completion status (open vs.
// already-fixed on a particular car). The recallsByVehicle API used below
// only returns campaigns ever issued for a make/model/year, not per-VIN
// completion — that only exists as a one-VIN-at-a-time web form at
// nhtsa.gov/recalls with no public API or bulk-data feed behind it.
// Automating it would mean scraping a .gov webpage (fragile, unlike every
// other data source this app uses) or paying for a third-party VIN recall
// API. Decided 2026-07-10: leave this as a manual, occasional check rather
// than build either. Don't "fix" this without asking first.
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
  const recallsFile = path.join(DATA_DIR, "vehicles", slug, "recalls.yaml");
  const existing = readYaml(recallsFile, { lastChecked: null, recalls: [] });

  // The recalls endpoint 400s on a model name containing a space (e.g. "ES
  // 300h") — strip spaces for the query, confirmed same result set as the
  // full name.
  const recallParams = new URLSearchParams({
    make,
    model: model.replace(/\s+/g, ""),
    modelYear: String(year),
  });

  let recalls = existing.recalls;
  let recallsOk = false;
  try {
    const data = await fetchJson(`https://api.nhtsa.gov/recalls/recallsByVehicle?${recallParams}`);
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

  writeYaml(recallsFile, {
    // Only bump lastChecked when the check actually succeeded — otherwise
    // this would misleadingly claim stale fallback data is current.
    lastChecked: recallsOk ? new Date().toISOString().slice(0, 10) : existing.lastChecked,
    recalls,
  });
  console.log(`[${slug}] ${recalls.length} recall(s) on file.`);
}

const vehicles = readYaml(path.join(DATA_DIR, "vehicles.yaml"), { vehicles: [] }).vehicles;
const active = vehicles.filter((v) => v.status === "active" && v.make && v.model && v.year);

for (const v of active) {
  await checkVehicle(v);
}
