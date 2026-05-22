import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const [invite, setInvite] = useState({ name: '', email: '', role: '', password: '', showPassword: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);

  const reset = () => {
    setInvite({ name: '', email: '', role: '', password: '', showPassword: false });
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!invite.name.trim()) e.name = 'Obrigatório';
    if (!invite.email.trim()) e.email = 'Obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email)) e.email = 'Email inválido';
    if (!invite.role) e.role = 'Obrigatório';
    if (invite.password && invite.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInvite = async () => {
    if (!validate()) return;
    setInviting(true);
    try {
      const resp = await supabase.functions.invoke('invite-user', {
        body: { name: invite.name, email: invite.email, role: invite.role, password: invite.password || undefined },
      });
      if (resp.error) {
        const ctx = (resp.error as Error & { context?: Record<string, string> }).context;
        const msg = (ctx && typeof ctx === 'object' && (ctx.error || ctx.message))
          ? (ctx.error || ctx.message)
          : resp.error.message;
        throw new Error(msg);
      }
      const result = resp.data as Record<string, string> | null;
      if (result?.error) throw new Error(result.error);
      toast.success(`Usuário ${invite.email} criado com sucesso!`);
      onOpenChange(false);
      reset();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Erro ao convidar usuário');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onOpenChange(false); reset(); } else { onOpenChange(true); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={invite.name} onChange={e => setInvite({ ...invite, name: e.target.value })} placeholder="Nome completo" className={`mt-1 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="email@empresa.com" className={`mt-1 ${errors.email ? 'border-destructive' : ''}`} />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label className="text-xs">Cargo *</Label>
            <Select value={invite.role} onValueChange={v => setInvite({ ...invite, role: v })}>
              <SelectTrigger className={`mt-1 ${errors.role ? 'border-destructive' : ''}`}>
                <SelectValue placeholder="Selecionar cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && <p className="text-xs text-destructive mt-1">{errors.role}</p>}
          </div>
          <div>
            <Label className="text-xs">Senha <span className="text-muted-foreground">(opcional — gerada automaticamente se vazia)</span></Label>
            <div className="relative mt-1">
              <Input
                type={invite.showPassword ? 'text' : 'password'}
                value={invite.password}
                onChange={e => setInvite({ ...invite, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
              />
              <button
                type="button"
                onClick={() => setInvite(i => ({ ...i, showPassword: !i.showPassword }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {invite.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={inviting}>
            {inviting ? 'Enviando...' : 'Enviar Convite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
