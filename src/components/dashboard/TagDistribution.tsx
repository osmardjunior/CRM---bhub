import { Tag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTagDistribution } from '@/hooks/useDashboardAnalytics';

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function TagDistribution({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: tags } = useTagDistribution(dateFrom, dateTo, projectId, agentId);
  const data = (tags ?? []).map(t => ({ name: t.tag_name, value: t.count, fill: t.tag_color }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Tag size={15} /> Top 10 Tags
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" name="Contatos" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          Sem dados para o período
        </div>
      )}
    </div>
  );
}
