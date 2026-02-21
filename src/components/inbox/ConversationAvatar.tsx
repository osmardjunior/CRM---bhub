import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarGradient } from '@/lib/colors';

interface ConversationAvatarProps {
  name: string;
  avatarUrl?: string | null;
  isGroup: boolean;
  size?: 'sm' | 'md' | 'lg';
  unread?: number;
}

const sizeMap = {
  sm: { container: 'h-8 w-8', text: 'text-xs', icon: 14, ring: 'ring-1' },
  md: { container: 'h-10 w-10', text: 'text-sm', icon: 16, ring: 'ring-2' },
  lg: { container: 'h-14 w-14', text: 'text-lg', icon: 22, ring: 'ring-2' },
};

export default function ConversationAvatar({
  name,
  avatarUrl,
  isGroup,
  size = 'md',
  unread = 0,
}: ConversationAvatarProps) {
  const s = sizeMap[size];
  const gradient = getAvatarGradient(name);

  return (
    <div className="relative shrink-0">
      <Avatar className={`${s.container} ${s.ring} ring-background shadow-sm`}>
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} />
        ) : null}
        <AvatarFallback
          className={`${s.text} font-bold text-white border-0`}
          style={{ background: gradient }}
        >
          {isGroup ? (
            <Users size={s.icon} className="text-white/90" />
          ) : (
            name[0]?.toUpperCase()
          )}
        </AvatarFallback>
      </Avatar>

      {/* Unread badge */}
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4.5 w-4.5 min-w-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm border-2 border-background">
          {unread > 9 ? '9+' : unread}
        </span>
      )}

      {/* Group indicator dot */}
      {isGroup && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-accent border-2 border-background flex items-center justify-center">
          <Users size={7} className="text-accent-foreground" />
        </span>
      )}
    </div>
  );
}
