import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Kanban, MessageSquare } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  label: string;
  sub: string;
  type: 'contact' | 'deal' | 'conversation';
}

interface GlobalSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearchCommand({ open, onOpenChange }: GlobalSearchCommandProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const term = `%${q}%`;

    const [contacts, deals, conversations] = await Promise.all([
      supabase.from('contacts').select('id, name, email').ilike('name', term).limit(5),
      supabase.from('deals').select('id, title, value').ilike('title', term).limit(5),
      supabase
        .from('conversations')
        .select('id, channel, contact:contacts!inner(name)')
        .ilike('contacts.name', term)
        .limit(5),
    ]);

    const r: SearchResult[] = [];
    contacts.data?.forEach(c => r.push({ id: c.id, label: c.name, sub: c.email ?? '', type: 'contact' }));
    deals.data?.forEach(d => r.push({ id: d.id, label: d.title, sub: `R$ ${Number(d.value).toLocaleString('pt-BR')}`, type: 'deal' }));
    conversations.data?.forEach(c => {
      const contactName = (c.contact as unknown as { name: string } | null)?.name ?? 'Conversa';
      r.push({ id: c.id, label: contactName, sub: c.channel, type: 'conversation' });
    });

    setResults(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    if (result.type === 'contact') navigate('/contatos');
    else if (result.type === 'deal') navigate('/pipeline');
    else navigate('/inbox');
  };

  const iconMap = {
    contact: <Users size={14} className="text-muted-foreground" />,
    deal: <Kanban size={14} className="text-muted-foreground" />,
    conversation: <MessageSquare size={14} className="text-muted-foreground" />,
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar contatos, negócios, conversas..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{loading ? 'Buscando...' : 'Nenhum resultado encontrado.'}</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Resultados">
            {results.map(r => (
              <CommandItem key={`${r.type}-${r.id}`} onSelect={() => handleSelect(r)} className="gap-2">
                {iconMap[r.type]}
                <span>{r.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.sub}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
