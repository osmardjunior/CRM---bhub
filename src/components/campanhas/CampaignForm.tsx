import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Send, Plus, X, Users, Loader2 } from 'lucide-react';
import { Campaign } from '@/hooks/useCampaigns';
import { useChatbotFlows } from '@/hooks/useChatbotFlows';
import { useTags } from '@/hooks/useTags';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useFunnels } from '@/contexts/FunnelContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const [campaignDeptId, setCampaignDeptId] = useState((campaign as Partial<Campaign> & { department_id?: string })?.department_id ?? '');
  const [actions, setActions] = useState<CampaignAction[]>(() => initActions(campaign));
  const [scheduleAt, setScheduleAt] = useState(campaign?.schedule_at ? campaign.schedule_at.slice(0, 16) : '');
  const [deadlineAt, setDeadlineAt] = useState(campaign?.deadline_at ? campaign.deadline_at.slice(0, 16) : '');
  const [skipWeekends, setSkipWeekends] = useState(campaign?.skip_weekends ?? false);
  const [sendWindowStart, setSendWindowStart] = useState((campaign?.send_window as { start?: string; end?: string } | null)?.start ?? '');
  const [sendWindowEnd, setSendWindowEnd] = useState((campaign?.send_window as { start?: string; end?: string } | null)?.end ?? '');
  const [filters, setFilters] = useState(campaign?.filters ? { ...EMPTY_FILTERS, ...(campaign.filters as Record<string, unknown>) } : { ...EMPTY_FILTERS });
  const [minDelay, setMinDelay] = useState(campaign?.min_delay_seconds ?? 3);
  const [maxDelay, setMaxDelay] = useState(campaign?.max_delay_seconds ?? 8);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set(campaign?.excluded_contact_ids ?? []));
  const [previewContacts, setPreviewContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const { companyId } = useAuth();
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

  // ── Preview ────────────────────────────────────────────────
  const loadPreview = useCallback(async () => {
    if (!companyId) return;
    setPreviewLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('id, name, phone, conversations(id, status, channel, last_message_at, assigned_user_id)')
        .eq('company_id', companyId)
        .eq('is_group', false);

      if (filters.registered_from) query = query.gte('created_at', filters.registered_from);
      if (filters.registered_to) query = query.lte('created_at', `${filters.registered_to}T23:59:59Z`);

      const { data: raw } = await query;
      const contacts = (raw ?? []) as Array<{ id: string; name: string; phone: string; conversations: any[] }>;

      // Include/exclude tags
      let includeTagIds: Set<string> | null = null;
      let excludeTagIds: Set<string> | null = null;
      if (filters.include_tags?.length > 0) {
        const { data: tagRows } = await supabase.from('contact_tags').select('contact_id').in('tag_id', filters.include_tags).eq('company_id', companyId);
        includeTagIds = new Set((tagRows ?? []).map((r: any) => r.contact_id));
      }
      if (filters.exclude_tags?.length > 0) {
        const { data: exRows } = await supabase.from('contact_tags').select('contact_id').in('tag_id', filters.exclude_tags).eq('company_id', companyId);
        excludeTagIds = new Set((exRows ?? []).map((r: any) => r.contact_id));
      }

      // Funnel filter
      let funnelIds: Set<string> | null = null;
      if (filters.funnel_id && filters.funnel_id !== 'all') {
        const fq = supabase.from('contact_funnel_stages').select('contact_id').eq('funnel_id', filters.funnel_id);
        if (filters.funnel_stage_id && filters.funnel_stage_id !== 'all') fq.eq('stage_id', filters.funnel_stage_id);
        const { data: fRows } = await fq;
        funnelIds = new Set((fRows ?? []).map((r: any) => r.contact_id));
      }

      const filtered = contacts.filter(c => {
        if (includeTagIds && !includeTagIds.has(c.id)) return false;
        if (excludeTagIds && excludeTagIds.has(c.id)) return false;
        if (funnelIds && !funnelIds.has(c.id)) return false;
        const convs = c.conversations ?? [];
        if (convs.length === 0) return false;
        const latest = [...convs].sort((a: any, b: any) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime())[0];
        if (filters.conversation_status && filters.conversation_status !== 'all') {
          const map: Record<string, string[]> = { open: ['open', 'new'], new: ['new'], pending: ['pending'], closed: ['closed', 'resolved'] };
          const allowed = map[filters.conversation_status] ?? [filters.conversation_status];
          if (!allowed.includes(latest.status)) return false;
        }
        if (filters.responsible_user_id && filters.responsible_user_id !== 'all' && latest.assigned_user_id !== filters.responsible_user_id) return false;
        if (filters.include_channels?.length > 0 && !filters.include_channels.includes(latest.channel)) return false;
        if (filters.exclude_channels?.length > 0 && filters.exclude_channels.includes(latest.channel)) return false;
        if (filters.inactive_days_min != null || filters.inactive_days_max != null) {
          const days = (Date.now() - new Date(latest.last_message_at ?? 0).getTime()) / 86400000;
          if (filters.inactive_days_min != null && days < filters.inactive_days_min) return false;
          if (filters.inactive_days_max != null && days > filters.inactive_days_max) return false;
        }
        return true;
      });

      setPreviewContacts(filtered.map(c => ({ id: c.id, name: c.name || c.phone || 'Sem nome', phone: c.phone || '—' })));
      setPreviewLoaded(true);
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  }, [companyId, filters]);

  // Reset preview when filters change
  useEffect(() => { setPreviewLoaded(false); }, [filters]);

  const toggleExclude = (contactId: string) => {
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  };

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
    if (minDelay < 2 || maxDelay < 2) { alert('Delay mínimo é 2 segundos.'); return; }
    if (minDelay > maxDelay) { alert('Delay mínimo não pode ser maior que o máximo.'); return; }
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
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelay,
      excluded_contact_ids: Array.from(excludedIds),
      status,
      ...(campaignDeptId ? { department_id: campaignDeptId } : {}),
    } as Partial<Campaign>);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft size={18} /></Button>
        <h2 className="text-xl font-semibold">{campaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="action">
            Ações {actions.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{actions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contacts">Filtros</TabsTrigger>
          <TabsTrigger value="preview">
            Preview {previewLoaded && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{previewContacts.length - excludedIds.size}</Badge>}
          </TabsTrigger>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delay mínimo entre envios (segundos)</Label>
                  <Input type="number" min={2} value={minDelay} onChange={e => setMinDelay(Math.max(2, Number(e.target.value)))} />
                  <p className="text-[11px] text-muted-foreground">Mínimo: 2 segundos</p>
                </div>
                <div className="space-y-2">
                  <Label>Delay máximo entre envios (segundos)</Label>
                  <Input type="number" min={2} value={maxDelay} onChange={e => setMaxDelay(Math.max(2, Number(e.target.value)))} />
                  <p className="text-[11px] text-muted-foreground">Intervalo aleatório entre min e máx</p>
                </div>
              </div>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        {/* ── TAB 4: Preview ─────────────────────────── */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={18} />
                Preview de Destinatários
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Visualize quais contatos receberão esta campanha. Desmarque para excluir individualmente.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={loadPreview} disabled={previewLoading}>
                {previewLoading ? <><Loader2 size={16} className="mr-2 animate-spin" /> Carregando...</> : 'Carregar Preview'}
              </Button>

              {previewLoaded && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">{previewContacts.length} contatos encontrados</Badge>
                    {excludedIds.size > 0 && (
                      <Badge variant="destructive">{excludedIds.size} excluído(s)</Badge>
                    )}
                    <span className="text-muted-foreground">
                      Envio para <strong>{previewContacts.length - excludedIds.size}</strong> contato(s)
                    </span>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2 text-left w-10">
                            <Checkbox
                              checked={excludedIds.size === 0}
                              onCheckedChange={(checked) => {
                                if (checked) setExcludedIds(new Set());
                                else setExcludedIds(new Set(previewContacts.map(c => c.id)));
                              }}
                            />
                          </th>
                          <th className="p-2 text-left">Contato</th>
                          <th className="p-2 text-left">Telefone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewContacts.map(c => (
                          <tr key={c.id} className={`border-t border-border ${excludedIds.has(c.id) ? 'opacity-40' : ''}`}>
                            <td className="p-2">
                              <Checkbox
                                checked={!excludedIds.has(c.id)}
                                onCheckedChange={() => toggleExclude(c.id)}
                              />
                            </td>
                            <td className="p-2">{c.name}</td>
                            <td className="p-2 font-mono text-xs">{c.phone}</td>
                          </tr>
                        ))}
                        {previewContacts.length === 0 && (
                          <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum contato encontrado com os filtros atuais.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:justify-end">
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
