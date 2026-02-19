import { MessageSquare, History, Users, BarChart3, Contact, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ReportType, SavedReport } from '@/hooks/useReportBuilder';

const reportCategories: { type: ReportType; label: string; icon: React.ElementType }[] = [
  { type: 'chats', label: 'Chats', icon: MessageSquare },
  { type: 'messages', label: 'Histórico de Mensagens', icon: History },
  { type: 'users', label: 'Relatórios de Usuários', icon: Users },
  { type: 'charts', label: 'Relatórios Gráficos', icon: BarChart3 },
  { type: 'contacts', label: 'Contatos', icon: Contact },
];

interface Props {
  activeType: ReportType;
  onSelectType: (t: ReportType) => void;
  savedReports: SavedReport[];
  onLoadReport: (r: SavedReport) => void;
  onDeleteReport: (id: string) => void;
}

export default function ReportSidebar({ activeType, onSelectType, savedReports, onLoadReport, onDeleteReport }: Props) {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col h-full">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipos de Relatório</h2>
      </div>

      <nav className="px-2 space-y-0.5">
        {reportCategories.map((c) => (
          <button
            key={c.type}
            onClick={() => onSelectType(c.type)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
              activeType === c.type
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <c.icon size={16} />
            <span className="truncate">{c.label}</span>
          </button>
        ))}
      </nav>

      {savedReports.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="px-4 mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bookmark size={12} /> Salvos
            </h2>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-0.5 pb-4">
              {savedReports.map((r) => (
                <div
                  key={r.id}
                  className="group flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground cursor-pointer"
                  onClick={() => onLoadReport(r)}
                >
                  <span className="truncate flex-1">{r.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => { e.stopPropagation(); onDeleteReport(r.id); }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
