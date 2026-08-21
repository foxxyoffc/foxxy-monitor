import { FoxxyLogo } from "@/components/FoxxyLogo";
import { Button } from "@/components/ui/button";
import { OwnerQuickTools } from "@/components/OwnerQuickTools";
import { WorkspaceTools } from "@/components/WorkspaceTools";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BarChart3, Bell, Calculator, Coffee, LayoutDashboard, LogOut, Menu, MessageSquareText, Phone, Settings, ShieldCheck, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analytics", label: "Grafik Pendapatan", icon: BarChart3 },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/chat", label: "Chat Room", icon: MessageSquareText },
];

const ownerLinks = [
  { href: "/admin", label: "Manajemen Admin", icon: UsersRound },
  { href: "/announcements", label: "Pengumuman", icon: Bell },
  { href: "/settings", label: "Profil & Identitas", icon: Settings },
];

function NavLink({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: typeof LayoutDashboard; mobile?: boolean }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href} className={cn(mobile ? "bottom-nav-link" : "nav-link", active && "is-active")}>
          <Icon className="h-[18px] w-[18px] shrink-0" />
          {!mobile && <span>{label}</span>}
          {mobile && <span>{label.split(" ")[0]}</span>}
        </Link>
      </TooltipTrigger>
      <TooltipContent side={mobile ? "top" : "right"}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function AppShell({ children, user, settings, onLogout, sessionToken }: { children: React.ReactNode; user: { name: string; role: "user" | "owner" | "admin"; adminNumber?: number | null }; settings?: { siteTitle?: string; logoUrl?: string | null; ownerSociabuzzUrl?: string | null } | null; onLogout: () => void; sessionToken: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = user.role === "owner";
  const nametag = isOwner ? "Owner" : `Admin ${user.adminNumber ?? "—"}`;
  const siteTitle = settings?.siteTitle ?? "Foxxy Monitor";
  const ownerCoffee = settings?.ownerSociabuzzUrl || "https://sociabuzz.com";

  return (
    <div className="min-h-screen bg-[#08070d] text-slate-100">
      <aside className={cn("sidebar-shell", menuOpen && "sidebar-mobile-open")}>
        <div className="mb-8 flex items-center justify-between px-3"><FoxxyLogo title={siteTitle} logoUrl={settings?.logoUrl} /><button onClick={() => setMenuOpen(false)} className="mobile-only icon-button"><X /></button></div>
        <nav className="space-y-1">
          <p className="nav-section">MONITOR</p>
          {mainLinks.map((item) => <NavLink key={item.href} {...item} />)}
          {isOwner && <><p className="nav-section mt-7">OWNER CONTROL</p>{ownerLinks.map((item) => <NavLink key={item.href} {...item} />)}</>}
        </nav>
        <div className="mt-auto space-y-2 px-3 pt-8">
          <a className="support-link" href="https://wa.me/6281997149736" target="_blank" rel="noreferrer"><Phone className="h-4 w-4" />Hubungi Owner/Developer</a>
          <a className="support-link" href={ownerCoffee} target="_blank" rel="noreferrer"><Coffee className="h-4 w-4" />Kopi untuk Owner</a>
        </div>
      </aside>
      {menuOpen && <button className="mobile-scrim" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
      <main className="app-main">
        <header className="topbar">
          <div className="flex items-center gap-3"><button className="mobile-only icon-button" onClick={() => setMenuOpen(true)} aria-label="Buka toolbar"><Menu /></button><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Workspace</p><h1 className="text-base font-black text-white">{siteTitle}</h1></div></div>
          <div className="flex items-center gap-1.5 sm:gap-3"><WorkspaceTools sessionToken={sessionToken} />{isOwner && <OwnerQuickTools sessionToken={sessionToken} ownerSociabuzzUrl={settings?.ownerSociabuzzUrl} />}<div className="hidden text-right sm:block"><p className="text-sm font-bold text-white">{user.name}</p><p className="text-xs font-semibold text-violet-300">{nametag}</p></div><div className="user-orb hidden sm:grid">{user.name.slice(0, 1).toUpperCase()}</div><Button variant="ghost" size="icon" onClick={onLogout} className="text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Keluar"><LogOut className="h-5 w-5" /></Button></div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
      <nav className="bottom-nav">{mainLinks.map((item) => <NavLink key={item.href} {...item} mobile />)}{isOwner && <NavLink href="/admin" label="Admin" icon={ShieldCheck} mobile />}</nav>
    </div>
  );
}
