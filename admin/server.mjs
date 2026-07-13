import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import {
  DATA_DIR,
  PRIVATE_UPLOADS_DIR,
  vehicleDir,
  getVehicleSummaries,
  saveVehicleSummaries,
  getVehicleSummary,
  slugify,
  loadVehicleFile,
  saveVehicleFile,
  currentMileage,
  escapeHtml,
  readYaml,
} from "./lib.mjs";
import { layout, msgFromQuery } from "./views.mjs";

const PORT = process.env.PORT || 4322;
const app = express();
app.use(express.urlencoded({ extended: true }));

function redirect(res, url, text, type = "success") {
  res.redirect(`${url}?msg=${encodeURIComponent(text)}&type=${type}`);
}

// ---------- Home ----------

app.get("/", (req, res) => {
  const vehicles = getVehicleSummaries();
  const active = vehicles.filter((v) => v.status === "active");
  const archived = vehicles.filter((v) => v.status === "archived");

  const renderList = (list) =>
    list.length
      ? `<div class="vehicle-list">${list
          .map(
            (v) =>
              `<a href="/vehicles/${v.slug}">${v.year} ${escapeHtml(v.make)} ${escapeHtml(v.model)}${
                v.trim ? " " + escapeHtml(v.trim) : ""
              } <span class="muted">— ${currentMileage(v.slug)?.toLocaleString() ?? "no mileage yet"}</span></a>`
          )
          .join("")}</div>`
      : `<p class="muted">None yet.</p>`;

  const body = `
    <h2>Vehicles</h2>
    ${renderList(active)}
    <p><a href="/vehicles/new"><button>+ Add vehicle</button></a></p>

    ${archived.length ? `<h3>Archived</h3>${renderList(archived)}` : ""}

    <p class="muted" style="margin-top:2rem;">
      When you're done making changes, run <code>npm run publish</code> in a terminal to review the diff and push to GitHub.
    </p>
  `;
  res.send(layout("Vehicles", body, msgFromQuery(req.query)));
});

// ---------- Add vehicle ----------

app.get("/vehicles/new", (req, res) => {
  const body = `
    <h2>Add a vehicle</h2>
    <form method="post" action="/vehicles/new">
      <fieldset>
        <legend>Basics</legend>
        <div class="row">
          <div><label>Year *<input name="year" type="number" required /></label></div>
          <div><label>Make *<input name="make" required /></label></div>
          <div><label>Model *<input name="model" required /></label></div>
        </div>
        <label>Nickname<input name="nickname" placeholder="e.g. Hera" /></label>
        <label>Trim<input name="trim" /></label>
        <label>VIN<input name="vin" /></label>
        <label>License plate<input name="licensePlate" placeholder="e.g. [PLATE-REDACTED]" /></label>
        <label>Tire size (currently mounted)<input name="tireSize" placeholder="e.g. 275/65R18" /></label>
        <label>Purchase date<input name="purchaseDate" type="date" /></label>
        <label>Previous owner / purchase notes<textarea name="previousOwner" rows="2"></textarea></label>
      </fieldset>
      <button type="submit">Create vehicle</button>
    </form>
    <p><a href="/">← Back</a></p>
  `;
  res.send(layout("Add vehicle", body, msgFromQuery(req.query)));
});

app.post("/vehicles/new", (req, res) => {
  const { year, make, model, nickname, trim, vin, licensePlate, tireSize, purchaseDate, previousOwner } = req.body;
  if (!year || !make || !model) {
    return redirect(res, "/vehicles/new", "Year, make, and model are required.", "error");
  }

  const vehicles = getVehicleSummaries();
  let baseSlug = slugify(`${year}-${make}-${model}`);
  let slug = baseSlug;
  let n = 2;
  while (vehicles.some((v) => v.slug === slug)) {
    slug = `${baseSlug}-${n++}`;
  }

  vehicles.push({
    slug,
    make,
    model,
    year: Number(year),
    nickname: nickname || undefined,
    trim: trim || undefined,
    vin: vin || undefined,
    licensePlate: licensePlate || undefined,
    tireSize: tireSize || undefined,
    purchaseDate: purchaseDate || undefined,
    previousOwner: previousOwner || undefined,
    status: "active",
    photo: null,
  });
  saveVehicleSummaries(vehicles);

  const scheduleTemplate = readYaml(path.join(DATA_DIR, "schedule-template.yaml"), { items: [] });
  saveVehicleFile(slug, "mileage-log", { entries: [] });
  saveVehicleFile(slug, "maintenance-log", { entries: [] });
  saveVehicleFile(slug, "schedule", scheduleTemplate);
  saveVehicleFile(slug, "tasks", { tasks: [] });
  saveVehicleFile(slug, "admin-dates", { dates: [] });
  saveVehicleFile(slug, "documents", { documents: [] });
  saveVehicleFile(slug, "recalls", { lastChecked: null, recalls: [], complaints: [] });
  saveVehicleFile(slug, "watch-list", { items: [] });
  saveVehicleFile(slug, "private", { notes: [] });

  redirect(res, `/vehicles/${slug}`, "Vehicle created with a starter maintenance schedule — customize it below.");
});

// ---------- Vehicle admin page ----------

function requireVehicle(req, res, next) {
  const summary = getVehicleSummary(req.params.slug);
  if (!summary) return res.status(404).send("Vehicle not found");
  req.vehicleSummary = summary;
  next();
}

app.get("/vehicles/:slug", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const v = req.vehicleSummary;
  const mileageLog = loadVehicleFile(slug, "mileage-log", { entries: [] }).entries;
  const maintenanceLog = loadVehicleFile(slug, "maintenance-log", { entries: [] }).entries;
  const schedule = loadVehicleFile(slug, "schedule", { items: [] }).items;
  const tasks = loadVehicleFile(slug, "tasks", { tasks: [] }).tasks;
  const adminDates = loadVehicleFile(slug, "admin-dates", { dates: [] }).dates;
  const documents = loadVehicleFile(slug, "documents", { documents: [] }).documents;
  const watchList = loadVehicleFile(slug, "watch-list", { items: [] }).items;
  const privateNotes = loadVehicleFile(slug, "private", { notes: [] }).notes;
  const mileage = currentMileage(slug);

  const itemTypeOptions = schedule
    .map((s) => `<option value="${escapeHtml(s.itemType)}">${escapeHtml(s.name)}</option>`)
    .join("");

  const body = `
    <p><a href="/">← All vehicles</a> · <a href="http://localhost:4321/vehicles/${slug}" target="_blank">View on site ↗</a></p>
    <h2>${v.year} ${escapeHtml(v.make)} ${escapeHtml(v.model)}${v.trim ? " " + escapeHtml(v.trim) : ""}</h2>
    <p class="muted">VIN: ${escapeHtml(v.vin) || "—"} · Plate: ${escapeHtml(v.licensePlate) || "—"} · Tires: ${escapeHtml(v.tireSize) || "—"} · Current mileage: ${mileage?.toLocaleString() ?? "—"} · Status: ${v.status}</p>

    <fieldset>
      <legend>Log mileage</legend>
      <form method="post" action="/vehicles/${slug}/mileage">
        <div class="row">
          <label>Date *<input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label>Odometer *<input name="mileage" type="number" required /></label>
        </div>
        <button type="submit">Add reading</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Log maintenance / oil change</legend>
      <form method="post" action="/vehicles/${slug}/maintenance">
        <div class="row">
          <label>Date *<input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}" /></label>
          <label>Odometer *<input name="mileage" type="number" required /></label>
        </div>
        <label>Schedule item (matches it to the maintenance schedule)
          <select name="itemType">
            <option value="">— not on schedule / one-off —</option>
            ${itemTypeOptions}
          </select>
        </label>
        <label>Description *<input name="description" required placeholder="e.g. Full synthetic oil change & filter" /></label>
        <label>Notes<textarea name="notes" rows="2"></textarea></label>
        <button type="submit">Add service record</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Maintenance schedule</legend>
      <table>
        <tr><th>Item</th><th>Interval (mi)</th><th>Interval (mo)</th></tr>
        ${schedule
          .map(
            (s) =>
              `<tr><td>${escapeHtml(s.name)}</td><td>${s.intervalMiles ?? "—"}</td><td>${s.intervalMonths ?? "—"}</td></tr>`
          )
          .join("")}
      </table>
      <form method="post" action="/vehicles/${slug}/schedule">
        <div class="row">
          <label>Item name *<input name="name" required /></label>
          <label>Interval, miles<input name="intervalMiles" type="number" /></label>
          <label>Interval, months<input name="intervalMonths" type="number" /></label>
        </div>
        <button type="submit">Add schedule item</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Tasks</legend>
      <table>
        ${tasks
          .map(
            (t) => `<tr>
              <td>${t.status === "done" ? "☑" : "☐"} ${escapeHtml(t.title)}</td>
              <td>${
                t.status === "open"
                  ? `<form method="post" action="/vehicles/${slug}/tasks/${t.id}/complete" style="margin:0;"><button type="submit">Mark done</button></form>`
                  : `<span class="muted">done</span>`
              }</td>
            </tr>`
          )
          .join("")}
      </table>
      <form method="post" action="/vehicles/${slug}/tasks">
        <label>New task *<input name="title" required /></label>
        <label>Notes<input name="notes" /></label>
        <button type="submit">Add task</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Upload document</legend>
      <p class="muted">🔒 Uploaded files are stored in the private <code>garage-log-private</code> repo, not the public site — only a filename/category/date summary appears publicly. Still avoid door/lock codes; use "Private notes" below for those (no online backup at all).</p>
      <form method="post" action="/vehicles/${slug}/documents" enctype="multipart/form-data">
        <label>File *<input name="file" type="file" required /></label>
        <label>Category *
          <select name="category" required>
            <option value="carfax">Carfax report</option>
            <option value="recall-verification">Recall verification</option>
            <option value="previous-owner-info">Previous owner info</option>
            <option value="registration">Registration</option>
            <option value="insurance">Insurance</option>
            <option value="warranty">Warranty</option>
            <option value="repair-invoice">Repair invoice</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Description<input name="description" /></label>
        <button type="submit">Upload</button>
      </form>
      <table>
        ${documents
          .map(
            (d) =>
              `<tr><td>${escapeHtml(d.filename)}</td><td class="muted">${escapeHtml(d.category)}</td><td class="muted">${escapeHtml(d.dateAdded)}</td></tr>`
          )
          .join("")}
      </table>
    </fieldset>

    <fieldset>
      <legend>Admin dates (insurance, registration, etc.)</legend>
      <table>
        ${adminDates
          .map(
            (d) => `<tr><td>${escapeHtml(d.label)}</td><td>${escapeHtml(d.dueDate)}</td></tr>`
          )
          .join("")}
      </table>
      <form method="post" action="/vehicles/${slug}/admin-dates">
        <div class="row">
          <label>Label *<input name="label" required placeholder="e.g. Auto insurance renewal" /></label>
          <label>Due date *<input name="dueDate" type="date" required /></label>
        </div>
        <label>Notes<input name="notes" /></label>
        <button type="submit">Add date</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Watch list (known problem areas)</legend>
      <table>
        ${watchList
          .map(
            (w) =>
              `<tr><td>${escapeHtml(w.issue)}</td><td class="muted">${w.typicalMileage ?? "—"} mi</td><td class="muted">${escapeHtml(w.status)}</td></tr>`
          )
          .join("")}
      </table>
      <form method="post" action="/vehicles/${slug}/watch-list">
        <label>Issue *<input name="issue" required /></label>
        <label>Typical mileage<input name="typicalMileage" type="number" /></label>
        <label>Description<textarea name="description" rows="2"></textarea></label>
        <button type="submit">Add watch item</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>🔒 Private notes (this computer only — never committed or published)</legend>
      <p class="muted">Door/lock codes, mechanic or insurance-adjuster contact info, policy numbers, anything you wouldn't want public. Stored in a file this app excludes from git, so it's never pushed and never appears on the public site.</p>
      <p class="muted">⚠️ Because this file is never committed, it has no online backup — if this computer is lost or wiped, these notes go with it. Also save anything you add here to <a href="https://keep.google.com" target="_blank">Google Keep</a> (or another notes app) so there's a backup copy that isn't just local.</p>
      <table>
        ${privateNotes
          .map(
            (n) => `<tr><td>${escapeHtml(n.label)}</td><td>${escapeHtml(n.value)}</td></tr>`
          )
          .join("")}
      </table>
      <form method="post" action="/vehicles/${slug}/private-notes">
        <div class="row">
          <label>Label *<input name="label" required placeholder="e.g. Door code" /></label>
          <label>Value *<input name="value" required /></label>
        </div>
        <button type="submit">Add private note</button>
      </form>
    </fieldset>

    <fieldset>
      <legend>Danger zone</legend>
      ${
        v.status === "active"
          ? `<form method="post" action="/vehicles/${slug}/archive" onsubmit="return confirm('Archive this vehicle? It will be hidden from the active dashboard but all history is kept.');">
              <button type="submit" class="danger">Archive (sold / retired)</button>
            </form>`
          : `<p class="muted">This vehicle is archived.</p>
             <form method="post" action="/vehicles/${slug}/unarchive"><button type="submit">Restore to active</button></form>`
      }
    </fieldset>
  `;
  res.send(layout(`${v.year} ${v.make} ${v.model}`, body, msgFromQuery(req.query)));
});

// ---------- Mileage ----------

app.post("/vehicles/:slug/mileage", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { date, mileage } = req.body;
  const mileageNum = Number(mileage);
  if (!date || !mileage || Number.isNaN(mileageNum)) {
    return redirect(res, `/vehicles/${slug}`, "Date and a numeric mileage are required.", "error");
  }
  const existingMax = currentMileage(slug);
  if (existingMax != null && mileageNum < existingMax) {
    return redirect(
      res,
      `/vehicles/${slug}`,
      `Mileage ${mileageNum.toLocaleString()} is less than the current known mileage of ${existingMax.toLocaleString()} — check the number.`,
      "error"
    );
  }
  const data = loadVehicleFile(slug, "mileage-log", { entries: [] });
  data.entries.push({ date, mileage: mileageNum });
  saveVehicleFile(slug, "mileage-log", data);
  redirect(res, `/vehicles/${slug}`, "Mileage reading added.");
});

// ---------- Maintenance ----------

app.post("/vehicles/:slug/maintenance", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { date, mileage, itemType, description, notes } = req.body;
  const mileageNum = Number(mileage);
  if (!date || !mileage || Number.isNaN(mileageNum) || !description) {
    return redirect(res, `/vehicles/${slug}`, "Date, mileage, and description are required.", "error");
  }
  const data = loadVehicleFile(slug, "maintenance-log", { entries: [] });
  data.entries.push({
    date,
    mileage: mileageNum,
    itemType: itemType || slugify(description),
    description,
    notes: notes || "",
    documents: [],
  });
  saveVehicleFile(slug, "maintenance-log", data);
  redirect(res, `/vehicles/${slug}`, "Service record added.");
});

// ---------- Schedule ----------

app.post("/vehicles/:slug/schedule", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { name, intervalMiles, intervalMonths } = req.body;
  if (!name || (!intervalMiles && !intervalMonths)) {
    return redirect(res, `/vehicles/${slug}`, "Name and at least one interval (miles or months) are required.", "error");
  }
  const data = loadVehicleFile(slug, "schedule", { items: [] });
  data.items.push({
    itemType: slugify(name),
    name,
    intervalMiles: intervalMiles ? Number(intervalMiles) : null,
    intervalMonths: intervalMonths ? Number(intervalMonths) : null,
  });
  saveVehicleFile(slug, "schedule", data);
  redirect(res, `/vehicles/${slug}`, "Schedule item added.");
});

// ---------- Tasks ----------

app.post("/vehicles/:slug/tasks", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { title, notes } = req.body;
  if (!title) return redirect(res, `/vehicles/${slug}`, "Task title is required.", "error");
  const data = loadVehicleFile(slug, "tasks", { tasks: [] });
  const nextId = data.tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  data.tasks.push({
    id: nextId,
    title,
    notes: notes || "",
    status: "open",
    createdDate: new Date().toISOString().slice(0, 10),
    completedDate: null,
  });
  saveVehicleFile(slug, "tasks", data);
  redirect(res, `/vehicles/${slug}`, "Task added.");
});

app.post("/vehicles/:slug/tasks/:id/complete", requireVehicle, (req, res) => {
  const { slug, id } = req.params;
  const data = loadVehicleFile(slug, "tasks", { tasks: [] });
  const task = data.tasks.find((t) => String(t.id) === id);
  if (task) {
    task.status = "done";
    task.completedDate = new Date().toISOString().slice(0, 10);
    saveVehicleFile(slug, "tasks", data);
  }
  redirect(res, `/vehicles/${slug}`, "Task marked done.");
});

// ---------- Admin dates ----------

app.post("/vehicles/:slug/admin-dates", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { label, dueDate, notes } = req.body;
  if (!label || !dueDate) {
    return redirect(res, `/vehicles/${slug}`, "Label and due date are required.", "error");
  }
  const data = loadVehicleFile(slug, "admin-dates", { dates: [] });
  data.dates.push({ type: slugify(label), label, dueDate, notes: notes || "" });
  saveVehicleFile(slug, "admin-dates", data);
  redirect(res, `/vehicles/${slug}`, "Admin date added.");
});

// ---------- Watch list ----------

app.post("/vehicles/:slug/watch-list", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { issue, typicalMileage, description } = req.body;
  if (!issue) return redirect(res, `/vehicles/${slug}`, "Issue name is required.", "error");
  const data = loadVehicleFile(slug, "watch-list", { items: [] });
  data.items.push({
    issue,
    typicalMileage: typicalMileage ? Number(typicalMileage) : null,
    description: description || "",
    sources: [],
    status: "not-yet-at-mileage",
  });
  saveVehicleFile(slug, "watch-list", data);
  redirect(res, `/vehicles/${slug}`, "Watch list item added.");
});

// ---------- Private notes (gitignored — never committed, never rendered on the public site) ----------

app.post("/vehicles/:slug/private-notes", requireVehicle, (req, res) => {
  const { slug } = req.params;
  const { label, value } = req.body;
  if (!label || !value) return redirect(res, `/vehicles/${slug}`, "Label and value are required.", "error");
  const data = loadVehicleFile(slug, "private", { notes: [] });
  data.notes.push({ label, value });
  saveVehicleFile(slug, "private", data);
  redirect(res, `/vehicles/${slug}`, "Private note saved (local only).");
});

// ---------- Documents ----------

// Buffer the upload in memory rather than streaming straight to disk: with
// multipart/form-data, fields are only guaranteed parsed in the order they
// appear in the request, so a disk-storage destination() callback can run
// before req.body.category is populated (silently mis-filing the document).
// Writing the file ourselves after multer finishes means req.body is complete.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.post("/vehicles/:slug/documents", requireVehicle, upload.single("file"), (req, res) => {
  const { slug } = req.params;
  const { category, description } = req.body;
  if (!req.file) return redirect(res, `/vehicles/${slug}`, "Choose a file to upload.", "error");

  const categorySlug = slugify(category || "other");
  const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const filename = `${Date.now()}-${safeName}`;
  const dest = path.join(PRIVATE_UPLOADS_DIR, slug, categorySlug);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, filename), req.file.buffer);

  const data = loadVehicleFile(slug, "documents", { documents: [] });
  data.documents.push({
    filename,
    category: categorySlug,
    dateAdded: new Date().toISOString().slice(0, 10),
    description: description || "",
  });
  saveVehicleFile(slug, "documents", data);
  redirect(res, `/vehicles/${slug}`, "Document uploaded.");
});

// ---------- Archive ----------

app.post("/vehicles/:slug/archive", requireVehicle, (req, res) => {
  const vehicles = getVehicleSummaries();
  const v = vehicles.find((v) => v.slug === req.params.slug);
  v.status = "archived";
  saveVehicleSummaries(vehicles);
  redirect(res, `/vehicles/${req.params.slug}`, "Vehicle archived.");
});

app.post("/vehicles/:slug/unarchive", requireVehicle, (req, res) => {
  const vehicles = getVehicleSummaries();
  const v = vehicles.find((v) => v.slug === req.params.slug);
  v.status = "active";
  saveVehicleSummaries(vehicles);
  redirect(res, `/vehicles/${req.params.slug}`, "Vehicle restored to active.");
});

app.listen(PORT, () => {
  console.log(`Garage Log admin running at http://localhost:${PORT}`);
});
