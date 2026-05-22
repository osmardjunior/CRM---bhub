import { useState, useRef } from 'react';
import { Search, Upload, Loader2, FileText, Image, Film, Music, File, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { toast } from 'sonner';

const BUCKET = 'chat-media';

interface CompanyFile {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  created_at: string;
}

function fileIcon(mime: string | null | undefined) {
  if (!mime) return <File size={24} className="text-muted-foreground" />;
  if (mime.startsWith('image/')) return <Image size={24} className="text-blue-500" />;
  if (mime.startsWith('video/')) return <Film size={24} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <Music size={24} className="text-green-500" />;
  return <FileText size={24} className="text-orange-500" />;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, mimeType: string, fileName: string) => void;
}

export default function MediaPickerModal({ open, onClose, onSelect }: MediaPickerModalProps) {
  const { companyId, user, role } = useAuth();
  const { projectId } = useProjectContext();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['media-picker', companyId, projectId, role, user?.id],
    enabled: !!companyId && open,
    queryFn: async () => {
      let query = supabase
        // @ts-expect-error company_files not yet in generated Supabase types
        .from('company_files')
        .select('id, file_path, file_name, mime_type, file_size, caption, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      // Agentes veem apenas seus próprios arquivos
      if (role !== 'admin' && user) {
        query = query.eq('created_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CompanyFile[];
    },
  });

  const filtered = files.filter(f =>
    f.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.caption ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId || !user) return;
    setUploading(true);
    try {
      const path = `${companyId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadErr) throw uploadErr;

      // Also save to company_files table
      // @ts-expect-error company_files not yet in generated Supabase types
      await supabase.from('company_files').insert({
        company_id: companyId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        caption: null,
        created_by: user.id,
        project_id: projectId || null,
      });

      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      toast.success('Arquivo enviado!');
    } catch {
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirm = () => {
    if (!selected || !companyId) return;
    const file = files.find(f => f.id === selected);
    if (!file) return;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(file.file_path);
    const url = data.publicUrl;
    const mime = file.mime_type ?? 'application/octet-stream';
    onSelect(url, mime, file.file_name);
    setSelected(null);
    setSearch('');
    onClose();
  };

  const isImage = (f: CompanyFile) => {
    return (f.mime_type ?? '').startsWith('image/');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { setSelected(null); setSearch(''); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Biblioteca de Arquivos</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivo ou legenda..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-secondary border-0"
            />
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            Subir novo
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <File size={28} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Suba um arquivo para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map(f => {
                const isSelected = selected === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelected(isSelected ? null : f.id)}
                    className={`relative rounded-lg border-2 p-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-secondary/50 hover:bg-secondary'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} className="text-primary-foreground" />
                      </div>
                    )}
                    {isImage(f) && companyId ? (
                      <img
                        src={supabase.storage.from(BUCKET).getPublicUrl(f.file_path).data.publicUrl}
                        alt={f.file_name}
                        className="w-full h-20 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-muted/50 rounded">
                        {fileIcon(f.mime_type)}
                      </div>
                    )}
                    <p className="text-[10px] text-foreground mt-1 truncate">{f.file_name.replace(/^\d+_/, '')}</p>
                    {f.caption && (
                      <p className="text-[9px] text-primary truncate" title={f.caption}>📝 {f.caption}</p>
                    )}
                    <p className="text-[9px] text-muted-foreground">
                      {formatSize(f.file_size)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setSearch(''); onClose(); }}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!selected} onClick={handleConfirm} className="gap-1">
            <Check size={14} /> Enviar na conversa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
