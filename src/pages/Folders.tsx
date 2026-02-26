import { useNavigate } from 'react-router-dom';
import { FolderOpen, ChevronRight, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDepartments } from '@/hooks/useDepartments';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';

function DepartmentCard({ dept }: { dept: { id: string; name: string } }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects(dept.id);

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => navigate(`/folders/${dept.id}`)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{dept.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </CardContent>
    </Card>
  );
}

export default function Folders() {
  const { data: departments = [], isLoading } = useDepartments();
  const { role } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Pastas</h1>
        </div>
        {role === 'admin' && (
          <Badge variant="outline" className="text-xs">Admin</Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum departamento encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Um administrador precisa criar departamentos e projetos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <DepartmentCard key={dept.id} dept={dept} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
