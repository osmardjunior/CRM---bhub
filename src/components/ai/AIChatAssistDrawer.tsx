import { useState } from 'react';
import { Sparkles, X, ArrowRight, Tag, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnthropicStream } from '@/hooks/useAnthropicStream';
import { useChatStore } from '@/store/chatStore';
import { toast } from 'sonner';
import type { ConversationDetail } from '@/services/api';

interface Props {
  conversation: ConversationDetail | null;
}

interface AIAnalysis {
  next_funnel_stage: string | null;
  suggested_tags: string[];
  trigger_dialog: string | null;
  urgency_level: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  recommended_action: string;
}

const urgencyColors: Record<string, string> = {
  low: 'bg-success/20 text-success border-success/30',
  medium: 'bg-warning/20 text-warning border-warning/30',
  high: 'bg-destructive/20 text-destructive border-destructive/30',
};

const sentimentEmoji: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
};

export default function AIChatAssistDrawer({ conversation }: Props) {
  const { isAIDrawerOpen, setAIDrawerOpen } = useChatStore();
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const { content, isStreaming, error, invoke, reset } = useAnthropicStream({
    endpoint: 'ai-chat-assist',
    onComplete: (result) => {
      try {
        const parsed = JSON.parse(result);
        setAnalysis(parsed);
      } catch {
        toast.error('Erro ao interpretar resposta da IA');
      }
    },
  });

  const handleAnalyze = () => {
    if (!conversation) return;
    setAnalysis(null);
    reset();

    const messages = conversation.messages.slice(-10).map((m) => ({
      direction: m.sender_type === 'user' ? 'inbound' : 'outbound',
      content: m.body,
    }));

    const tags = ((conversation.contact as any).tags as string[]) || [];

    invoke({
      conversationId: conversation.id,
      messages,
      metadata: {
        currentStage: null,
        tags,
        attendanceStatus: conversation.status,
        timeInStatus: 0,
        assignedAgent: conversation.assigned_user?.name ?? null,
      },
    });
  };

  const handleApply = () => {
    if (!analysis) return;
    toast.success('Sugestões aplicadas com sucesso!');
    setAIDrawerOpen(false);
  };

  return (
    <Sheet open={isAIDrawerOpen} onOpenChange={setAIDrawerOpen}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente IA
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {!isStreaming && !analysis && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Analise a conversa atual com IA para obter sugestões de próximos passos, tags e ações recomendadas.
              </p>
              <Button onClick={handleAnalyze} disabled={!conversation}>
                <Sparkles className="mr-2 h-4 w-4" />
                Analisar Conversa
              </Button>
            </div>
          )}

          {isStreaming && !analysis && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando conversa...
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {analysis && (
            <>
              {/* Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {sentimentEmoji[analysis.sentiment]} Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                </CardContent>
              </Card>

              {/* Urgency */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Urgência</span>
                    <Badge variant="outline" className={urgencyColors[analysis.urgency_level]}>
                      {analysis.urgency_level === 'high' ? 'Alta' : analysis.urgency_level === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Next Funnel Stage */}
              {analysis.next_funnel_stage && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Próxima Etapa</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{analysis.next_funnel_stage}</p>
                  </CardContent>
                </Card>
              )}

              {/* Suggested Tags */}
              {analysis.suggested_tags.length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Tags Sugeridas</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.suggested_tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommended Action */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Ação Recomendada</span>
                  </div>
                  <p className="text-sm">{analysis.recommended_action}</p>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleApply} className="flex-1">
                  Aplicar Sugestões
                </Button>
                <Button variant="outline" onClick={() => { setAnalysis(null); reset(); }}>
                  Descartar
                </Button>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
