import { useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import { conversations, type Conversation, type ConversationStatus, type Channel } from '@/data/mock';

const tabs: { label: string; value: ConversationStatus | 'todas' }[] = [
  { label: 'Abertas', value: 'aberta' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Fechadas', value: 'resolvida' },
];

const channelLabels: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  webchat: 'Webchat',
};

const channelColors: Record<Channel, string> = {
  whatsapp: 'bg-success/15 text-success',
  instagram: 'bg-pink-500/15 text-pink-600',
  webchat: 'bg-info/15 text-info',
};

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ selectedId, onSelect }: Props) {
  const [activeTab, setActiveTab] = useState<ConversationStatus | 'todas'>('aberta');
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<Channel | 'todos'>('todos');

  const filtered = conversations.filter((c) => {
    if (activeTab !== 'todas' && c.status !== activeTab) return false;
    if (channelFilter !== 'todos' && c.channel !== channelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.contactName.toLowerCase().includes(q) || c.contactPhone.includes(q);
    }
    return true;
  });

  return (
    <div className="flex w-80 min-w-[320px] flex-col border-r border-border">
      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab.value
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-secondary border-0"
          />
        </div>
        <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as Channel | 'todos')}>
          <SelectTrigger className="h-8 w-[110px] text-xs bg-secondary border-0">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="webchat">Webchat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma conversa"
            description="Não há conversas com esse filtro."
          />
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-border p-3 text-left transition-colors hover:bg-accent/50 ${
                  isSelected ? 'bg-accent' : ''
                }`}
              >
                <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                  <AvatarImage src={conv.contactAvatar} />
                  <AvatarFallback className="text-xs">{conv.contactName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{conv.contactName}</span>
                    <span className="text-[11px] text-muted-foreground ml-2 shrink-0">{conv.timestamp}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${channelColors[conv.channel]}`}>
                      {channelLabels[conv.channel]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {conv.assignedTo || 'Não atribuído'}
                    </span>
                    {conv.unread > 0 && (
                      <Badge className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0 min-w-[18px] justify-center">
                        {conv.unread}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
