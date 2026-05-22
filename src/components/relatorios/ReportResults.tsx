import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import type { ReportType } from '@/hooks/useReportBuilder';

const senderLabels: Record<string, string> = { agent: 'Agente', user: 'Contato', contact: 'Contato', system: 'Sistema', bot: 'Bot' };

function exportCSV(rows: any[], reportType: ReportType) {
  const isChat = reportType === 'chats';
  const isMsg = reportType === 'messages';

  let headers: string[];
  let csvRows: string[];

  if (isMsg) {
    headers = ['Contato', 'Telefone', 'Canal', 'Remetente', 'Tipo', 'Conteúdo', 'Data'];
    csvRows = rows.map(row => {
      const conv = row.conversation;
      const contact = conv?.contact;
      return [
        contact?.name ?? '',
        contact?.phone ?? '',
        conv?.channel ?? '',
        senderLabels[row.sender_type] || row.sender_type,
        row.type || 'texto',
        (row.body || '').slice(0, 200),
        row.created_at ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm') : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
  } else {
    headers = ['Nome', 'Telefone', 'Cadastro', ...(isChat ? ['Canal', 'Status'] : []), 'Última interação', 'Tags'];
    csvRows = rows.map(row => {
      const contact = isChat ? row.contact : row;
      const tags = Array.isArray(contact?.tags) ? contact.tags.join('; ') : '';
      const lastContact = isChat ? row.last_message_at : contact?.last_contact_at;
      return [
        contact?.name ?? '',
        contact?.phone ?? '',
        contact?.created_at ? format(new Date(contact.created_at), 'dd/MM/yyyy') : '',
        ...(isChat ? [row.channel ?? '', row.status ?? ''] : []),
        lastContact ? format(new Date(lastContact), 'dd/MM/yyyy HH:mm') : '',
        tags,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
  }

  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  reportType: ReportType;
  rows: any[];
  total: number;
  page: number;
  onPageChange: (p: number) => void;
  isLoading: boolean;
}

const PAGE_SIZE = 25;

export default function ReportResults({ reportType, rows, total, page, onPageChange, isLoading }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card card-shadow p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card card-shadow p-10 text-center text-sm text-muted-foreground">
        Nenhum resultado encontrado. Ajuste os filtros e tente novamente.
      </div>
    );
  }

  const isChat = reportType === 'chats';
  const isMsg = reportType === 'messages';

  return (
    <div className="rounded-xl border border-border bg-card card-shadow">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {total} resultado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </span>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => exportCSV(rows, reportType)}>
          <Download size={13} /> Exportar CSV
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {isMsg ? (
              <>
                <TableHead>Contato</TableHead>
                <TableHead className="hidden sm:table-cell">Canal</TableHead>
                <TableHead>Remetente</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="max-w-[300px] hidden lg:table-cell">Conteúdo</TableHead>
                <TableHead>Data</TableHead>
              </>
            ) : (
              <>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                <TableHead className="hidden md:table-cell">Cadastro</TableHead>
                {isChat && <TableHead className="hidden md:table-cell">Canal</TableHead>}
                {isChat && <TableHead>Status</TableHead>}
                <TableHead className="hidden lg:table-cell">Última interação</TableHead>
                <TableHead className="hidden xl:table-cell">Tags</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isMsg ? rows.map((row) => {
            const conv = row.conversation;
            const contact = conv?.contact;
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{contact?.name ?? '—'}</TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className="text-xs capitalize">{conv?.channel ?? '—'}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={row.sender_type === 'agent' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {senderLabels[row.sender_type] || row.sender_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize hidden md:table-cell">{row.type || 'texto'}</TableCell>
                <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground hidden lg:table-cell">
                  {row.body || (row.type ? `[${row.type}]` : '—')}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {row.created_at ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                </TableCell>
              </TableRow>
            );
          }) : rows.map((row) => {
            const contact = isChat ? row.contact : row;
            const tags: string[] = Array.isArray(contact?.tags) ? contact.tags : [];

            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{contact?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">{contact?.phone ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {contact?.created_at ? format(new Date(contact.created_at), 'dd/MM/yyyy') : '—'}
                </TableCell>
                {isChat && (
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-xs capitalize">{row.channel}</Badge>
                  </TableCell>
                )}
                {isChat && (
                  <TableCell>
                    <Badge
                      variant={row.status === 'open' ? 'default' : 'secondary'}
                      className="text-xs capitalize"
                    >
                      {row.status === 'open' ? 'Aberto' : row.status === 'closed' ? 'Fechado' : 'Pendente'}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground hidden lg:table-cell">
                  {(isChat ? row.last_message_at : contact?.last_contact_at)
                    ? format(new Date(isChat ? row.last_message_at : contact.last_contact_at), 'dd/MM/yyyy HH:mm')
                    : '—'}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 3).map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                    {tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{tags.length - 3}</Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="p-4 border-t border-border">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => page > 1 && onPageChange(page - 1)}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={pageNum === page}
                      onClick={() => onPageChange(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => page < totalPages && onPageChange(page + 1)}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
