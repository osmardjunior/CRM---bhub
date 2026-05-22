import { useState } from 'react';
import { Clock, Loader2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduleMessageButtonProps {
  conversationId: string;
  companyId: string | null;
  userId: string | undefined;
  messageBody: string;
  onScheduled: () => void;
}

export default function ScheduleMessageButton({
  conversationId,
  companyId,
  userId,
  messageBody,
  onScheduled,
}: ScheduleMessageButtonProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('12:00');
  const [scheduling, setScheduling] = useState(false);

  const handleSchedule = async () => {
    if (!date || !companyId || !userId) return;
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledAt = new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    );

    if (scheduledAt <= new Date()) {
      toast.error('Selecione um horário futuro.');
      return;
    }

    setScheduling(true);
    try {
      const { error } = await supabase.from('scheduled_messages').insert({
        conversation_id: conversationId,
        company_id: companyId,
        created_by: userId,
        content: messageBody,
        scheduled_at: scheduledAt.toISOString(),
      });
      if (error) throw error;
      toast.success(`Mensagem agendada para ${format(scheduledAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`);
      setOpen(false);
      setDate(undefined);
      setTime('12:00');
      onScheduled();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar mensagem');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Agendar mensagem">
          <Clock size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end" side="top">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Agendar envio</p>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            className={cn("p-2 pointer-events-auto")}
            locale={ptBR}
          />
          <div className="flex items-center gap-2">
            <CalendarIcon size={14} className="text-muted-foreground" />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-8 w-28 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            disabled={!date || scheduling}
            onClick={handleSchedule}
          >
            {scheduling ? <Loader2 size={13} className="animate-spin mr-1" /> : <Clock size={13} className="mr-1" />}
            Agendar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
