import { useProjectContext } from '@/contexts/ProjectContext';

// sessionStorage is tab-isolated: each browser tab gets its own project selection.
// This allows agents to work on different projects in parallel across tabs.
export function useSelectedProject() {
  const { projectId, selectProject: select } = useProjectContext();
  return { projectId, select };
}
