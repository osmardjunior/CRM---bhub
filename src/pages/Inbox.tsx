import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConversationList from '@/components/inbox/ConversationList';
import ChatPanel from '@/components/inbox/ChatPanel';
import ContactProfilePanel from '@/components/inbox/ContactProfilePanel';
import {
  useInfiniteConversations,
  useConversationDetail,
  useUnreadCounts,
  useMarkConversationRead,
} from '@/hooks/useConversations';
import { useInboxRealtime } from '@/hooks/useInboxRealtime';
import { useAuth } from '@/contexts/AuthContext';
import { useMyProjects } from '@/hooks/useProjects';
import { useSelectedProject } from '@/hooks/useSelectedProject';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ConversationFilters } from '@/services/api';
import type { Enums } from '@/integrations/supabase/types';

export default function InboxPage() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const initialStatus = searchParams.get('status') as Enums<'conversation_status'> | null;
  const initialSearch = searchParams.get('search');
  const initialProjectId = searchParams.get('projectId') ?? '';

  const { data: myProjects = [] } = useMyProjects();
  const { projectId, select: selectProject } = useSelectedProject();

  // URL param takes priority over localStorage on first load
  const effectiveProjectId = initialProjectId || projectId;

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [profileOpen, setProfileOpen] = useState(true);
  const [filters, setFilters] = useState<Omit<ConversationFilters, 'page'>>({
    status: initialStatus ?? undefined,
    statusIn: initialStatus ? undefined : ['new', 'open', 'pending', 'resolved'],
    search: initialSearch ?? undefined,
    project_id: effectiveProjectId || undefined,
  });

  // Se o agente pertence a exatamente 1 projeto, aplica automaticamente (sem mostrar seletor)
  const didAutoProject = useRef(false);
  useEffect(() => {
    if (didAutoProject.current) return;
    if (role === 'agent' && myProjects.length === 1 && !effectiveProjectId) {
      didAutoProject.current = true;
      const sole = myProjects[0].id;
      selectProject(sole);
      setFilters(prev => ({ ...prev, project_id: sole }));
    }
  }, [myProjects, role, effectiveProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agents only see conversations assigned to them + scoped to their projects
  const effectiveFilters = useMemo<Omit<ConversationFilters, 'page'>>(() => {
    if (role === 'agent' && user?.id) {
      return { ...filters, assigned_user_id: user.id };
    }
    return filters;
  }, [filters, role, user?.id]);

  // O seletor de projeto só aparece quando há > 1 projeto disponível
  // (para agentes com apenas 1 projeto, aplica silenciosamente; para admins, sempre mostra)
  const showProjectSelector = myProjects.length > 1 || (role !== 'agent' && myProjects.length > 0);

  const {
    data: infiniteData,
    isLoading: listLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConversations(effectiveFilters);

  const conversations = useMemo(
    () => infiniteData?.pages.flat() ?? [],
    [infiniteData],
  );

  // Auto-seleciona a primeira conversa UMA única vez após o carregamento inicial.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (!didAutoSelect.current && selectedId === null && conversations.length > 0) {
      didAutoSelect.current = true;
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const effectiveSelectedId = selectedId;
  const { data: detail, isLoading: detailLoading } = useConversationDetail(effectiveSelectedId);
  const { data: unreadCounts } = useUnreadCounts(conversations);
  const markRead = useMarkConversationRead();

  useInboxRealtime(effectiveSelectedId);

  useEffect(() => {
    if (effectiveSelectedId) {
      markRead.mutate(effectiveSelectedId);
    }
    // markRead is a stable mutation ref from React Query — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedId]);

  const handleProjectChange = (value: string) => {
    const id = value === '__all__' ? '' : value;
    selectProject(id);
    setSelectedId(null);
    didAutoSelect.current = false;
    setFilters((prev) => ({ ...prev, project_id: id || undefined }));
  };

  const handleFilterChange = (newFilters: Partial<ConversationFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...newFilters };
      // Persist status filter in URL so it survives page reload
      setSearchParams(params => {
        if (next.status) {
          params.set('status', next.status);
        } else {
          params.delete('status');
        }
        return params;
      }, { replace: true });
      return next;
    });
  };

  const hasSelection = !!effectiveSelectedId;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2">
      {/* Project selector bar — visível para admin sempre, para agente apenas se tiver > 1 projeto */}
      {showProjectSelector && (
        <div className="flex items-center gap-2 px-3 pb-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Projeto:</span>
          <Select
            value={filters.project_id ?? '__all__'}
            onValueChange={handleProjectChange}
          >
            <SelectTrigger className="h-7 text-xs w-48">
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              {role !== 'agent' && (
                <SelectItem value="__all__">Todos os projetos</SelectItem>
              )}
              {myProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-0 rounded-xl border border-border bg-card card-shadow overflow-hidden">
      {/* Conversation list — hidden on mobile when a chat is open */}
      <div className={hasSelection ? 'hidden md:flex shrink-0' : 'flex w-full md:w-auto shrink-0'}>
        <ConversationList
          conversations={conversations}
          loading={listLoading}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedId}
          filters={filters}
          onFilterChange={handleFilterChange}
          unreadCounts={unreadCounts ?? {}}
          hasMore={!!hasNextPage}
          onLoadMore={() => fetchNextPage()}
          loadingMore={isFetchingNextPage}
        />
      </div>

      {/* Chat panel — hidden on mobile when no chat is selected */}
      <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        <ChatPanel
          conversation={effectiveSelectedId ? (detail ?? null) : null}
          loading={detailLoading && !!effectiveSelectedId}
          onToggleProfile={() => setProfileOpen((p) => !p)}
          profileOpen={profileOpen}
          onBack={() => setSelectedId(null)}
        />
      </div>

      {profileOpen && detail && (
        <ContactProfilePanel
          conversation={detail}
          onClose={() => setProfileOpen(false)}
        />
      )}
      </div>
    </div>
  );
}
