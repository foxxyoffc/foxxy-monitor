import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type DeferredInstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(() => typeof window !== "undefined" && !isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setDeferredPrompt(event as DeferredInstallPrompt); setVisible(true); };
    const onInstalled = () => { setVisible(false); setDeferredPrompt(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const install = async () => {
    if (!deferredPrompt) { setShowGuide(true); return; }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;
  return <aside className="pwa-install-card" role="status" aria-label="Notifikasi instalasi aplikasi"><div className="pwa-install-icon"><Smartphone /></div><div className="min-w-0 flex-1"><strong>Pasang Foxxy Monitor</strong><p>{showGuide ? "Buka menu browser ⋮ lalu pilih Tambahkan ke layar utama." : "Akses cepat langsung dari layar utama."}</p></div><button onClick={install} className="pwa-install-action"><Download />Pasang</button><button onClick={() => setVisible(false)} className="pwa-install-close" aria-label="Tutup notifikasi instalasi"><X /></button></aside>;
}
