import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { QueryNotice } from "@/components/QueryNotice";
import { useFoxxySession } from "@/hooks/useFoxxySession";
import { trpc } from "@/lib/trpc";
import { AuthPage } from "@/pages/AuthPage";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";

const DashboardPage = lazy(() => import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage })));
const CalculatorPage = lazy(() => import("@/pages/CalculatorPage").then((module) => ({ default: module.CalculatorPage })));
const ChatPage = lazy(() => import("@/pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then((module) => ({ default: module.AdminPage })));
const AnnouncementsPage = lazy(() => import("@/pages/AnnouncementsPage").then((module) => ({ default: module.AnnouncementsPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

type FoxxyUser = { id: number; name: string; email?: string | null; role: "user" | "owner" | "admin"; adminNumber?: number | null };

function FoxxyLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return <div className={fullScreen ? "foxxy-loader foxxy-loader-full" : "foxxy-loader"} role="status" aria-label="Memuat Foxxy Monitor"><div className="foxxy-loader-mark"><span>ϟ</span></div><div className="foxxy-loader-bars"><i /><i /><i /></div><span className="sr-only">Memuat</span></div>;
}

function PageLoading() {
  return <div className="grid min-h-[45vh] place-items-center"><FoxxyLoader /></div>;
}

function PrivateRouter({ sessionToken, user, settings, logout }: { sessionToken: string; user: FoxxyUser; settings: unknown; logout: () => void }) {
  const ownerOnly = (Page: React.ComponentType<{ sessionToken: string }>) => user.role === "owner" ? <Page sessionToken={sessionToken} /> : <DashboardPage sessionToken={sessionToken} role={user.role} />;
  return (
    <AppShell user={user} settings={settings as { siteTitle?: string; logoUrl?: string | null; ownerSociabuzzUrl?: string | null }} onLogout={logout} sessionToken={sessionToken}>
      <Suspense fallback={<PageLoading />}>
        <Switch>
          <Route path="/" component={() => <DashboardPage sessionToken={sessionToken} role={user.role} />} />
          <Route path="/analytics" component={() => <AnalyticsPage sessionToken={sessionToken} />} />
          <Route path="/calculator" component={CalculatorPage} />
          <Route path="/chat" component={() => <ChatPage sessionToken={sessionToken} role={user.role} />} />
          <Route path="/admin" component={() => ownerOnly(AdminPage)} />
          <Route path="/announcements" component={() => ownerOnly(AnnouncementsPage)} />
          <Route path="/settings" component={() => <SettingsPage sessionToken={sessionToken} user={user} settings={settings as { siteTitle?: string; logoUrl?: string | null }} />} />
          <Route component={() => <DashboardPage sessionToken={sessionToken} role={user.role} />} />
        </Switch>
      </Suspense>
    </AppShell>
  );
}

function FoxxyApplication() {
  const session = useFoxxySession();
  const settings = trpc.auth.settings.useQuery(undefined, { refetchOnWindowFocus: false });
  if (!session.sessionToken || (!session.isLoading && !session.user)) return <AuthPage onAuthenticated={session.setSession} />;
  if (!session.user) return <FoxxyLoader fullScreen />;
  const user: FoxxyUser = { ...session.user, name: session.user.name ?? "Pengguna" };
  if (settings.error) return <AppShell user={user} settings={null} onLogout={session.logout} sessionToken={session.sessionToken}><QueryNotice error={settings.error} onRetry={() => settings.refetch()} label="Pengaturan Foxxy Monitor belum dapat dimuat." /></AppShell>;
  return <PrivateRouter sessionToken={session.sessionToken} user={user} settings={settings.data} logout={session.logout} />;
}

export default function App() {
  return <ErrorBoundary><TooltipProvider><Toaster richColors theme="dark" position="top-right" /><FoxxyApplication /></TooltipProvider></ErrorBoundary>;
      }
