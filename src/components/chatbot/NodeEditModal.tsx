import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import type { ChatbotNode } from '@/hooks/useChatbotFlows';

type NodeType = ChatbotNode['node_type'];

interface NodeEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node?: ChatbotNode | null;
  onSave: (data: { node_type: NodeType; config: Record<string, any> }) => void;
  isNew?: boolean;
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  message: 'Mensagem',
  menu: 'Menu de Opções',
  collect_data: 'Coleta de Dados',
  ai_response: 'Resposta IA',
  transfer: 'Encaminhar para Atendente',
  condition: 'Condição de Horário',
  apply_tag: 'Aplicar Tag',
  move_to_funnel: 'Mover para Funil',
  delegate: 'Delegar Chat',
  close_chat: 'Encerrar Chat',
  delay: 'Atraso / Espera',
  webhook: 'Webhook',
};

export default function NodeEditModal({ open, onOpenChange, node, onSave, isNew }: NodeEditModalProps) {
  const [nodeType, setNodeType] = useState<NodeType>('message');
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) {
      setNodeType(node.node_type);
      setConfig({ ...node.config });
    } else {
      setNodeType('message');
      setConfig({});
    }
  }, [node, open]);

  const handleSave = () => {
    onSave({ node_type: nodeType, config });
    onOpenChange(false);
  };

  const renderConfigFields = () => {
    switch (nodeType) {
      case 'message':
        return (
          <div className="space-y-2">
            <Label>Texto da mensagem</Label>
            <Textarea placeholder="Olá! Bem-vindo ao nosso atendimento..." value={config.text || ''} onChange={e => setConfig({ ...config, text: e.target.value })} rows={4} />
          </div>
        );
      case 'menu':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texto do menu</Label>
              <Input placeholder="Escolha uma opção:" value={config.text || ''} onChange={e => setConfig({ ...config, text: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Opções</Label>
              {(config.options as any[] || []).map((opt: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <Input value={opt.label} onChange={e => {
                    const opts = [...(config.options || [])];
                    opts[i] = { ...opts[i], label: e.target.value };
                    setConfig({ ...config, options: opts });
                  }} placeholder="Nome da opção" className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                    const opts = (config.options || []).filter((_: any, j: number) => j !== i);
                    setConfig({ ...config, options: opts });
                  }}><Trash2 size={14} /></Button>
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
                  <Checkbox checked={(config.fields || []).includes(field)} onCheckedChange={checked => {
                    const fields = config.fields || [];
                    setConfig({ ...config, fields: checked ? [...fields, field] : fields.filter((f: string) => f !== field) });
                  }} />
                  <Label className="text-sm font-normal">{{ name: 'Nome', email: 'E-mail', phone: 'Telefone' }[field]}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      case 'ai_response':
        return (
          <div className="space-y-2">
            <Label>Instruções adicionais para a IA (opcional)</Label>
            <Textarea placeholder="Contexto extra para esta etapa... (as instruções gerais do fluxo já são usadas)" value={config.context || ''} onChange={e => setConfig({ ...config, context: e.target.value })} rows={4} />
          </div>
        );
      case 'transfer':
        return (
          <div className="space-y-2">
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
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Adicionar Etapa' : 'Editar Etapa'}</DialogTitle>
          <DialogDescription>Configure o comportamento desta etapa do fluxo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo da etapa</Label>
            <Select value={nodeType} onValueChange={v => { setNodeType(v as NodeType); setConfig({}); }} disabled={!isNew}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(NODE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {renderConfigFields()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
