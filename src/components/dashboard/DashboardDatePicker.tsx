import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const quickOptions = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

interface Props {
  dateFrom: Date;
  dateTo: Date;
  setDateFrom: (d: Date) => void;
  setDateTo: (d: Date) => void;
}

export default function DashboardDatePicker({ dateFrom, dateTo, setDateFrom, setDateTo }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {quickOptions.map((opt) => (
        <Button
          key={opt.days}
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-2.5"
          onClick={() => {
            setDateFrom(subDays(new Date(), opt.days));
            setDateTo(new Date());
          }}
        >
          {opt.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-7 gap-1.5 text-[11px] font-normal px-2.5')}>
            <CalendarIcon size={12} />
            {format(dateFrom, 'dd/MM/yy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={dateFrom} onSelect={(d) => d && setDateFrom(d)} initialFocus locale={ptBR} />
        </PopoverContent>
      </Popover>

      <span className="text-[11px] text-muted-foreground">até</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-7 gap-1.5 text-[11px] font-normal px-2.5')}>
            <CalendarIcon size={12} />
            {format(dateTo, 'dd/MM/yy', { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={dateTo} onSelect={(d) => d && setDateTo(d)} initialFocus locale={ptBR} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
