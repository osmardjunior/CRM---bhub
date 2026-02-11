import { useState } from 'react';
import { Users, Search, Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { contacts } from '@/data/mock';

export default function ContatosPage() {
  const [search, setSearch] = useState('');

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Button size="sm" className="gap-2">
          <Plus size={16} />
          Novo Contato
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum contato encontrado" description="Tente buscar com outro termo." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contato</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Empresa</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Telefone</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Tags</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contact) => (
                  <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback>{contact.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{contact.name}</p>
                          <p className="text-xs text-muted-foreground">{contact.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{contact.company}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{contact.phone}</td>
                    <td className="px-4 py-3"><StatusBadge status={contact.status} /></td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
