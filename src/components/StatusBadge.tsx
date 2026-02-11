import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  // DB enum statuses
  open: { label: 'Aberta', className: 'bg-info/15 text-info border-info/20' },
  pending: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/20' },
  closed: { label: 'Fechada', className: 'bg-success/15 text-success border-success/20' },
  // Legacy / mock statuses
  aberta: { label: 'Aberta', className: 'bg-info/15 text-info border-info/20' },
  pendente: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/20' },
  resolvida: { label: 'Resolvida', className: 'bg-success/15 text-success border-success/20' },
  online: { label: 'Online', className: 'bg-success/15 text-success border-success/20' },
  ausente: { label: 'Ausente', className: 'bg-warning/15 text-warning border-warning/20' },
  offline: { label: 'Offline', className: 'bg-muted text-muted-foreground border-border' },
  alta: { label: 'Alta', className: 'bg-destructive/15 text-destructive border-destructive/20' },
  media: { label: 'Média', className: 'bg-warning/15 text-warning border-warning/20' },
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground border-border' },
  em_progresso: { label: 'Em Progresso', className: 'bg-info/15 text-info border-info/20' },
  concluida: { label: 'Concluída', className: 'bg-success/15 text-success border-success/20' },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
