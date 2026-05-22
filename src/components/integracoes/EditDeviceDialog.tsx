import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getAreaUserIds } from '@/lib/areaFilter';
import { ProviderFields, providerLabel } from '@/components/integracoes/DeviceCard';
import type { Integration } from '@/hooks/useIntegrations';

type AgentEntry = { id: string; name: string; originalAllowed: string[] | null; checked: boolean };

export interface EditDeviceResult {
  id: string;
  updates: {
    device_name: string;
    phone_number: string;
    config: Record<string, string>;
    department_id: string | null;
  };
}

interface EditDeviceDialogProps {
  device: Integration | null;
  onClose: () => void;
  departments: { id: string; name: string }[];
  companyId: string | null;
  whatsappDeviceIds: string[];
  isPending: boolean;
  onSubmit: (result: EditDeviceResult) => void;
}

export default function EditDeviceDialog({ device, onClose, departments, companyId, whatsappDeviceIds, isPending, onSubmit }: EditDeviceDialogProps) {
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [editAgentsList, setEditAgentsList] = useState<AgentEntry[]>([]);

  useEffect(() => {
    if (!device) return;
    setEditName(device.device_name || '');
    setEditPhone(device.phone_number || '');
    setEditDeptId(device.department_id ?? '__none__');
    setEditConfig(device.config as Record<string, string> ?? {});
    setEditAgentsList([]);

    if (companyId) {
      (async () => {
        const areaUserIds = await getAreaUserIds();
        let q = supabase
          .from('profiles')
          .select('id, name, allowed_integration_ids')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('name');
        if (areaUserIds) q = q.in('id', areaUserIds);
        const { data: profiles } = await q;
        if (profiles) {
          const deviceId = device.id;
          setEditAgentsList(profiles.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: (p.name as string) || (p.id as string),
            originalAllowed: (p.allowed_integration_ids as string[] | null) ?? null,
            checked: p.allowed_integration_ids === null || ((p.allowed_integration_ids as string[] | null) ?? []).includes(deviceId),
          })));
        }
      })();
    }
  }, [device, companyId]);

  const handleEdit = async () => {
    if (!device) return;
    const needsPhone = device.provider !== 'evolution';
    if (!editName.trim() || (needsPhone && !editPhone.trim())) {
      toast.error(needsPhone ? 'Preencha nome e número' : 'Preencha o nome');
      return;
    }

    // Save agent assignment changes
    const deviceId = device.id;
    const agentUpdates: Promise<unknown>[] = [];
    for (const agent of editAgentsList) {
      const wasChecked = agent.originalAllowed === null || agent.originalAllowed.includes(deviceId);
      const isNowChecked = agent.checked;
      if (wasChecked === isNowChecked) continue;
      let newAllowed: string[] | null;
      if (isNowChecked) {
        if (agent.originalAllowed === null) continue;
        newAllowed = [...agent.originalAllowed, deviceId];
      } else {
        if (agent.originalAllowed === null) {
          newAllowed = whatsappDeviceIds.filter(id => id !== deviceId);
        } else {
          newAllowed = agent.originalAllowed.filter(id => id !== deviceId);
        }
      }
      agentUpdates.push(
        supabase.from('profiles').update({ allowed_integration_ids: newAllowed }).eq('id', agent.id)
      );
    }
    if (agentUpdates.length > 0) await Promise.all(agentUpdates);

    onSubmit({
      id: device.id,
      updates: {
        device_name: editName,
        phone_number: editPhone,
        config: editConfig,
        department_id: editDeptId === '__none__' ? null : editDeptId || null,
      },
    });
  };

  return (
    <Dialog open={!!device} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Aparelho</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">Altere o nome, número ou credenciais deste aparelho</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Nome do aparelho</Label>
            <Input className="mt-1" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Vendas - Principal" />
          </div>
          {device?.provider !== 'evolution' && (
            <div>
              <Label className="text-xs">Número de telefone</Label>
              <Input className="mt-1" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+5511999999999" />
            </div>
          )}

          {departments.length > 0 && (
            <div>
              <Label className="text-xs">Departamento</Label>
              <Select value={editDeptId} onValueChange={setEditDeptId}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Nenhum departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {device && (
            <>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Provedor</p>
                <p className="text-sm font-semibold text-foreground">{providerLabel(device.provider)}</p>
              </div>
              <ProviderFields provider={device.provider} config={editConfig} onChange={setEditConfig} />
            </>
          )}

          {/* Agent assignment section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-muted-foreground" />
              <Label className="text-xs font-semibold">Agentes que atendem este número</Label>
            </div>
            {editAgentsList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic pl-5">Carregando agentes...</p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
                {editAgentsList.map(agent => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-primary"
                      checked={agent.checked}
                      onChange={() =>
                        setEditAgentsList(prev =>
                          prev.map(a => a.id === agent.id ? { ...a, checked: !a.checked } : a)
                        )
                      }
                    />
                    <span className="text-sm text-foreground flex-1">{agent.name}</span>
                    {agent.originalAllowed === null && (
                      <span className="text-[11px] text-muted-foreground">todos os números</span>
                    )}
                  </label>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground pl-5">
              Agentes marcados recebem conversas deste número. Desmarcar restringe o agente a outros números apenas.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleEdit} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
