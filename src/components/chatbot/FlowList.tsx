import { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import type { ChatbotFlow } from '@/hooks/useChatbotFlows';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FlowListProps {
  flows: ChatbotFlow[];
  onSelect: (flow: ChatbotFlow) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function FlowList({ flows, onSelect, onCreate, onDelete, onToggleActive }: FlowListProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowCreate(false);
  };

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
          <Plus size={28} className="text-accent-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum fluxo criado</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Crie seu primeiro fluxo de chatbot para automatizar o atendimento aos seus clientes.
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-2" /> Criar primeiro fluxo
        </Button>

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Fluxo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Nome do fluxo</Label>
              <Input placeholder="Ex: Atendimento Principal" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{flows.length} fluxo(s) criado(s)</p>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={16} className="mr-2" /> Novo fluxo
        </Button>
      </div>

      <div className="grid gap-3">
        {flows.map(flow => (
          <Card key={flow.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => onSelect(flow)}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground truncate">{flow.name}</h4>
                  <Badge variant={flow.is_active ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {flow.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Criado em {format(new Date(flow.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Switch checked={flow.is_active} onCheckedChange={checked => onToggleActive(flow.id, checked)} />
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(flow.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome do fluxo</Label>
            <Input placeholder="Ex: Atendimento Principal" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir fluxo"
        description="Tem certeza que deseja excluir este fluxo? Todas as etapas serão removidas permanentemente."
        onConfirm={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
