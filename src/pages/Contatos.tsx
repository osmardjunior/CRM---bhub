import { useState, useMemo } from 'react';
import { Users, Search, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/shared/EmptyState';
import TagChips from '@/components/shared/TagChips';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import ContactDetailPanel from '@/components/contatos/ContactDetailPanel';
import NewContactModal from '@/components/contatos/NewContactModal';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/contexts/AuthContext';

const sourceOptions = ['WhatsApp', 'Instagram', 'Webchat', 'Indicação', 'Google Ads', 'Facebook Ads'];

export default function ContatosPage() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { companyId } = useAuth();

  const { data: contacts, isLoading } = useContacts();

  const allTags = useMemo(() => {
    if (!contacts) return [];
    return Array.from(new Set(contacts.flatMap((c) => (c.tags as string[]) || [])));
  }, [contacts]);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search);
      const tags = (c.tags as string[]) || [];
      const matchesTag = tagFilter === 'all' || tags.includes(tagFilter);
      const matchesSource = sourceFilter === 'all' || c.source === sourceFilter;
      return matchesSearch && matchesTag && matchesSource;
    });
  }, [contacts, search, tagFilter, sourceFilter]);

  const selectedContact = contacts?.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-4 lg:-m-6">
      {/* Left: toolbar + table */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-secondary border-0 text-sm"
            />
          </div>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm bg-secondary border-0">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm bg-secondary border-0">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              {sourceOptions.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" className="gap-1.5 ml-auto h-9" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            Novo contato
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum contato encontrado"
              description="Tente buscar com outro termo ou ajuste os filtros."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 sticky top-0">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Telefone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Tags</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden xl:table-cell">Último contato</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => {
                  const tags = (contact.tags as string[]) || [];
                  const responsible = (contact as any).responsible;
                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedId(contact.id)}
                      className={`border-b border-border cursor-pointer transition-colors ${
                        selectedId === contact.id ? 'bg-accent/50' : 'hover:bg-accent/30'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{contact.name[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">{contact.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-sm">{contact.phone}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {contact.source && <Badge variant="outline" className="text-xs font-normal">{contact.source}</Badge>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <TagChips tags={tags} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell">
                        {contact.last_contact_at
                          ? new Date(contact.last_contact_at).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm hidden lg:table-cell">
                        {responsible?.name || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: Detail panel */}
      {selectedContact && (
        <div className="w-80 xl:w-96 shrink-0 hidden md:block">
          <ContactDetailPanel
            key={selectedContact.id}
            contact={selectedContact}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {/* New contact modal */}
      <NewContactModal open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} />
    </div>
  );
}
