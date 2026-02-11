import { useState } from 'react';
import { CheckSquare, Plus, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { tasks, type TaskStatus } from '@/data/mock';

const filterTabs: { label: string; value: TaskStatus | 'todas' }[] = [
  { label: 'Todas', value: 'todas' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Em Progresso', value: 'em_progresso' },
  { label: 'Concluídas', value: 'concluida' },
];

export default function TarefasPage() {
  const [activeFilter, setActiveFilter] = useState<TaskStatus | 'todas'>('todas');

  const filtered = tasks.filter(
    (t) => activeFilter === 'todas' || t.status === activeFilter
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {filterTabs.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={activeFilter === f.value ? 'default' : 'ghost'}
              className="h-7 text-xs rounded-full"
              onClick={() => setActiveFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button size="sm" className="gap-2">
          <Plus size={16} />
          Nova Tarefa
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Não há tarefas com esse filtro." />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-4 hover:bg-accent/30 transition-colors cursor-pointer">
                <Checkbox
                  checked={task.status === 'concluida'}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${task.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    <StatusBadge status={task.priority} />
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                    <span>{task.assignedTo}</span>
                    {task.contactName && (
                      <Badge variant="secondary" className="text-xs">{task.contactName}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
