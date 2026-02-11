import { useState, useRef, useEffect } from 'react';
import ConversationList from '@/components/inbox/ConversationList';
import ChatPanel from '@/components/inbox/ChatPanel';
import ContactProfilePanel from '@/components/inbox/ContactProfilePanel';
import { conversations, type Conversation } from '@/data/mock';

export default function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [profileOpen, setProfileOpen] = useState(true);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-0 -mt-2 rounded-xl border border-border bg-card card-shadow overflow-hidden">
      {/* A – Conversation List */}
      <ConversationList
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* B – Chat Panel */}
      <ChatPanel
        conversation={selected}
        onToggleProfile={() => setProfileOpen((p) => !p)}
        profileOpen={profileOpen}
      />

      {/* C – Contact Profile Panel */}
      {profileOpen && selected && (
        <ContactProfilePanel
          conversation={selected}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
