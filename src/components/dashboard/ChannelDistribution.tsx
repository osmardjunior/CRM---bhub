import { MessageSquare } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChannelVolume } from '@/hooks/useReports';

interface Props {
  dateFrom: string;
  dateTo: string;
  projectId?: string | null;
  agentId?: string | null;
}

export default function ChannelDistribution({ dateFrom, dateTo, projectId, agentId }: Props) {
  const { data: channels } = useChannelVolume(dateFrom, dateTo, projectId, agentId);
  const data = channels ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <MessageSquare size={15} /> Volume por Canal
      </h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
          Sem dados para o período
        </div>
      )}
    </div>
  );
}
