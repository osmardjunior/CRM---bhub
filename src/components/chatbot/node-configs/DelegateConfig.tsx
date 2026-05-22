import { Users, Building2, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface DelegateConfigProps {
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
  team: { id: string; name: string; role: string }[];
  departments: { id: string; name: string }[];
}

export default function DelegateConfig({ config, setConfig, team, departments }: DelegateConfigProps) {
  const userIds = (config.user_ids || []) as string[];
  const departmentIds = (config.department_ids || []) as string[];

  return (
    <div className="space-y-5">
      {/* Usuários */}
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
            checked={config.remove_other_users as boolean || false}
            onCheckedChange={v => setConfig({ ...config, remove_other_users: !!v })}
          />
          <Label className="text-sm font-normal text-muted-foreground">Remover outros usuários delegados</Label>
        </div>
      </div>

      <Separator />

      {/* Departamentos */}
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
            checked={config.remove_other_departments as boolean || false}
            onCheckedChange={v => setConfig({ ...config, remove_other_departments: !!v })}
          />
          <Label className="text-sm font-normal text-muted-foreground">Remover outros grupos delegados</Label>
        </div>
      </div>

      <Separator />

      {/* Rodízio */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <RotateCcw size={16} />
          Rodízio
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={config.round_robin as boolean || false}
            onCheckedChange={v => setConfig({ ...config, round_robin: v })}
          />
          <Label className="text-sm font-normal">Ativar Rodízio no Departamento</Label>
        </div>
        {config.round_robin && (
          <div className="space-y-2 pl-6">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={config.round_robin_single_user as boolean || false}
                onCheckedChange={v => setConfig({ ...config, round_robin_single_user: !!v })}
              />
              <Label className="text-sm font-normal text-muted-foreground">
                Delegar apenas para um usuário deste departamento (não será delegado para o departamento)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={config.prefer_online as boolean || false}
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
}
