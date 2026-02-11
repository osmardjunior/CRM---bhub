import { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseCSV, type CSVRow } from '@/lib/csv';
import { useCreateContact } from '@/hooks/useContacts';
import { toast } from 'sonner';

const CONTACT_FIELDS = [
  { key: 'name', label: 'Nome', required: true },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'source', label: 'Origem' },
  { key: 'tags', label: 'Tags (separadas por ;)' },
  { key: '_skip', label: '— Ignorar —' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportContactsModal({ open, onClose }: Props) {
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createContact = useCreateContact();

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers: h, rows: r } = parseCSV(text);
      if (h.length === 0) {
        toast.error('Arquivo CSV vazio ou inválido.');
        return;
      }
      setHeaders(h);
      setRows(r);

      // Auto-map columns
      const autoMap: Record<string, string> = {};
      h.forEach((col) => {
        const lower = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower.includes('nome') || lower.includes('name')) autoMap[col] = 'name';
        else if (lower.includes('telefone') || lower.includes('phone') || lower.includes('fone')) autoMap[col] = 'phone';
        else if (lower.includes('email') || lower.includes('e-mail')) autoMap[col] = 'email';
        else if (lower.includes('origem') || lower.includes('source')) autoMap[col] = 'source';
        else if (lower.includes('tag')) autoMap[col] = 'tags';
        else autoMap[col] = '_skip';
      });
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    const nameCol = Object.entries(mapping).find(([, v]) => v === 'name')?.[0];
    if (!nameCol) {
      toast.error('Mapeie a coluna "Nome" (obrigatória).');
      return;
    }

    setImporting(true);
    let success = 0;
    let errors = 0;

    for (const row of rows) {
      const name = row[nameCol]?.trim();
      if (!name) { errors++; continue; }

      const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];
      const emailCol = Object.entries(mapping).find(([, v]) => v === 'email')?.[0];
      const sourceCol = Object.entries(mapping).find(([, v]) => v === 'source')?.[0];
      const tagsCol = Object.entries(mapping).find(([, v]) => v === 'tags')?.[0];

      const tags = tagsCol && row[tagsCol]
        ? row[tagsCol].split(';').map((t) => t.trim()).filter(Boolean)
        : [];

      try {
        await createContact.mutateAsync({
          name,
          phone: phoneCol ? row[phoneCol]?.trim() || null : null,
          email: emailCol ? row[emailCol]?.trim() || null : null,
          source: sourceCol ? row[sourceCol]?.trim() || null : null,
          tags: tags.length > 0 ? tags : [],
        });
        success++;
      } catch {
        errors++;
      }
    }

    toast.success(`Importação concluída: ${success} contatos criados${errors > 0 ? `, ${errors} erros` : ''}.`);
    handleClose();
  };

  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Contatos via CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Envie um arquivo CSV com os dados dos contatos.'}
            {step === 'map' && 'Mapeie as colunas do CSV para os campos do contato.'}
            {step === 'preview' && `Preview de ${Math.min(5, rows.length)} de ${rows.length} registros.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-10 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Arraste um arquivo CSV aqui ou clique para selecionar</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {headers.map((col) => (
              <div key={col} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-1/2">
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{col}</span>
                </div>
                <Select value={mapping[col] || '_skip'} onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}>
                  <SelectTrigger className="w-1/2 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_FIELDS.map((f) => (
                      <SelectItem key={f.key} value={f.key}>
                        {f.label} {f.required ? '*' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {!Object.values(mapping).includes('name') && (
              <div className="flex items-center gap-2 text-destructive text-xs mt-2">
                <AlertCircle size={14} />
                <span>A coluna "Nome" é obrigatória.</span>
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {CONTACT_FIELDS.filter((f) => f.key !== '_skip' && Object.values(mapping).includes(f.key)).map((f) => (
                    <th key={f.key} className="px-2 py-1.5 text-left font-medium text-muted-foreground">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b">
                    {CONTACT_FIELDS.filter((f) => f.key !== '_skip' && Object.values(mapping).includes(f.key)).map((f) => {
                      const col = Object.entries(mapping).find(([, v]) => v === f.key)?.[0];
                      return <td key={f.key} className="px-2 py-1.5">{col ? row[col] : ''}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={() => setStep('preview')} disabled={!Object.values(mapping).includes('name')}>
                Preview
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>Voltar</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? 'Importando...' : `Importar ${rows.length} contatos`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
