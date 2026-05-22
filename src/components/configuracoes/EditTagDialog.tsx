import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useProjects } from '@/hooks/useProjects';
import { TAG_COLORS } from '@/pages/configuracoes/constants';

export interface EditingTag {
  id: string;
  name: string;
  color: string;
  department_id?: string;
  project_id?: string | null;
}

interface EditTagDialogProps {
  editingTag: EditingTag | null;
  setEditingTag: (tag: EditingTag | null) => void;
  departments: { id: string; name: string }[];
  onSave: () => void;
  saving: boolean;
}

export default function EditTagDialog({ editingTag, setEditingTag, departments, onSave, saving }: EditTagDialogProps) {
  const { data: editTagProjects = [] } = useProjects(editingTag?.department_id || undefined);

  return (
    <Dialog open={!!editingTag} onOpenChange={() => setEditingTag(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Editar Tag</DialogTitle></DialogHeader>
        {editingTag && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={editingTag.name}
                onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                className="mt-1"
              />
            </div>
            {departments.length > 0 && (
              <div>
                <Label className="text-xs">Departamento</Label>
                <Select
                  value={editingTag.department_id || '_none'}
                  onValueChange={v => setEditingTag({ ...editingTag, department_id: v === '_none' ? undefined : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sem departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem departamento</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingTag.department_id && editTagProjects.length > 0 && (
              <div>
                <Label className="text-xs">Projeto <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <Select
                  value={editingTag.project_id || '_none'}
                  onValueChange={v => setEditingTag({ ...editingTag, project_id: v === '_none' ? null : v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Todos os projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Todos os projetos</SelectItem>
                    {editTagProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs mb-2 block">Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setEditingTag({ ...editingTag, color: c })}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: editingTag.color === c ? '#fff' : 'transparent',
                      boxShadow: editingTag.color === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingTag(null)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
