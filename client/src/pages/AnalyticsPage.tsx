import { MetricCharts } from "@/components/MetricCharts";
import { QueryNotice } from "@/components/QueryNotice";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export function AnalyticsPage({ sessionToken }: { sessionToken: string }) {
  const summary = trpc.dashboard.summary.useQuery({ sessionToken }, { refetchInterval: 12000 });

  return <div className="space-y-7">
    <section className="page-heading"><p className="eyebrow">ANALYTICS</p><h2>Grafik Pendapatan</h2><p>Analisis tren dan kontribusi APK 1, APK 2, serta APK 3 dari data yang tercatat.</p></section>
    <QueryNotice error={summary.error} onRetry={() => summary.refetch()} label="Grafik pendapatan belum dapat dimuat." />
    {!summary.error && <Card className="surface-card"><CardContent className="p-5 sm:p-7"><MetricCharts metrics={summary.data?.metrics ?? []} /></CardContent></Card>}
  </div>;
}
