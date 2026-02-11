import { Badge } from '@/components/ui/badge';

type Channel = 'whatsapp' | 'instagram' | 'webchat';

const channelConfig: Record<Channel, { label: string; className: string }> = {
  whatsapp: { label: 'WhatsApp', className: 'bg-success/15 text-success border-success/20' },
  instagram: { label: 'Instagram', className: 'bg-pink-500/15 text-pink-600 border-pink-500/20' },
  webchat: { label: 'Webchat', className: 'bg-info/15 text-info border-info/20' },
};

interface ChannelBadgeProps {
  channel: Channel;
  className?: string;
}

export default function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = channelConfig[channel];
  return (
    <Badge
      variant="outline"
      className={`text-[10px] px-1.5 py-0 border-0 font-medium ${config.className} ${className || ''}`}
    >
      {config.label}
    </Badge>
  );
}
