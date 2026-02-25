import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useTags } from '@/hooks/useTags';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useFunnels } from '@/contexts/FunnelContext';

interface Filters {
  include_tags: string[];
  exclude_tags: string[];
  include_channels: string[];
  exclude_channels: string[];
  registered_from: string;
  registered_to: string;
  inactive_days_min: number | null;
  inactive_days_max: number | null;
  no_receive_days_min: number | null;
  no_receive_days_max: number | null;
  no_send_days_min: number | null;
  no_send_days_max: number | null;
  funnel_id: string;
  funnel_stage_id: string;
  conversation_status: string;
  responsible_user_id: string;
  department_id: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'webchat', label: 'Webchat' },
];

export default function CampaignFilters({ filters, onChange }: Props) {
  const { data: tags = [] } = useTags();
  const { data: departments = [] } = useDepartments();
  const { data: team = [] } = useTeamProfiles();
  const { funnels } = useFunnels();

  const selectedFunnel = funnels.find(f => f.id === filters.funnel_id);

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div className="space-y-6">

      {/* Status + Funil (CRM filters) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Conversa</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Status da Conversa</Label>
            <Select value={filters.conversation_status || 'all'} onValueChange={v => update({ conversation_status: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="new">Nova</SelectItem>
                <SelectItem value="open">Em Atendimento</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="closed">Fechada/Resolvida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Responsável</Label>
            <Select value={filters.responsible_user_id || 'all'} onValueChange={v => update({ responsible_user_id: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {team.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Departamento</Label>
            <Select value={filters.department_id || 'all'} onValueChange={v => update({ department_id: v === 'all' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Funil */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Funil de Vendas</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Funil</Label>
            <Select
              value={filters.funnel_id || 'all'}
              onValueChange={v => update({ funnel_id: v === 'all' ? '' : v, funnel_stage_id: '' })}
            >
              <SelectTrigger><SelectValue placeholder="Todos os funis" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis</SelectItem>
                {funnels.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedFunnel && (
            <div className="space-y-2">
              <Label className="text-sm">Etapa do Funil</Label>
              <Select
                value={filters.funnel_stage_id || 'all'}
                onValueChange={v => update({ funnel_stage_id: v === 'all' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {selectedFunnel.stages.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {funnels.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum funil cadastrado.</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Tags</h3>
        <div className="space-y-3">
          <Label className="text-sm">Incluir contatos com estas tags</Label>
          <div className="flex flex-wrap gap-2 min-h-[36px]">
            {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>}
            {tags.map(t => (
              <Badge
                key={t.id}
                variant={filters.include_tags.includes(t.id) ? 'default' : 'outline'}
                className="cursor-pointer"
                style={filters.include_tags.includes(t.id) ? { backgroundColor: t.color, borderColor: t.color } : {}}
                onClick={() => update({ include_tags: toggleArrayItem(filters.include_tags, t.id) })}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm">Excluir contatos com estas tags</Label>
          <div className="flex flex-wrap gap-2 min-h-[36px]">
            {tags.map(t => (
              <Badge
                key={t.id}
                variant={filters.exclude_tags.includes(t.id) ? 'destructive' : 'outline'}
                className="cursor-pointer"
                onClick={() => update({ exclude_tags: toggleArrayItem(filters.exclude_tags, t.id) })}
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Canal */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Canal</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Incluir por canal</Label>
            <div className="space-y-2">
              {CHANNELS.map(ch => (
                <label key={ch.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.include_channels.includes(ch.value)}
                    onCheckedChange={() => update({ include_channels: toggleArrayItem(filters.include_channels, ch.value) })}
                  />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Excluir por canal</Label>
            <div className="space-y-2">
              {CHANNELS.map(ch => (
                <label key={ch.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.exclude_channels.includes(ch.value)}
                    onCheckedChange={() => update({ exclude_channels: toggleArrayItem(filters.exclude_channels, ch.value) })}
                  />
                  {ch.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Datas de cadastro */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Data de Cadastro</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Cadastrado a partir de</Label>
            <Input type="date" value={filters.registered_from} onChange={e => update({ registered_from: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Cadastrado até</Label>
            <Input type="date" value={filters.registered_to} onChange={e => update({ registered_to: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Inatividade */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground border-b pb-2">Inatividade (dias)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Mais de X dias sem interagir</Label>
            <Input type="number" min={0} placeholder="Ex: 7" value={filters.inactive_days_min ?? ''} onChange={e => update({ inactive_days_min: e.target.value ? Number(e.target.value) : null })} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Menos de X dias sem interagir</Label>
            <Input type="number" min={0} placeholder="Ex: 30" value={filters.inactive_days_max ?? ''} onChange={e => update({ inactive_days_max: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>
    </div>
  );
}

export const EMPTY_FILTERS = {
  include_tags: [] as string[],
  exclude_tags: [] as string[],
  include_channels: [] as string[],
  exclude_channels: [] as string[],
  registered_from: '',
  registered_to: '',
  inactive_days_min: null as number | null,
  inactive_days_max: null as number | null,
  no_receive_days_min: null as number | null,
  no_receive_days_max: null as number | null,
  no_send_days_min: null as number | null,
  no_send_days_max: null as number | null,
  funnel_id: '',
  funnel_stage_id: '',
  conversation_status: '',
  responsible_user_id: '',
  department_id: '',
};
