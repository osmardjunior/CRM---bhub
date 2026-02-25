import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Send, Plus, X } from 'lucide-react';
import { Campaign } from '@/hooks/useCampaigns';
import { useChatbotFlows } from '@/hooks/useChatbotFlows';
import { useTags } from '@/hooks/useTags';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useFunnels } from '@/contexts/FunnelContext';
import CampaignFilters, { EMPTY_FILTERS } from './CampaignFilters';

const ACTION_TYPES = [
  { value: 'send_message',  label: 'Enviar Mensagem' },
  { value: 'apply_tag',     label: 'Aplicar Tag' },
  { value: 'set_status',    label: 'Alterar Status da Conversa' },
  { value: 'delegate',      label: 'Delegar Lead' },
  { value: 'move_funnel',   label: 'Mover para Funil/Etapa' },
  { value: 'run_flow',      label: 'Executar Fluxo de Chatbot' },
  { value: 'archive_chats', label: 'Fechar Conversa' },
];

const STATUS_OPTIONS = [
  { value: 'new',     label: 'Nova' },
  { value: 'open',    label: 'Em Atendimento' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed',  label: 'Fechada' },
];

type CampaignAction = { type: string; [key: string]: any };

interface Props {
  campaign?: Campaign | null;
  onSave: (data: Partial<Campaign>) => void;
  onCancel: () => void;
  saving?: boolean;
}

function initActions(campaign?: Campaign | null): CampaignAction[] {
  if (!campaign) return [];
  // New multi-action format
  if (campaign.action_config?.actions) return campaign.action_config.actions as CampaignAction[];
  // Legacy single-action format
  if (campaign.action_type && campaign.action_type !== 'multi') {
    return [{ type: campaign.action_type, ...campaign.action_config }];
  }
  return [];
}

export default function CampaignForm({ campaign, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [description, setDescription] = useState(campaign?.description ?? '');
  const [campaignDeptId, setCampaignDeptId] = useState((campaign as any)?.department_id ?? '');
  const [actions, setActions] = useState<CampaignAction[]>(() => initActions(campaign));
  const [scheduleAt, setScheduleAt] = useState(campaign?.schedule_at ? campaign.schedule_at.slice(0, 16) : '');
  const [deadlineAt, setDeadlineAt] = useState(campaign?.deadline_at ? campaign.deadline_at.slice(0, 16) : '');
  const [skipWeekends, setSkipWeekends] = useState(campaign?.skip_weekends ?? false);
  const [sendWindowStart, setSendWindowStart] = useState((campaign?.send_window as any)?.start ?? '');
  const [sendWindowEnd, setSendWindowEnd] = useState((campaign?.send_window as any)?.end ?? '');
  const [filters, setFilters] = useState(campaign?.filters ? { ...EMPTY_FILTERS, ...(campaign.filters as any) } : { ...EMPTY_FILTERS });

  const { flows } = useChatbotFlows();
  const { data: tags = [] } = useTags();
  const { data: team = [] } = useTeamProfiles();
  const { data: departments = [] } = useDepartments();
  const { funnels } = useFunnels();

  // ── Actions helpers ────────────────────────────────────────
  const addAction = () => setActions(prev => [...prev, { type: 'send_message' }]);

  const removeAction = (i: number) => setActions(prev => prev.filter((_, idx) => idx !== i));

  const updateAction = (i: number, patch: Partial<CampaignAction>) =>
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const cfgAction = (i: number, k: string, v: any) =>
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, [k]: v } : a));

  // ── Submit ─────────────────────────────────────────────────
  const validateActions = (): string | null => {
    if (actions.length === 0) return 'Adicione pelo menos uma ação na aba "Ações".';
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      if (a.type === 'send_message' && !a.message?.trim()) return `Ação ${i + 1}: preencha o texto da mensagem.`;
      if (a.type === 'apply_tag' && (!a.tag_ids || a.tag_ids.length === 0)) return `Ação ${i + 1}: selecione pelo menos uma tag.`;
      if (a.type === 'set_status' && !a.status) return `Ação ${i + 1}: selecione o status.`;
      if (a.type === 'move_funnel' && (!a.funnel_id || !a.stage_id)) return `Ação ${i + 1}: selecione o funil e a etapa.`;
      if (a.type === 'run_flow' && !a.flow_id) return `Ação ${i + 1}: selecione o fluxo de chatbot.`;
    }
    return null;
  };

  const handleSubmit = (status: 'draft' | 'scheduled') => {
    const validationError = validateActions();
    if (validationError) { alert(validationError); return; }
    onSave({
      id: campaign?.id,
      name,
      description,
      action_type: 'multi',
      action_config: { actions },
      filters,
      schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
      deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
      skip_weekends: skipWeekends,
      send_window: sendWindowStart || sendWindowEnd ? { start: sendWindowStart, end: sendWindowEnd } : {},
      status,
      ...(campaignDeptId ? { department_id: campaignDeptId } : {}),
    } as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft size={18} /></Button>
        <h2 className="text-xl font-semibold">{campaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="action">
            Ações {actions.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{actions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contacts">Filtros de Contatos</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Informações ─────────────────────── */}
        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Informações da Campanha</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da campanha *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Reengajamento de leads inativos" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o objetivo desta campanha..." rows={3} />
              </div>
              {departments.length > 0 && (
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={campaignDeptId || '_none'} onValueChange={v => setCampaignDeptId(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os departamentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Todos os departamentos</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Define qual departamento é responsável por esta campanha.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agendado para</Label>
                  <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Deixe vazio para executar manualmente</p>
                </div>
                <div className="space-y-2">
                  <Label>Prazo final</Label>
                  <Input type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Janela de envio — início</Label>
                  <Input type="time" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Janela de envio — fim</Label>
                  <Input type="time" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">
                O disparo só ocorre dentro do horário definido. Deixe vazio para sem restrição.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={skipWeekends} onCheckedChange={v => setSkipWeekends(!!v)} />
                Ignorar fins de semana (Sábado e Domingo)
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Ações ────────────────────────────── */}
        <TabsContent value="action">
          <Card>
            <CardHeader>
              <CardTitle>Ações da Campanha</CardTitle>
              <p className="text-sm text-muted-foreground">
                Adicione uma ou mais ações que serão executadas em sequência para cada contato.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {actions.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhuma ação adicionada. Clique em "+ Adicionar Ação" para começar.
                </div>
              )}

              {actions.map((action, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                      {i + 1}
                    </span>
                    <Select
                      value={action.type}
                      onValueChange={v => updateAction(i, { type: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_TYPES.map(a => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAction(i)}
                    >
                      <X size={16} />
                    </Button>
                  </div>

                  {/* Config fields */}
                  {action.type === 'send_message' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Mensagem *</Label>
                      <Textarea
                        value={action.message ?? ''}
                        onChange={e => cfgAction(i, 'message', e.target.value)}
                        placeholder="Olá {nome}! Temos uma oferta especial para você..."
                        rows={4}
                      />
                      <p className="text-[11px] text-muted-foreground">Use {`{nome}`} para incluir o nome do contato.</p>
                    </div>
                  )}

                  {action.type === 'apply_tag' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Tags a aplicar</Label>
                      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border min-h-[48px] bg-background">
                        {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada.</p>}
                        {tags.map(tag => {
                          const selected = (action.tag_ids ?? []).includes(tag.id);
                          return (
                            <Badge
                              key={tag.id}
                              variant={selected ? 'default' : 'outline'}
                              className="cursor-pointer select-none"
                              style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                              onClick={() => {
                                const ids: string[] = action.tag_ids ?? [];
                                cfgAction(i, 'tag_ids', selected ? ids.filter(id => id !== tag.id) : [...ids, tag.id]);
                              }}
                            >
                              {tag.name}
                            </Badge>
                          );
                        })}
                      </div>
                      {(action.tag_ids?.length ?? 0) > 0 && (
                        <p className="text-[11px] text-muted-foreground">{action.tag_ids.length} tag(s) selecionada(s)</p>
                      )}
                    </div>
                  )}

                  {action.type === 'set_status' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Novo status da conversa</Label>
                      <Select
                        value={action.status ?? '_none'}
                        onValueChange={v => cfgAction(i, 'status', v === '_none' ? '' : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Selecione...</SelectItem>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.type === 'delegate' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Atribuir ao usuário</Label>
                        <Select
                          value={action.user_id ?? '_none'}
                          onValueChange={v => cfgAction(i, 'user_id', v === '_none' ? '' : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {team.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Atribuir ao departamento</Label>
                        <Select
                          value={action.department_id ?? '_none'}
                          onValueChange={v => cfgAction(i, 'department_id', v === '_none' ? '' : v)}
                        >
                          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {action.type === 'move_funnel' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Funil</Label>
                        <Select
                          value={action.funnel_id ?? '_none'}
                          onValueChange={v => {
                            cfgAction(i, 'funnel_id', v === '_none' ? '' : v);
                            cfgAction(i, 'stage_id', '');
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Selecione...</SelectItem>
                            {funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {action.funnel_id && action.funnel_id !== '_none' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Etapa</Label>
                          <Select
                            value={action.stage_id ?? '_none'}
                            onValueChange={v => cfgAction(i, 'stage_id', v === '_none' ? '' : v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">Selecione...</SelectItem>
                              {(funnels.find(f => f.id === action.funnel_id)?.stages ?? []).map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {action.type === 'run_flow' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Fluxo de Chatbot</Label>
                      <Select
                        value={action.flow_id ?? '_none'}
                        onValueChange={v => cfgAction(i, 'flow_id', v === '_none' ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o fluxo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Selecione...</SelectItem>
                          {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {action.type === 'archive_chats' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                      Esta ação irá <strong>fechar</strong> as conversas de todos os contatos filtrados. Esta ação não pode ser desfeita em massa.
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" className="w-full" onClick={addAction}>
                <Plus size={16} className="mr-2" /> Adicionar Ação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: Filtros ─────────────────────────── */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Contatos</CardTitle>
              <p className="text-sm text-muted-foreground">
                Define quais contatos receberão esta campanha. <strong>Sem filtros = todos os contatos.</strong>
              </p>
            </CardHeader>
            <CardContent>
              <CampaignFilters filters={filters} onChange={setFilters} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button variant="secondary" onClick={() => handleSubmit('draft')} disabled={!name || saving}>
          <Save size={16} className="mr-2" /> Salvar Rascunho
        </Button>
        <Button onClick={() => handleSubmit('scheduled')} disabled={!name || saving}>
          <Send size={16} className="mr-2" /> {scheduleAt ? 'Agendar' : 'Salvar e Executar'}
        </Button>
      </div>
    </div>
  );
}
