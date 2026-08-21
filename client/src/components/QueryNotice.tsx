import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

type QueryError = { message?: string } | null | undefined;

export function QueryNotice({ error, onRetry, label = "Data belum dapat dimuat." }: { error?: QueryError; onRetry: () => void; label?: string }) {
  if (!error) return null;
  return <div className="query-notice"><AlertTriangle /><div><strong>{label}</strong><p>{error.message || "Periksa koneksi lalu coba lagi."}</p></div><Button variant="outline" size="sm" onClick={onRetry}><RefreshCw />Coba Lagi</Button></div>;
}
