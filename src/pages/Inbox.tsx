import { useState } from 'react';
import ConversationList from '@/components/inbox/ConversationList';
import ChatPanel from '@/components/inbox/ChatPanel';
import ContactProfilePanel from '@/components/inbox/ContactProfilePanel';
import { useConversations, useConversationDetail } from '@/hooks/useConversations';
import type { ConversationFilters } from '@/services/api';
import type { Enums } from '@/integrations/supabase/types';

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(true);
  const [filters, setFilters] = useState<ConversationFilters>({});

  const { data: conversations, isLoading: listLoading } = useConversations(filters);
  const { data: detail, isLoading: detailLoading } = useConversationDetail(selectedId);

  // Auto-select first conversation
  const effectiveSelectedId = selectedId ?? conversations?.[0]?.id ?? null;

  const handleFilterChange = (newFilters: Partial<ConversationFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 -mt-2 rounded-xl border border-border bg-card card-shadow overflow-hidden">
      <ConversationList
        conversations={conversations ?? []}
        loading={listLoading}
        selectedId={effectiveSelectedId}
        onSelect={setSelectedId}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <ChatPanel
        conversation={effectiveSelectedId ? (detail ?? null) : null}
        loading={detailLoading && !!effectiveSelectedId}
        onToggleProfile={() => setProfileOpen((p) => !p)}
        profileOpen={profileOpen}
      />

      {profileOpen && detail && (
        <ContactProfilePanel
          conversation={detail}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
