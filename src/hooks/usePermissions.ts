import { useAuth } from '@/contexts/AuthContext';
import type { Enums } from '@/integrations/supabase/types';

type AppRole = Enums<'app_role'>;

interface Permissions {
  /** Can reassign conversations to any team member */
  canReassignConversations: boolean;
  /** Can assign conversations to self only (agents) */
  canAssignToSelf: boolean;
  /** Can manage users in Settings (invite, edit roles) */
  canManageUsers: boolean;
  /** Current role */
  role: AppRole | null;
  /** Check if user is admin */
  isAdmin: boolean;
  /** Check if user is supervisor or admin */
  isSupervisorOrAbove: boolean;
}

export function usePermissions(): Permissions {
  const { role, user } = useAuth();
  const typedRole = role as AppRole | null;

  const isAdmin = typedRole === 'admin';
  const isSupervisorOrAbove = typedRole === 'admin' || typedRole === 'supervisor';

  return {
    canReassignConversations: isSupervisorOrAbove,
    canAssignToSelf: true, // all roles can assign to self
    canManageUsers: isAdmin,
    role: typedRole,
    isAdmin,
    isSupervisorOrAbove,
  };
}

/** Returns a tooltip reason string if the user lacks permission */
export function getPermissionTooltip(
  permission: keyof Pick<Permissions, 'canReassignConversations' | 'canManageUsers'>,
  permissions: Permissions,
): string | undefined {
  if (permission === 'canReassignConversations' && !permissions.canReassignConversations) {
    return 'Sem permissão: apenas supervisores e admins podem reatribuir conversas';
  }
  if (permission === 'canManageUsers' && !permissions.canManageUsers) {
    return 'Sem permissão: apenas admins podem gerenciar usuários';
  }
  return undefined;
}
