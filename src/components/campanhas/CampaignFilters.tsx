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

  const allStages = funnels.flatMap(f => f.stages.map(s => ({ ...s, funnelName: f.name })));

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div className="space-y-6">
      {/* Tags */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Incluir quem tiver estas Tags</Label>
        <div className="flex flex-wrap gap-2">
          {tags.map(t => (
            <Badge
              key={t.id}
              variant={filters.include_tags.includes(t.id) ? 'default' : 'outline'}
              className="cursor-pointer"
              style={filters.include_tags.includes(t.id) ? { backgroundColor: t.color } : {}}
              onClick={() => update({ include_tags: toggleArrayItem(filters.include_tags, t.id) })}
            >
              {t.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Excluir quem tiver estas Tags</Label>
        <div className="flex flex-wrap gap-2">
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

      {/* Channels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Incluir por Canal</Label>
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
          <Label className="text-sm font-semibold">Excluir por Canal</Label>
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

      {/* Registration dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Cadastrado a partir de</Label>
          <Input type="date" value={filters.registered_from} onChange={e => update({ registered_from: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Cadastrado até</Label>
          <Input type="date" value={filters.registered_to} onChange={e => update({ registered_to: e.target.value })} />
        </div>
      </div>

      {/* Inactivity */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Mais de X dias sem interagir</Label>
          <Input type="number" min={0} placeholder="Ex: 7" value={filters.inactive_days_min ?? ''} onChange={e => update({ inactive_days_min: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Menos de X dias sem interagir</Label>
          <Input type="number" min={0} placeholder="Ex: 30" value={filters.inactive_days_max ?? ''} onChange={e => update({ inactive_days_max: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Mais de X dias sem receber msg</Label>
          <Input type="number" min={0} placeholder="Ex: 7" value={filters.no_receive_days_min ?? ''} onChange={e => update({ no_receive_days_min: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Menos de X dias sem receber msg</Label>
          <Input type="number" min={0} placeholder="Ex: 30" value={filters.no_receive_days_max ?? ''} onChange={e => update({ no_receive_days_max: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Mais de X dias sem enviar msg</Label>
          <Input type="number" min={0} placeholder="Ex: 7" value={filters.no_send_days_min ?? ''} onChange={e => update({ no_send_days_min: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Menos de X dias sem enviar msg</Label>
          <Input type="number" min={0} placeholder="Ex: 30" value={filters.no_send_days_max ?? ''} onChange={e => update({ no_send_days_max: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>

      {/* Funnel Stage */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Etapa do Funil</Label>
          <Select value={filters.funnel_stage_id} onValueChange={v => update({ funnel_stage_id: v })}>
            <SelectTrigger><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {allStages.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.funnelName} → {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Status de Conversa</Label>
          <Select value={filters.conversation_status} onValueChange={v => update({ conversation_status: v })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="closed">Fechada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Responsible & Department */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Responsável</Label>
          <Select value={filters.responsible_user_id} onValueChange={v => update({ responsible_user_id: v })}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {team.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Departamento</Label>
          <Select value={filters.department_id} onValueChange={v => update({ department_id: v })}>
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
  funnel_stage_id: '',
  conversation_status: '',
  responsible_user_id: '',
  department_id: '',
};
