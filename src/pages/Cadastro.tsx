import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function CadastroPage() {
  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
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

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('register-company', {
        body: {
          company_name: companyName,
          user_name: userName,
          email,
          password,
        },
      });

      if (fnErr) {
        // Try to extract message from response body
        try {
          const body = await (fnErr as { context?: Response }).context?.json?.();
          setError(body?.error || 'Erro ao criar empresa. Tente novamente.');
        } catch {
          setError('Erro ao criar empresa. Tente novamente.');
        }
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const { error: loginErr } = await signIn(email, password);
      if (loginErr) {
        // Registration succeeded but login failed — redirect to login
        navigate('/login');
        return;
      }

      navigate('/inbox');
    } catch {
      setError('Erro interno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1a2e] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-5 flex items-center justify-center">
            <img src="/logo-dark.png" alt="ALL·IN" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-xl font-bold text-white">Criar sua empresa</h1>
          <p className="text-sm text-gray-400 mt-1">Preencha os dados para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 space-y-4">
          <div>
            <Label className="text-xs text-gray-300">Nome da empresa</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Minha Empresa"
              className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-gray-500"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">Seu nome</Label>
            <Input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="João Silva"
              className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-gray-500"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-gray-500"
              required
            />
          </div>
          <div>
            <Label className="text-xs text-gray-300">Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="mt-1 bg-white/10 border-white/10 text-white placeholder:text-gray-500"
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button type="submit" className="w-full gap-2 bg-[#c8944a] hover:bg-[#b8843a] text-white" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {loading ? 'Criando...' : 'Criar empresa'}
          </Button>

          <p className="text-xs text-center text-gray-400">
            Já tem conta?{' '}
            <Link to="/login" className="text-[#c8944a] hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
