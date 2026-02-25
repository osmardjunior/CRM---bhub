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
import type { ConversationFilters } from '@/services/api';
import type { Enums } from '@/integrations/supabase/types';

export default function InboxPage() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const initialStatus = searchParams.get('status') as Enums<'conversation_status'> | null;

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [profileOpen, setProfileOpen] = useState(true);
  const [filters, setFilters] = useState<Omit<ConversationFilters, 'page'>>({
    status: initialStatus ?? undefined,
  });

  // Agents only see conversations assigned to them
  const effectiveFilters = useMemo<Omit<ConversationFilters, 'page'>>(() => {
    if (role === 'agent' && user?.id) {
      return { ...filters, assigned_user_id: user.id };
    }
    return filters;
  }, [filters, role, user?.id]);

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
    <div className="flex h-[calc(100vh-7rem)] gap-0 -mt-2 rounded-xl border border-border bg-card card-shadow overflow-hidden">
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
  );
}
