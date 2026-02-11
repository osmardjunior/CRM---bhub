import { Badge } from '@/components/ui/badge';

const statusConfig = {
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
} as const;

export default function StatusBadge({ status }: { status: keyof typeof statusConfig }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
