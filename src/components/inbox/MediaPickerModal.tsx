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
import { toast } from 'sonner';

const BUCKET = 'chat-media';

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  metadata: {
    size: number;
    mimetype: string;
  } | null;
}

function fileIcon(mime: string | undefined) {
  if (!mime) return <File size={24} className="text-muted-foreground" />;
  if (mime.startsWith('image/')) return <Image size={24} className="text-blue-500" />;
  if (mime.startsWith('video/')) return <Film size={24} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <Music size={24} className="text-green-500" />;
  return <FileText size={24} className="text-orange-500" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getPublicUrl(companyId: string, fileName: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${companyId}/${fileName}`);
  return data.publicUrl;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] ?? 'application/octet-stream';
}

interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, mimeType: string, fileName: string) => void;
}

export default function MediaPickerModal({ open, onClose, onSelect }: MediaPickerModalProps) {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['media-picker', companyId],
    enabled: !!companyId && open,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list(companyId ?? '', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      return (data ?? []) as unknown as StorageFile[];
    },
  });

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const path = `${companyId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      queryClient.invalidateQueries({ queryKey: ['arquivos'] });
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
    const file = files.find(f => f.name === selected);
    if (!file) return;
    const url = getPublicUrl(companyId, file.name);
    const mime = file.metadata?.mimetype ?? getMimeType(file.name);
    onSelect(url, mime, file.name);
    setSelected(null);
    setSearch('');
    onClose();
  };

  const isImage = (f: StorageFile) => {
    const mime = f.metadata?.mimetype ?? getMimeType(f.name);
    return mime.startsWith('image/');
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
              placeholder="Buscar arquivo..."
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
                const isSelected = selected === f.name;
                return (
                  <button
                    key={f.id || f.name}
                    onClick={() => setSelected(isSelected ? null : f.name)}
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
                        src={getPublicUrl(companyId, f.name)}
                        alt={f.name}
                        className="w-full h-20 object-cover rounded"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-muted/50 rounded">
                        {fileIcon(f.metadata?.mimetype)}
                      </div>
                    )}
                    <p className="text-[10px] text-foreground mt-1 truncate">{f.name.replace(/^\d+_/, '')}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {f.metadata?.size ? formatSize(f.metadata.size) : ''}
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
