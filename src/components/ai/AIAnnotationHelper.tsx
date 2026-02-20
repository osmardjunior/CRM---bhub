import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAnthropicStream } from '@/hooks/useAnthropicStream';
import type { ConversationDetail } from '@/services/api';

interface Props {
  conversation: ConversationDetail;
  onInsert: (text: string) => void;
}

export default function AIAnnotationHelper({ conversation, onInsert }: Props) {
  const [open, setOpen] = useState(false);

  const { content, isStreaming, error, invoke, reset } = useAnthropicStream({
    endpoint: 'ai-annotation',
    onComplete: () => {},
  });

  const handleGenerate = () => {
    reset();
    const recentMessages = conversation.messages.slice(-10).map((m) => ({
      direction: m.sender_type === 'user' ? 'inbound' : 'outbound',
      content: m.body,
    }));

    const tags = ((conversation.contact as any).tags as string[]) || [];

    invoke({
      conversationId: conversation.id,
      recentMessages,
      contactMetadata: {
        name: conversation.contact.name,
        attendanceStatus: conversation.status,
        tags,
      },
    });
  };

  const handleInsert = () => {
    onInsert(content);
    setOpen(false);
    reset();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            setOpen(true);
            handleGenerate();
          }}
        >
          <Sparkles size={12} className="text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1">
            <Sparkles size={12} className="text-primary" />
            Rascunho de Anotação (IA)
          </p>

          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Gerando rascunho...
            </div>
          )}

          {content && (
            <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap bg-secondary/50 rounded p-2 max-h-40 overflow-y-auto">
              {content}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {content && !isStreaming && (
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleInsert}>
              Inserir Rascunho
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
