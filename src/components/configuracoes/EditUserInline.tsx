import { useState, useEffect } from 'react';
import {
  Users, Save, Plus, Shield, Lock, EyeOff, Clock,
  XCircle, ChevronRight, RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  WEEK_DAYS, FULL_PERMISSION_GROUPS, ALL_PERMISSION_KEYS,
  type EditableUser,
} from '@/pages/configuracoes/constants';

interface EditUserInlineProps {
  user: EditableUser;
  form: EditableUser;
  setForm: (fn: (prev: EditableUser) => EditableUser) => void;
  integrations: { id: string; phone_number?: string; device_name?: string; status: string }[];
  departments: { id: string; name: string }[];
  teamMembers: EditableUser[];
  roundRobinMode: 'weight' | 'percentage';
  onSaved: () => void;
  onClose: () => void;
}

export default function EditUserInline({ user, form, setForm, integrations, departments, teamMembers, roundRobinMode, onSaved, onClose }: EditUserInlineProps) {
  const [saving, setSaving] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [userDeptIds, setUserDeptIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<string | null>('dados');

  useEffect(() => {
    supabase
      .from('profile_departments')
      .select('department_id')
      .eq('profile_id', user.id)
      .then(({ data }) => setUserDeptIds((data ?? []).map(r => r.department_id)));
  }, [user.id]);

  const allSelected = ALL_PERMISSION_KEYS.every(k => form.custom_permissions[k]);
  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    ALL_PERMISSION_KEYS.forEach(k => { next[k] = !allSelected; });
    setForm(f => ({ ...f, custom_permissions: next }));
  };
  const togglePerm = (key: string) => {
    setForm(f => ({
      ...f,
      custom_permissions: { ...f.custom_permissions, [key]: !f.custom_permissions[key] },
    }));
  };

  const addInterval = () => {
    setForm(f => ({
      ...f,
      access_hours: { ...f.access_hours, intervals: [...f.access_hours.intervals, { start: '08:00', end: '18:00' }] },
    }));
  };
  const removeInterval = (idx: number) => {
    setForm(f => ({
      ...f,
      access_hours: { ...f.access_hours, intervals: f.access_hours.intervals.filter((_, i) => i !== idx) },
    }));
  };
  const updateInterval = (idx: number, field: 'start' | 'end', value: string) => {
    setForm(f => ({
      ...f,
      access_hours: { ...f.access_hours, intervals: f.access_hours.intervals.map((iv, i) => i === idx ? { ...iv, [field]: value } : iv) },
    }));
  };
  const toggleBlockedDay = (day: number) => {
    setForm(f => {
      const days = f.access_hours.blocked_days;
      return { ...f, access_hours: { ...f.access_hours, blocked_days: days.includes(day) ? days.filter(d => d !== day) : [...days, day] } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error: profileErr } = await supabase.from('profiles').update({
        name: form.name,
        display_name: form.display_name || null,
        spy_mode: form.spy_mode,
        access_hours: form.access_hours,
        custom_permissions: form.custom_permissions,
        is_active: form.is_active,
        round_robin_weight: form.round_robin_weight,
        allowed_integration_ids: form.allowed_integration_ids && form.allowed_integration_ids.length > 0 ? form.allowed_integration_ids : null,
      }).eq('id', form.id);
      if (profileErr) throw profileErr;

      const newRole = form.role as 'admin' | 'supervisor' | 'agent';
      const { error: roleErr } = await supabase.rpc('admin_set_user_role', { target_user_id: form.id, new_role: newRole });
      if (roleErr) throw roleErr;

      const { error: deptDelErr } = await supabase.from('profile_departments').delete().eq('profile_id', form.id);
      if (deptDelErr) throw deptDelErr;
      if (userDeptIds.length > 0) {
        const { error: deptInsErr } = await supabase.from('profile_departments').insert(userDeptIds.map(did => ({ profile_id: form.id, department_id: did })));
        if (deptInsErr) throw deptInsErr;
      }

      toast.success('Usuário atualizado com sucesso!');
      onSaved();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = form.role === 'admin';
  const toggle = (section: string) => setOpenSection(prev => prev === section ? null : section);

  const SectionHeader = ({ id, icon: Icon, title, subtitle }: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; subtitle?: string }) => (
    <button
      onClick={() => toggle(id)}
      className="flex items-center gap-2.5 w-full py-2.5 text-left group"
    >
      <Icon size={14} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
      <ChevronRight size={13} className={`text-muted-foreground transition-transform ${openSection === id ? 'rotate-90' : ''}`} />
    </button>
  );

  return (
    <div className="pt-3 space-y-1">
      {/* Dados */}
      <SectionHeader id="dados" icon={Users} title="Dados do Usuário" subtitle="Nome, email, cargo e departamentos" />
      {openSection === 'dados' && (
        <div className="pl-6 pb-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Nome visível</Label>
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Assinatura para cliente" className="h-8 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Email</Label>
              <Input value={form.email} disabled className="h-8 text-sm opacity-60" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Cargo</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                  <SelectItem value="supervisor" className="text-xs">Supervisor</SelectItem>
                  <SelectItem value="agent" className="text-xs">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {departments.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Departamentos</Label>
              <div className="flex flex-wrap gap-2">
                {departments.map(dept => (
                  <label key={dept.id} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-accent/30 px-2 py-1 rounded-md border border-border">
                    <Checkbox
                      id={`inline-dept-${dept.id}`}
                      checked={userDeptIds.includes(dept.id)}
                      onCheckedChange={(c) => setUserDeptIds(prev => c ? [...prev, dept.id] : prev.filter(id => id !== dept.id))}
                    />
                    {dept.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2">
            <div>
              <p className="text-xs font-medium">Ativo</p>
              <p className="text-[10px] text-muted-foreground">Desativar impede login</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
          </div>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Modo Espião */}
      <div className="flex items-center justify-between py-2.5">
        <div className="flex items-center gap-2.5">
          <EyeOff size={14} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground">Modo Espião</p>
            <p className="text-[10px] text-muted-foreground">Monitora sem remover notificações</p>
          </div>
        </div>
        <Switch checked={form.spy_mode} onCheckedChange={v => setForm(f => ({ ...f, spy_mode: v }))} />
      </div>

      <div className="border-t border-border" />

      {/* Permissões */}
      <SectionHeader id="permissoes" icon={Shield} title="Permissões" subtitle={isAdmin ? 'Admin — acesso total' : `${ALL_PERMISSION_KEYS.filter(k => form.custom_permissions[k]).length}/${ALL_PERMISSION_KEYS.length} ativas`} />
      {openSection === 'permissoes' && (
        <div className="pl-6 pb-3 space-y-3">
          {isAdmin ? (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <Shield size={14} className="text-primary shrink-0" />
              <p className="text-xs text-muted-foreground">Admins têm acesso total. Permissões individuais não se aplicam.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {ALL_PERMISSION_KEYS.filter(k => form.custom_permissions[k]).length} de {ALL_PERMISSION_KEYS.length} permissões ativas
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-full gap-2 h-8 text-xs" onClick={() => setPermissionsDialogOpen(true)}>
                <Shield size={13} /> Configurar permissões detalhadas
              </Button>
            </>
          )}
        </div>
      )}

      <div className="border-t border-border" />

      {/* Acesso (WhatsApp + Horários) */}
      <SectionHeader id="acesso" icon={Lock} title="Acesso" subtitle="WhatsApp, horários e dias bloqueados" />
      {openSection === 'acesso' && (
        <div className="pl-6 pb-3 space-y-4">
          {integrations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Números WhatsApp</p>
              <p className="text-[10px] text-muted-foreground">Sem seleção = todos. Selecione para restringir.</p>
              <div className="space-y-1">
                {integrations.map(intg => {
                  const checked = form.allowed_integration_ids?.includes(intg.id) ?? false;
                  return (
                    <label key={intg.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-2 py-1 rounded text-xs">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setForm(f => {
                            const current = f.allowed_integration_ids ?? [];
                            return { ...f, allowed_integration_ids: c ? [...current, intg.id] : current.filter(id => id !== intg.id) };
                          });
                        }}
                      />
                      <span className="select-none">{intg.phone_number || intg.device_name}</span>
                      <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full ${intg.status === 'connected' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {intg.status === 'connected' ? 'On' : intg.status}
                      </span>
                    </label>
                  );
                })}
              </div>
              {(form.allowed_integration_ids?.length ?? 0) > 0 && (
                <button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={() => setForm(f => ({ ...f, allowed_integration_ids: null }))}>
                  Limpar restrição
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-muted-foreground" />
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Horário de acesso</p>
              </div>
              <Switch
                checked={form.access_hours.enabled}
                onCheckedChange={v => setForm(f => ({ ...f, access_hours: { ...f.access_hours, enabled: v } }))}
              />
            </div>
            {form.access_hours.enabled && (
              <>
                <div className="space-y-2">
                  {form.access_hours.intervals.map((iv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input type="time" value={iv.start} onChange={e => updateInterval(idx, 'start', e.target.value)} className="h-7 w-24 text-xs" />
                      <span className="text-[10px] text-muted-foreground">até</span>
                      <Input type="time" value={iv.end} onChange={e => updateInterval(idx, 'end', e.target.value)} className="h-7 w-24 text-xs" />
                      {form.access_hours.intervals.length > 1 && (
                        <button onClick={() => removeInterval(idx)} className="text-muted-foreground hover:text-destructive"><XCircle size={13} /></button>
                      )}
                    </div>
                  ))}
                  {form.access_hours.intervals.length < 2 && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={addInterval}><Plus size={10} /> Intervalo</Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">Dias bloqueados</p>
                  <div className="flex gap-1">
                    {WEEK_DAYS.map(d => {
                      const blocked = form.access_hours.blocked_days.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          onClick={() => toggleBlockedDay(d.value)}
                          className={`h-7 w-9 rounded text-[10px] font-medium border transition-colors ${blocked ? 'bg-destructive/10 border-destructive/40 text-destructive' : 'bg-secondary border-border text-muted-foreground hover:border-primary'}`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Rodízio */}
      <SectionHeader id="rodizio" icon={RotateCcw} title="Rodízio" subtitle={roundRobinMode === 'percentage' ? `${form.round_robin_weight}%` : `Peso ${form.round_robin_weight}`} />
      {openSection === 'rodizio' && (
        <div className="pl-6 pb-3 space-y-3">
          {roundRobinMode === 'percentage' ? (
            <>
              <p className="text-[10px] text-muted-foreground">% de atendimentos que este usuário recebe. Soma = 100%.</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={100}
                  value={form.round_robin_weight}
                  onChange={e => setForm(f => ({ ...f, round_robin_weight: Math.min(100, Math.max(1, Number(e.target.value))) }))}
                  className="h-8 w-20 text-sm"
                />
                <span className="text-xs font-medium">%</span>
              </div>
              {(() => {
                const others = teamMembers.filter(m => m.id !== user.id);
                const total = others.reduce((s, m) => s + (m.round_robin_weight || 1), 0) + form.round_robin_weight;
                const ok = total === 100;
                return (
                  <div className={`rounded-md px-2.5 py-1.5 text-[10px] ${ok ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {ok ? '✓' : '⚠'} Soma: <strong>{total}%</strong> {ok ? '— OK' : `— faltam ${100 - total}%`}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">Peso 3 = 3× mais atendimentos que peso 1.</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={10}
                  value={form.round_robin_weight}
                  onChange={e => setForm(f => ({ ...f, round_robin_weight: Math.min(10, Math.max(1, Number(e.target.value))) }))}
                  className="h-8 w-20 text-sm"
                />
                <span className="text-[10px] text-muted-foreground">
                  {form.round_robin_weight === 1 ? 'Padrão' : `${form.round_robin_weight}× mais`}
                </span>
              </div>
              {(() => {
                const others = teamMembers.filter(m => m.id !== user.id);
                const totalWeight = others.reduce((s, m) => s + (m.round_robin_weight || 1), 0) + form.round_robin_weight;
                const pct = Math.round((form.round_robin_weight / totalWeight) * 100);
                return (
                  <div className="rounded-md bg-primary/5 px-2.5 py-1.5 text-[10px] text-primary">
                    ~<strong>{pct}%</strong> dos atendimentos
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="border-t border-border pt-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Fechar</Button>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSave} disabled={saving}>
          <Save size={13} /> {saving ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>

      {/* Full Permissions Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw]">
          <DialogHeader>
            <DialogTitle>Nível / Permissões — {user.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Nível:</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="h-8 px-2 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="admin">Admin (acesso total)</option>
                <option value="supervisor">Supervisor</option>
                <option value="agent">Normal (Permissões personalizadas)</option>
              </select>
            </div>
            {!isAdmin && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span className="text-xs font-medium">Selecionar todas</span>
              </label>
            )}
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-4 my-4">
              <Shield size={18} className="text-primary shrink-0" />
              <p className="text-sm text-muted-foreground">Admins têm acesso total.</p>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              {(() => {
                const col1 = FULL_PERMISSION_GROUPS.filter(g => g.col === 1);
                const col2 = FULL_PERMISSION_GROUPS.filter(g => g.col === 2);
                const fullWidth = FULL_PERMISSION_GROUPS.filter(g => g.col === 0);
                const renderGroup = (g: typeof FULL_PERMISSION_GROUPS[0]) => (
                  <div key={g.group} className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-2">{g.group}</p>
                    <div className="space-y-1.5">
                      {g.items.map(item => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded transition-colors">
                          <Checkbox checked={!!form.custom_permissions[item.key]} onCheckedChange={() => togglePerm(item.key)} />
                          <span className="text-xs select-none">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
                return (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-5">{col1.map(renderGroup)}</div>
                      <div className="space-y-5">{col2.map(renderGroup)}</div>
                    </div>
                    {fullWidth.map(g => (
                      <div key={g.group} className="border-t border-border pt-5">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1 mb-3">{g.group}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                          {g.items.map(item => (
                            <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-accent/30 px-1 py-0.5 rounded transition-colors">
                              <Checkbox checked={!!form.custom_permissions[item.key]} onCheckedChange={() => togglePerm(item.key)} />
                              <span className="text-xs select-none">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
          <DialogFooter className="mt-4 sticky bottom-0 bg-background pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => setPermissionsDialogOpen(false)}>Confirmar permissões</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
