import { useMemo, useState } from 'react';
import { Plus, Check, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePermissions } from '@/hooks/usePermissions';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/useTags';
import { useDepartments } from '@/hooks/useDepartments';
import { useProjects } from '@/hooks/useProjects';
import { useProjectContext } from '@/contexts/ProjectContext';
import PageHeader from '@/components/shared/PageHeader';

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#64748b', '#d946ef',
];

export default function TagsPage() {
  const permissions = usePermissions();
  const { projectId: selectedProjectId } = useProjectContext();
  const { data: allTags = [], isLoading } = useTags();
  // Filter tags by selected project: show project-scoped + global tags
  const tags = selectedProjectId
    ? allTags.filter(t => !t.project_id || t.project_id === selectedProjectId)
    : allTags;
  const { data: departments = [] } = useDepartments();
  const { data: allProjects = [] } = useProjects();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [newTagDeptId, setNewTagDeptId] = useState<string>('');
  const [newTagProjectId, setNewTagProjectId] = useState<string>('');
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; color: string; department_id?: string | null; project_id?: string | null } | null>(null);

  // Projects filtered by selected department
  const { data: newTagProjects = [] } = useProjects(newTagDeptId || undefined);
  const { data: editTagProjects = [] } = useProjects(editingTag?.department_id || undefined);

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTag.mutate({ name, color: newTagColor, department_id: newTagDeptId || null, project_id: newTagProjectId || null }, {
      onSuccess: () => {
        setNewTagName('');
        setNewTagColor(TAG_COLORS[0]);
        setNewTagDeptId('');
        setNewTagProjectId('');
      },
    });
  };

  const handleSaveEditTag = () => {
    if (!editingTag) return;
    updateTag.mutate({
      id: editingTag.id,
      name: editingTag.name,
      color: editingTag.color,
      department_id: editingTag.department_id,
      project_id: editingTag.project_id,
    });
    setEditingTag(null);
  };

  const grouped = useMemo(() => {
    if (!departments.length) return null;
    const map = new Map<string, typeof tags>();
    tags.forEach(tag => {
      const key = tag.department_id ?? '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tag);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      const nameA = departments.find(d => d.id === a)?.name ?? '';
      const nameB = departments.find(d => d.id === b)?.name ?? '';
      return nameA.localeCompare(nameB);
    });
  }, [tags, departments]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Tags" subtitle="Tags centralizadas usadas em contatos." />

      <div className="rounded-xl border border-border bg-card card-shadow p-5">
        {/* Create new tag */}
        {permissions.can('tags_create') && (
          <div className="space-y-2 mb-5">
            <div className="flex items-end gap-2">
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
              <Button size="sm" className="gap-1 h-9" onClick={handleCreateTag} disabled={!newTagName.trim() || createTag.isPending}>
                <Plus size={14} /> Criar
              </Button>
            </div>
            <div className="flex gap-2">
              {departments.length > 0 && (
                <Select value={newTagDeptId} onValueChange={v => { setNewTagDeptId(v); setNewTagProjectId(''); }}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-0 flex-1">
                    <SelectValue placeholder="Departamento (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {newTagDeptId && newTagProjects.length > 0 && (
                <Select value={newTagProjectId} onValueChange={setNewTagProjectId}>
                  <SelectTrigger className="h-8 text-xs bg-secondary border-0 flex-1">
                    <SelectValue placeholder="Projeto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {newTagProjects.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              {TAG_COLORS.map(c => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${newTagColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewTagColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        <Separator className="mb-4" />

        {/* Tags list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !tags.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tag criada ainda.</p>
        ) : grouped ? (
          // Grouped by department
          <div className="space-y-3">
            {grouped.map(([key, groupTags]) => (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {key === '__none__' ? 'Sem departamento' : departments.find(d => d.id === key)?.name ?? '—'}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {groupTags.length}
                  </Badge>
                </div>
                <div className="space-y-1 pl-2 border-l-2 border-border">
                  {groupTags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2 flex-wrap">
                      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      {editingTag?.id === tag.id ? (
                        <>
                          <Input
                            value={editingTag.name}
                            onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                            className="h-7 text-sm flex-1 bg-background"
                          />
                          {departments.length > 0 && (
                            <Select
                              value={editingTag.department_id ?? ''}
                              onValueChange={v => setEditingTag({ ...editingTag, department_id: v || null, project_id: null })}
                            >
                              <SelectTrigger className="h-7 text-xs w-28 bg-background">
                                <SelectValue placeholder="Depto." />
                              </SelectTrigger>
                              <SelectContent>
                                {departments.map(d => (
                                  <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {editingTag.department_id && editTagProjects.length > 0 && (
                            <Select
                              value={editingTag.project_id ?? ''}
                              onValueChange={v => setEditingTag({ ...editingTag, project_id: v || null })}
                            >
                              <SelectTrigger className="h-7 text-xs w-28 bg-background">
                                <SelectValue placeholder="Projeto" />
                              </SelectTrigger>
                              <SelectContent>
                                {editTagProjects.map(p => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
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
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="text-sm text-foreground">{tag.name}</span>
                            {tag.project_id && (
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                {allProjects.find(p => p.id === tag.project_id)?.name ?? 'Projeto'}
                              </span>
                            )}
                          </div>
                          {(permissions.can('tags_create') || permissions.can('tags_delete')) && (
                            <div className="flex gap-1">
                              {permissions.can('tags_create') && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color, department_id: tag.department_id, project_id: tag.project_id })}>
                                  <Pencil size={13} />
                                </Button>
                              )}
                              {permissions.can('tags_delete') && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTag.mutate(tag.id)}>
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat list (no departments configured)
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
                    {(permissions.can('tags_create') || permissions.can('tags_delete')) && (
                      <div className="flex gap-1">
                        {permissions.can('tags_create') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color, department_id: tag.department_id })}>
                            <Pencil size={13} />
                          </Button>
                        )}
                        {permissions.can('tags_delete') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTag.mutate(tag.id)}>
                            <Trash2 size={13} />
                          </Button>
                        )}
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
