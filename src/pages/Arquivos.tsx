import { useState, useRef } from 'react';
import { Archive, Upload, Search, Download, Trash2, FileText, Image, Film, Music, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import EmptyState from '@/components/shared/EmptyState';

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
  if (!mime) return <File size={18} className="text-muted-foreground" />;
  if (mime.startsWith('image/')) return <Image size={18} className="text-blue-500" />;
  if (mime.startsWith('video/')) return <Film size={18} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <Music size={18} className="text-green-500" />;
  return <FileText size={18} className="text-orange-500" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const BUCKET = 'chat-media';

export default function ArquivosPage() {
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['arquivos', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).list(companyId ?? '', {
        limit: 200,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (error) throw error;
      return (data ?? []) as unknown as StorageFile[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      const { error } = await supabase.storage.from(BUCKET).remove([`${companyId}/${fileName}`]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arquivos'] });
      toast.success('Arquivo removido.');
    },
    onError: () => toast.error('Erro ao remover arquivo.'),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      const path = `${companyId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['arquivos'] });
      toast.success('Arquivo enviado com sucesso!');
    } catch {
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (fileName: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${companyId}/${fileName}`);
    window.open(data.publicUrl, '_blank');
  };

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Arquivos</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os arquivos enviados no sistema</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Enviar arquivo
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar arquivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary border-0"
        />
      </div>

      {/* File list */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nenhum arquivo encontrado"
            description="Envie arquivos para reutilizá-los nos chats."
            actionLabel="Enviar arquivo"
            onAction={() => fileInputRef.current?.click()}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Tamanho</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id || f.name} className="border-b border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {fileIcon(f.metadata?.mimetype)}
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {f.metadata?.size ? formatSize(f.metadata.size) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(f.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f.name)}>
                        <Download size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(f.name)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
