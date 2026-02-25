import { useState } from 'react';
import { Check, CheckCheck, Download, FileText, ChevronDown, Bot, Reply, Trash2, Copy } from 'lucide-react';
import { getColorForName, getBgColorForName } from '@/lib/colors';

interface ReplyTo {
  id: string;
  body: string | null;
  sender_type: string;
  sender_name: string | null;
}

interface Message {
  id?: string;
  body?: string | null;
  media_url?: string | null;
  type?: string | null;
  created_at: string;
  deleted_at?: string | null;
  delivery_status?: string | null;
  processed_by_bot?: boolean | null;
  sent_by?: string | null;
  sender_name?: string | null;
  sender?: { name?: string | null } | null;
  reply_to_message_id?: string | null;
  reply_to?: ReplyTo | null;
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
  onReply?: (msg: Message) => void;
  onDelete?: (msgId: string) => void;
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

export default function MessageBubble({
  msg,
  isOutgoing,
  contactName,
  contactAvatarUrl,
  isGroup = false,
  showSenderHeader = true,
  onReply,
  onDelete,
}: MessageBubbleProps) {
  const [showMeta, setShowMeta] = useState(false);
  const isDeleted = !!msg.deleted_at;
  const hasMedia = !!msg.media_url && !isDeleted;
  const hasBody = !!msg.body?.trim() && !isDeleted;
  const isBot = msg.processed_by_bot || msg.sent_by === 'bot';
  const deliveryStatus = msg.delivery_status ?? 'sent';

  const senderName = msg.sender_name ?? msg.sender?.name ?? contactName;
  const senderColor = isGroup && !isOutgoing ? getColorForName(senderName) : undefined;

  // Reply preview label
  const replyTo = msg.reply_to;
  const replyLabel = replyTo
    ? (replyTo.sender_type === 'agent' ? 'Você' : (replyTo.sender_name ?? contactName))
    : null;

  return (
    <div className={`flex ${showSenderHeader ? 'mb-1.5' : 'mb-0.5'} ${isOutgoing ? 'justify-end' : 'justify-start'} group`}>
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
      {!isOutgoing && !showSenderHeader && (
        <div className="w-7 shrink-0 mr-1.5" />
      )}

      <div className="relative max-w-[65%]">
        {/* Hover action bar */}
        {!isDeleted && (
          <div className={`absolute -top-7 ${isOutgoing ? 'right-0' : 'left-0'} hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-lg shadow-md px-1 py-0.5 z-10`}>
            {onReply && (
              <button
                className="p-1 hover:bg-accent rounded transition-colors"
                title="Responder"
                onClick={() => onReply(msg)}
              >
                <Reply size={12} className="text-muted-foreground" />
              </button>
            )}
            {msg.body && (
              <button
                className="p-1 hover:bg-accent rounded transition-colors"
                title="Copiar"
                onClick={() => navigator.clipboard.writeText(msg.body ?? '')}
              >
                <Copy size={12} className="text-muted-foreground" />
              </button>
            )}
            {isOutgoing && onDelete && msg.id && (
              <button
                className="p-1 hover:bg-destructive/10 rounded transition-colors"
                title="Excluir"
                onClick={() => onDelete(msg.id!)}
              >
                <Trash2 size={12} className="text-destructive/70" />
              </button>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm relative ${
            isDeleted
              ? 'bg-muted/40 border border-border/30 opacity-70'
              : isOutgoing
                ? 'bg-[hsl(142,60%,88%)] text-foreground rounded-br-sm dark:bg-[hsl(142,40%,25%)]'
                : 'bg-card text-foreground rounded-bl-sm border border-border/50'
          }`}
        >
          {/* Sender name for group chats or bot */}
          {!isOutgoing && showSenderHeader && !isDeleted && (
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
          {replyTo && !isDeleted && (
            <div className={`border-l-2 border-primary rounded px-2 py-1 mb-1.5 ${isOutgoing ? 'bg-black/10 dark:bg-white/10' : 'bg-secondary/60'}`}>
              <p className="text-[10px] font-semibold text-primary truncate">{replyLabel}</p>
              <p className="text-[10px] text-muted-foreground truncate">{replyTo.body ?? '📎 Mídia'}</p>
            </div>
          )}

          {/* Deleted message */}
          {isDeleted ? (
            <p className="text-xs text-muted-foreground italic">🚫 Mensagem apagada</p>
          ) : (
            <>
              {hasMedia && msg.media_url && <MediaContent url={msg.media_url} dbType={msg.type} />}
              {hasBody && (
                <p className={`text-sm leading-relaxed whitespace-pre-wrap ${hasMedia ? 'mt-1.5' : ''}`}>
                  {msg.body}
                </p>
              )}
              {!hasMedia && !hasBody && (
                <p className="text-sm leading-relaxed text-muted-foreground italic">[Mídia não suportada]</p>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-1 mt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {isOutgoing && !isDeleted && <DeliveryTicks status={deliveryStatus} />}
            {!isDeleted && (
              <button onClick={() => setShowMeta(!showMeta)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronDown size={10} className={`text-muted-foreground transition-transform ${showMeta ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Expandable metadata */}
          {showMeta && !isDeleted && (
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
