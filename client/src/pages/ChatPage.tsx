import { QueryNotice } from "@/components/QueryNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Eraser, MessageSquareText, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function ChatPage({ sessionToken, role }: { sessionToken: string; role: string }) {
  const messages = trpc.chat.list.useQuery({ sessionToken }, { refetchInterval: 6000 });
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const send = trpc.chat.send.useMutation({ onSuccess: () => { setContent(""); utils.chat.list.invalidate({ sessionToken }); }, onError: (error) => toast.error(error.message) });
  const deleteHistory = trpc.chat.deleteHistory.useMutation({ onSuccess: () => { utils.chat.list.invalidate({ sessionToken }); toast.success("History chat telah dihapus."); }, onError: (error) => toast.error(error.message) });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data?.length]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (content.trim()) send.mutate({ sessionToken, content }); };
  const rows = [...(messages.data ?? [])].reverse();

  return <div className="space-y-7">
    <section className="flex flex-wrap items-end justify-between gap-4"><div className="page-heading"><p className="eyebrow">TEAM CONVERSATION</p><h2>Chat Room</h2><p>Ruang diskusi Owner dan seluruh Admin. Pesan diperbarui otomatis setiap 6 detik.</p></div>{role === "owner" && <Button variant="outline" className="danger-outline" onClick={() => { if (confirm("Hapus seluruh history chat?")) deleteHistory.mutate({ sessionToken }); }} disabled={deleteHistory.isPending}><Eraser />Delete History</Button>}</section>
    <QueryNotice error={messages.error} onRetry={() => messages.refetch()} label="History chat belum dapat dimuat." />
    {!messages.error && <Card className="chat-shell"><CardContent className="flex h-[calc(100vh-300px)] min-h-[480px] flex-col p-0"><div className="chat-header"><div className="flex items-center gap-3"><div className="metric-icon purple"><MessageSquareText /></div><div><strong className="text-white">Diskusi Tim</strong><p>Polling sederhana aktif</p></div></div><span className="live-pill"><span className="status-dot green" />Live</span></div><div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">{rows.length ? rows.map(({ message, user }) => { const display = user.role === "owner" ? "Owner" : `Admin ${user.adminNumber ?? "—"}`; return <div key={message.id} className="chat-message"><div className="chat-avatar">{(user.name ?? "A").slice(0, 1)}</div><div><div className="mb-1 flex flex-wrap items-center gap-2"><strong>{user.name ?? display}</strong><span className="chat-role">{display}</span><time>{new Date(message.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.content}</p></div></div>; }) : <div className="empty-chat"><MessageSquareText /><p>Belum ada pesan. Mulai diskusi bersama tim.</p></div>}<div ref={bottomRef} /></div><form onSubmit={submit} className="chat-composer"><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Tulis pesan untuk tim..." rows={1} maxLength={1500} /><Button type="submit" className="primary-action" disabled={!content.trim() || send.isPending}><Send />Kirim</Button></form></CardContent></Card>}
  </div>;
}
