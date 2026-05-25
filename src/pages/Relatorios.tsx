import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon, Search, Filter, ChevronLeft, ChevronRight,
  UserX, X, ExternalLink, BellDot, FileSpreadsheet, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useUserProjects } from '@/hooks/useUserProjects';
import { useTags } from '@/hooks/useTags';
import { useFunnels } from '@/contexts/FunnelContext';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useLeadsReport } from '@/hooks/useLeadsReport';
import { supabase } from '@/integrations/supabase/client';
import { exportLeadsExcel, exportLeadsPdf, type ExportMeta } from '@/lib/exportReport';
import { toast } from 'sonner';

const quickOptions = [
  { label: 'Hoje', days: 0 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const PAGE_SIZE = 25;

export default function RelatoriosPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, user, profile, companyId } = useAuth();
  const isAdmin = role === 'admin';
  const { data: allTeam = [] } = useTeamProfiles();
  const { projectId } = useProjectContext();
  const { data: projectMembers = [] } = useUserProjects(projectId || '');
  const { data: allTags = [] } = useTags();
  const { funnels: allFunnels } = useFunnels();
  const { data: allIntegrations = [] } = useIntegrations(projectId || undefined);
  const whatsappNumbers = allIntegrations.filter(i => i.channel === 'whatsapp');

  const team = projectId
    ? allTeam.filter(m => projectMembers.some(pm => pm.user_id === m.id))
    : allTeam;
  const tags = projectId
    ? allTags.filter(t => !t.project_id || t.project_id === projectId)
    : allTags;
  const funnels = projectId
    ? allFunnels.filter(f => !f.project_id || f.project_id === projectId)
    : allFunnels;

  // Initialize all filters from URL params for persistence across navigation
  const initialAgent = searchParams.get('agent') || 'all';
  const initialStatus = searchParams.get('status') || 'all';
  const initialIntegration = searchParams.get('integration') || 'all';
  const initialSearch = searchParams.get('search') || '';
  const initialTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
  const initialFunnels = searchParams.get('funnels')?.split(',').filter(Boolean) || [];
  const initialStages = searchParams.get('stages')?.split(',').filter(Boolean) || [];
  const initialExcludeTags = searchParams.get('xtags')?.split(',').filter(Boolean) || [];
  const initialExcludeFunnels = searchParams.get('xfunnels')?.split(',').filter(Boolean) || [];
  const initialExcludeStages = searchParams.get('xstages')?.split(',').filter(Boolean) || [];
  const initialUnread = searchParams.get('unread') === '1';
  const initialPage = parseInt(searchParams.get('page') || '1', 10) || 1;
  const initialDateFrom = searchParams.get('from') ? new Date(searchParams.get('from')!) : subDays(new Date(), 30);
  const initialDateTo = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();

  // Filters
  const [dateFrom, setDateFrom] = useState<Date>(initialDateFrom);
  const [dateTo, setDateTo] = useState<Date>(initialDateTo);
  const [agentId, setAgentId] = useState<string>(initialAgent);
  const [tagIds, setTagIds] = useState<string[]>(initialTags);
  const [funnelIds, setFunnelIds] = useState<string[]>(initialFunnels);
  const [stageIds, setStageIds] = useState<string[]>(initialStages);
  const [excludeTagIds, setExcludeTagIds] = useState<string[]>(initialExcludeTags);
  const [excludeFunnelIds, setExcludeFunnelIds] = useState<string[]>(initialExcludeFunnels);
  const [excludeStageIds, setExcludeStageIds] = useState<string[]>(initialExcludeStages);
  const [integrationFilter, setIntegrationFilter] = useState<string>(initialIntegration);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [searchText, setSearchText] = useState(initialSearch);
  const [unreadOnly, setUnreadOnly] = useState(initialUnread);
  const [unreadIds, setUnreadIds] = useState<string[] | null>(null);
  const [page, setPage] = useState(initialPage);

  // Fetch unread IDs when toggle is on
  useEffect(() => {
    if (!unreadOnly || !user || !companyId) {
      setUnreadIds(null);
      return;
    }
    supabase.rpc('get_unread_conversation_ids', {
      p_user_id: user.id,
      p_company_id: companyId,
      p_project_id: projectId || null,
    }).then(({ data, error }) => {
      if (error) { console.error('[Relatorios] unread RPC error:', error); setUnreadIds([]); return; }
      // Production function returns { conversation_id: string }[]
      const ids = (data as { conversation_id: string }[] ?? []).map(r => r.conversation_id);
      setUnreadIds(ids);
    });
  }, [unreadOnly, user, companyId, projectId]);

  // Sync all filters to URL for persistence (back/forward navigation, sharing)
  useEffect(() => {
    setSearchParams(params => {
      const set = (key: string, val: string, defaultVal: string) => {
        if (val && val !== defaultVal) params.set(key, val);
        else params.delete(key);
      };
      set('agent', agentId, 'all');
      set('status', statusFilter, 'all');
      set('integration', integrationFilter, 'all');
      set('search', searchText, '');
      set('from', format(dateFrom, 'yyyy-MM-dd'), format(subDays(new Date(), 30), 'yyyy-MM-dd'));
      set('to', format(dateTo, 'yyyy-MM-dd'), format(new Date(), 'yyyy-MM-dd'));
      if (tagIds.length > 0) params.set('tags', tagIds.join(','));
      else params.delete('tags');
      if (funnelIds.length > 0) params.set('funnels', funnelIds.join(','));
      else params.delete('funnels');
      if (stageIds.length > 0) params.set('stages', stageIds.join(','));
      else params.delete('stages');
      if (excludeTagIds.length > 0) params.set('xtags', excludeTagIds.join(','));
      else params.delete('xtags');
      if (excludeFunnelIds.length > 0) params.set('xfunnels', excludeFunnelIds.join(','));
      else params.delete('xfunnels');
      if (excludeStageIds.length > 0) params.set('xstages', excludeStageIds.join(','));
      else params.delete('xstages');
      if (unreadOnly) params.set('unread', '1');
      else params.delete('unread');
      if (page > 1) params.set('page', String(page));
      else params.delete('page');
      return params;
    }, { replace: true });
  }, [agentId, statusFilter, integrationFilter, searchText, dateFrom, dateTo, tagIds, funnelIds, stageIds, excludeTagIds, excludeFunnelIds, excludeStageIds, unreadOnly, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stages filtered by selected funnels
  const allStages = useMemo(() => {
    const source = funnelIds.length > 0 ? funnels.filter(f => funnelIds.includes(f.id)) : funnels;
    return source.flatMap(f => (f.stages ?? []).map(s => ({ ...s, funnelName: f.name })));
  }, [funnels, funnelIds]);

  // Clear stageIds that no longer belong to selected funnels
  useEffect(() => {
    if (funnelIds.length === 0) return;
    const validIds = new Set(allStages.map(s => s.id));
    const filtered = stageIds.filter(id => validIds.has(id));
    if (filtered.length !== stageIds.length) setStageIds(filtered);
  }, [funnelIds, allStages]);

  const filters = useMemo(() => ({
    dateFrom: startOfDay(dateFrom).toISOString(),
    dateTo: endOfDay(dateTo).toISOString(),
    agentId: agentId !== 'all' ? agentId : undefined,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    funnelIds: funnelIds.length > 0 ? funnelIds : undefined,
    stageIds: stageIds.length > 0 ? stageIds : undefined,
    excludeTagIds: excludeTagIds.length > 0 ? excludeTagIds : undefined,
    excludeFunnelIds: excludeFunnelIds.length > 0 ? excludeFunnelIds : undefined,
    excludeStageIds: excludeStageIds.length > 0 ? excludeStageIds : undefined,
    integrationId: integrationFilter !== 'all' ? integrationFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchText.trim() || undefined,
    unreadIds: unreadOnly ? (unreadIds ?? undefined) : undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [dateFrom, dateTo, agentId, tagIds, funnelIds, stageIds, excludeTagIds, excludeFunnelIds, excludeStageIds, integrationFilter, statusFilter, searchText, unreadOnly, unreadIds, page]);

  const { data, isLoading, error } = useLeadsReport(filters);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleQuick = (days: number) => {
    setDateFrom(days === 0 ? new Date() : subDays(new Date(), days));
    setDateTo(new Date());
    setPage(1);
  };

  const removeTag = (id: string) => { setTagIds(v => v.filter(x => x !== id)); setPage(1); };
  const removeFunnel = (id: string) => { setFunnelIds(v => v.filter(x => x !== id)); setPage(1); };
  const removeStage = (id: string) => { setStageIds(v => v.filter(x => x !== id)); setPage(1); };
  const removeExcludeTag = (id: string) => { setExcludeTagIds(v => v.filter(x => x !== id)); setPage(1); };
  const removeExcludeFunnel = (id: string) => { setExcludeFunnelIds(v => v.filter(x => x !== id)); setPage(1); };
  const removeExcludeStage = (id: string) => { setExcludeStageIds(v => v.filter(x => x !== id)); setPage(1); };

  const agentSummary = data?.agentCounts ?? [];
  const convUrl = (id: string) => `/inbox?id=${id}${projectId ? `&project=${projectId}` : ''}`;
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const buildExportMeta = (): ExportMeta => ({
    dateFrom,
    dateTo,
    agentName: agentId !== 'all' ? (team.find(m => m.id === agentId)?.name ?? (agentId === '__unassigned__' ? 'Não Delegado' : undefined)) : undefined,
    statusLabel: statusFilter !== 'all' ? (statusLabels[statusFilter]?.label ?? statusFilter) : undefined,
    tagNames: tagIds.length > 0 ? tagIds.map(id => tags.find(t => t.id === id)?.name).filter(Boolean) as string[] : undefined,
    funnelNames: funnelIds.length > 0 ? funnelIds.map(id => funnels.find(f => f.id === id)?.name).filter(Boolean) as string[] : undefined,
    total,
  });

  const handleExport = async (type: 'excel' | 'pdf') => {
    setExporting(type);
    try {
      // For export, we need ALL rows — not just the current page.
      // Use the existing query result if total <= pageSize, otherwise fetch all.
      let exportRows = rows;
      if (total > PAGE_SIZE) {
        // Fetch all rows applying the same filters as the report
        let q = supabase
          .from('conversations')
          .select('id, contact_id, status, assigned_user_id, created_at, contact:contacts!inner(id, name, phone, phone_e164)')
          .eq('company_id', companyId!)
          .gte('created_at', startOfDay(dateFrom).toISOString())
          .lte('created_at', endOfDay(dateTo).toISOString());

        if (projectId) q = q.eq('project_id', projectId);
        if (role !== 'admin' && user?.id) {
          q = q.eq('assigned_user_id', user.id);
        } else if (agentId === '__unassigned__') {
          q = q.is('assigned_user_id', null);
        } else if (agentId !== 'all') {
          q = q.eq('assigned_user_id', agentId);
        }
        if (statusFilter !== 'all') q = q.eq('status', statusFilter);
        if (integrationFilter !== 'all') q = q.eq('integration_id', integrationFilter);

        const { data: allData } = await q
          .order('created_at', { ascending: false })
          .range(0, 49999);

        if (allData) {
          const agentIdSet = [...new Set(allData.map(r => r.assigned_user_id).filter(Boolean))] as string[];
          const nameMap: Record<string, string> = {};
          if (agentIdSet.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', agentIdSet);
            for (const p of profiles ?? []) nameMap[p.id] = p.name || 'Sem nome';
          }
          exportRows = allData.map((c: any) => ({
            conversation_id: c.id,
            contact_id: c.contact_id,
            contact_name: c.contact?.name || 'Sem nome',
            phone: c.contact?.phone_e164 || c.contact?.phone || null,
            status: c.status,
            agent_name: c.assigned_user_id ? (nameMap[c.assigned_user_id] || 'Sem nome') : 'Não Delegado',
            tags: [],
            funnel_names: [],
            stage_names: [],
            created_at: c.created_at,
          }));
        }
      }

      const meta = buildExportMeta();
      if (type === 'excel') {
        await exportLeadsExcel(exportRows, meta);
      } else {
        await exportLeadsPdf(exportRows, meta);
      }
      toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} exportado com sucesso!`);
    } catch (err) {
      console.error('[export]', err);
      toast.error(`Erro ao exportar ${type === 'excel' ? 'Excel' : 'PDF'}`);
    } finally {
      setExporting(null);
    }
  };

  const hasActiveFilters = tagIds.length > 0 || funnelIds.length > 0 || stageIds.length > 0 || excludeTagIds.length > 0 || excludeFunnelIds.length > 0 || excludeStageIds.length > 0 || unreadOnly;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Filter size={18} /> Relatório de Leads
      </h1>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card card-shadow p-4 space-y-3">

        {/* Row 1 — Period */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Período:</span>
          {quickOptions.map((opt) => (
            <Button key={opt.days} size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => handleQuick(opt.days)}>
              {opt.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
                <CalendarIcon size={12} />
                {format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={(d) => { if (d) { setDateFrom(d); setPage(1); } }} initialFocus locale={ptBR} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
                <CalendarIcon size={12} />
                {format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={(d) => { if (d) { setDateTo(d); setPage(1); } }} initialFocus locale={ptBR} />
            </PopoverContent>
          </Popover>

          {/* Unread toggle */}
          <button
            onClick={() => { setUnreadOnly(v => !v); setPage(1); }}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-colors',
              unreadOnly
                ? 'bg-primary border-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            <BellDot size={12} />
            Não lidos
          </button>
        </div>

        {/* Row 2 — Main filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {isAdmin && (
            <Select value={agentId} onValueChange={(v) => { setAgentId(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Agentes</SelectItem>
                <SelectItem value="__unassigned__">Não Delegado</SelectItem>
                {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="new">Aberto</SelectItem>
              <SelectItem value="open">Em Atendimento</SelectItem>
              <SelectItem value="pending">Aguardando</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="closed">Fechado</SelectItem>
            </SelectContent>
          </Select>

          {whatsappNumbers.length > 0 && (
            <Select value={integrationFilter} onValueChange={(v) => { setIntegrationFilter(v); setPage(1); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Número" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Números</SelectItem>
                {whatsappNumbers.map((ig) => (
                  <SelectItem key={ig.id} value={ig.id}>
                    {ig.device_name}{ig.phone_number ? ` (${ig.phone_number})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 text-xs pl-8"
              placeholder="Buscar nome ou telefone..."
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Row 3 — Tag / Funnel / Stage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value="" onValueChange={(v) => { if (v && !tagIds.includes(v)) { setTagIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Tag" /></SelectTrigger>
            <SelectContent>
              {tags.filter(t => !tagIds.includes(t.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag disponível</div>
              ) : tags.filter(t => !tagIds.includes(t.id)).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color || '#6366f1' }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value="" onValueChange={(v) => { if (v && !funnelIds.includes(v)) { setFunnelIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Funil" /></SelectTrigger>
            <SelectContent>
              {funnels.filter(f => !funnelIds.includes(f.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum funil disponível</div>
              ) : funnels.filter(f => !funnelIds.includes(f.id)).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value="" onValueChange={(v) => { if (v && !stageIds.includes(v)) { setStageIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Filtrar por Etapa" /></SelectTrigger>
            <SelectContent>
              {allStages.filter(s => !stageIds.includes(s.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma etapa disponível</div>
              ) : allStages.filter(s => !stageIds.includes(s.id)).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.funnelName} › {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 4 — Exclude Tag / Funnel / Stage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value="" onValueChange={(v) => { if (v && !excludeTagIds.includes(v)) { setExcludeTagIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs border-red-500/30 text-red-500"><SelectValue placeholder="Excluir Tag" /></SelectTrigger>
            <SelectContent>
              {tags.filter(t => !excludeTagIds.includes(t.id) && !tagIds.includes(t.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag disponível</div>
              ) : tags.filter(t => !excludeTagIds.includes(t.id) && !tagIds.includes(t.id)).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color || '#6366f1' }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value="" onValueChange={(v) => { if (v && !excludeFunnelIds.includes(v)) { setExcludeFunnelIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs border-red-500/30 text-red-500"><SelectValue placeholder="Excluir Funil" /></SelectTrigger>
            <SelectContent>
              {funnels.filter(f => !excludeFunnelIds.includes(f.id) && !funnelIds.includes(f.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum funil disponível</div>
              ) : funnels.filter(f => !excludeFunnelIds.includes(f.id) && !funnelIds.includes(f.id)).map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value="" onValueChange={(v) => { if (v && !excludeStageIds.includes(v)) { setExcludeStageIds(prev => [...prev, v]); setPage(1); } }}>
            <SelectTrigger className="h-8 text-xs border-red-500/30 text-red-500"><SelectValue placeholder="Excluir Etapa" /></SelectTrigger>
            <SelectContent>
              {allStages.filter(s => !excludeStageIds.includes(s.id) && !stageIds.includes(s.id)).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma etapa disponível</div>
              ) : allStages.filter(s => !excludeStageIds.includes(s.id) && !stageIds.includes(s.id)).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.funnelName} › {s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tagIds.map(id => {
              const t = tags.find(tg => tg.id === id);
              return t ? (
                <Badge key={id} variant="secondary" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeTag(id)}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#6366f1' }} />
                  {t.name} <X size={9} />
                </Badge>
              ) : null;
            })}
            {funnelIds.map(id => {
              const f = funnels.find(fn => fn.id === id);
              return f ? (
                <Badge key={id} variant="secondary" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeFunnel(id)}>
                  Funil: {f.name} <X size={9} />
                </Badge>
              ) : null;
            })}
            {stageIds.map(id => {
              const s = allStages.find(st => st.id === id);
              return s ? (
                <Badge key={id} variant="outline" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeStage(id)}>
                  {s.funnelName} › {s.label} <X size={9} />
                </Badge>
              ) : null;
            })}
            {excludeTagIds.map(id => {
              const t = tags.find(tg => tg.id === id);
              return t ? (
                <Badge key={`x-${id}`} variant="destructive" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeExcludeTag(id)}>
                  Excluir: {t.name} <X size={9} />
                </Badge>
              ) : null;
            })}
            {excludeFunnelIds.map(id => {
              const f = funnels.find(fn => fn.id === id);
              return f ? (
                <Badge key={`x-${id}`} variant="destructive" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeExcludeFunnel(id)}>
                  Excluir Funil: {f.name} <X size={9} />
                </Badge>
              ) : null;
            })}
            {excludeStageIds.map(id => {
              const s = allStages.find(st => st.id === id);
              return s ? (
                <Badge key={`x-${id}`} variant="destructive" className="text-[10px] gap-1 cursor-pointer pr-1" onClick={() => removeExcludeStage(id)}>
                  Excluir: {s.funnelName} › {s.label} <X size={9} />
                </Badge>
              ) : null;
            })}
            {unreadOnly && (
              <Badge variant="default" className="text-[10px] gap-1 cursor-pointer pr-1 bg-primary" onClick={() => { setUnreadOnly(false); setPage(1); }}>
                <BellDot size={9} /> Não lidos <X size={9} />
              </Badge>
            )}
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
              onClick={() => { setTagIds([]); setFunnelIds([]); setStageIds([]); setExcludeTagIds([]); setExcludeFunnelIds([]); setExcludeStageIds([]); setUnreadOnly(false); setPage(1); }}
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Agent summary cards */}
      {isAdmin && agentSummary.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {agentSummary.map((a) => {
            const isUnassigned = a.agent_id === '__unassigned__';
            return (
              <button
                key={a.agent_id}
                onClick={() => { setAgentId(a.agent_id === agentId ? 'all' : a.agent_id); setPage(1); }}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  isUnassigned
                    ? 'border-orange-500/30 bg-orange-500/5'
                    : a.agent_id === agentId
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-accent/50',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {isUnassigned && <UserX size={12} className="text-orange-500" />}
                  <p className="text-xs font-medium truncate">{a.agent_name}</p>
                </div>
                <p className="text-xl font-bold">{a.total}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-red-600 dark:text-red-400" title="Aberto">{a.new} Ab</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400" title="Em Atendimento">{a.open} At</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400" title="Aguardando">{a.pending} Ag</span>
                  <span className="text-[10px] text-muted-foreground" title="Fechado">{a.closed} Fe</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Results table */}
      <div className="rounded-xl border border-border bg-card card-shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? 'Carregando...'
                : error
                  ? `Erro: ${(error as Error).message}`
                  : `${total} lead${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
            </p>
            {!isLoading && total > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!!exporting}
                  onClick={() => handleExport('excel')}
                >
                  <FileSpreadsheet size={12} />
                  {exporting === 'excel' ? 'Exportando...' : 'Excel'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  disabled={!!exporting}
                  onClick={() => handleExport('pdf')}
                >
                  <FileText size={12} />
                  {exporting === 'pdf' ? 'Exportando...' : 'PDF'}
                </Button>
              </div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Contato</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden sm:table-cell">Telefone</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden md:table-cell">Agente</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">Tags</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden xl:table-cell">Funil / Etapa</th>
                <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground hidden sm:table-cell">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.conversation_id}
                  className="border-b last:border-0 hover:bg-accent/30 cursor-pointer transition-colors"
                  onClick={() => navigate(convUrl(row.conversation_id))}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      window.open(convUrl(row.conversation_id), '_blank');
                    }
                  }}
                >
                  <td className="py-2.5 px-4 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{row.contact_name}</span>
                      <a
                        href={convUrl(row.conversation_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir em nova aba"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent hover:border-accent-foreground/20 transition-colors shrink-0"
                      >
                        <ExternalLink size={11} />
                        <span>↗</span>
                      </a>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground hidden sm:table-cell">{row.phone || '—'}</td>
                  <td className="py-2.5 px-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="py-2.5 px-4 hidden md:table-cell">
                    {row.agent_name === 'Não Delegado' ? (
                      <span className="text-orange-500 italic text-xs">Não Delegado</span>
                    ) : (
                      <span className="text-muted-foreground">{row.agent_name || '—'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(row.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t.name} variant="secondary" className="text-[10px] px-1.5 py-0" style={t.color ? { backgroundColor: t.color + '22', color: t.color, borderColor: t.color + '44' } : undefined}>
                          {t.name}
                        </Badge>
                      ))}
                      {(row.tags ?? []).length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{row.tags!.length - 3}</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(row.funnel_names ?? []).slice(0, 2).map((name, i) => (
                        <span key={name} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {name}{row.stage_names?.[i] ? ` › ${row.stage_names[i]}` : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {format(new Date(row.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                  </td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {unreadOnly && unreadIds?.length === 0
                      ? 'Nenhuma conversa não lida'
                      : 'Nenhum lead encontrado para os filtros selecionados'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const statusLabels: Record<string, { label: string; className: string }> = {
  new: { label: 'Aberto', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  open: { label: 'Em Atendimento', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pending: { label: 'Aguardando', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  closed: { label: 'Fechado', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusLabels[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', s.className)}>{s.label}</span>;
}
