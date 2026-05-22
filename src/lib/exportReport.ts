import type { LeadRow } from '@/hooks/useLeadsReport';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels: Record<string, string> = {
  new: 'Aberto',
  open: 'Em Atendimento',
  pending: 'Aguardando',
  closed: 'Fechado',
  resolved: 'Resolvido',
};

export interface ExportMeta {
  dateFrom: Date;
  dateTo: Date;
  agentName?: string;
  statusLabel?: string;
  tagNames?: string[];
  funnelNames?: string[];
  total: number;
}

function buildHeaderLines(meta: ExportMeta): string[] {
  const lines: string[] = [
    `Relatório de Leads — ALL-IN CRM`,
    `Exportado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    `Período: ${format(meta.dateFrom, 'dd/MM/yyyy', { locale: ptBR })} até ${format(meta.dateTo, 'dd/MM/yyyy', { locale: ptBR })}`,
  ];
  if (meta.agentName) lines.push(`Agente: ${meta.agentName}`);
  if (meta.statusLabel) lines.push(`Status: ${meta.statusLabel}`);
  if (meta.tagNames?.length) lines.push(`Tags: ${meta.tagNames.join(', ')}`);
  if (meta.funnelNames?.length) lines.push(`Funis: ${meta.funnelNames.join(', ')}`);
  lines.push(`Total: ${meta.total} lead${meta.total !== 1 ? 's' : ''}`);
  return lines;
}

function rowToFlat(row: LeadRow) {
  return {
    Contato: row.contact_name,
    Telefone: row.phone || '—',
    Status: statusLabels[row.status] || row.status,
    Agente: row.agent_name || 'Não Delegado',
    Tags: (row.tags ?? []).map(t => t.name).join(', ') || '—',
    'Funil / Etapa': [
      ...(row.funnel_names ?? []).map((name, i) =>
        row.stage_names?.[i] ? `${name} › ${row.stage_names[i]}` : name,
      ),
    ].join(', ') || '—',
    Data: format(new Date(row.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
  };
}

// ── Excel Export ──────────────────────────────────────────────────────────────

export async function exportLeadsExcel(rows: LeadRow[], meta: ExportMeta) {
  const XLSX = await import('xlsx');

  const headerLines = buildHeaderLines(meta);

  // Build worksheet data: header block + blank row + table
  const wsData: (string | number)[][] = [];
  for (const line of headerLines) wsData.push([line]);
  wsData.push([]); // blank separator

  const columns = ['Contato', 'Telefone', 'Status', 'Agente', 'Tags', 'Funil / Etapa', 'Data'];
  wsData.push(columns);

  for (const row of rows) {
    const flat = rowToFlat(row);
    wsData.push(columns.map(col => flat[col as keyof typeof flat]));
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 28 }, // Contato
    { wch: 18 }, // Telefone
    { wch: 16 }, // Status
    { wch: 22 }, // Agente
    { wch: 30 }, // Tags
    { wch: 30 }, // Funil / Etapa
    { wch: 18 }, // Data
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  XLSX.writeFile(wb, `leads_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
}

// ── PDF Export ────────────────────────────────────────────────────────────────

export async function exportLeadsPdf(rows: LeadRow[], meta: ExportMeta) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header block
  const headerLines = buildHeaderLines(meta);
  doc.setFontSize(14);
  doc.text('Relatório de Leads — ALL-IN CRM', 14, 15);
  doc.setFontSize(9);
  let y = 22;
  for (let i = 1; i < headerLines.length; i++) {
    doc.text(headerLines[i], 14, y);
    y += 4.5;
  }

  // Table
  const columns = ['Contato', 'Telefone', 'Status', 'Agente', 'Tags', 'Funil / Etapa', 'Data'];
  const body = rows.map(row => {
    const flat = rowToFlat(row);
    return columns.map(col => flat[col as keyof typeof flat]);
  });

  (doc as any).autoTable({
    startY: y + 3,
    head: [columns],
    body,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: 45 },
      5: { cellWidth: 45 },
      6: { cellWidth: 25 },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`leads_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
}
