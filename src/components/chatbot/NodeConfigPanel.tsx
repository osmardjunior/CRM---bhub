import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useFunnels } from '@/contexts/FunnelContext';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
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

  useEffect(() => {
    setConfig({ ...node.config });
  }, [node.id, node.config]);

  const handleSave = () => {
    onSave({ id: node.id, config });
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

      case 'apply_tag' as any:
        return (
          <div className="space-y-3">
            <Label>Tags a aplicar</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => {
                const selected = ((config.tag_ids as string[]) || []).includes(tag.id);
                return (
                  <Badge
                    key={tag.id}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer transition-colors"
                    style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : { borderColor: tag.color, color: tag.color }}
                    onClick={() => {
                      const ids = (config.tag_ids || []) as string[];
                      setConfig({ ...config, tag_ids: selected ? ids.filter(id => id !== tag.id) : [...ids, tag.id] });
                    }}
                  >
                    {tag.name}
                  </Badge>
                );
              })}
            </div>
            {tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada. Crie tags na página de Tags.</p>}
          </div>
        );

      case 'move_to_funnel' as any:
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

      case 'delegate' as any:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delegar para</Label>
              <Select value={config.delegate_to || ''} onValueChange={v => setConfig({ ...config, delegate_to: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
                <SelectContent>
                  {team.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={config.round_robin || false}
                onCheckedChange={v => setConfig({ ...config, round_robin: v, delegate_to: v ? '' : config.delegate_to })}
              />
              <Label className="text-sm font-normal">Rodízio automático entre membros</Label>
            </div>
            {config.round_robin && (
              <p className="text-sm text-muted-foreground">O chat será delegado automaticamente para o próximo membro disponível.</p>
            )}
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
