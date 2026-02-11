import { useState, useEffect } from 'react';
import { Save, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function MeuPerfil() {
  const { user, profile, role } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', user.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Perfil atualizado com sucesso!');
  };

  const roleLabels: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente' };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-border bg-card card-shadow p-6">
        <h2 className="text-base font-semibold text-foreground mb-6 flex items-center gap-2">
          <User size={18} /> Meu Perfil
        </h2>

        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground capitalize">{roleLabels[role ?? 'agent'] ?? role}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-secondary border-0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input value={user?.email ?? ''} readOnly className="bg-secondary border-0 opacity-60" />
          </div>
        </div>

        <Button className="mt-5 gap-1.5" size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
