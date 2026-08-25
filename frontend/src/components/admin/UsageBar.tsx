import { cn } from "@/lib/utils";

export function UsageBar({ label, used, cap }: { label: string; used: number; cap: number | null }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const nearLimit = cap !== null && pct >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-medium text-fg">
          {used} / {cap ?? "Unlimited"}
        </span>
      </div>
      {cap !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover">
          <div
            className={cn("h-full rounded-full transition-all", nearLimit ? "bg-warning" : "bg-brand-600")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {nearLimit && <p className="mt-1.5 text-xs text-warning">Approaching plan limit.</p>}
    </div>
  );
}
