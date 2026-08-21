import { Activity } from "lucide-react";

export function FoxxyLogo({ title = "Foxxy Monitor", logoUrl, compact = false }: { title?: string; logoUrl?: string | null; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="logo-mark shrink-0">
        {logoUrl ? <img src={logoUrl} alt={`Logo ${title}`} className="h-full w-full object-cover" /> : <Activity className="h-5 w-5" strokeWidth={2.6} />}
      </div>
      {!compact && <div className="min-w-0"><p className="truncate text-sm font-black tracking-[0.16em] text-white">{title}</p><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Control center</p></div>}
    </div>
  );
}
