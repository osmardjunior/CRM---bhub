import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Instagram, Globe } from 'lucide-react';

interface ChannelConfig {
  enabled: boolean;
  mode: 'manual' | 'automatic';
}

interface ChannelPanelProps {
  channels: Record<string, ChannelConfig>;
  onChange: (channels: Record<string, ChannelConfig>) => void;
}

const CHANNEL_META = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-success' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500' },
  { key: 'webchat', label: 'Webchat', icon: Globe, color: 'text-info' },
];

export default function ChannelPanel({ channels, onChange }: ChannelPanelProps) {
  const getChannel = (key: string): ChannelConfig => channels[key] || { enabled: false, mode: 'automatic' };

  const updateChannel = (key: string, updates: Partial<ChannelConfig>) => {
    onChange({ ...channels, [key]: { ...getChannel(key), ...updates } });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Canais</h3>
        <p className="text-xs text-muted-foreground">Ativar/desativar por canal</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {CHANNEL_META.map(ch => {
          const cfg = getChannel(ch.key);
          const Icon = ch.icon;
          return (
            <div key={ch.key} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={16} className={ch.color} />
                  <span className="text-sm font-medium text-foreground">{ch.label}</span>
                </div>
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={v => updateChannel(ch.key, { enabled: v })}
                />
              </div>
              {cfg.enabled && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Modo</Label>
                  <Select value={cfg.mode} onValueChange={(v: 'manual' | 'automatic') => updateChannel(ch.key, { mode: v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automático</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
