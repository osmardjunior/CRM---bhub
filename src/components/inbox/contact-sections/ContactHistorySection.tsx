import {
  MessageSquare, History, User, ArrowRight, StickyNote,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ContactHistorySectionProps {
  conversationId: string;
  contactId: string;
  currentConversationId: string;
}

export default function ContactHistorySection({ conversationId, contactId, currentConversationId }: ContactHistorySectionProps) {
  const { data: contactConversations = [] } = useQuery({
    queryKey: ['contact-conversations', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations').select('id, status, created_at, last_message_at')
        .eq('contact_id', contactId).order('last_message_at', { ascending: false }).limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: convEvents = [] } = useQuery({
    queryKey: ['conversation-events', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const [eventsRes, annotationsRes] = await Promise.all([
        supabase.from('conversation_events')
          .select('*, actor:profiles!conversation_events_actor_id_fkey(name)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('annotations')
          .select('*, author:profiles!annotations_author_id_fkey(name)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: false }).limit(50),
      ]);
      const events = (eventsRes.data ?? []).map((e: Record<string, unknown>) => ({ ...e, _kind: 'event' as const }));
      const notes = (annotationsRes.data ?? []).map((a: Record<string, unknown>) => ({ ...a, _kind: 'annotation' as const }));
      return [...events, ...notes].sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    },
  });

  const statusColors: Record<string, string> = {
    new: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    resolved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    closed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  const statusLabels: Record<string, string> = { new: 'Aberta', open: 'Em Atend.', pending: 'Aguardando', resolved: 'Resolvida', closed: 'Fechada' };

  return (
    <div className="px-3 py-4">
      <p className="text-xs font-semibold text-foreground mb-3">Linha do tempo</p>

      {/* Conversation list */}
      {contactConversations.length > 0 && (
        <div className="mb-4 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageSquare size={10} />Conversas
          </p>
          {contactConversations.map((conv) => {
            const dateStr = new Date(conv.last_message_at ?? conv.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
            return (
              <div key={conv.id} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${conv.id === currentConversationId ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/40'}`}>
                <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[conv.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {conv.id === currentConversationId ? '● Atual' : (statusLabels[conv.status] ?? conv.status)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Events timeline */}
      {convEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <History size={28} className="mb-2 opacity-30" />
          <p className="text-xs">Nenhum evento registrado</p>
        </div>
      ) : (
        <div className="relative pl-4">
          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {convEvents.map((ev: Record<string, unknown>) => {
              const date = new Date(ev.created_at as string).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
              const statusLabel: Record<string, string> = { new: 'Aberto', open: 'Em Atendimento', pending: 'Aguardando', resolved: 'Resolvido', closed: 'Fechado' };
              const statusColor: Record<string, string> = { new: 'text-green-600', open: 'text-blue-600', pending: 'text-amber-600', resolved: 'text-purple-600', closed: 'text-red-700' };
              const payload = ev.payload as Record<string, string> | undefined;
              const actor = ev.actor as { name?: string } | undefined;
              const author = (ev as Record<string, unknown>).author as { name?: string } | undefined;

              if (ev._kind === 'annotation') return (
                <div key={ev.id as string} className="relative">
                  <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-amber-400 border-2 border-background" />
                  <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <StickyNote size={10} className="text-amber-600" />
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{author?.name ?? 'Agente'}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{date}</span>
                    </div>
                    <p className="text-[11px] text-foreground leading-relaxed">{ev.body as string}</p>
                  </div>
                </div>
              );

              if (ev.event_type === 'status_change') return (
                <div key={ev.id as string} className="relative flex items-start gap-2">
                  <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[10px] font-semibold ${statusColor[payload?.from ?? ''] ?? 'text-muted-foreground'}`}>{statusLabel[payload?.from ?? ''] ?? payload?.from}</span>
                      <ArrowRight size={9} className="text-muted-foreground shrink-0" />
                      <span className={`text-[10px] font-semibold ${statusColor[payload?.to ?? ''] ?? 'text-muted-foreground'}`}>{statusLabel[payload?.to ?? ''] ?? payload?.to}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{actor?.name ?? 'Sistema'} · {date}</p>
                  </div>
                </div>
              );

              if (ev.event_type === 'agent_assigned') return (
                <div key={ev.id as string} className="relative flex items-start gap-2">
                  <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-blue-400 border-2 border-background" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <User size={9} className="text-blue-500" />
                      <span className="text-[10px] text-foreground">Agente atribuído</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{date}</p>
                  </div>
                </div>
              );

              return (
                <div key={ev.id as string} className="relative flex items-start gap-2">
                  <div className="absolute -left-[13px] top-1 h-3 w-3 rounded-full bg-muted border-2 border-background" />
                  <div className="flex-1">
                    <span className="text-[10px] text-muted-foreground">{ev.event_type as string}</span>
                    <p className="text-[9px] text-muted-foreground">{date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
