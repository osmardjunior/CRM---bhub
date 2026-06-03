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
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import type { ConversationFilters } from '@/services/api';
import type { Enums } from '@/integrations/supabase/types';

export default function InboxPage() {
  const { user, role } = useAuth();
  const { projectId, selectProject } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const initialStatus = searchParams.get('status') as Enums<'conversation_status'> | null;
  const initialSearch = searchParams.get('search');
  const initialAssigned = searchParams.get('assigned');
  const initialProject = searchParams.get('project');

  // If navigated with ?project=xxx (e.g. from reports), switch global project
  useEffect(() => {
    if (initialProject && initialProject !== projectId) {
      selectProject(initialProject);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [profileOpen, setProfileOpen] = useState(true);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [listFrozen, setListFrozen] = useState(() => localStorage.getItem('inbox_frozen') === 'true');

  // When coming from URL with ?id=, also clear status filter to show the conversation regardless of status
  const [filters, setFilters] = useState<Omit<ConversationFilters, 'page'>>({
    status: initialStatus ?? undefined,
    statusIn: (initialStatus || initialId) ? undefined : undefined,
    search: initialSearch ?? undefined,
    project_id: initialProject || projectId || undefined,
    assigned_user_id: initialAssigned === 'none' ? '__none__' : initialAssigned ?? undefined,
  });

  // Sync project_id filter when global selector changes + clear selected conversation
  // Never clear selectedId if we navigated via URL with ?id= (protects against project sync race)
  const isFirstProjectChange = useRef(!!initialId);
  useEffect(() => {
    setFilters(prev => ({ ...prev, project_id: projectId || undefined }));
    if (isFirstProjectChange.current) {
      isFirstProjectChange.current = false;
    } else if (!navigatedViaUrl.current) {
      setSelectedId(null);
    }
  }, [projectId]);

  // Agents only see conversations assigned to them + scoped to their projects
  const effectiveFilters = useMemo<Omit<ConversationFilters, 'page'>>(() => {
    if (role === 'agent' && user?.id) {
      return { ...filters, assigned_user_id: user.id };
    }
    return filters;
  }, [filters, role, user?.id]);

  const effectiveSelectedId = selectedId;

  const { play: playNotification } = useNotificationSound();
  const { isSubscribed } = useInboxRealtime(effectiveSelectedId, playNotification, listFrozen);

  const {
    data: infiniteData,
    isLoading: listLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConversations(effectiveFilters, { frozen: listFrozen, realtimeActive: isSubscribed });

  const conversations = useMemo(
    () => infiniteData?.pages.flat() ?? [],
    [infiniteData],
  );

  // Auto-seleciona a primeira conversa UMA única vez após o carregamento inicial.
  // skipAutoSelect prevents re-selecting after "mark as unread" clears the selection.
  // navigatedViaUrl prevents auto-select from overriding a URL-provided conversation ID.
  const didAutoSelect = useRef(false);
  const skipAutoSelect = useRef(false);
  const navigatedViaUrl = useRef(!!initialId);
  useEffect(() => {
    if (skipAutoSelect.current) return;
    if (navigatedViaUrl.current) return;
    if (!didAutoSelect.current && selectedId === null && conversations.length > 0) {
      didAutoSelect.current = true;
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  const { data: detail, isLoading: detailLoading, isError: detailError } = useConversationDetail(effectiveSelectedId, { realtimeActive: isSubscribed });
  const { data: unreadCounts } = useUnreadCounts(conversations);
  const markRead = useMarkConversationRead();

  // Only mark as read when the user EXPLICITLY clicks a conversation (not auto-select).
  // This prevents the initial load from clearing all unread badges.
  const userClickedRef = useRef(false);
  useEffect(() => {
    if (effectiveSelectedId && userClickedRef.current) {
      markRead.mutate(effectiveSelectedId);
      userClickedRef.current = false;
    }
    // markRead is a stable mutation ref from React Query — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSelectedId]);

  // Clear selection ONLY if the detail query explicitly fails (RLS blocked / conversation deleted)
  // Do NOT clear based on list position — conversation may be valid but outside the paginated window
  // Never clear when navigated via URL — the conversation may just need time to load
  useEffect(() => {
    if (detailError && selectedId && !navigatedViaUrl.current) {
      setSelectedId(null);
      didAutoSelect.current = false;
    }
  }, [detailError, selectedId]);

  // Keep ?id= in URL in sync with selectedId so sharing/refreshing works
  useEffect(() => {
    setSearchParams(params => {
      if (selectedId) {
        params.set('id', selectedId);
      } else {
        params.delete('id');
      }
      return params;
    }, { replace: true });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (newFilters: Partial<ConversationFilters>) => {
    // Unfreeze list when filters change
    setListFrozen(false);
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
    <div className="flex flex-col h-[calc(100dvh-7rem)] -mt-2">
      <div className="flex flex-1 min-h-0 gap-0 rounded-xl border border-border bg-card card-shadow overflow-hidden">
      {/* Conversation list — hidden on mobile when a chat is open, collapsible on desktop */}
      <div className={`${listCollapsed ? '!hidden' : ''} ${hasSelection ? 'hidden md:flex shrink-0' : 'flex w-full md:w-auto shrink-0'}`}>
        <ConversationList
          conversations={conversations}
          loading={listLoading}
          selectedId={effectiveSelectedId}
          onSelect={(id: string) => {
            skipAutoSelect.current = false;
            userClickedRef.current = true;
            // Restore default status filter when user starts manual navigation
            if (navigatedViaUrl.current) {
              navigatedViaUrl.current = false;
              setFilters(prev => prev);
            }
            setSelectedId(id);
          }}
          filters={filters}
          onFilterChange={handleFilterChange}
          unreadCounts={unreadCounts ?? {}}
          hasMore={!!hasNextPage}
          onLoadMore={() => fetchNextPage()}
          loadingMore={isFetchingNextPage}
          frozen={listFrozen}
          onToggleFreeze={() => setListFrozen(p => { const next = !p; localStorage.setItem('inbox_frozen', String(next)); return next; })}
        />
      </div>

      {/* Chat panel — hidden on mobile when no chat is selected */}
      <div className={`${hasSelection ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
        <ChatPanel
          conversation={effectiveSelectedId ? (detail ?? null) : null}
          loading={detailLoading && !!effectiveSelectedId}
          onToggleProfile={() => setProfileOpen((p) => !p)}
          profileOpen={profileOpen}
          onBack={(opts?: { skipAutoSelect?: boolean }) => {
            if (opts?.skipAutoSelect) skipAutoSelect.current = true;
            setSelectedId(null);
          }}
          listCollapsed={listCollapsed}
          onToggleList={() => setListCollapsed((p) => !p)}
        />
      </div>

      {profileOpen && detail && detail.contact && (
        <div className="hidden md:flex">
          <ContactProfilePanel
            conversation={detail}
            onClose={() => setProfileOpen(false)}
          />
        </div>
      )}
      {/* Mobile: profile panel as overlay */}
      {profileOpen && detail && detail.contact && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-[320px] animate-in slide-in-from-right">
            <ContactProfilePanel
              conversation={detail}
              onClose={() => setProfileOpen(false)}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
