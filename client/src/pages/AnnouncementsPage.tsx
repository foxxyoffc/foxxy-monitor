import { QueryNotice } from "@/components/QueryNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export function AnnouncementsPage({ sessionToken }: { sessionToken: string }) {
  const announcements = trpc.dashboard.listAnnouncements.useQuery({ sessionToken });
  const utils = trpc.useUtils();
  const remove = trpc.dashboard.deleteAnnouncement.useMutation({ onSuccess: () => { utils.dashboard.listAnnouncements.invalidate({ sessionToken }); utils.dashboard.summary.invalidate({ sessionToken }); toast.success("Pengumuman dihapus."); }, onError: (error) => toast.error(error.message) });
  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-4"><div className="page-heading"><p className="eyebrow">OWNER ANNOUNCEMENTS</p><h2>Pengumuman</h2><p>Buat informasi yang langsung terlihat di dashboard semua Admin.</p></div><CreateAnnouncement sessionToken={sessionToken} /></section>
    <QueryNotice error={announcements.error} onRetry={() => announcements.refetch()} label="Pengumuman belum dapat dimuat." />
    {!announcements.error && <div className="grid gap-4">{announcements.data?.length ? announcements.data.map((item) => <Card className="surface-card" key={item.id}><CardContent className="flex items-start justify-between gap-4 p-6"><div><div className="mb-2 flex items-center gap-2">{item.isPinned && <Pin className="h-4 w-4 text-violet-300" />}<h3 className="font-black text-white">{item.title}</h3></div><p className="max-w-2xl text-sm leading-6 text-slate-300">{item.content}</p><time className="mt-3 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("id-ID")}</time></div><Button variant="ghost" size="icon" className="text-rose-300 hover:bg-rose-500/10" onClick={() => { if (confirm("Hapus pengumuman ini?")) remove.mutate({ sessionToken, announcementId: item.id }); }}><Trash2 className="h-4 w-4" /></Button></CardContent></Card>) : <div className="empty-panel"><Megaphone /><p>Belum ada pengumuman. Buat informasi pertama untuk tim Anda.</p></div>}</div>}
  </div>;
}

function CreateAnnouncement({ sessionToken }: { sessionToken: string }) {
  const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [pinned, setPinned] = useState(false); const utils = trpc.useUtils();
  const create = trpc.dashboard.createAnnouncement.useMutation({ onSuccess: () => { utils.dashboard.listAnnouncements.invalidate({ sessionToken }); utils.dashboard.summary.invalidate({ sessionToken }); setOpen(false); setTitle(""); setContent(""); toast.success("Pengumuman diterbitkan."); }, onError: (error) => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ sessionToken, title, content, isPinned: pinned }); };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="primary-action"><Plus />Buat Pengumuman</Button></DialogTrigger><DialogContent className="dialog-dark"><DialogHeader><DialogTitle>Pengumuman Baru</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><Input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Judul pengumuman" /><Textarea required value={content} onChange={(event) => setContent(event.target.value)} placeholder="Tulis informasi untuk seluruh admin..." rows={5} /><label className="flex items-center gap-2 text-sm text-slate-300"><input checked={pinned} onChange={(event) => setPinned(event.target.checked)} type="checkbox" />Pin di urutan teratas</label><Button type="submit" className="primary-action w-full" disabled={create.isPending}>{create.isPending ? "Menerbitkan..." : "Terbitkan"}</Button></form></DialogContent></Dialog>;
}
