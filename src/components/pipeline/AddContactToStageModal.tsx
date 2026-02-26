import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useContacts } from '@/hooks/useContacts';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (contactId: string) => void;
  existingContactIds: string[];
}

export default function AddContactToStageModal({ open, onClose, onAdd, existingContactIds }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) { setSearch(''); setDebouncedSearch(''); }
  }, [open]);

  const { data: contactsResult, isLoading } = useContacts(
    debouncedSearch ? { search: debouncedSearch } : undefined
  );

  const allContacts = Array.isArray(contactsResult) ? contactsResult : (contactsResult?.data ?? []);
  const filtered = allContacts.filter((c) => !existingContactIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Contato</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato encontrado</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onAdd(c.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-accent text-left transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">
                      {c.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {c.phone && (
                      <p className="text-[11px] text-muted-foreground">{c.phone}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
