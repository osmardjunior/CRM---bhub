import { Puzzle, CheckCircle, Lock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Module {
  name: string;
  description: string;
  active: boolean;
  category: string;
}

const modules: Module[] = [
  {
    name: 'Adicionar Chat',
    description: 'Inicie conversas proativas com novos contatos via WhatsApp, sem que eles precisem te contatar primeiro.',
    active: false,
    category: 'Atendimento',
  },
  {
    name: 'Agendamento de Mensagens',
    description: 'Programe mensagens para serem enviadas em horários específicos, mesmo quando nenhum atendente estiver online.',
    active: true,
    category: 'Atendimento',
  },
  {
    name: 'NPS — Net Promoter Score',
    description: 'Envie pesquisas de satisfação automáticas ou manuais ao fim de cada atendimento e meça o NPS da sua equipe.',
    active: true,
    category: 'Relatórios',
  },
  {
    name: 'Funil Inteligente',
    description: 'Organize seus leads em funis de vendas Kanban com etapas customizadas e movimentação automática via chatbot.',
    active: true,
    category: 'Vendas',
  },
  {
    name: 'API de Integração',
    description: 'Integre o sistema com qualquer plataforma via webhooks e endpoints REST para enviar mensagens e gerenciar chats.',
    active: true,
    category: 'Integrações',
  },
  {
    name: 'Relatórios Gráficos',
    description: 'Acesse dashboards com métricas de atendimento, volume de mensagens, tempo médio de resposta e desempenho por agente.',
    active: true,
    category: 'Relatórios',
  },
  {
    name: 'Rodízio de Atendimento',
    description: 'Distribua chats automaticamente entre os agentes disponíveis usando sistema de round-robin configurável.',
    active: false,
    category: 'Atendimento',
  },
  {
    name: 'Campos Personalizados',
    description: 'Adicione campos customizados aos contatos (texto, email, número, data) e exporte-os para sistemas de CRM.',
    active: false,
    category: 'Contatos',
  },
];

const categories = Array.from(new Set(modules.map((m) => m.category)));

export default function ModulosPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Módulos</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie as funcionalidades contratadas da sua conta. Entre em contato com o suporte para ativar módulos adicionais.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card card-shadow p-4">
          <p className="text-xs text-muted-foreground mb-1">Total de módulos</p>
          <p className="text-2xl font-bold text-foreground">{modules.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card card-shadow p-4">
          <p className="text-xs text-muted-foreground mb-1">Ativos</p>
          <p className="text-2xl font-bold text-success">{modules.filter((m) => m.active).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card card-shadow p-4">
          <p className="text-xs text-muted-foreground mb-1">Não contratados</p>
          <p className="text-2xl font-bold text-muted-foreground">{modules.filter((m) => !m.active).length}</p>
        </div>
      </div>

      {/* Modules by category */}
      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">{cat}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {modules.filter((m) => m.category === cat).map((mod) => (
              <div
                key={mod.name}
                className={`rounded-xl border bg-card card-shadow p-4 flex items-start gap-3 ${
                  mod.active ? 'border-border' : 'border-dashed border-border/50 opacity-70'
                }`}
              >
                <div className={`mt-0.5 shrink-0 ${mod.active ? 'text-success' : 'text-muted-foreground'}`}>
                  {mod.active ? <CheckCircle size={18} /> : <Lock size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{mod.name}</span>
                    <Badge variant={mod.active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {mod.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* CTA */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex items-center gap-4">
        <Puzzle size={28} className="text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Precisa de um módulo adicional?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Entre em contato com nossa equipe de suporte para contratar módulos adicionais ou tirar dúvidas sobre funcionalidades.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => window.open('https://chatguru.com.br', '_blank')}>
          <ExternalLink size={13} /> Falar com suporte
        </Button>
      </div>
    </div>
  );
}
