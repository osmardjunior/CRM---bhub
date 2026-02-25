import { useState, useMemo, useCallback } from 'react';
import { Users, Search, Plus, Download, Upload, Loader2 } from 'lucide-react';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import EmptyState from '@/components/shared/EmptyState';
import TagChips from '@/components/shared/TagChips';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import ContactDetailPanel from '@/components/contatos/ContactDetailPanel';
import NewContactModal from '@/components/contatos/NewContactModal';
import ImportContactsModal from '@/components/contatos/ImportContactsModal';
import { useContacts } from '@/hooks/useContacts';
import { useAuth } from '@/contexts/AuthContext';
import { generateCSV, downloadCSV } from '@/lib/csv';

const sourceOptions = ['WhatsApp', 'Instagram', 'Webchat', 'Indicação', 'Google Ads', 'Facebook Ads'];

export default function ContatosPage() {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(0);
  const { user, role, companyId } = useAuth();

  const filters = useMemo(() => ({
    search: search || undefined,
    tag: tagFilter,
    source: sourceFilter,
    page,
    limit: 25,
    // Agents only see their own leads
    ...(role === 'agent' && user?.id ? { assigned_user_id: user.id } : {}),
  }), [search, tagFilter, sourceFilter, page, role, user?.id]);

  const { data: result, isLoading } = useContacts(filters);

  const contacts = useMemo(() => result?.data ?? [], [result?.data]);
  const totalPages = result?.totalPages ?? 1;

  const allTags = useMemo(() => {
    return Array.from(new Set(contacts.flatMap((c) => (c.tags as string[]) || [])));
  }, [contacts]);

  const selectedContact = contacts.find((c) => c.id === selectedId) || null;

  const handleExport = useCallback(async () => {
    if (!contacts.length) return;
    setExporting(true);
    try {
      const headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Tags', 'Último contato'];
      const rows = contacts.map((c) => ({
        Nome: c.name,
        Telefone: c.phone ?? '',
        Email: c.email ?? '',
        Origem: c.source ?? '',
        Tags: ((c.tags as string[]) || []).join('; '),
        'Último contato': c.last_contact_at ? new Date(c.last_contact_at).toLocaleDateString('pt-BR') : '',
      }));
      const csv = generateCSV(headers, rows);
      downloadCSV('contatos.csv', csv);
    } finally {
      setExporting(false);
    }
  }, [contacts]);

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-4 lg:-m-6">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9 bg-secondary border-0 text-sm"
            />
          </div>

          <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); setPage(0); }}>
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

          <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
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

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setImportOpen(true)}>
              <Upload size={14} /> Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExport} disabled={contacts.length === 0 || exporting}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Exportar
            </Button>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => setModalOpen(true)}>
              <Plus size={15} /> Novo contato
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : contacts.length === 0 ? (
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
                {contacts.map((contact) => {
                  const tags = (contact.tags as string[]) || [];
                  const responsible = contact.responsible;
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-border bg-card px-4 py-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        isActive={pageNum === page}
                        onClick={() => setPage(pageNum)}
                        className="cursor-pointer"
                      >
                        {pageNum + 1}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
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

      <NewContactModal open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
