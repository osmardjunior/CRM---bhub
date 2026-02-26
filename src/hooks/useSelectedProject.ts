import { useState } from 'react';

const KEY = 'inbox_selected_project';

export function useSelectedProject() {
  const [projectId, setProjectId] = useState<string>(
    () => localStorage.getItem(KEY) ?? '',
  );

  const select = (id: string) => {
    if (id) {
      localStorage.setItem(KEY, id);
    } else {
      localStorage.removeItem(KEY);
    }
    setProjectId(id);
  };

  return { projectId, select };
}
