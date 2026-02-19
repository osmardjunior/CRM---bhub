import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { ChatbotFlow } from '@/hooks/useChatbotFlows';

const DAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

interface FlowSettingsProps {
  flow: ChatbotFlow | null;
  onSave: (updates: Partial<ChatbotFlow> & { id: string }) => void;
}

export default function FlowSettings({ flow, onSave }: FlowSettingsProps) {
  const { toast } = useToast();
  const [offlineMessage, setOfflineMessage] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [businessHours, setBusinessHours] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({});

  useEffect(() => {
    if (flow) {
      setOfflineMessage(flow.offline_message);
      setAiInstructions(flow.ai_instructions);
      setTimeoutMinutes(flow.timeout_minutes);
      const bh = flow.business_hours as Record<string, any> || {};
      const parsed: Record<string, { enabled: boolean; start: string; end: string }> = {};
      DAYS.forEach(d => {
        parsed[d.key] = bh[d.key] || { enabled: d.key !== 'sat' && d.key !== 'sun', start: '08:00', end: '18:00' };
      });
      setBusinessHours(parsed);
    }
  }, [flow]);

  if (!flow) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Selecione um fluxo na aba "Meus Fluxos" para configurar.
      </div>
    );
  }

  const handleSave = () => {
    onSave({
      id: flow.id,
      offline_message: offlineMessage,
      ai_instructions: aiInstructions,
      timeout_minutes: timeoutMinutes,
      business_hours: businessHours,
    });
    toast({ title: 'Configurações salvas!' });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Horário de Atendimento</CardTitle>
          <CardDescription>Defina os dias e horários em que o atendimento está disponível.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map(d => {
            const day = businessHours[d.key] || { enabled: false, start: '08:00', end: '18:00' };
            return (
              <div key={d.key} className="flex items-center gap-3">
                <Switch checked={day.enabled} onCheckedChange={checked => setBusinessHours({ ...businessHours, [d.key]: { ...day, enabled: checked } })} />
                <span className="text-sm w-20">{d.label}</span>
                {day.enabled && (
                  <>
                    <Input type="time" value={day.start} className="w-28" onChange={e => setBusinessHours({ ...businessHours, [d.key]: { ...day, start: e.target.value } })} />
                    <span className="text-sm text-muted-foreground">até</span>
                    <Input type="time" value={day.end} className="w-28" onChange={e => setBusinessHours({ ...businessHours, [d.key]: { ...day, end: e.target.value } })} />
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagem Fora do Horário</CardTitle>
          <CardDescription>Texto enviado automaticamente quando o cliente entra em contato fora do horário.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={offlineMessage} onChange={e => setOfflineMessage(e.target.value)} rows={3} placeholder="Estamos fora do horário de atendimento..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instruções da IA</CardTitle>
          <CardDescription>Prompt base que define o comportamento da IA em etapas do tipo "Resposta IA".</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={aiInstructions} onChange={e => setAiInstructions(e.target.value)} rows={5} placeholder="Você é um assistente de vendas da empresa X. Seja educado e objetivo..." />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeout</CardTitle>
          <CardDescription>Tempo de inatividade (em minutos) para encerrar a conversa automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input type="number" value={timeoutMinutes} onChange={e => setTimeoutMinutes(Number(e.target.value))} className="w-24" min={1} />
            <span className="text-sm text-muted-foreground">minutos</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">Salvar Configurações</Button>
    </div>
  );
}
