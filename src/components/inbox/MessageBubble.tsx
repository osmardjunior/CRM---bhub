import { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Download, FileText, ChevronDown, Bot, Reply, Trash2, Copy, Pencil, MoreVertical, X } from 'lucide-react';
import { getColorForName, getBgColorForName } from '@/lib/colors';
import { toast } from 'sonner';

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
  deleted_by_name?: string | null;
  edited_at?: string | null;
  delivery_status?: string | null;
  external_message_id?: string | null;
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
  isAdminView?: boolean;
  onReply?: (msg: Message) => void;
  onDelete?: (msgId: string) => void;
  onEdit?: (msg: Message) => void;
  onScrollToMessage?: (msgId: string) => void;
}

function getMediaType(url: string): 'image' | 'audio' | 'video' | 'sticker' | 'document' {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|avif|heic)(\?|$)/.test(lower)) return 'image';
  if (/\.(ogg|mp3|m4a|opus|aac|wav|oga|amr)(\?|$)/.test(lower)) return 'audio';
  if (/\.(mp4|3gp|mov|avi|mkv|webm)(\?|$)/.test(lower)) return 'video';
  if (lower.includes('audio') || lower.includes('ptt')) return 'audio';
  if (lower.includes('image') || lower.includes('photo')) return 'image';
  if (lower.includes('video')) return 'video';
  if (lower.includes('sticker')) return 'sticker';
  return 'document';
}

function MediaContent({ url, dbType }: { url: string; dbType?: string | null }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const type = dbType && ['audio', 'image', 'video', 'sticker', 'document'].includes(dbType)
    ? dbType as ReturnType<typeof getMediaType>
    : getMediaType(url);

  switch (type) {
    case 'image':
      return (
        <>
          <img
            src={url}
            alt="Imagem"
            className="rounded-lg max-w-full max-h-64 object-contain cursor-pointer"
            loading="lazy"
            onClick={() => setLightboxOpen(true)}
          />
          {lightboxOpen && (
            <div
              className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
              onClick={() => setLightboxOpen(false)}
            >
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <a
                  href={url}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Baixar"
                >
                  <Download size={20} />
                </a>
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <img
                src={url}
                alt="Imagem"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      );
    case 'sticker':
      return (
        <img src={url} alt="Figurinha" className="max-w-[150px] max-h-[150px] object-contain" loading="lazy" />
      );
    case 'audio': {
      const isOgg = /\.(ogg|opus|oga)(\?|$)/i.test(url);
      return (
        <audio controls className="max-w-full min-w-[200px]" preload="metadata">
          <source src={url} type={isOgg ? 'audio/ogg; codecs=opus' : undefined} />
          <source src={url} />
        </audio>
      );
    }
    case 'video':
      return (
        <video
          controls
          playsInline
          preload="auto"
          className="rounded-lg max-w-full max-h-64"
          onError={(e) => {
            const el = e.currentTarget;
            if (!el.dataset.retried && el.src !== url) {
              el.dataset.retried = '1';
              el.src = url;
              el.load();
            }
          }}
        >
          <source src={url} type="video/mp4" />
          <source src={url} />
        </video>
      );
    case 'document': {
      const isPdf = /\.pdf(\?|$)/i.test(url);
      return isPdf ? (
        <PdfViewer url={url} />
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors">
          <FileText size={18} className="text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate flex-1">Documento</span>
          <Download size={14} className="text-muted-foreground shrink-0" />
        </a>
      );
    }
  }
}

function PdfViewer({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg hover:bg-secondary transition-colors w-full text-left"
      >
        <FileText size={18} className="text-red-500 shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">PDF — Clique para visualizar</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <a
              href={url}
              download
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Baixar"
            >
              <Download size={20} />
            </a>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <iframe
            src={url}
            className="w-full max-w-4xl h-[85vh] rounded-lg bg-white"
            onClick={(e) => e.stopPropagation()}
            title="PDF"
          />
        </div>
      )}
    </>
  );
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
  isAdminView = false,
  onReply,
  onDelete,
  onEdit,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [showMeta, setShowMeta] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActions]);

  const isDeleted = !!msg.deleted_at;
  // Admin/supervisor sees original content even for deleted messages
  const showDeletedContent = isDeleted && isAdminView;
  const hasMedia = !!msg.media_url && (!isDeleted || showDeletedContent);
  const hasBody = !!msg.body?.trim() && (!isDeleted || showDeletedContent);
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
    <div data-message-id={msg.id} className={`flex ${showSenderHeader ? 'mb-1.5' : 'mb-0.5'} ${isOutgoing ? 'justify-end' : 'justify-start'} group`}>
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
        {/* 3-dot action menu */}
        {!isDeleted && (
          <div ref={actionsRef} className={`absolute -top-1 ${isOutgoing ? '-left-6' : '-right-6'} z-10`}>
            <button
              className="p-0.5 rounded-full hover:bg-accent/80 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical size={14} className="text-muted-foreground" />
            </button>
            {showActions && (
              <div className={`absolute top-6 ${isOutgoing ? 'left-0' : 'right-0'} bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-20`}>
                {onReply && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                    onClick={() => { onReply(msg); setShowActions(false); }}
                  >
                    <Reply size={13} className="text-muted-foreground" />
                    Responder
                  </button>
                )}
                {isOutgoing && onEdit && msg.body && !msg.media_url && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                    onClick={() => { onEdit(msg); setShowActions(false); }}
                  >
                    <Pencil size={13} className="text-muted-foreground" />
                    Editar
                  </button>
                )}
                {msg.body && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left"
                    onClick={() => { navigator.clipboard.writeText(msg.body ?? ''); setShowActions(false); toast?.('Copiado!'); }}
                  >
                    <Copy size={13} className="text-muted-foreground" />
                    Copiar
                  </button>
                )}
                {isOutgoing && onDelete && msg.id && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left text-destructive"
                    onClick={() => { onDelete(msg.id!); setShowActions(false); }}
                  >
                    <Trash2 size={13} />
                    Apagar para todos
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 shadow-sm relative ${
            isDeleted && !showDeletedContent
              ? 'bg-muted/40 border border-border/30 opacity-70'
              : isDeleted && showDeletedContent
                ? 'bg-red-50/60 border border-red-200/50 dark:bg-red-950/20 dark:border-red-800/30'
                : isOutgoing
                  ? 'bg-[hsl(142,60%,88%)] text-foreground rounded-br-sm dark:bg-[hsl(142,40%,25%)]'
                  : 'bg-card text-foreground rounded-bl-sm border border-border/50'
          }`}
        >
          {/* Admin: deleted message banner */}
          {showDeletedContent && (
            <div className="flex items-center gap-1 mb-1.5 px-1 py-0.5 rounded bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              <Trash2 size={10} />
              <span className="text-[10px] font-medium">
                Apagada{msg.deleted_by_name ? ` por ${msg.deleted_by_name}` : ' pelo agente'}
              </span>
            </div>
          )}

          {/* Sender name for group chats or bot */}
          {!isOutgoing && showSenderHeader && (!isDeleted || showDeletedContent) && (
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

          {/* Reply reference — clickable to scroll */}
          {replyTo && (!isDeleted || showDeletedContent) && (
            <div
              className={`border-l-2 border-primary rounded px-2 py-1 mb-1.5 cursor-pointer hover:opacity-80 transition-opacity ${isOutgoing ? 'bg-black/10 dark:bg-white/10' : 'bg-secondary/60'}`}
              onClick={() => onScrollToMessage?.(replyTo.id)}
            >
              <p className="text-[10px] font-semibold text-primary truncate">{replyLabel}</p>
              <p className="text-[10px] text-muted-foreground truncate">{replyTo.body ?? '📎 Mídia'}</p>
            </div>
          )}

          {/* Deleted message — non-admin sees placeholder */}
          {isDeleted && !showDeletedContent ? (
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
                <p className="text-sm leading-relaxed text-muted-foreground italic">
                  {msg.type === 'image' ? '📷 Imagem indisponível'
                    : msg.type === 'audio' ? '🎵 Áudio indisponível'
                    : msg.type === 'video' ? '🎬 Vídeo indisponível'
                    : msg.type === 'sticker' ? '✨ Figurinha'
                    : msg.type === 'document' ? '📄 Documento indisponível'
                    : '[Mídia não suportada]'}
                </p>
              )}
            </>
          )}

          <div className="flex items-center justify-end gap-1 mt-0.5">
            {msg.edited_at && (!isDeleted || showDeletedContent) && (
              <span className="text-[9px] text-muted-foreground italic">editado</span>
            )}
            <p className="text-[10px] text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
            {isOutgoing && (!isDeleted || showDeletedContent) && <DeliveryTicks status={deliveryStatus} />}
            {(!isDeleted || showDeletedContent) && (
              <button onClick={() => setShowMeta(!showMeta)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronDown size={10} className={`text-muted-foreground transition-transform ${showMeta ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {/* Expandable metadata */}
          {showMeta && (!isDeleted || showDeletedContent) && (
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
