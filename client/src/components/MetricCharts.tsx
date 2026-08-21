import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Metric = { metricDate: string; appKey: "apk1" | "apk2" | "apk3"; revenue: number; adsRevenue: number; success: number };
const APP_LABELS = { apk1: "APK 1", apk2: "APK 2", apk3: "APK 3" } as const;
const COLORS = ["#9b5cff", "#d946ef", "#38bdf8"];

export function MetricCharts({ metrics, compact = false }: { metrics: Metric[]; compact?: boolean }) {
  const charts = useMemo(() => {
    const ordered = [...metrics].sort((a, b) => a.metricDate.localeCompare(b.metricDate));
    const byDate = new Map<string, { date: string; apk1: number; apk2: number; apk3: number }>();
    const byApp = new Map<Metric["appKey"], number>([["apk1", 0], ["apk2", 0], ["apk3", 0]]);
    ordered.forEach((row) => { const entry = byDate.get(row.metricDate) ?? { date: row.metricDate.slice(5), apk1: 0, apk2: 0, apk3: 0 }; entry[row.appKey] += row.revenue; byDate.set(row.metricDate, entry); byApp.set(row.appKey, (byApp.get(row.appKey) ?? 0) + row.revenue); });
    return { line: Array.from(byDate.values()).slice(-10), pie: Array.from(byApp.entries()).map(([name, value]) => ({ name: APP_LABELS[name as keyof typeof APP_LABELS], value })) };
  }, [metrics]);

  if (!metrics.length) return <div className="empty-chart">Belum ada data pendapatan. Tambahkan data APK untuk menampilkan diagram garis, batang, dan lingkaran.</div>;
  return <div className={compact ? "grid gap-5" : "grid gap-5 xl:grid-cols-2"}>
    <ChartCard title="Diagram Garis — Tren Pendapatan"><ResponsiveContainer width="100%" height={260}><LineChart data={charts.line}><CartesianGrid stroke="#ffffff12" vertical={false} /><XAxis dataKey="date" stroke="#958eab" tickLine={false} axisLine={false} /><YAxis stroke="#958eab" tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${Math.round(v / 1000)}k`} /><Tooltip contentStyle={{ background: "#17131f", border: "1px solid #ffffff1f", borderRadius: 12 }} formatter={(v: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)} /><Line type="monotone" dataKey="apk1" name="APK 1" stroke="#9b5cff" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="apk2" name="APK 2" stroke="#d946ef" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="apk3" name="APK 3" stroke="#38bdf8" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
    <ChartCard title="Diagram Batang — Pendapatan per APK"><ResponsiveContainer width="100%" height={260}><BarChart data={charts.pie} layout="vertical" margin={{ left: 8 }}><CartesianGrid stroke="#ffffff12" horizontal={false} /><XAxis type="number" stroke="#958eab" tickLine={false} axisLine={false} tickFormatter={(v) => `Rp${Math.round(v / 1000)}k`} /><YAxis dataKey="name" type="category" stroke="#c8c1d9" tickLine={false} axisLine={false} width={48} /><Tooltip contentStyle={{ background: "#17131f", border: "1px solid #ffffff1f", borderRadius: 12 }} formatter={(v: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)} /><Bar dataKey="value" radius={[0, 8, 8, 0]}>{charts.pie.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Bar></BarChart></ResponsiveContainer></ChartCard>
    {!compact && <ChartCard title="Diagram Lingkaran — Proporsi Pendapatan"><div className="relative"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={charts.pie} dataKey="value" nameKey="name" innerRadius={68} outerRadius={98} paddingAngle={4}>{charts.pie.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip contentStyle={{ background: "#17131f", border: "1px solid #ffffff1f", borderRadius: 12 }} formatter={(v: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v)} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</span><span className="text-sm font-black">APK</span></div></div></ChartCard>}
  </div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) { return <Card className="chart-card"><CardHeader className="pb-0"><CardTitle className="text-sm font-black text-white">{title}</CardTitle></CardHeader><CardContent className="pt-4">{children}</CardContent></Card>; }
