import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCheck, Download, FileText } from 'lucide-react';

interface MessageBubbleProps {
  msg: any;
  isOutgoing: boolean;
  contactName: string;
  contactAvatarUrl?: string | null;
}

function getMediaType(url: string): 'image' | 'audio' | 'video' | 'sticker' | 'document' {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp)(\?|$)/.test(lower)) return 'image';
  if (/\.(webp)(\?|$)/.test(lower)) {
    // webp could be sticker (small) or image — treat short URLs / sticker-like as sticker
    return 'sticker';
  }
  if (/\.(ogg|mp3|m4a|opus|aac|wav|oga)(\?|$)/.test(lower)) return 'audio';
  if (/\.(mp4|3gp|mov|avi|mkv|webm)(\?|$)/.test(lower)) return 'video';
  // Check MIME hints in URL
  if (lower.includes('audio') || lower.includes('ptt')) return 'audio';
  if (lower.includes('image') || lower.includes('photo')) return 'image';
  if (lower.includes('video')) return 'video';
  if (lower.includes('sticker')) return 'sticker';
  return 'document';
}

function MediaContent({ url }: { url: string }) {
  const type = getMediaType(url);

  switch (type) {
    case 'image':
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Imagem"
            className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
            loading="lazy"
          />
        </a>
      );
    case 'sticker':
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt="Figurinha"
            className="max-w-[150px] max-h-[150px] object-contain"
            loading="lazy"
          />
        </a>
      );
    case 'audio':
      return (
        <audio controls className="max-w-full min-w-[200px]" preload="metadata">
          <source src={url} />
          Seu navegador não suporta áudio.
        </audio>
      );
    case 'video':
      return (
        <video controls className="rounded-lg max-w-full max-h-64" preload="metadata">
          <source src={url} />
          Seu navegador não suporta vídeo.
        </video>
      );
    case 'document':
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors"
        >
          <FileText size={18} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate flex-1">Documento</span>
          <Download size={14} className="text-muted-foreground shrink-0" />
        </a>
      );
  }
}

export default function MessageBubble({ msg, isOutgoing, contactName, contactAvatarUrl }: MessageBubbleProps) {
  const hasMedia = !!msg.media_url;
  const hasBody = !!msg.body?.trim();

  return (
    <div className={`flex mb-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      {!isOutgoing && (
        <Avatar className="h-7 w-7 shrink-0 mr-1.5 mt-0.5 self-end">
          <AvatarImage src={contactAvatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px] bg-muted">
            {contactName[0]}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm relative ${
          isOutgoing
            ? 'bg-[hsl(142,60%,88%)] text-foreground rounded-br-sm dark:bg-[hsl(142,40%,25%)]'
            : 'bg-card text-foreground rounded-bl-sm border border-border/50'
        }`}
      >
        {!isOutgoing && (
          <p className="text-[10px] font-semibold mb-0.5 text-primary">
            {msg.sender?.name ?? contactName}
          </p>
        )}

        {hasMedia && <MediaContent url={msg.media_url} />}
        
        {hasBody && (
          <p className={`text-sm leading-relaxed whitespace-pre-wrap ${hasMedia ? 'mt-1.5' : ''}`}>
            {msg.body}
          </p>
        )}

        {!hasMedia && !hasBody && (
          <p className="text-sm leading-relaxed text-muted-foreground italic">
            [Mídia não suportada]
          </p>
        )}

        <div className="flex items-center justify-end gap-1 mt-0.5">
          <p className="text-[10px] text-muted-foreground">
            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isOutgoing && <CheckCheck size={12} className="text-primary shrink-0" />}
        </div>
      </div>
    </div>
  );
}
