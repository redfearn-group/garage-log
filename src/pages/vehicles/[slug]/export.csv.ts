import type { APIRoute } from "astro";
import { getVehicleSummaries, getVehicle, vehicleLabel } from "../../../lib/data";

export function getStaticPaths() {
  return getVehicleSummaries().map((v) => ({ params: { slug: v.slug } }));
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const GET: APIRoute = ({ params }) => {
  const vehicle = getVehicle(params.slug!);
  const rows = [["Date", "Mileage", "Service", "Notes"]];
  const sorted = [...vehicle.maintenanceLog].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const m of sorted) {
    rows.push([m.date, String(m.mileage), m.description, m.notes ?? ""]);
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${vehicle.slug}-maintenance-history.csv"`,
    },
  });
};
