import { useState, useRef } from 'react';
import { Archive, Upload, Search, Download, Trash2, FileText, Image, Film, Music, File, Loader2, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/usePermissions';
import EmptyState from '@/components/shared/EmptyState';

interface CompanyFile {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  project_id: string | null;
  created_at: string;
}

const BUCKET = 'chat-media';

function fileIcon(mime: string | null | undefined) {
  if (!mime) return <File size={18} className="text-muted-foreground" />;
  if (mime.startsWith('image/')) return <Image size={18} className="text-blue-500" />;
  if (mime.startsWith('video/')) return <Film size={18} className="text-purple-500" />;
  if (mime.startsWith('audio/')) return <Music size={18} className="text-green-500" />;
  return <FileText size={18} className="text-orange-500" />;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArquivosPage() {
  const permissions = usePermissions();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [pendingFile, setPendingFile] = useState<globalThis.File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { companyId, user, role } = useAuth();
  const { projectId } = useProjectContext();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['company-files', companyId, projectId, role, user?.id],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        // @ts-expect-error company_files not yet in generated Supabase types
        .from('company_files')
        .select('id, file_path, file_name, mime_type, file_size, caption, project_id, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(100);

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

  const deleteMutation = useMutation({
    mutationFn: async (file: CompanyFile) => {
      // Delete from storage
      await supabase.storage.from(BUCKET).remove([file.file_path]);
      // Delete from company_files table
      const { error } = await supabase
        // @ts-expect-error company_files not yet in generated Supabase types
        .from('company_files')
        .delete()
        .eq('id', file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      toast.success('Arquivo removido.');
    },
    onError: () => toast.error('Erro ao remover arquivo.'),
  });

  const updateCaptionMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        // @ts-expect-error company_files not yet in generated Supabase types
        .from('company_files')
        .update({ caption: caption || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      setEditingId(null);
      toast.success('Legenda atualizada.');
    },
    onError: () => toast.error('Erro ao atualizar legenda.'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowUploadForm(true);
    setCaption('');
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile || !companyId || !user) return;
    setUploading(true);
    try {
      const path = `${companyId}/${Date.now()}_${pendingFile.name}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, pendingFile);
      if (uploadErr) throw uploadErr;

      // Insert into company_files table
      // @ts-expect-error company_files not yet in generated Supabase types
      const { error: dbErr } = await supabase.from('company_files').insert({
        company_id: companyId,
        file_path: path,
        file_name: pendingFile.name,
        mime_type: pendingFile.type || null,
        file_size: pendingFile.size,
        caption: caption.trim() || null,
        created_by: user.id,
        project_id: projectId || null,
      });
      if (dbErr) throw dbErr;

      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      queryClient.invalidateQueries({ queryKey: ['media-picker'] });
      toast.success('Arquivo enviado com sucesso!');
      setShowUploadForm(false);
      setPendingFile(null);
      setCaption('');
    } catch {
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filePath: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    window.open(data.publicUrl, '_blank');
  };

  const filtered = files.filter((f) =>
    f.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.caption ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Arquivos</h1>
          <p className="text-sm text-muted-foreground">Gerencie arquivos com legendas para enviar nos chats</p>
        </div>
        {permissions.can('files_send') && (
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
              <Upload size={15} />
              <span className="hidden sm:inline">Enviar arquivo</span>
            </Button>
          </div>
        )}
      </div>

      {/* Upload form with caption */}
      {showUploadForm && pendingFile && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {fileIcon(pendingFile.type)}
              <span className="text-sm font-medium">{pendingFile.name}</span>
              <span className="text-xs text-muted-foreground">({formatSize(pendingFile.size)})</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowUploadForm(false); setPendingFile(null); }}>
              <X size={14} />
            </Button>
          </div>
          <Textarea
            placeholder="Legenda / texto para enviar junto com o arquivo (opcional)..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[60px] text-sm"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setShowUploadForm(false); setPendingFile(null); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleUpload} disabled={uploading} className="gap-1">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Salvar arquivo
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar arquivo ou legenda..."
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
            description="Envie arquivos com legendas para reutilizá-los nos chats."
            actionLabel="Enviar arquivo"
            onAction={() => fileInputRef.current?.click()}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Nome</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Legenda</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Tamanho</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {fileIcon(f.mime_type)}
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                        {f.file_name.replace(/^\d+_/, '')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[250px]">
                    {editingId === f.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editCaption}
                          onChange={(e) => setEditCaption(e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Legenda..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateCaptionMutation.mutate({ id: f.id, caption: editCaption });
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateCaptionMutation.mutate({ id: f.id, caption: editCaption })}>
                          <Check size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X size={12} />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1 group/caption cursor-pointer"
                        onClick={() => { setEditingId(f.id); setEditCaption(f.caption ?? ''); }}
                      >
                        {f.caption ? (
                          <span className="text-xs text-muted-foreground truncate">{f.caption}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic">Sem legenda</span>
                        )}
                        <Pencil size={10} className="text-muted-foreground/50 opacity-0 group-hover/caption:opacity-100 shrink-0" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {formatSize(f.file_size)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(f.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f.file_path)}>
                        <Download size={14} />
                      </Button>
                      {permissions.can('files_delete') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(f)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
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
