export interface CsvColumn {
  key: string;
  header: string;
}

const escapeCsv = (v: string | number) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Builds a CSV string (columns array of {key, header}, rows as plain
// objects keyed the same way). Extracted from the pattern first used for
// the platform-admin tenant export -- no external CSV library needed for
// data this simple.
export function toCsv(columns: CsvColumn[], rows: Record<string, string | number>[]): string {
  return [
    columns.map((c) => escapeCsv(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escapeCsv(row[c.key])).join(",")),
  ].join("\r\n");
}

export function sendCsv(res: { setHeader: (k: string, v: string) => void; send: (body: string) => void }, filenamePrefix: string, csv: string) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
}
