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
  /**
   * Check a granular custom permission by key.
   * Admins always return true. For non-admins, checks `custom_permissions` JSONB.
   * If the key is not present, returns false (deny by default).
   */
  can: (key: string) => boolean;
  /** Raw custom_permissions map from profile */
  customPermissions: Record<string, boolean>;
}

export function usePermissions(): Permissions {
  const { role, profile } = useAuth();
  const typedRole = role as AppRole | null;

  const isAdmin = typedRole === 'admin';
  const isSupervisorOrAbove = typedRole === 'admin' || typedRole === 'supervisor';

  const customPermissions = (profile?.custom_permissions ?? {}) as Record<string, boolean>;

  const can = (key: string): boolean => {
    // Admins have all permissions
    if (isAdmin) return true;
    return !!customPermissions[key];
  };

  return {
    canReassignConversations: isSupervisorOrAbove || !!customPermissions['chats_delegate'],
    canAssignToSelf: true, // all roles can assign to self
    canManageUsers: isAdmin,
    role: typedRole,
    isAdmin,
    isSupervisorOrAbove,
    can,
    customPermissions,
  };
}

/** Returns a tooltip reason string if the user lacks permission */
export function getPermissionTooltip(
  permission: keyof Pick<Permissions, 'canReassignConversations' | 'canManageUsers'>,
  permissions: Permissions,
): string | undefined {
  if (permission === 'canReassignConversations' && !permissions.canReassignConversations) {
    return 'Sem permissão: você não tem a permissão "Delegar Chats"';
  }
  if (permission === 'canManageUsers' && !permissions.canManageUsers) {
    return 'Sem permissão: apenas admins podem gerenciar usuários';
  }
  return undefined;
}
