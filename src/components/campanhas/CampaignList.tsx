import { Campaign } from '@/hooks/useCampaigns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pause, Play, Pencil, Trash2, Rocket, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  scheduled: { label: 'Agendada', variant: 'outline' },
  running: { label: 'Em Progresso', variant: 'default' },
  paused: { label: 'Pausada', variant: 'destructive' },
  completed: { label: 'Concluída', variant: 'default' },
};

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Disparo de Mensagem',
  archive_chats: 'Limpar Chat',
  delegate: 'Delegar Lead',
  apply_tag: 'Aplicar Tag',
  move_funnel: 'Mover p/ Funil',
  run_flow: 'Executar Fluxo',
};

interface Props {
  campaigns: Campaign[];
  onEdit: (c: Campaign) => void;
  onDelete: (id: string) => void;
  onTogglePause: (c: Campaign) => void;
  onRun: (id: string) => void;
  runningId: string | null;
}

export default function CampaignList({ campaigns, onEdit, onDelete, onTogglePause, onRun, runningId }: Props) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Nenhuma campanha criada</p>
        <p className="text-sm">Crie sua primeira campanha para ações em massa.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Ação</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead>Recipientes</TableHead>
          <TableHead>Criada em</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((c) => {
          const pct = c.total_contacts > 0 ? Math.round((c.processed / c.total_contacts) * 100) : 0;
          const st = STATUS_MAP[c.status] ?? STATUS_MAP.draft;
          return (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{ACTION_LABELS[c.action_type] ?? c.action_type}</TableCell>
              <TableCell>
                <Badge variant={st.variant}>{st.label}</Badge>
              </TableCell>
              <TableCell>
                {c.status === 'completed' && c.total_contacts === 0 ? (
                  <span className="text-xs text-amber-500">Nenhum contato encontrado</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-2 w-20" />
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {c.status === 'completed' ? `${c.processed} / ${c.total_contacts}` : c.total_contacts}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(c.created_at), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(c.status === 'draft' || c.status === 'scheduled') && (
                      <DropdownMenuItem onClick={() => onRun(c.id)} disabled={runningId === c.id}>
                        {runningId === c.id
                          ? <><Loader2 size={14} className="mr-2 animate-spin" /> Executando...</>
                          : <><Rocket size={14} className="mr-2" /> Executar Agora</>}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(c)}>
                      <Pencil size={14} className="mr-2" /> Editar
                    </DropdownMenuItem>
                    {(c.status === 'running' || c.status === 'paused') && (
                      <DropdownMenuItem onClick={() => onTogglePause(c)}>
                        {c.status === 'running' ? <><Pause size={14} className="mr-2" /> Pausar</> : <><Play size={14} className="mr-2" /> Retomar</>}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c.id)}>
                      <Trash2 size={14} className="mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
