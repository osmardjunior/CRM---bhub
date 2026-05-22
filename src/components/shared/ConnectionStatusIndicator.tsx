import { useState, useEffect, useCallback, useMemo } from 'react';
import { Smartphone, Loader2, Download, Flame, Thermometer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import EvolutionQRModal from '@/components/integracoes/EvolutionQRModal';

type LiveStatus = 'checking' | 'connected' | 'disconnected';

// ── Warmup thresholds (mirrors send-whatsapp edge function) ──
function getWarmupThresholds(ageDays: number) {
  if (ageDays <= 1)  return { softMinute: 1,  softHour: 15,  softDay: 30,  hardMinute: 2 };
  if (ageDays <= 3)  return { softMinute: 3,  softHour: 30,  softDay: 80,  hardMinute: 6 };
  if (ageDays <= 7)  return { softMinute: 5,  softHour: 60,  softDay: 150, hardMinute: 10 };
  if (ageDays <= 14) return { softMinute: 10, softHour: 100, softDay: 300, hardMinute: 20 };
  if (ageDays <= 30) return { softMinute: 15, softHour: 160, softDay: 450, hardMinute: 30 };
  return { softMinute: 20, softHour: 200, softDay: 600, hardMinute: 40 };
}

type PressureLevel = 'cool' | 'warm' | 'hot' | 'critical';

function getPressureLevel(pressure: number): PressureLevel {
  if (pressure < 0.3) return 'cool';
  if (pressure < 0.6) return 'warm';
  if (pressure < 0.85) return 'hot';
  return 'critical';
}

const PRESSURE_CONFIG: Record<PressureLevel, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  cool:     { label: 'Normal',  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20', barColor: 'bg-green-500' },
  warm:     { label: 'Morno',   color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', barColor: 'bg-amber-500' },
  hot:      { label: 'Quente',  color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', barColor: 'bg-orange-500' },
  critical: { label: 'Crítico', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', barColor: 'bg-red-500' },
};

interface RateData {
  countMinute: number;
  countHour: number;
  countDay: number;
  pressure: number;
  level: PressureLevel;
  thresholds: ReturnType<typeof getWarmupThresholds>;
  ageDays: number;
}

export default function ConnectionStatusIndicator() {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const { projectId } = useProjectContext();
  const { data: integrations = [], isLoading } = useIntegrations(projectId || undefined);
  const whatsapp = integrations.filter(i => i.channel === 'whatsapp');

  const [liveStatus, setLiveStatus] = useState<Record<string, LiveStatus>>({});
  const [qrDevice, setQrDevice] = useState<{ id: string; apiUrl: string; apiKey: string; instanceName: string } | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const checkAllStatuses = useCallback(async () => {
    const evolutionDevices = whatsapp.filter(d => d.provider === 'evolution' && d.config?.api_url);
    if (!evolutionDevices.length) return;

    setLiveStatus(prev => {
      const next = { ...prev };
      evolutionDevices.forEach(d => { next[d.id] = 'checking'; });
      return next;
    });

    await Promise.allSettled(
      evolutionDevices.map(async (d) => {
        try {
          const { data } = await supabase.functions.invoke('evolution-api', {
            body: {
              action: 'check-status',
              api_url: d.config.api_url,
              api_key: d.config.api_key,
              instance_name: d.config.instance_name,
              integration_id: d.id,
            },
          });
          setLiveStatus(prev => ({ ...prev, [d.id]: data?.connected ? 'connected' : 'disconnected' }));
        } catch {
          setLiveStatus(prev => ({ ...prev, [d.id]: 'disconnected' }));
        }
      })
    );
  }, [whatsapp]);

  useEffect(() => {
    if (!isLoading && whatsapp.length > 0) {
      checkAllStatuses();
      const timer = setInterval(checkAllStatuses, 60_000);
      return () => clearInterval(timer);
    }
  }, [isLoading, integrations.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatus = (id: string, dbStatus: string): LiveStatus => {
    if (liveStatus[id]) return liveStatus[id];
    return dbStatus === 'connected' ? 'connected' : 'disconnected';
  };

  const syncHistory = useCallback(async (integ: typeof whatsapp[0]) => {
    if (!integ.config?.api_url || syncingId) return;
    setSyncingId(integ.id);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'sync-history',
          api_url: integ.config.api_url,
          api_key: integ.config.api_key,
          instance_name: integ.config.instance_name,
          integration_id: integ.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizado! ${data.synced_chats} conversa(s) e ${data.synced_messages} mensagem(ns) importadas.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sincronizar');
    } finally {
      setSyncingId(null);
    }
  }, [syncingId]);

  // ── Rate pressure query — reads send_rate_log per integration ──
  const integrationIds = useMemo(() => whatsapp.map(i => i.id), [whatsapp]);

  const { data: rateByIntegration = {} } = useQuery<Record<string, RateData>>({
    queryKey: ['send-rate-pressure', integrationIds],
    queryFn: async () => {
      if (integrationIds.length === 0) return {};

      const oneDayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
      const { data: rows } = await supabase
        .from('send_rate_log')
        .select('integration_id, sent_at')
        .in('integration_id', integrationIds)
        .gte('sent_at', oneDayAgo)
        .order('sent_at', { ascending: false })
        .limit(2000);

      const now = Date.now();
      const oneMinAgo = now - 60_000;
      const oneHourAgo = now - 3_600_000;

      // Group by integration
      const grouped: Record<string, number[]> = {};
      for (const r of rows ?? []) {
        if (!grouped[r.integration_id]) grouped[r.integration_id] = [];
        grouped[r.integration_id].push(new Date(r.sent_at).getTime());
      }

      const result: Record<string, RateData> = {};
      for (const integ of whatsapp) {
        const timestamps = grouped[integ.id] ?? [];
        const ageDays = Math.max(1, Math.floor((now - new Date(integ.created_at).getTime()) / 86_400_000));
        const thresholds = getWarmupThresholds(ageDays);

        let countMinute = 0, countHour = 0, countDay = 0;
        for (const t of timestamps) {
          countDay++;
          if (t >= oneHourAgo) countHour++;
          if (t >= oneMinAgo) countMinute++;
        }

        const pressureMin = Math.min(countMinute / thresholds.softMinute, 1);
        const pressureHour = Math.min(countHour / thresholds.softHour, 1);
        const pressureDay = Math.min(countDay / thresholds.softDay, 1);
        const pressure = Math.max(pressureMin, pressureHour, pressureDay);

        result[integ.id] = {
          countMinute, countHour, countDay,
          pressure, level: getPressureLevel(pressure),
          thresholds, ageDays,
        };
      }
      return result;
    },
    enabled: integrationIds.length > 0,
    refetchInterval: 15_000,
  });

  // ── Derived values ──
  const total = whatsapp.length;
  const connectedCount = whatsapp.filter(i => getStatus(i.id, i.status) === 'connected').length;
  const checkingCount = whatsapp.filter(i => getStatus(i.id, i.status) === 'checking').length;
  const disconnectedCount = total - connectedCount - checkingCount;

  const maxPressure = useMemo(() => {
    let max = 0;
    for (const r of Object.values(rateByIntegration)) {
      if (r.pressure > max) max = r.pressure;
    }
    return max;
  }, [rateByIntegration]);
  const globalLevel = getPressureLevel(maxPressure);

  // Status color — prioritize disconnected > pressure > normal
  const dotColor = checkingCount > 0
    ? 'bg-amber-500'
    : total === 0
      ? 'bg-red-500'
      : disconnectedCount > 0
        ? 'bg-red-500'
        : globalLevel === 'critical'
          ? 'bg-red-500'
          : globalLevel === 'hot'
            ? 'bg-orange-500'
            : connectedCount === total
              ? 'bg-green-500'
              : 'bg-amber-500';

  const dotPulse = checkingCount > 0 || disconnectedCount > 0 || globalLevel === 'critical' || globalLevel === 'hot';

  return (
  <>
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Smartphone size={17} />
          <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card ${dotColor} ${dotPulse ? 'animate-pulse' : ''}`} />
          {(disconnectedCount > 0 || globalLevel === 'critical') && (
            <span className="absolute -right-1 -bottom-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white px-0.5">
              {disconnectedCount > 0 ? disconnectedCount : '!'}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-xs font-semibold text-foreground">Números WhatsApp</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground">
              {total === 0
                ? 'Nenhum número cadastrado'
                : checkingCount > 0
                  ? 'Verificando conexões...'
                  : `${connectedCount}/${total} conectado(s)`}
            </p>
            {maxPressure >= 0.3 && (
              <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${PRESSURE_CONFIG[globalLevel].bg} ${PRESSURE_CONFIG[globalLevel].color} ${PRESSURE_CONFIG[globalLevel].border}`}>
                <Flame size={8} className="mr-0.5" /> {PRESSURE_CONFIG[globalLevel].label}
              </Badge>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {total > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> {connectedCount} online
            </span>
            {disconnectedCount > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> {disconnectedCount} offline
              </span>
            )}
            {checkingCount > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 size={8} className="animate-spin" /> {checkingCount} verificando
              </span>
            )}
          </div>
        )}

        {/* Device list */}
        {whatsapp.length > 0 ? (
          <div className="max-h-80 overflow-y-auto">
            {whatsapp.map(integ => {
              const status = getStatus(integ.id, integ.status);
              const isEvolution = integ.provider === 'evolution' && integ.config?.api_url;
              const isDisconnected = status === 'disconnected';
              const isConnected = status === 'connected';
              const canReconnect = isEvolution && isDisconnected;
              const canSync = isEvolution && isConnected;
              const isSyncing = syncingId === integ.id;
              const rate = rateByIntegration[integ.id];
              const level = rate?.level ?? 'cool';
              const pCfg = PRESSURE_CONFIG[level];

              return (
                <div
                  key={integ.id}
                  onClick={() => {
                    if (canReconnect) {
                      setQrDevice({
                        id: integ.id,
                        apiUrl: integ.config.api_url,
                        apiKey: integ.config.api_key,
                        instanceName: integ.config.instance_name,
                      });
                    }
                  }}
                  className={`px-3 py-2.5 transition-colors border-b border-border last:border-0 ${canReconnect ? 'cursor-pointer hover:bg-accent/50' : 'hover:bg-accent/30'}`}
                >
                  {/* Row 1: device info */}
                  <div className="flex items-center gap-2.5">
                    {status === 'checking' ? (
                      <Loader2 size={12} className="animate-spin text-amber-500 shrink-0" />
                    ) : (
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-400 animate-pulse'}`} />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground truncate">{integ.device_name}</p>
                        <span className={`text-[9px] font-medium px-1 py-0 rounded ${
                          status === 'checking'
                            ? 'bg-amber-500/10 text-amber-500'
                            : isConnected
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 text-red-500'
                        }`}>
                          {status === 'checking' ? 'Verificando' : isConnected ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      {integ.phone_number && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{integ.phone_number}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canSync && (
                        <button
                          onClick={(e) => { e.stopPropagation(); syncHistory(integ); }}
                          disabled={isSyncing}
                          className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50 flex items-center gap-0.5"
                          title="Importar conversas retroativas"
                        >
                          {isSyncing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        </button>
                      )}
                      {canReconnect && (
                        <span className="text-[10px] font-medium text-red-500">Reconectar</span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: rate pressure bar */}
                  {rate && isConnected && (
                    <div className="mt-2 ml-5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1">
                          <Thermometer size={9} className={pCfg.color} />
                          <span className={`text-[9px] font-medium ${pCfg.color}`}>{pCfg.label}</span>
                        </div>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[9px] text-muted-foreground cursor-help tabular-nums">
                                {rate.countMinute}/min · {rate.countHour}/h · {rate.countDay}/dia
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-[10px] max-w-48">
                              <p className="font-medium mb-1">Limites (chip {rate.ageDays}d):</p>
                              <p>{rate.thresholds.softMinute}/min · {rate.thresholds.softHour}/h · {rate.thresholds.softDay}/dia</p>
                              <p className="mt-1 text-muted-foreground">Mensagens acima do limite aumentam o delay de envio para proteger o número.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {/* Pressure bar */}
                      <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pCfg.barColor}`}
                          style={{ width: `${Math.max(rate.pressure * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">Nenhum aparelho cadastrado.</p>
          </div>
        )}

        {/* Warnings */}
        {(disconnectedCount > 0 || globalLevel === 'critical') && (
          <div className="px-3 py-2 border-t border-border bg-red-500/5 space-y-1">
            {disconnectedCount > 0 && (
              <p className="text-[10px] text-red-500 font-medium">
                {disconnectedCount} número(s) desconectado(s) — clique para reconectar
              </p>
            )}
            {globalLevel === 'critical' && (
              <p className="text-[10px] text-red-500 font-medium flex items-center gap-1">
                <Flame size={9} /> Volume crítico — reduza o envio para evitar queda do chip
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={() => navigate('/integracoes')}
            className="text-xs text-primary hover:underline font-medium w-full text-left"
          >
            Gerenciar integrações →
          </button>
        </div>
      </PopoverContent>
    </Popover>

    <EvolutionQRModal
      open={!!qrDevice}
      onOpenChange={(open) => {
        if (!open) {
          setQrDevice(null);
          checkAllStatuses();
        }
      }}
      integrationId={qrDevice?.id ?? null}
      apiUrl={qrDevice?.apiUrl ?? ''}
      apiKey={qrDevice?.apiKey ?? ''}
      instanceName={qrDevice?.instanceName ?? ''}
    />
  </>
  );
}
