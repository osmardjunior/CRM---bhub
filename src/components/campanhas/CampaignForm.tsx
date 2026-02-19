import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Campaign } from '@/hooks/useCampaigns';
import { useChatbotFlows } from '@/hooks/useChatbotFlows';
import CampaignFilters, { EMPTY_FILTERS } from './CampaignFilters';

const ACTION_TYPES = [
  { value: 'send_message', label: 'Disparo de Mensagem' },
  { value: 'archive_chats', label: 'Limpar Chat (Arquivar)' },
  { value: 'delegate', label: 'Delegar Lead' },
  { value: 'apply_tag', label: 'Aplicar Tag' },
  { value: 'move_funnel', label: 'Mover para Funil' },
  { value: 'run_flow', label: 'Executar Fluxo de Chatbot' },
];

interface Props {
  campaign?: Campaign | null;
  onSave: (data: Partial<Campaign>) => void;
  onCancel: () => void;
  saving?: boolean;
}

export default function CampaignForm({ campaign, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [description, setDescription] = useState(campaign?.description ?? '');
  const [actionType, setActionType] = useState(campaign?.action_type ?? 'send_message');
  const [actionConfig, setActionConfig] = useState<Record<string, any>>(campaign?.action_config ?? {});
  const [scheduleAt, setScheduleAt] = useState(campaign?.schedule_at ? campaign.schedule_at.slice(0, 16) : '');
  const [deadlineAt, setDeadlineAt] = useState(campaign?.deadline_at ? campaign.deadline_at.slice(0, 16) : '');
  const [skipWeekends, setSkipWeekends] = useState(campaign?.skip_weekends ?? false);
  const [sendWindowStart, setSendWindowStart] = useState((campaign?.send_window as any)?.start ?? '');
  const [sendWindowEnd, setSendWindowEnd] = useState((campaign?.send_window as any)?.end ?? '');
  const [filters, setFilters] = useState(campaign?.filters ? { ...EMPTY_FILTERS, ...(campaign.filters as any) } : { ...EMPTY_FILTERS });

  const { flows } = useChatbotFlows();

  const handleSubmit = (status: 'draft' | 'scheduled') => {
    onSave({
      id: campaign?.id,
      name,
      description,
      action_type: actionType,
      action_config: actionConfig,
      filters,
      schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : null,
      deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
      skip_weekends: skipWeekends,
      send_window: sendWindowStart || sendWindowEnd ? { start: sendWindowStart, end: sendWindowEnd } : {},
      status,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft size={18} />
        </Button>
        <h2 className="text-xl font-semibold">{campaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="action">Diálogo / Ação</TabsTrigger>
          <TabsTrigger value="contacts">Contatos (Filtros)</TabsTrigger>
        </TabsList>

        {/* TAB 1: Informações */}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data/hora de envio</Label>
                  <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prazo para finalizar</Label>
                  <Input type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Janela de envio (início)</Label>
                  <Input type="time" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Janela de envio (fim)</Label>
                  <Input type="time" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={skipWeekends} onCheckedChange={v => setSkipWeekends(!!v)} />
                Ignorar fins de semana (Sábado e Domingo)
              </label>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Ação */}
        <TabsContent value="action">
          <Card>
            <CardHeader><CardTitle>Diálogo / Ação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Ação *</Label>
                <Select value={actionType} onValueChange={v => { setActionType(v); setActionConfig({}); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {actionType === 'send_message' && (
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={actionConfig.message ?? ''}
                    onChange={e => setActionConfig({ ...actionConfig, message: e.target.value })}
                    placeholder="Digite a mensagem que será enviada..."
                    rows={4}
                  />
                </div>
              )}

              {actionType === 'run_flow' && (
                <div className="space-y-2">
                  <Label>Selecionar Fluxo de Chatbot</Label>
                  <Select value={actionConfig.flow_id ?? ''} onValueChange={v => setActionConfig({ ...actionConfig, flow_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
                    <SelectContent>
                      {flows.map(f => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {actionType === 'archive_chats' && (
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                  Esta ação irá arquivar (fechar) todas as conversas dos contatos filtrados que estejam com status "fechada", limpando o CRM.
                </div>
              )}

              {actionType === 'delegate' && (
                <div className="space-y-2">
                  <Label>Delegar para</Label>
                  <Input
                    value={actionConfig.delegate_to ?? ''}
                    onChange={e => setActionConfig({ ...actionConfig, delegate_to: e.target.value })}
                    placeholder="Nome do usuário ou departamento"
                  />
                </div>
              )}

              {actionType === 'apply_tag' && (
                <div className="space-y-2">
                  <Label>IDs das Tags (separados por vírgula)</Label>
                  <Input
                    value={actionConfig.tag_ids?.join(', ') ?? ''}
                    onChange={e => setActionConfig({ ...actionConfig, tag_ids: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                    placeholder="tag-id-1, tag-id-2"
                  />
                </div>
              )}

              {actionType === 'move_funnel' && (
                <div className="space-y-2">
                  <Label>ID da Etapa do Funil</Label>
                  <Input
                    value={actionConfig.funnel_stage_id ?? ''}
                    onChange={e => setActionConfig({ ...actionConfig, funnel_stage_id: e.target.value })}
                    placeholder="ID da etapa destino"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Filtros */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader><CardTitle>Filtros de Contatos</CardTitle></CardHeader>
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
          <Send size={16} className="mr-2" /> Agendar
        </Button>
      </div>
    </div>
  );
}
