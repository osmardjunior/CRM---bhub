import { Plus, Trash2, Check, UserCheck, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface SmartRouterConfigProps {
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
  tags: { id: string; name: string; color: string }[];
  funnels: { id: string; name: string; stages: { id: string; label: string }[] }[];
  team: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}

interface RouteActions {
  response?: string;
  tag_ids?: string[];
  funnel_id?: string;
  stage_id?: string;
  delegate_assignments?: Array<{ user_id: string; percentage: number }>;
  delegate_dept_assignments?: Array<{ department_id: string; percentage: number }>;
}

function SmartRouteActions({
  routeConfig,
  onUpdate,
  keyPrefix,
  tags,
  funnels,
  team,
  departments,
}: {
  routeConfig: RouteActions;
  onUpdate: (updates: Partial<RouteActions>) => void;
  keyPrefix: string;
  tags: SmartRouterConfigProps['tags'];
  funnels: SmartRouterConfigProps['funnels'];
  team: SmartRouterConfigProps['team'];
  departments: SmartRouterConfigProps['departments'];
}) {
  const tagIds = (routeConfig.tag_ids || []) as string[];
  const funnelId = routeConfig.funnel_id || '';
  const stageId = routeConfig.stage_id || '';
  const userAssignments: Array<{ user_id: string; percentage: number }> = routeConfig.delegate_assignments || [];
  const deptAssignments: Array<{ department_id: string; percentage: number }> = routeConfig.delegate_dept_assignments || [];

  const userTotal = userAssignments.reduce((s, a) => s + (a.percentage || 0), 0);
  const deptTotal = deptAssignments.reduce((s, a) => s + (a.percentage || 0), 0);

  const addUserAssignment = () => {
    onUpdate({ delegate_assignments: [...userAssignments, { user_id: '', percentage: 100 - userTotal > 0 ? 100 - userTotal : 0 }] });
  };
  const removeUserAssignment = (i: number) => {
    onUpdate({ delegate_assignments: userAssignments.filter((_, idx) => idx !== i) });
  };
  const updateUserAssignment = (i: number, field: 'user_id' | 'percentage', value: string | number) => {
    const updated = [...userAssignments];
    updated[i] = { ...updated[i], [field]: value };
    onUpdate({ delegate_assignments: updated });
  };

  const addDeptAssignment = () => {
    onUpdate({ delegate_dept_assignments: [...deptAssignments, { department_id: '', percentage: 100 - deptTotal > 0 ? 100 - deptTotal : 0 }] });
  };
  const removeDeptAssignment = (i: number) => {
    onUpdate({ delegate_dept_assignments: deptAssignments.filter((_, idx) => idx !== i) });
  };
  const updateDeptAssignment = (i: number, field: 'department_id' | 'percentage', value: string | number) => {
    const updated = [...deptAssignments];
    updated[i] = { ...updated[i], [field]: value };
    onUpdate({ delegate_dept_assignments: updated });
  };

  return (
    <div className="space-y-3 mt-2 pl-3 border-l-2 border-border">
      {/* Resposta */}
      <div className="space-y-1">
        <Label className="text-xs">Resposta (opcional)</Label>
        <Textarea
          placeholder="Mensagem a enviar para o lead..."
          value={routeConfig.response || ''}
          onChange={e => onUpdate({ response: e.target.value })}
          rows={2}
        />
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs">Tags a aplicar</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {tags.map(tag => {
              const selected = tagIds.includes(tag.id);
              return (
                <button
                  key={`${keyPrefix}-tag-${tag.id}`}
                  type="button"
                  onClick={() => onUpdate({ tag_ids: selected ? tagIds.filter(id => id !== tag.id) : [...tagIds, tag.id] })}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all border-2"
                  style={{ backgroundColor: selected ? tag.color : 'transparent', borderColor: tag.color, color: selected ? '#fff' : tag.color }}
                >
                  <div
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border"
                    style={{ borderColor: selected ? '#fff' : tag.color, backgroundColor: selected ? 'rgba(255,255,255,0.25)' : 'transparent' }}
                  >
                    {selected && <Check size={10} style={{ color: '#fff' }} />}
                  </div>
                  <span className="truncate">{tag.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Funil */}
      <div className="space-y-1">
        <Label className="text-xs">Mover para Funil (opcional)</Label>
        <Select value={funnelId || '_none'} onValueChange={v => onUpdate({ funnel_id: v === '_none' ? '' : v, stage_id: '' })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Nenhum funil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Nenhum</SelectItem>
            {funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {funnelId && funnelId !== '_none' && (
        <div className="space-y-1">
          <Label className="text-xs">Etapa</Label>
          <Select value={stageId} onValueChange={v => onUpdate({ stage_id: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
            <SelectContent>
              {(funnels.find(f => f.id === funnelId)?.stages || []).map(s => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Delegação por usuário */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <UserCheck size={12} className="text-muted-foreground" />
            <Label className="text-xs">Delegar para usuário(s)</Label>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-semibold',
              userTotal === 100 ? 'text-green-600' : userTotal > 100 ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {userTotal}%{userTotal === 100 ? ' ✓' : userTotal > 100 ? ' excede 100%' : ' / 100%'}
            </span>
            <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5 gap-0.5" onClick={addUserAssignment}>
              <Plus size={9} /> Usuário
            </Button>
          </div>
        </div>
        {userAssignments.length === 0 && (
          <p className="text-[11px] text-muted-foreground pl-1">Nenhum usuário. Clique em "+ Usuário" para adicionar.</p>
        )}
        {userAssignments.map((assignment, i) => (
          <div key={`${keyPrefix}-ua-${i}`} className="flex items-center gap-1.5">
            <Select
              value={assignment.user_id || '_none'}
              onValueChange={v => updateUserAssignment(i, 'user_id', v === '_none' ? '' : v)}
            >
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione...</SelectItem>
                {team.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 shrink-0">
              <Input
                type="number"
                min={0}
                max={100}
                value={assignment.percentage}
                onChange={e => updateUserAssignment(i, 'percentage', Math.min(100, Math.max(0, Number(e.target.value))))}
                className="h-7 text-xs w-14 text-center"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeUserAssignment(i)}>
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>

      {/* Delegação por departamento */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Building2 size={12} className="text-muted-foreground" />
            <Label className="text-xs">Delegar para departamento(s)</Label>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-semibold',
              deptTotal === 100 ? 'text-green-600' : deptTotal > 100 ? 'text-red-500' : 'text-muted-foreground'
            )}>
              {deptTotal > 0 ? `${deptTotal}%${deptTotal === 100 ? ' ✓' : deptTotal > 100 ? ' excede 100%' : ' / 100%'}` : ''}
            </span>
            <Button variant="outline" size="sm" className="h-5 text-[10px] px-1.5 gap-0.5" onClick={addDeptAssignment}>
              <Plus size={9} /> Dept.
            </Button>
          </div>
        </div>
        {deptAssignments.length === 0 && (
          <p className="text-[11px] text-muted-foreground pl-1">Nenhum departamento. Clique em "+ Dept." para adicionar.</p>
        )}
        {deptAssignments.map((assignment, i) => (
          <div key={`${keyPrefix}-da-${i}`} className="flex items-center gap-1.5">
            <Select
              value={assignment.department_id || '_none'}
              onValueChange={v => updateDeptAssignment(i, 'department_id', v === '_none' ? '' : v)}
            >
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione...</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-0.5 shrink-0">
              <Input
                type="number"
                min={0}
                max={100}
                value={assignment.percentage}
                onChange={e => updateDeptAssignment(i, 'percentage', Math.min(100, Math.max(0, Number(e.target.value))))}
                className="h-7 text-xs w-14 text-center"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeDeptAssignment(i)}>
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SmartRouterConfig({ config, setConfig, tags, funnels, team, departments }: SmartRouterConfigProps) {
  const mode = (config.mode as string) || 'rules';
  const routes = (config.routes as Record<string, unknown>[]) || [];
  const showKeywords = mode === 'rules' || mode === 'both';
  const showAI = mode === 'ai' || mode === 'both';

  const updateRoute = (index: number, updates: Record<string, unknown>) => {
    const updated = [...routes];
    updated[index] = { ...updated[index], ...updates };
    setConfig({ ...config, routes: updated });
  };

  const addRoute = () => {
    const newRoute = {
      id: crypto.randomUUID(),
      label: `Rota ${routes.length + 1}`,
      keywords: [],
      ai_intent_description: '',
      response: '',
      tag_ids: [],
      funnel_id: '',
      stage_id: '',
      delegate_assignments: [],
      delegate_dept_assignments: [],
    };
    setConfig({ ...config, routes: [...routes, newRoute] });
  };

  const removeRoute = (index: number) => {
    setConfig({ ...config, routes: routes.filter((_, i: number) => i !== index) });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Modo de Roteamento</Label>
        <Select value={mode} onValueChange={v => setConfig({ ...config, mode: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rules">Regras (palavras-chave)</SelectItem>
            <SelectItem value="ai">IA (intenção detectada)</SelectItem>
            <SelectItem value="both">Ambos (regras + IA como fallback)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showAI && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Prompt de Contexto para IA</Label>
          <Textarea
            placeholder="Descreva o contexto do seu negócio para a IA classificar as mensagens dos leads..."
            value={(config.ai_prompt as string) || ''}
            onChange={e => setConfig({ ...config, ai_prompt: e.target.value })}
            rows={3}
          />
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Rotas</Label>
          <Button variant="outline" size="sm" onClick={addRoute} className="h-7 text-xs gap-1">
            <Plus size={12} /> Adicionar Rota
          </Button>
        </div>
        {routes.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma rota configurada. Adicione pelo menos uma.</p>
        )}
        {routes.map((route: Record<string, unknown>, i: number) => (
          <div key={(route.id as string) || i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
              <Input
                value={(route.label as string) || ''}
                onChange={e => updateRoute(i, { label: e.target.value })}
                placeholder="Nome da rota (ex: Interessado)"
                className="h-7 text-xs flex-1"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeRoute(i)}>
                <Trash2 size={13} />
              </Button>
            </div>
            {showKeywords && (
              <div className="space-y-1">
                <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
                <Input
                  value={route.keywords_raw !== undefined ? (route.keywords_raw as string) : ((route.keywords as string[]) || []).join(', ')}
                  onChange={e => updateRoute(i, { keywords_raw: e.target.value })}
                  onBlur={e => {
                    const parsed = e.target.value.split(',').map((k: string) => k.trim()).filter(Boolean);
                    updateRoute(i, { keywords: parsed, keywords_raw: undefined });
                  }}
                  placeholder="preço, quero comprar, quanto custa"
                  className="h-7 text-xs"
                />
              </div>
            )}
            {showAI && (
              <div className="space-y-1">
                <Label className="text-xs">Descrição de intenção para IA</Label>
                <Input
                  value={(route.ai_intent_description as string) || ''}
                  onChange={e => updateRoute(i, { ai_intent_description: e.target.value })}
                  placeholder="Lead demonstra interesse em comprar"
                  className="h-7 text-xs"
                />
              </div>
            )}
            <SmartRouteActions
              routeConfig={{
                response: route.response as string,
                tag_ids: route.tag_ids as string[],
                funnel_id: route.funnel_id as string,
                stage_id: route.stage_id as string,
                delegate_assignments: route.delegate_assignments as RouteActions['delegate_assignments'],
                delegate_dept_assignments: route.delegate_dept_assignments as RouteActions['delegate_dept_assignments'],
              }}
              onUpdate={updates => updateRoute(i, updates)}
              keyPrefix={`route-${(route.id as string) || i}`}
              tags={tags}
              funnels={funnels}
              team={team}
              departments={departments}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
