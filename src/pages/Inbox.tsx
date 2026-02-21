import { useState, useEffect, useMemo } from 'react';
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
import type { ConversationFilters } from '@/services/api';

export default function InboxPage() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get('id');
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [profileOpen, setProfileOpen] = useState(true);
  const [filters, setFilters] = useState<Omit<ConversationFilters, 'page'>>({ status: 'open' });

  const {
    data: infiniteData,
    isLoading: listLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConversations(filters);

  const conversations = useMemo(
    () => infiniteData?.pages.flat() ?? [],
    [infiniteData],
  );

  const effectiveSelectedId = selectedId ?? conversations[0]?.id ?? null;
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
    setFilters((prev) => ({ ...prev, ...newFilters }));
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
