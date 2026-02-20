import { useState } from 'react';
import { Sparkles, Calendar, FileText, Copy, Download, Loader2, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnthropicStream } from '@/hooks/useAnthropicStream';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery } from '@tanstack/react-query';

export default function AIReportGenerator() {
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [showReport, setShowReport] = useState(false);

  const { content, isStreaming, error, invoke, reset } = useAnthropicStream({
    endpoint: 'ai-report-gen',
    onComplete: (result) => {
      toast.success('Relatório gerado com sucesso!');
    },
  });

  // Fetch previous reports
  const { data: previousReports = [] } = useQuery({
    queryKey: ['ai-reports'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('ai_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const handleGenerate = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Selecione o período');
      return;
    }

    setShowReport(true);
    reset();

    // Fetch metrics from the database
    const { data: agentMetrics } = await supabase.rpc('get_agent_metrics', {
      date_from: periodStart,
      date_to: periodEnd,
    });

    const { data: convCount } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd);

    const { data: npsData } = await supabase
      .from('satisfaction_surveys')
      .select('score')
      .gte('sent_at', periodStart)
      .lte('sent_at', periodEnd)
      .not('score', 'is', null);

    const metrics = {
      agents: agentMetrics ?? [],
      totalConversations: convCount ?? 0,
      npsResponses: npsData ?? [],
      avgNPS: npsData?.length ? (npsData.reduce((a: number, b: any) => a + (b.score || 0), 0) / npsData.length).toFixed(1) : 'N/A',
    };

    invoke({ periodStart, periodEnd, metrics });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success('Relatório copiado!');
  };

  const handleSave = async () => {
    try {
      await (supabase as any).from('ai_reports').insert({
        period_start: periodStart,
        period_end: periodEnd,
        content_md: content,
        metadata: {},
      });
      toast.success('Relatório salvo!');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Sparkles className="h-4 w-4" />
        Gerar Relatório IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={showReport ? 'max-w-4xl h-[85vh]' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatório Executivo com IA
            </DialogTitle>
          </DialogHeader>

          {!showReport ? (
            <Tabs defaultValue="generate">
              <TabsList className="w-full">
                <TabsTrigger value="generate" className="flex-1">Novo Relatório</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="generate" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Data Fim</Label>
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <Button onClick={handleGenerate} className="w-full gap-2" disabled={!periodStart || !periodEnd}>
                  <Sparkles className="h-4 w-4" />
                  Gerar Relatório
                </Button>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ScrollArea className="h-64">
                  {previousReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum relatório salvo</p>
                  ) : (
                    <div className="space-y-2">
                      {previousReports.map((r: any) => (
                        <button
                          key={r.id}
                          className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                          onClick={() => {
                            reset();
                            // Show saved report content - set manually
                          }}
                        >
                          <p className="text-sm font-medium">{r.period_start} → {r.period_end}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {isStreaming && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  🤔 Analisando dados...
                  <Progress value={Math.min((content.length / 2000) * 100, 95)} className="flex-1" />
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <ScrollArea className="flex-1 min-h-0">
                <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content || '_Gerando relatório..._'}
                  </ReactMarkdown>
                </div>
              </ScrollArea>

              {!isStreaming && content && (
                <div className="flex gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                    <Download className="h-3 w-3" /> Exportar PDF
                  </Button>
                  <Button size="sm" onClick={handleSave} className="gap-1 ml-auto">
                    Salvar Relatório
                  </Button>
                </div>
              )}

              {!isStreaming && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setShowReport(false); reset(); }}>
                  ← Voltar
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
