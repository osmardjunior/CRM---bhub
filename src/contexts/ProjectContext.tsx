import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const KEY = 'inbox_selected_project';

interface ProjectContextType {
  projectId: string;
  selectProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { companyId } = useAuth();
  const [projectId, setProjectId] = useState<string>(
    () => sessionStorage.getItem(KEY) ?? '',
  );

  // Auto-select when only 1 project exists
  const { data: projects } = useQuery({
    queryKey: ['projects-autoselect', companyId],
    enabled: !!companyId && !projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId!)
        .eq('active', true)
        .limit(2);
      return data ?? [];
    },
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!projectId && projects?.length === 1) {
      selectProject(projects[0].id);
    }
  }, [projects, projectId]);

  const selectProject = (id: string) => {
    if (id) {
      sessionStorage.setItem(KEY, id);
    } else {
      sessionStorage.removeItem(KEY);
    }
    setProjectId(id);
  };

  return (
    <ProjectContext.Provider value={{ projectId, selectProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used inside ProjectProvider');
  return ctx;
}
