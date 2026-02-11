import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamMembers, useContacts } from '@/hooks/useContacts';
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks';
import type { TaskWithRelations } from '@/services/tasks';

type TaskPriority = 'alta' | 'media' | 'baixa';
type TaskStatus = 'pendente' | 'em_progresso' | 'concluida';

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  task?: TaskWithRelations | null;
  /** Pre-fill contact when creating from contact profile */
  defaultContactId?: string;
  defaultContactName?: string;
}

interface FormErrors {
  title?: string;
  dueDate?: string;
  assignedTo?: string;
}

export default function TaskModal({ open, onClose, task, defaultContactId, defaultContactName }: TaskModalProps) {
  const isEdit = !!task;
  const { data: teamMembers } = useTeamMembers();
  const { data: contacts } = useContacts();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    priority: (task?.priority || 'media') as TaskPriority,
    status: (task?.status || 'pendente') as TaskStatus,
    dueDate: task?.due_date ? new Date(task.due_date) : undefined as Date | undefined,
    assignedUserId: task?.assigned_user_id || '',
    contactId: task?.contact_id || defaultContactId || '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when modal opens with new task
  useState(() => {
    if (open) {
      setForm({
        title: task?.title || '',
        description: task?.description || '',
        priority: (task?.priority || 'media') as TaskPriority,
        status: (task?.status || 'pendente') as TaskStatus,
        dueDate: task?.due_date ? new Date(task.due_date) : undefined,
        assignedUserId: task?.assigned_user_id || '',
        contactId: task?.contact_id || defaultContactId || '',
      });
    }
  });

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.title.trim()) e.title = 'Título é obrigatório';
    if (!form.dueDate) e.dueDate = 'Prazo é obrigatório';
    if (!form.assignedUserId) e.assignedTo = 'Responsável é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      due_date: form.dueDate ? format(form.dueDate, 'yyyy-MM-dd') : null,
      assigned_user_id: form.assignedUserId || null,
      contact_id: form.contactId && form.contactId !== 'none' ? form.contactId : null,
    };

    if (isEdit && task) {
      updateTask.mutate({ id: task.id, ...payload }, { onSuccess: () => onClose() });
    } else {
      createTask.mutate(payload, { onSuccess: () => onClose() });
    }
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título da tarefa"
              className={`mt-1 ${errors.title ? 'border-destructive' : ''}`}
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva a tarefa..."
              className="mt-1 min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Prazo *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full mt-1 justify-start text-left font-normal',
                      !form.dueDate && 'text-muted-foreground',
                      errors.dueDate && 'border-destructive'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.dueDate ? format(form.dueDate, 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.dueDate}
                    onSelect={(d) => setForm({ ...form, dueDate: d })}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
              {errors.dueDate && <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>}
            </div>

            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Responsável *</Label>
              <Select value={form.assignedUserId} onValueChange={(v) => setForm({ ...form, assignedUserId: v })}>
                <SelectTrigger className={`mt-1 ${errors.assignedTo ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {(teamMembers ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assignedTo && <p className="text-xs text-destructive mt-1">{errors.assignedTo}</p>}
            </div>

            <div>
              <Label className="text-xs">Contato vinculado</Label>
              <Select value={form.contactId} onValueChange={(v) => setForm({ ...form, contactId: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(contacts ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && (
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_progresso">Em Progresso</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createTask.isPending || updateTask.isPending}>
            {isEdit ? 'Salvar' : 'Criar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
