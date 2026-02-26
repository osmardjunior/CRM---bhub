import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Users, Kanban, CheckSquare, DollarSign, AlertTriangle, Star, Loader2, BarChart2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useNPSCard } from '@/hooks/useSatisfaction';
const stageLabels: Record<string, string> = {
  novo_lead: 'Novo Lead',
  em_contato: 'Em Contato',
  proposta: 'Proposta',
  fechamento: 'Fechamento',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

const COLORS = [
  'hsl(168, 60%, 48%)',
  'hsl(210, 80%, 52%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(142, 60%, 40%)',
  'hsl(0, 72%, 51%)',
];

export default function Dashboard() {
  const { companyId, user } = useAuth();
  const { data: npsData } = useNPSCard();

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboard-metrics', companyId],
    queryFn: async () => {
      const [convOpen, contacts, dealsList, tasksPending, tasksOverdue] = await Promise.all([
        supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('company_id', companyId!).in('status', ['new', 'open', 'pending']),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId!),
        supabase.from('deals').select('stage, value').eq('company_id', companyId!),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId!).neq('status', 'concluida'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', companyId!).neq('status', 'concluida').lt('due_date', new Date().toISOString().split('T')[0]),
      ]);

      const deals = dealsList.data ?? [];
      const totalPipeline = deals.reduce((sum, d) => sum + Number(d.value), 0);
      const stageCount: Record<string, number> = {};
      deals.forEach(d => { stageCount[d.stage] = (stageCount[d.stage] ?? 0) + 1; });

      return {
        openConversations: convOpen.count ?? 0,
        totalContacts: contacts.count ?? 0,
        totalPipeline,
        pendingTasks: tasksPending.count ?? 0,
        overdueTasks: tasksOverdue.count ?? 0,
        dealsByStage: Object.entries(stageCount).map(([stage, count]) => ({
          name: stageLabels[stage] ?? stage,
          value: count,
        })),
      };
    },
    enabled: !!companyId,
  });

  const npsColor = npsData?.nps != null
    ? npsData.nps >= 50 ? 'text-success' : npsData.nps >= 0 ? 'text-warning' : 'text-destructive'
    : 'text-muted-foreground';

  const cards = [
    { label: 'Conversas Abertas', value: metrics?.openConversations ?? 0, icon: MessageSquare, color: 'text-primary' },
    { label: 'Total Contatos', value: metrics?.totalContacts ?? 0, icon: Users, color: 'text-info' },
    { label: 'Pipeline Total', value: `R$ ${(metrics?.totalPipeline ?? 0).toLocaleString('pt-BR')}`, icon: DollarSign, color: 'text-success' },
    { label: 'Tarefas Pendentes', value: metrics?.pendingTasks ?? 0, icon: CheckSquare, color: 'text-warning' },
    { label: 'Tarefas Atrasadas', value: metrics?.overdueTasks ?? 0, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'NPS (30d)', value: npsData?.nps != null ? npsData.label : '—', icon: Star, color: npsColor },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-border bg-card card-shadow p-4">
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={16} className={c.color} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Negócios por Etapa</h3>
          {metricsLoading ? (
            <div className="flex items-center justify-center h-[250px]">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (metrics?.dealsByStage ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground gap-2">
              <BarChart2 size={32} className="opacity-30" />
              <p className="text-sm">Nenhum negócio cadastrado ainda</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics?.dealsByStage ?? []}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(168, 60%, 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="rounded-xl border border-border bg-card card-shadow p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição do Pipeline</h3>
          {metricsLoading ? (
            <div className="flex items-center justify-center h-[250px]">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (metrics?.dealsByStage ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground gap-2">
              <BarChart2 size={32} className="opacity-30" />
              <p className="text-sm">Nenhum negócio para distribuir</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics?.dealsByStage ?? []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`}
                >
                  {(metrics?.dealsByStage ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
