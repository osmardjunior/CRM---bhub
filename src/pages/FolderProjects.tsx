import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FolderOpen, ChevronRight, Plus, ArrowLeft, MessageSquare, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDepartments } from '@/hooks/useDepartments';
import { useProjects, useCreateProject, type Project } from '@/hooks/useProjects';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/contexts/AuthContext';

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { data: integrations = [] } = useIntegrations(project.id);
  const { data: conversations = [] } = useConversations({ project_id: project.id, status: 'open' });

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => navigate(`/folders/${project.department_id}/${project.id}`)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-foreground">{project.name}</p>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" />
            {integrations.length} {integrations.length === 1 ? 'número' : 'números'}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {conversations.length} abertas
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full text-xs h-7"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/inbox?projectId=${project.id}`);
          }}
        >
          Abrir Atendimento
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FolderProjects() {
  const { departmentId } = useParams<{ departmentId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();

  const { data: departments = [] } = useDepartments();
  const { data: projects = [], isLoading } = useProjects(departmentId);
  const createProject = useCreateProject();

  const dept = departments.find((d) => d.id === departmentId);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim() || !departmentId) return;
    createProject.mutate(
      { department_id: departmentId, name: newName.trim() },
      { onSuccess: () => { setShowCreate(false); setNewName(''); } },
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/folders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FolderOpen className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {dept?.name ?? 'Departamento'}
          </h1>
        </div>
        {role === 'admin' && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Projeto
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum projeto neste departamento.</p>
            {role === 'admin' && (
              <Button size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar primeiro projeto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Nome do projeto</Label>
            <Input
              className="mt-1"
              placeholder="Ex: TipsPlace"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createProject.isPending}>
              {createProject.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
