import { useState } from 'react';
import { Save, Trash2, Zap, Hash, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useQuickReplies,
  useCreateQuickReply,
  useDeleteQuickReplies,
} from '@/hooks/useQuickReplies';

export default function RespostasRapidas() {
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [shortcutError, setShortcutError] = useState('');
  const [messageError, setMessageError] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');

  const { data: replies = [], isLoading } = useQuickReplies();
  const createReply = useCreateQuickReply();
  const deleteReplies = useDeleteQuickReplies();

  // Validation
  const validate = () => {
    let ok = true;
    if (!shortcut.trim()) {
      setShortcutError('Nome do atalho é obrigatório');
      ok = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(shortcut.trim())) {
      setShortcutError('Use apenas letras, números ou _');
      ok = false;
    } else {
      setShortcutError('');
    }
    if (!message.trim()) {
      setMessageError('O texto da mensagem é obrigatório');
      ok = false;
    } else {
      setMessageError('');
    }
    return ok;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await createReply.mutateAsync({ shortcut, message });
    setShortcut('');
    setMessage('');
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === replies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(replies.map((r) => r.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === 'delete') {
      await deleteReplies.mutateAsync([...selected]);
      setSelected(new Set());
      setBulkAction('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Respostas Rápidas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nesta área estão listados as respostas rápidas cadastradas por você. As respostas rápidas são{' '}
          <span className="text-primary font-medium">individuais</span> para cada usuário da conta.
        </p>
      </div>

      <div className="flex gap-5 items-start">
        {/* Form card */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Criar Resposta Rápida</h2>

          {/* Shortcut input */}
          <div className="space-y-1">
            <div className="flex items-center border border-input rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-ring bg-background">
              <span className="flex items-center justify-center px-3 border-r border-input bg-muted text-muted-foreground h-10 shrink-0">
                <Hash size={14} />
              </span>
              <input
                type="text"
                placeholder="Nome do atalho"
                value={shortcut}
                onChange={(e) => {
                  setShortcut(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''));
                  setShortcutError('');
                }}
                maxLength={50}
                className="flex-1 h-10 px-3 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {shortcutError ? (
              <p className="text-xs text-destructive">{shortcutError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Use apenas letras ou números para o atalho</p>
            )}
          </div>

          {/* Message textarea */}
          <div className="space-y-1">
            <Textarea
              placeholder="Texto que será inserido"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageError('');
              }}
              maxLength={2000}
              rows={5}
              className="resize-none text-sm bg-background"
            />
            <div className="flex items-center justify-between">
              {messageError ? (
                <p className="text-xs text-destructive">{messageError}</p>
              ) : (
                <span />
              )}
              <span className="text-[11px] text-muted-foreground ml-auto">{message.length}/2000</span>
            </div>
          </div>

          <Button
            className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground"
            onClick={handleSave}
            disabled={createReply.isPending}
          >
            <Save size={14} />
            {createReply.isPending ? 'Salvando...' : 'Salvar Resposta Rápida'}
          </Button>
        </div>

        {/* How to use card */}
        <div className="w-56 shrink-0 rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Como Utilizar</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dentro do chat escreva{' '}
            <span className="font-bold text-foreground">"/"</span>{' '}
            e o atalho para inserir o texto rapidamente.
          </p>

          {/* Preview mockup */}
          <div className="rounded-lg overflow-hidden border border-border bg-secondary/50">
            <div className="bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground font-semibold">
              /{shortcut || 'atalho'}
            </div>
            <div className="px-2.5 py-2 text-[11px] text-muted-foreground line-clamp-3">
              {message || 'Texto da mensagem aparecerá aqui...'}
            </div>
          </div>

          <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground font-mono">
            /{shortcut || 'atalho'}
          </div>
        </div>
      </div>

      {/* Saved replies list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Respostas Rápidas Cadastradas</h2>
          <span className="text-xs text-muted-foreground">{replies.length} cadastrada(s)</span>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-border">
            <span className="text-xs text-muted-foreground">{selected.size} selecionada(s)</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="h-7 text-xs w-52">
                <SelectValue placeholder="-- Escolher ação --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delete">Apagar da lista</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1.5"
              onClick={handleBulkAction}
              disabled={!bulkAction || deleteReplies.isPending}
            >
              <Trash2 size={12} />
              Confirmar
            </Button>
          </div>
        )}

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 w-10">
                <Checkbox
                  checked={replies.length > 0 && selected.size === replies.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Atalho</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Texto</th>
              <th className="px-4 py-2.5 w-16" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-64" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : replies.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MessageSquare size={28} className="opacity-40" />
                    <p className="text-sm">Nenhuma resposta rápida cadastrada ainda</p>
                    <p className="text-xs">Crie seu primeiro atalho acima</p>
                  </div>
                </td>
              </tr>
            ) : (
              replies.map((reply) => (
                <tr
                  key={reply.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/30 transition-colors ${selected.has(reply.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(reply.id)}
                      onCheckedChange={() => toggleSelect(reply.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground font-semibold">
                      /{reply.shortcut}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-sm truncate">
                    {reply.message}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteReplies.mutate([reply.id])}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
