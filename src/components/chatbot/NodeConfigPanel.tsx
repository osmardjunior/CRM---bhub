import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Check, Users, Building2, RotateCcw } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useFunnels } from '@/contexts/FunnelContext';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import type { ChatbotNode } from '@/hooks/useChatbotFlows';

type NodeType = ChatbotNode['node_type'];

const NODE_TYPE_LABELS: Record<string, string> = {
  message: 'Mensagem',
  menu: 'Menu de Opções',
  collect_data: 'Coleta de Dados',
  ai_response: 'Resposta IA',
  transfer: 'Encaminhar para Atendente',
  condition: 'Condição de Horário',
  apply_tag: 'Aplicar Tag',
  move_to_funnel: 'Mover para Funil',
  delegate: 'Delegar Chat',
  delay: 'Aguardar (Delay)',
  close_chat: 'Encerrar Chat',
  webhook: 'Webhook',
};

interface NodeConfigPanelProps {
  node: ChatbotNode;
  onSave: (data: { id: string; node_type?: NodeType; config?: Record<string, any> }) => void;
}

export default function NodeConfigPanel({ node, onSave }: NodeConfigPanelProps) {
  const [config, setConfig] = useState<Record<string, any>>({});
  const { data: tags = [] } = useTags();
  const { funnels } = useFunnels();
  const { data: team = [] } = useTeamProfiles();
  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    setConfig({ ...node.config });
  }, [node.id, node.config]);

  const handleSave = () => {
    onSave({ id: node.id, config });
  };

  const renderApplyTag = () => (
    <div className="space-y-3">
      <Label className="text-sm font-semibold">Tags a aplicar</Label>
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada. Crie tags na página de Tags.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tags.map(tag => {
            const selected = ((config.tag_ids as string[]) || []).includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  const ids = (config.tag_ids || []) as string[];
                  setConfig({ ...config, tag_ids: selected ? ids.filter(id => id !== tag.id) : [...ids, tag.id] });
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border-2"
                style={{
                  backgroundColor: selected ? tag.color : 'transparent',
                  borderColor: tag.color,
                  color: selected ? '#fff' : tag.color,
                }}
              >
                <div
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                  style={{
                    borderColor: selected ? '#fff' : tag.color,
                    backgroundColor: selected ? 'rgba(255,255,255,0.25)' : 'transparent',
                  }}
                >
                  {selected && <Check size={12} style={{ color: '#fff' }} />}
                </div>
                <span className="truncate">{tag.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDelegate = () => {
    const userIds = (config.user_ids || []) as string[];
    const departmentIds = (config.department_ids || []) as string[];

    return (
      <div className="space-y-5">
        {/* Seção Usuários */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} />
            Usuários
          </div>
          <div className="space-y-2 pl-1">
            {team.map(m => {
              const checked = userIds.includes(m.id);
              return (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => {
                      setConfig({
                        ...config,
                        user_ids: v ? [...userIds, m.id] : userIds.filter(id => id !== m.id),
                      });
                    }}
                  />
                  <span className="text-sm flex-1">{m.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {m.role}
                  </Badge>
                </div>
              );
            })}
            {team.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={config.remove_other_users || false}
              onCheckedChange={v => setConfig({ ...config, remove_other_users: !!v })}
            />
            <Label className="text-sm font-normal text-muted-foreground">Remover outros usuários delegados</Label>
          </div>
        </div>

        <Separator />

        {/* Seção Departamentos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 size={16} />
            Departamentos
          </div>
          <div className="space-y-2 pl-1">
            {departments.map(d => {
              const checked = departmentIds.includes(d.id);
              return (
                <div key={d.id} className="flex items-center gap-2.5">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={v => {
                      setConfig({
                        ...config,
                        department_ids: v ? [...departmentIds, d.id] : departmentIds.filter(id => id !== d.id),
                      });
                    }}
                  />
                  <span className="text-sm">{d.name}</span>
                </div>
              );
            })}
            {departments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado.</p>}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              checked={config.remove_other_departments || false}
              onCheckedChange={v => setConfig({ ...config, remove_other_departments: !!v })}
            />
            <Label className="text-sm font-normal text-muted-foreground">Remover outros grupos delegados</Label>
          </div>
        </div>

        <Separator />

        {/* Seção Rodízio */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RotateCcw size={16} />
            Rodízio
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={config.round_robin || false}
              onCheckedChange={v => setConfig({ ...config, round_robin: v })}
            />
            <Label className="text-sm font-normal">Ativar Rodízio no Departamento</Label>
          </div>
          {config.round_robin && (
            <div className="space-y-2 pl-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={config.round_robin_single_user || false}
                  onCheckedChange={v => setConfig({ ...config, round_robin_single_user: !!v })}
                />
                <Label className="text-sm font-normal text-muted-foreground">
                  Delegar apenas para um usuário deste departamento (não será delegado para o departamento)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={config.prefer_online || false}
                  onCheckedChange={v => setConfig({ ...config, prefer_online: !!v })}
                />
                <Label className="text-sm font-normal text-muted-foreground">
                  Dar preferência para quem estiver online
                </Label>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFields = () => {
    switch (node.node_type) {
      case 'message':
        return (
          <div className="space-y-3">
            <Label>Texto da mensagem</Label>
            <Textarea
              placeholder="Olá! Bem-vindo ao nosso atendimento..."
              value={config.text || ''}
              onChange={e => setConfig({ ...config, text: e.target.value })}
              rows={5}
            />
          </div>
        );

      case 'menu':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texto do menu</Label>
              <Input
                placeholder="Escolha uma opção:"
                value={config.text || ''}
                onChange={e => setConfig({ ...config, text: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Opções</Label>
              {(config.options as any[] || []).map((opt: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    value={opt.label}
                    onChange={e => {
                      const opts = [...(config.options || [])];
                      opts[i] = { ...opts[i], label: e.target.value };
                      setConfig({ ...config, options: opts });
                    }}
                    placeholder="Nome da opção"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                    const opts = (config.options || []).filter((_: any, j: number) => j !== i);
                    setConfig({ ...config, options: opts });
                  }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setConfig({ ...config, options: [...(config.options || []), { label: '', next_position: null }] })}>
                <Plus size={14} className="mr-1" /> Adicionar opção
              </Button>
            </div>
          </div>
        );

      case 'collect_data':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem para o cliente</Label>
              <Input placeholder="Por favor, informe seus dados:" value={config.prompt || ''} onChange={e => setConfig({ ...config, prompt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Campos a coletar</Label>
              {['name', 'email', 'phone'].map(field => (
                <div key={field} className="flex items-center gap-2">
                  <Checkbox
                    checked={(config.fields || []).includes(field)}
                    onCheckedChange={checked => {
                      const fields = config.fields || [];
                      setConfig({ ...config, fields: checked ? [...fields, field] : fields.filter((f: string) => f !== field) });
                    }}
                  />
                  <Label className="text-sm font-normal">{{ name: 'Nome', email: 'E-mail', phone: 'Telefone' }[field]}</Label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'ai_response':
        return (
          <div className="space-y-3">
            <Label>Instruções adicionais para a IA (opcional)</Label>
            <Textarea
              placeholder="Contexto extra para esta etapa..."
              value={config.context || ''}
              onChange={e => setConfig({ ...config, context: e.target.value })}
              rows={5}
            />
          </div>
        );

      case 'transfer':
        return (
          <div className="space-y-3">
            <Label>Mensagem ao transferir</Label>
            <Input placeholder="Transferindo para um atendente..." value={config.message || ''} onChange={e => setConfig({ ...config, message: e.target.value })} />
          </div>
        );

      case 'condition':
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Esta etapa verifica automaticamente se o horário atual está dentro do horário de atendimento configurado nas Configurações Gerais do fluxo.
            </p>
            <p className="text-sm text-muted-foreground">
              • <strong>Dentro do horário</strong>: segue para a próxima etapa.<br />
              • <strong>Fora do horário</strong>: envia a mensagem de fora do horário e encerra.
            </p>
          </div>
        );

      case 'apply_tag':
        return renderApplyTag();

      case 'move_to_funnel':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funil</Label>
              <Select value={config.funnel_id || ''} onValueChange={v => setConfig({ ...config, funnel_id: v, stage_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                <SelectContent>
                  {funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {config.funnel_id && (
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={config.stage_id || ''} onValueChange={v => setConfig({ ...config, stage_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                  <SelectContent>
                    {(funnels.find(f => f.id === config.funnel_id)?.stages || []).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        );

      case 'delegate':
        return renderDelegate();

      case 'delay':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Aguarda um tempo antes de executar a próxima etapa do fluxo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Minutos</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.minutes ?? 0}
                  onChange={e => setConfig({ ...config, minutes: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Segundos</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={config.seconds ?? 0}
                  onChange={e => setConfig({ ...config, seconds: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
        );

      case 'close_chat':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mensagem ao encerrar (opcional)</Label>
              <Textarea
                placeholder="Obrigado pelo contato! Até a próxima."
                value={config.message || ''}
                onChange={e => setConfig({ ...config, message: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Status final</Label>
              <Select value={config.status || 'closed'} onValueChange={v => setConfig({ ...config, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Fechado</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
              <Input
                placeholder="https://seu-sistema.com/webhook"
                value={config.url || ''}
                onChange={e => setConfig({ ...config, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Método</Label>
              <Select value={config.method || 'POST'} onValueChange={v => setConfig({ ...config, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Headers (JSON, opcional)</Label>
              <Textarea
                placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                value={config.headers || ''}
                onChange={e => setConfig({ ...config, headers: e.target.value })}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>
        );

      default:
        return <p className="text-sm text-muted-foreground">Tipo de etapa desconhecido.</p>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {NODE_TYPE_LABELS[node.node_type] || node.node_type}
          </h3>
          <p className="text-xs text-muted-foreground">Etapa #{node.position + 1}</p>
        </div>
        <Button size="sm" onClick={handleSave}>
          <Save size={14} className="mr-1" /> Salvar
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {renderFields()}
      </div>
    </div>
  );
}
