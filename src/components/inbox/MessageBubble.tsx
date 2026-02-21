import { useState } from 'react';
import { Check, CheckCheck, Download, FileText, ChevronDown, Bot, Reply } from 'lucide-react';
import { getColorForName, getBgColorForName } from '@/lib/colors';

interface Message {
  id?: string;
  body?: string | null;
  media_url?: string | null;
  type?: string | null;
  created_at: string;
  delivery_status?: string | null;
  processed_by_bot?: boolean | null;
  sent_by?: string | null;
  sender_name?: string | null;
  sender?: { name?: string | null } | null;
  reply_to_message_id?: string | null;
  server_timestamp?: string | null;
  client_timestamp?: string | null;
}

interface MessageBubbleProps {
  msg: Message;
  isOutgoing: boolean;
  contactName: string;
  contactAvatarUrl?: string | null;
  isGroup?: boolean;
  showSenderHeader?: boolean;
}

function getMediaType(url: string): 'image' | 'audio' | 'video' | 'sticker' | 'document' {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp)(\?|$)/.test(lower)) return 'image';
  if (/\.(webp)(\?|$)/.test(lower)) return 'sticker';
  if (/\.(ogg|mp3|m4a|opus|aac|wav|oga)(\?|$)/.test(lower)) return 'audio';
  if (/\.(mp4|3gp|mov|avi|mkv|webm)(\?|$)/.test(lower)) return 'video';
  if (lower.includes('audio') || lower.includes('ptt')) return 'audio';
  if (lower.includes('image') || lower.includes('photo')) return 'image';
  if (lower.includes('video')) return 'video';
  if (lower.includes('sticker')) return 'sticker';
  return 'document';
}

function MediaContent({ url, dbType }: { url: string; dbType?: string | null }) {
  // Prefer DB type field over URL-based detection (WhatsApp CDN URLs are encrypted/opaque)
  const type = dbType && ['audio', 'image', 'video', 'sticker', 'document'].includes(dbType)
    ? dbType as ReturnType<typeof getMediaType>
    : getMediaType(url);

  switch (type) {
    case 'image':
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt="Imagem" className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer" loading="lazy" />
        </a>
      );
    case 'sticker':
      return (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt="Figurinha" className="max-w-[150px] max-h-[150px] object-contain" loading="lazy" />
        </a>
      );
    case 'audio':
      return (
        <audio controls className="max-w-full min-w-[200px]" preload="metadata">
          <source src={url} />
        </audio>
      );
    case 'video':
      return (
        <video controls className="rounded-lg max-w-full max-h-64" preload="metadata">
          <source src={url} />
        </video>
      );
    case 'document':
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
          <FileText size={18} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate flex-1">Documento</span>
          <Download size={14} className="text-muted-foreground shrink-0" />
        </a>
      );
  }
}

function DeliveryTicks({ status }: { status?: string }) {
  if (!status || status === 'sent') {
    return <Check size={12} className="text-muted-foreground shrink-0" />;
  }
  if (status === 'delivered') {
    return <CheckCheck size={12} className="text-muted-foreground shrink-0" />;
  }
  if (status === 'read') {
    return <CheckCheck size={12} className="text-primary shrink-0" />;
  }
  return <Check size={12} className="text-destructive shrink-0" />;
}

export default function MessageBubble({ msg, isOutgoing, contactName, contactAvatarUrl, isGroup = false, showSenderHeader = true }: MessageBubbleProps) {
  const [showMeta, setShowMeta] = useState(false);
  const hasMedia = !!msg.media_url;
  const hasBody = !!msg.body?.trim();
  const isBot = msg.processed_by_bot || msg.sent_by === 'bot';
  const deliveryStatus = msg.delivery_status ?? 'sent';

  const senderName = msg.sender_name ?? msg.sender?.name ?? contactName;
  const senderColor = isGroup && !isOutgoing ? getColorForName(senderName) : undefined;
  const senderBg = isGroup && !isOutgoing ? getBgColorForName(senderName) : undefined;

  return (
    <div className={`flex mb-1.5 ${isOutgoing ? 'justify-end' : 'justify-start'} group`}>
      {/* Avatar for incoming messages */}
      {!isOutgoing && showSenderHeader && (
        <div className="shrink-0 mr-1.5 mt-0.5 self-end">
          {isGroup ? (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
              style={{ background: senderColor }}
            >
              {senderName[0]?.toUpperCase()}
            </div>
          ) : (
            <div className="h-7 w-7 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {contactAvatarUrl ? (
                <img src={contactAvatarUrl} className="h-full w-full object-cover" alt="" />
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">{contactName[0]}</span>
              )}
            </div>
          )}
        </div>
      )}
      {/* Spacer when avatar is hidden (consecutive same sender) */}
      {!isOutgoing && !showSenderHeader && (
        <div className="w-7 shrink-0 mr-1.5" />
      )}

      <div className="relative max-w-[65%]">
        {/* Hover actions */}
        <div className="absolute -top-6 right-0 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-sm px-1 py-0.5 z-10">
          <button className="p-1 hover:bg-accent rounded" title="Responder">
            <Reply size={12} className="text-muted-foreground" />
          </button>
        </div>

        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm relative ${
            isOutgoing
              ? 'bg-[hsl(142,60%,88%)] text-foreground rounded-br-sm dark:bg-[hsl(142,40%,25%)]'
              : 'bg-card text-foreground rounded-bl-sm border border-border/50'
          }`}
        >
          {/* Sender name for group chats or bot */}
          {!isOutgoing && showSenderHeader && (
            <div className="flex items-center gap-1 mb-0.5">
              {isBot && <Bot size={10} className="text-primary" />}
              <p
                className="text-[10px] font-semibold"
                style={{ color: senderColor ?? 'hsl(var(--primary))' }}
              >
                {senderName}
              </p>
            </div>
          )}

          {/* Reply reference */}
          {msg.reply_to_message_id && (
            <div className="bg-secondary/60 border-l-2 border-primary rounded px-2 py-1 mb-1.5">
              <p className="text-[10px] text-muted-foreground italic truncate">Respondendo mensagem...</p>
            </div>
          )}

          {hasMedia && msg.media_url && <MediaContent url={msg.media_url} dbType={msg.type} />}

          {hasBody && (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${hasMedia ? 'mt-1.5' : ''}`}>
              {msg.body}
            </p>
          )}

          {!hasMedia && !hasBody && (
            <p className="text-sm leading-relaxed text-muted-foreground italic">[Mídia não suportada]</p>
          )}

          <div className="flex items-center justify-end gap-1 mt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {isOutgoing && <DeliveryTicks status={deliveryStatus} />}
            <button onClick={() => setShowMeta(!showMeta)} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronDown size={10} className={`text-muted-foreground transition-transform ${showMeta ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expandable metadata */}
          {showMeta && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[9px] text-muted-foreground space-y-0.5">
              {msg.processed_by_bot !== undefined && (
                <p>Bot: {msg.processed_by_bot ? 'Sim' : 'Não'}</p>
              )}
              {msg.sent_by && <p>Enviado por: {msg.sent_by}</p>}
              {msg.server_timestamp && (
                <p>Servidor: {new Date(msg.server_timestamp).toLocaleString('pt-BR')}</p>
              )}
              {msg.client_timestamp && (
                <p>Cliente: {new Date(msg.client_timestamp).toLocaleString('pt-BR')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
