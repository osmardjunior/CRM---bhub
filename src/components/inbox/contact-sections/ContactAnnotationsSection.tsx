import { useState } from 'react';
import { Plus, Pencil, Trash2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';

interface ContactAnnotationsSectionProps {
  conversationId: string;
  companyId: string | null;
  userId: string | undefined;
}

export default function ContactAnnotationsSection({ conversationId, companyId, userId }: ContactAnnotationsSectionProps) {
  const queryClient = useQueryClient();
  const [newAnnotation, setNewAnnotation] = useState('');
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editAnnotationBody, setEditAnnotationBody] = useState('');

  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations-panel', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annotations')
        .select('*, author:profiles!annotations_author_id_fkey(name)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim()) return;
    setSavingAnnotation(true);
    try {
      const { error } = await supabase.from('annotations').insert({
        conversation_id: conversationId, company_id: companyId,
        author_id: userId, body: newAnnotation.trim(),
      });
      if (error) throw error;
      setNewAnnotation('');
      queryClient.invalidateQueries({ queryKey: ['annotations-panel', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
      toast.success('Anotação salva');
    } catch { toast.error('Erro ao salvar anotação'); }
    finally { setSavingAnnotation(false); }
  };

  const handleEditAnnotation = async (id: string) => {
    if (!editAnnotationBody.trim()) return;
    try {
      const { error } = await supabase.from('annotations').update({ body: editAnnotationBody.trim() }).eq('id', id);
      if (error) throw error;
      setEditingAnnotationId(null);
      setEditAnnotationBody('');
      queryClient.invalidateQueries({ queryKey: ['annotations-panel', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
      toast.success('Anotação atualizada');
    } catch { toast.error('Erro ao editar anotação'); }
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      const { error } = await supabase.from('annotations').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['annotations-panel', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
      toast.success('Anotação removida');
    } catch { toast.error('Erro ao remover anotação'); }
  };

  return (
    <div className="px-3 py-4 space-y-4">
      <p className="text-xs font-semibold text-foreground">Anotações</p>

      {annotations.length > 0 ? (
        <div className="space-y-2">
          {annotations.map((ann: Record<string, unknown>) => {
            const author = ann.author as { name?: string } | undefined;
            return (
              <div key={ann.id as string} className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">{author?.name ?? 'Agente'}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(ann.created_at as string).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {ann.author_id === userId && (
                      <div className="flex items-center gap-0.5 ml-1">
                        <button
                          onClick={() => { setEditingAnnotationId(ann.id as string); setEditAnnotationBody(ann.body as string); }}
                          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                          title="Editar"
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          onClick={() => handleDeleteAnnotation(ann.id as string)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                          title="Apagar"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {editingAnnotationId === ann.id ? (
                  <div className="space-y-1.5">
                    <textarea
                      className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      rows={2}
                      value={editAnnotationBody}
                      onChange={(e) => setEditAnnotationBody(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => handleEditAnnotation(ann.id as string)} disabled={!editAnnotationBody.trim()}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setEditingAnnotationId(null); setEditAnnotationBody(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-foreground leading-relaxed">{ann.body as string}</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
          <StickyNote size={28} className="mb-2 opacity-30" />
          <p className="text-xs">Nenhuma anotação ainda</p>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nova anotação</p>
        <textarea className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          rows={3} placeholder="Escrever anotação..." value={newAnnotation} onChange={(e) => setNewAnnotation(e.target.value)} />
        <Button size="sm" className="w-full h-8 text-xs gap-1" onClick={handleAddAnnotation} disabled={savingAnnotation || !newAnnotation.trim()}>
          <Plus size={12} />{savingAnnotation ? 'Salvando...' : 'Salvar anotação'}
        </Button>
      </div>
    </div>
  );
}
