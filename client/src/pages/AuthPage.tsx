import { FoxxyLogo } from "@/components/FoxxyLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDeviceId } from "@/hooks/useFoxxySession";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
      prompt: () => void;
    };
  };
};

function getGoogleIdentity() {
  return (window as unknown as Record<string, unknown>)["google"] as GoogleIdentity | undefined;
}

function loadGoogleIdentity() {
  return new Promise<void>((resolve, reject) => {
    if (getGoogleIdentity()?.accounts.id) return resolve();
    const current = document.getElementById("google-identity-sdk") as HTMLScriptElement | null;
    if (current) {
      current.addEventListener("load", () => resolve(), { once: true });
      current.addEventListener("error", () => reject(new Error("Gagal memuat Google Identity.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-identity-sdk";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Google Identity."));
    document.head.appendChild(script);
  });
}

export function AuthPage({ onAuthenticated }: { onAuthenticated: (sessionToken: string) => void }) {
  const ownerStatus = trpc.auth.hasOwner.useQuery();
  const settings = trpc.auth.settings.useQuery();
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [form, setForm] = useState({ name: "", username: "", password: "", email: "" });
  const bootstrap = trpc.auth.bootstrapOwner.useMutation({
    onSuccess: (result) => { onAuthenticated(result.sessionToken); toast.success("Owner berhasil dibuat. Selamat datang di Foxxy Monitor."); },
    onError: (error) => toast.error(error.message),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: (result) => { onAuthenticated(result.sessionToken); toast.success("Login berhasil."); },
    onError: (error) => toast.error(error.message),
  });
  const googleLogin = trpc.auth.googleLogin.useMutation({
    onSuccess: (result) => { onAuthenticated(result.sessionToken); toast.success("Login Google berhasil."); },
    onError: (error) => toast.error(error.message),
  });
  const noOwner = ownerStatus.data && !ownerStatus.data.hasOwner;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const deviceId = getDeviceId();
    if (mode === "bootstrap") bootstrap.mutate({ ...form, email: form.email || undefined, deviceId });
    else login.mutate({ username: form.username, password: form.password, deviceId });
  };

  const loginWithGoogle = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      toast.info("Login Google belum dikonfigurasi oleh Owner.");
      return;
    }
    try {
      await loadGoogleIdentity();
      const googleIdentity = getGoogleIdentity();
      googleIdentity?.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => googleLogin.mutate({ idToken: credential, deviceId: getDeviceId() }),
      });
      googleIdentity?.accounts.id.prompt();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google Identity tidak tersedia.");
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-grid" />
      <main className="auth-panel">
        <section className="auth-pitch">
          <FoxxyLogo title={settings.data?.siteTitle ?? "Foxxy Monitor"} logoUrl={settings.data?.logoUrl} />
          <div className="mb-auto mt-auto">
            <p className="eyebrow">MONITORING CENTER</p>
            <h1>Satu panel.<br /><span>Kontrol menyeluruh.</span></h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">Kelola pendapatan aplikasi, status transaksi, pengeluaran, dan aktivitas tim dari workspace yang terproteksi.</p>
          </div>
          <div className="auth-trust"><ShieldCheck className="h-5 w-5 text-violet-300" /><span>Akses per perangkat & role-based control</span></div>
        </section>
        <section className="auth-card-wrap">
          <div className="auth-card">
            {noOwner && mode === "login" ? (
              <>
                <p className="eyebrow">PENYIAPAN AWAL</p>
                <h2>Buat akun Owner</h2>
                <p className="auth-subtext">Belum ada Owner terdaftar. Siapkan akses utama untuk mulai menggunakan Foxxy Monitor.</p>
                <Button className="primary-action mt-7 w-full" onClick={() => setMode("bootstrap")}>Buat Owner <ArrowRight /></Button>
              </>
            ) : (
              <>
                <button className="auth-back" onClick={() => setMode(mode === "login" ? "bootstrap" : "login")}>{mode === "bootstrap" ? "← Kembali ke Login" : noOwner ? "Buat akun Owner" : ""}</button>
                <p className="eyebrow">{mode === "bootstrap" ? "PENYIAPAN AWAL" : "AKSES AMAN"}</p>
                <h2>{mode === "bootstrap" ? "Buat akun Owner" : "Masuk ke workspace"}</h2>
                <p className="auth-subtext">{mode === "bootstrap" ? "Akun ini memegang akses penuh untuk mengelola admin dan pengaturan." : "Masukkan akun yang sudah didaftarkan oleh Owner."}</p>
                <form className="mt-7 space-y-4" onSubmit={submit}>
                  {mode === "bootstrap" && <Field label="Nama Owner" icon={UserRound}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama Anda" required /></Field>}
                  <Field label="Username" icon={UserRound}><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="contoh: owner.foxxy" required /></Field>
                  {mode === "bootstrap" && <Field label="Gmail (opsional untuk Google Login)" icon={Mail}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@gmail.com" /></Field>}
                  <Field label="Password" icon={LockKeyhole}><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimal 8 karakter" minLength={8} required /></Field>
                  <Button type="submit" className="primary-action mt-2 w-full" disabled={bootstrap.isPending || login.isPending}>{bootstrap.isPending || login.isPending ? "Memproses..." : mode === "bootstrap" ? "Buat dan Masuk" : "Masuk"}<ArrowRight /></Button>
                </form>
                {mode === "login" && <>
                  <div className="divider"><span>atau</span></div>
                  <Button type="button" variant="outline" className="google-button w-full" onClick={loginWithGoogle} disabled={googleLogin.isPending}><span className="google-g">G</span>{googleLogin.isPending ? "Memverifikasi Google..." : "Masuk dengan Google"}</Button>
                  <div className="auth-security"><AlertTriangle className="h-4 w-4" />Satu akun hanya aktif di satu perangkat. Sesi yang dihapus atau diblokir akan langsung dicabut.</div>
                </>}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof UserRound; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-xs font-bold text-slate-300">{label}</Label><div className="auth-input-wrap"><Icon className="h-4 w-4 text-violet-300" />{children}</div></div>;
}
