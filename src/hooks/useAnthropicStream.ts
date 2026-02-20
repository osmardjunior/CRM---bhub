import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseAnthropicStreamOptions {
  endpoint: string;
  onComplete?: (content: string) => void;
}

export function useAnthropicStream({ endpoint, onComplete }: UseAnthropicStreamOptions) {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (payload: object) => {
    setIsStreaming(true);
    setContent('');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(errBody || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from Anthropic streaming
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const event = JSON.parse(jsonStr);

            // Anthropic SSE format
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              accumulated += event.delta.text;
              setContent(accumulated);
            }
          } catch {
            // Partial JSON, skip
          }
        }
      }

      onComplete?.(accumulated);
    } catch (err: any) {
      setError(err.message ?? 'AI request failed');
    } finally {
      setIsStreaming(false);
    }
  }, [endpoint, onComplete]);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
  }, []);

  return { content, isStreaming, error, invoke, reset };
}
