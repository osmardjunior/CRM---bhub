import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Search, Save } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useDepartments } from '@/hooks/useDepartments';
import { useFunnels } from '@/contexts/FunnelContext';
import type { ReportFilters as Filters, ReportType } from '@/hooks/useReportBuilder';

interface Props {
  reportType: ReportType;
  filters: Filters;
  onChange: (f: Filters) => void;
  onRun: () => void;
  onSave: () => void;
  reportName: string;
  onNameChange: (n: string) => void;
  showOnHome: boolean;
  onShowOnHomeChange: (v: boolean) => void;
}

export default function ReportFiltersPanel({
  reportType,
  filters,
  onChange,
  onRun,
  onSave,
  reportName,
  onNameChange,
  showOnHome,
  onShowOnHomeChange,
}: Props) {
  const { data: tags } = useTags();
  const { data: team } = useTeamProfiles();
  const { data: departments } = useDepartments();
  const { funnels } = useFunnels();

  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const addIncludeTag = (tagName: string) => {
    if (!filters.includeTags?.includes(tagName)) {
      update({ includeTags: [...(filters.includeTags ?? []), tagName] });
    }
  };
  const removeIncludeTag = (t: string) =>
    update({ includeTags: (filters.includeTags ?? []).filter((x) => x !== t) });

  const addExcludeTag = (tagName: string) => {
    if (!filters.excludeTags?.includes(tagName)) {
      update({ excludeTags: [...(filters.excludeTags ?? []), tagName] });
    }
  };
  const removeExcludeTag = (t: string) =>
    update({ excludeTags: (filters.excludeTags ?? []).filter((x) => x !== t) });

  if (reportType === 'charts' || reportType === 'users') return null;

  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5 space-y-5">
      {/* Report name */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Nome do Relatório</Label>
          <Input
            value={reportName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Meu relatório"
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Tela Inicial</Label>
          <Switch checked={showOnHome} onCheckedChange={onShowOnHomeChange} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tags include */}
        <div>
          <Label className="text-xs text-muted-foreground">Incluir Tags</Label>
          <Select onValueChange={addIncludeTag}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecionar tag..." />
            </SelectTrigger>
            <SelectContent>
              {(tags ?? []).map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(filters.includeTags ?? []).map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 text-xs">
                {t} <X size={12} className="cursor-pointer" onClick={() => removeIncludeTag(t)} />
              </Badge>
            ))}
          </div>
        </div>

        {/* Tags exclude */}
        <div>
          <Label className="text-xs text-muted-foreground">Excluir Tags</Label>
          <Select onValueChange={addExcludeTag}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Selecionar tag..." />
            </SelectTrigger>
            <SelectContent>
              {(tags ?? []).map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(filters.excludeTags ?? []).map((t) => (
              <Badge key={t} variant="outline" className="gap-1 text-xs">
                {t} <X size={12} className="cursor-pointer" onClick={() => removeExcludeTag(t)} />
              </Badge>
            ))}
          </div>
        </div>

        {/* Status */}
        {(reportType === 'chats') && (
          <div>
            <Label className="text-xs text-muted-foreground">Status de Atendimento</Label>
            <Select value={filters.status ?? 'any'} onValueChange={(v) => update({ status: v as any })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Indiferente</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Channel */}
        {(reportType === 'chats') && (
          <div>
            <Label className="text-xs text-muted-foreground">Canal</Label>
            <Select
              value={filters.channels?.[0] ?? 'any'}
              onValueChange={(v) => update({ channels: v === 'any' ? [] : [v] })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="webchat">Webchat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Bot status */}
        {(reportType === 'chats') && (
          <div>
            <Label className="text-xs text-muted-foreground">Status do Bot</Label>
            <Select value={filters.botStatus ?? 'any'} onValueChange={(v) => update({ botStatus: v as any })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Indiferente</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Assigned user */}
        <div>
          <Label className="text-xs text-muted-foreground">Delegado ao Usuário</Label>
          <Select
            value={filters.assignedUserIds?.[0] ?? 'any'}
            onValueChange={(v) => update({ assignedUserIds: v === 'any' ? [] : [v] })}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Todos</SelectItem>
              {(team ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department — only for chats */}
        {reportType === 'chats' && (
          <div>
            <Label className="text-xs text-muted-foreground">Departamento</Label>
            <Select
              value={filters.departmentIds?.[0] ?? 'any'}
              onValueChange={(v) => update({ departmentIds: v === 'any' ? [] : [v] })}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos</SelectItem>
                {(departments ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Funnel + Stage — only for contacts */}
        {reportType === 'contacts' && (
          <>
            <div>
              <Label className="text-xs text-muted-foreground">Funil</Label>
              <Select
                value={filters.funnelId ?? 'any'}
                onValueChange={(v) => update({ funnelId: v === 'any' ? undefined : v, stageId: undefined })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Todos</SelectItem>
                  {funnels.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filters.funnelId && (
              <div>
                <Label className="text-xs text-muted-foreground">Etapa do Funil</Label>
                <Select
                  value={filters.stageId ?? 'any'}
                  onValueChange={(v) => update({ stageId: v === 'any' ? undefined : v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Todas</SelectItem>
                    {(funnels.find((f) => f.id === filters.funnelId)?.stages ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        {/* Date filters */}
        <div>
          <Label className="text-xs text-muted-foreground">Cadastrado a partir de</Label>
          <Input
            type="date"
            value={filters.registeredFrom ?? ''}
            onChange={(e) => update({ registeredFrom: e.target.value || undefined })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Cadastrado até</Label>
          <Input
            type="date"
            value={filters.registeredTo ?? ''}
            onChange={(e) => update({ registeredTo: e.target.value || undefined })}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Cadastrado nos últimos X dias</Label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 30"
            value={filters.registeredLastDays ?? ''}
            onChange={(e) => update({ registeredLastDays: e.target.value ? Number(e.target.value) : null })}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Interagiu nos últimos X dias</Label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 7"
            value={filters.interactedLastDays ?? ''}
            onChange={(e) => update({ interactedLastDays: e.target.value ? Number(e.target.value) : null })}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Mais de X dias sem interagir</Label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 15"
            value={filters.daysWithoutInteraction ?? ''}
            onChange={(e) => update({ daysWithoutInteraction: e.target.value ? Number(e.target.value) : null })}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Dias sem receber mensagem</Label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 10"
            value={filters.daysWithoutReceiving ?? ''}
            onChange={(e) => update({ daysWithoutReceiving: e.target.value ? Number(e.target.value) : null })}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Dias sem enviar mensagem</Label>
          <Input
            type="number"
            min={0}
            placeholder="Ex: 10"
            value={filters.daysWithoutSending ?? ''}
            onChange={(e) => update({ daysWithoutSending: e.target.value ? Number(e.target.value) : null })}
            className="mt-1"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onRun} className="gap-2">
          <Search size={15} /> Ver Relatório
        </Button>
        <Button variant="outline" onClick={onSave} className="gap-2">
          <Save size={15} /> Salvar Relatório
        </Button>
      </div>
    </div>
  );
}
