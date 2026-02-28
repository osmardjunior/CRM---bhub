import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await signIn(email, password);
    setLoading(false);

    if (err) {
      setError('Email ou senha inválidos.');
    } else {
      navigate('/inbox');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <img src="/logo-dark.png" alt="ALL·IN" className="h-10 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-bold text-foreground">ALL·IN — Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">Faça login para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card card-shadow p-6 space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="mt-1"
              required
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>

          <div className="text-[11px] text-muted-foreground text-center space-y-1">
            <p className="font-medium">Contas de teste:</p>
            <p>davi@allin.com / 123456 (Admin)</p>
            <p>ana@allin.com / 123456 (Supervisor)</p>
          </div>
        </form>
      </div>
    </div>
  );
}
