import { useState } from 'react';
import { Plus, Check, Pencil, Trash2, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/useTags';
import PageHeader from '@/components/shared/PageHeader';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#64748b', '#d946ef',
];

export default function TagsPage() {
  const permissions = usePermissions();
  const { data: tags, isLoading } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string } | null>(null);

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTag.mutate({ name, color: newTagColor });
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
  };

  const handleSaveEditTag = () => {
    if (!editingTag) return;
    updateTag.mutate({ id: editingTag.id, name: editingTag.name, color: editingTag.color });
    setEditingTag(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Tags" subtitle="Tags centralizadas usadas em contatos. Apenas admins podem gerenciar." />

      <div className="rounded-xl border border-border bg-card card-shadow p-5">
        {/* Create new tag */}
        {permissions.isAdmin && (
          <div className="flex items-end gap-2 mb-5">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Nova tag</Label>
              <Input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                placeholder="Nome da tag..."
                className="mt-1 bg-secondary border-0"
              />
            </div>
            <div className="flex gap-1 items-center">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
            <Button size="sm" className="gap-1 h-9" onClick={handleCreateTag} disabled={createTag.isPending}>
              <Plus size={14} /> Criar
            </Button>
          </div>
        )}

        <Separator className="mb-4" />

        {/* Tags list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !tags?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tag criada ainda.</p>
        ) : (
          <div className="space-y-2">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {editingTag?.id === tag.id ? (
                  <>
                    <Input
                      value={editingTag.name}
                      onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                      className="h-7 text-sm flex-1 bg-background"
                    />
                    <div className="flex gap-0.5">
                      {TAG_COLORS.map(c => (
                        <button
                          key={c}
                          className={`h-5 w-5 rounded-full border-2 transition-all ${editingTag.color === c ? 'border-foreground' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditingTag({ ...editingTag, color: c })}
                        />
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleSaveEditTag}>
                      <Check size={14} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-foreground flex-1">{tag.name}</span>
                    {permissions.isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}>
                          <Pencil size={13} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTag.mutate(tag.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
