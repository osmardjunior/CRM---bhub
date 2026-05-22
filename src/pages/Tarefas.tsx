import { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Calendar as CalendarIcon,
  List,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/LoadingSkeletons';
import TaskModal from '@/components/tarefas/TaskModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { useTasks, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskWithRelations } from '@/services/tasks';

type TabKey = 'minhas' | 'time' | 'concluidas';
type ViewMode = 'lista' | 'calendario';

export default function TarefasPage() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const deleteTaskMut = useDeleteTask();
  const [activeTab, setActiveTab] = useState<TabKey>('minhas');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const filtered = useMemo(() => {
    if (!tasks) return [];
    switch (activeTab) {
      case 'minhas':
        return tasks.filter((t) => t.assigned_user_id === user?.id && t.status !== 'concluida');
      case 'time':
        return tasks.filter((t) => t.status !== 'concluida');
      case 'concluidas':
        return tasks.filter((t) => t.status === 'concluida');
      default:
        return tasks;
    }
  }, [tasks, activeTab, user?.id]);

  const toggleDone = (id: string, currentStatus: string) => {
    updateTask.mutate({
      id,
      status: currentStatus === 'concluida' ? 'pendente' : 'concluida',
    });
  };

  const handleDelete = (id: string) => {
    deleteTaskMut.mutate(id);
    setDeleteId(null);
  };

  const openEdit = (task: TaskWithRelations) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'minhas', label: 'Minhas' },
    { key: 'time', label: 'Do time' },
    { key: 'concluidas', label: 'Concluídas' },
  ];

  const isOverdue = (dueDate: string | null) => dueDate ? new Date(dueDate) < new Date() : false;

  // Calendar helpers
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonthIdx, 1).getDay();
  const monthName = calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const calendarCells = useMemo(() => {
    const cells: { day: number | null; tasks: TaskWithRelations[] }[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, tasks: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, tasks: filtered.filter((t) => t.due_date === dateStr) });
    }
    return cells;
  }, [filtered, calYear, calMonthIdx, daysInMonth, firstDayOfWeek]);

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] -m-4 lg:-m-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              size="sm"
              variant={activeTab === tab.key ? 'default' : 'ghost'}
              className="h-8 text-xs rounded-full"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-0.5 ml-2 rounded-lg border border-border p-0.5 bg-secondary">
          <Button
            size="sm"
            variant={viewMode === 'lista' ? 'default' : 'ghost'}
            className="h-7 text-xs gap-1 px-2.5"
            onClick={() => setViewMode('lista')}
          >
            <List size={13} /> Lista
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'calendario' ? 'default' : 'ghost'}
            className="h-7 text-xs gap-1 px-2.5"
            onClick={() => setViewMode('calendario')}
          >
            <CalendarIcon size={13} /> Calendário
          </Button>
        </div>

        <Button size="sm" className="gap-1.5 ml-auto h-8" onClick={openCreate}>
          <Plus size={15} /> <span className="hidden sm:inline">Nova tarefa</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : viewMode === 'lista' ? (
          filtered.length === 0 ? (
            <EmptyState icon={CheckSquare} title="Nenhuma tarefa" description="Não há tarefas nesta aba." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 sticky top-0">
                    <th className="w-10 px-3 py-2.5" />
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Título</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Contato</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Responsável</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Prazo</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Prioridade</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((task) => (
                    <tr key={task.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-3 text-center">
                        <Checkbox
                          checked={task.status === 'concluida'}
                          onCheckedChange={() => toggleDone(task.id, task.status)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className={`font-medium text-sm ${task.status === 'concluida' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[260px]">{task.description}</p>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        {task.contact ? (
                          <Badge variant="secondary" className="text-xs">{task.contact.name}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {task.assigned_user?.name ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs ${isOverdue(task.due_date) && task.status !== 'concluida' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={task.priority} />
                      </td>
                      <td className="px-3 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toggleDone(task.id, task.status)}>
                              <Check size={14} className="mr-2" />
                              {task.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(task)}>
                              <Pencil size={14} className="mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(task.id)}>
                              <Trash2 size={14} className="mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* CALENDAR VIEW */
          <div className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <h3 className="text-sm font-semibold text-foreground capitalize">{monthName}</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}>
                <ChevronRight size={16} />
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden overflow-x-auto">
              <div className="grid grid-cols-7 border-b border-border bg-muted/40 min-w-[500px]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 min-w-[500px]">
                {calendarCells.map((cell, i) => (
                  <div
                    key={i}
                    className={`min-h-[90px] border-b border-r border-border p-1.5 ${
                      cell.day === null ? 'bg-muted/20' : 'bg-card'
                    }`}
                  >
                    {cell.day !== null && (
                      <>
                        <span className="text-xs font-medium text-muted-foreground">{cell.day}</span>
                        <div className="mt-1 space-y-0.5">
                          {cell.tasks.slice(0, 3).map((t) => (
                            <div
                              key={t.id}
                              onClick={() => openEdit(t)}
                              className={`rounded px-1.5 py-0.5 text-[11px] truncate cursor-pointer transition-colors ${
                                t.priority === 'alta'
                                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                  : t.priority === 'media'
                                  ? 'bg-warning/10 text-warning hover:bg-warning/20'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {t.title}
                            </div>
                          ))}
                          {cell.tasks.length > 3 && (
                            <span className="text-[10px] text-muted-foreground px-1">+{cell.tasks.length - 3} mais</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task modal */}
      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        task={editingTask}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir tarefa"
        description="Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {
          if (deleteId) handleDelete(deleteId);
        }}
      />
    </div>
  );
}
