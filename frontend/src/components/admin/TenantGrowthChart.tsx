import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const PERIODS: { value: "7d" | "30d" | "3m" | "12m"; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "3m", label: "3 Months" },
  { value: "12m", label: "12 Months" },
];

export function TenantGrowthChart({
  data,
  period,
  onPeriodChange,
}: {
  data: { label: string; newTenants: number; activeTenants: number }[];
  period: "7d" | "30d" | "3m" | "12m";
  onPeriodChange: (period: "7d" | "30d" | "3m" | "12m") => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-wrap gap-2">
        <CardTitle>Tenant growth</CardTitle>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? "primary" : "secondary"}
              onClick={() => onPeriodChange(p.value)}
              className={cn("px-2.5")}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 12 }} width={32} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="newTenants" name="New tenants" stroke="var(--color-brand-600)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="activeTenants" name="Active tenants" stroke="var(--success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
