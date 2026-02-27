import { useState } from 'react';

const KEY = 'inbox_selected_project';

// sessionStorage is tab-isolated: each browser tab gets its own project selection.
// This allows agents to work on different projects in parallel across tabs.
export function useSelectedProject() {
  const [projectId, setProjectId] = useState<string>(
    () => sessionStorage.getItem(KEY) ?? '',
  );

  const select = (id: string) => {
    if (id) {
      sessionStorage.setItem(KEY, id);
    } else {
      sessionStorage.removeItem(KEY);
    }
    setProjectId(id);
  };

  return { projectId, select };
}
