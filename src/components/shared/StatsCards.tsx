import { type LucideIcon } from 'lucide-react';

export interface StatCardData {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface StatsCardsProps {
  stats: StatCardData[];
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card card-shadow p-4 flex items-start gap-3"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              <p className="text-xl font-bold text-foreground mt-0.5">{stat.value}</p>
              {stat.change && (
                <p
                  className={`text-[11px] mt-0.5 font-medium ${
                    stat.trend === 'up'
                      ? 'text-success'
                      : stat.trend === 'down'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {stat.change}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
