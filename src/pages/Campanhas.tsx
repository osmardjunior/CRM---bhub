import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, useRunCampaign, Campaign } from '@/hooks/useCampaigns';
import CampaignList from '@/components/campanhas/CampaignList';
import CampaignForm from '@/components/campanhas/CampaignForm';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';

export default function Campanhas() {
  const permissions = usePermissions();
  const { data: campaigns = [], isLoading } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const runCampaign = useRunCampaign();

  const [editing, setEditing] = useState<Campaign | null | 'new'>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleSave = async (data: Partial<Campaign>) => {
    if (data.id) {
      await updateCampaign.mutateAsync({ id: data.id, ...data });
    } else {
      await createCampaign.mutateAsync(data);
    }
    setEditing(null);
  };

  const handleTogglePause = (c: Campaign) => {
    updateCampaign.mutate({ id: c.id, status: c.status === 'running' ? 'paused' : 'running' });
  };

  if (editing) {
    return (
      <CampaignForm
        campaign={editing === 'new' ? null : editing}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
        saving={createCampaign.isPending || updateCampaign.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campanhas</h2>
          <p className="text-sm text-muted-foreground">Ações em massa sobre contatos e conversas do CRM</p>
        </div>
        {permissions.can('campaigns_create') && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} className="sm:mr-2" /> <span className="hidden sm:inline">Nova Campanha</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <CampaignList
          campaigns={campaigns}
          onEdit={c => setEditing(c)}
          onDelete={id => setDeleteId(id)}
          onTogglePause={handleTogglePause}
          onRun={id => runCampaign.mutate(id)}
          runningId={runCampaign.isPending ? (runCampaign.variables as string) : null}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir campanha"
        description="Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita."
        onConfirm={() => { if (deleteId) deleteCampaign.mutate(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
