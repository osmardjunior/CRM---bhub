import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Smartphone, Wifi, WifiOff, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects } from '@/hooks/useProjects';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatusBadge({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 gap-1 text-[11px]">
        <Wifi className="h-3 w-3" /> Conectado
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30 gap-1 text-[11px]">
        <Clock className="h-3 w-3" /> Pendente
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-500/15 text-red-600 border-red-500/30 gap-1 text-[11px]">
      <WifiOff className="h-3 w-3" /> Desconectado
    </Badge>
  );
}

export default function FolderNumbers() {
  const { departmentId, projectId } = useParams<{ departmentId: string; projectId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();

  const { data: projects = [] } = useProjects(departmentId);
  const { data: integrations = [], isLoading } = useIntegrations(projectId);

  const project = projects.find((p) => p.id === projectId);

  const canManage = role === 'admin' || role === 'supervisor';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => navigate(`/folders/${departmentId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Smartphone className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {project?.name ?? 'Projeto'}
          </h1>
        </div>
        <Button
          size="sm"
          onClick={() => navigate(`/inbox?projectId=${projectId}`)}
        >
          <ExternalLink className="h-4 w-4 mr-1" /> Abrir Atendimento
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : integrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Smartphone className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum número vinculado a este projeto.</p>
            {canManage && (
              <p className="text-xs text-muted-foreground mt-1">
                Acesse <strong>Configurações → Integrações</strong> para vincular um número.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
              >
                {/* Status icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  integration.status === 'connected'
                    ? 'bg-green-500/10'
                    : integration.status === 'pending'
                      ? 'bg-yellow-500/10'
                      : 'bg-red-500/10'
                }`}>
                  <Smartphone className="h-4 w-4 text-foreground/70" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">
                      {integration.device_name || 'Sem nome'}
                    </span>
                    <StatusBadge status={integration.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {integration.phone_number
                      ? integration.phone_number
                      : 'Número não sincronizado'}
                    {integration.config?.last_seen && (
                      <span className="ml-2 text-muted-foreground/60">
                        · visto {formatDistanceToNow(new Date(integration.config.last_seen), {
                          addSuffix: true, locale: ptBR,
                        })}
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost" size="sm" className="h-8 text-xs"
                      onClick={() => navigate(`/integracoes`)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Gerenciar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
