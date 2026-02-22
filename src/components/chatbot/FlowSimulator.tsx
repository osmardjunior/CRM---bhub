import { useState, useRef, useEffect } from 'react';
import { Play, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ChatbotFlow, ChatbotNode } from '@/hooks/useChatbotFlows';
import { supabase } from '@/integrations/supabase/client';

interface SimulatorMessage {
  id: number;
  role: 'bot' | 'user' | 'system';
  text: string;
}

interface FlowSimulatorProps {
  flow: ChatbotFlow;
  nodes: ChatbotNode[];
  open: boolean;
  onClose: () => void;
}

export default function FlowSimulator({ flow, nodes, open, onClose }: FlowSimulatorProps) {
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [input, setInput] = useState('');
  const [currentNodeIndex, setCurrentNodeIndex] = useState<number | null>(null);
  const [waitingInput, setWaitingInput] = useState(false);
  const [finished, setFinished] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const msgIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nextMsgId = () => ++msgIdRef.current;

  useEffect(() => {
    if (open) resetSimulator();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (role: SimulatorMessage['role'], text: string) => {
    setMessages(prev => [...prev, { id: nextMsgId(), role, text }]);
  };

  const resetSimulator = () => {
    setMessages([]);
    setInput('');
    setCurrentNodeIndex(null);
    setWaitingInput(false);
    setFinished(false);
    setAiLoading(false);
    msgIdRef.current = 0;

    if (nodes.length === 0) {
      setMessages([{ id: 1, role: 'system', text: 'Nenhuma etapa configurada neste fluxo.' }]);
      setFinished(true);
      return;
    }

    // Start processing from node 0 after a small delay
    setTimeout(() => processNode(0, null), 300);
  };

  const getNextIndex = (currentIdx: number): number | null => {
    if (currentIdx + 1 < nodes.length) return currentIdx + 1;
    return null;
  };

  const processNode = async (nodeIdx: number, userMessage: string | null) => {
    if (nodeIdx >= nodes.length) {
      addMsg('system', '✅ Fluxo finalizado.');
      setFinished(true);
      return;
    }

    const node = nodes[nodeIdx];
    const config = node.config || {};

    switch (node.node_type) {
      case 'message': {
        addMsg('bot', config.text || '(mensagem vazia)');
        await delay(500);
        const nextAfterMsg = getNextIndex(nodeIdx);
        if (nextAfterMsg !== null) processNode(nextAfterMsg, null);
        else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
        break;
      }

      case 'menu': {
        const options = (config.options || []) as { label: string; next_position?: number | null }[];
        if (userMessage !== null) {
          // User responded to menu
          const optIdx = parseInt(userMessage) - 1;
          if (optIdx >= 0 && optIdx < options.length) {
            const chosen = options[optIdx];
            addMsg('system', `📌 Opção escolhida: ${chosen.label}`);
            await delay(300);
            if (chosen.next_position != null) {
              const jumpIdx = nodes.findIndex(n => n.position === chosen.next_position);
              if (jumpIdx >= 0) processNode(jumpIdx, null);
              else {
                const ni = getNextIndex(nodeIdx);
                if (ni !== null) { processNode(ni, null); } else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
              }
            } else {
              const ni = getNextIndex(nodeIdx);
              if (ni !== null) { processNode(ni, null); } else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
            }
          } else {
            addMsg('bot', '❌ Opção inválida. Tente novamente.');
            setCurrentNodeIndex(nodeIdx);
            setWaitingInput(true);
          }
        } else {
          // Show menu
          const menuText = config.text || 'Escolha uma opção:';
          const optionsText = options.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
          addMsg('bot', `${menuText}\n\n${optionsText}`);
          setCurrentNodeIndex(nodeIdx);
          setWaitingInput(true);
        }
        break;
      }

      case 'collect_data': {
        const fields = (config.fields || []) as string[];
        const fieldLabels: Record<string, string> = { name: 'Nome', email: 'E-mail', phone: 'Telefone' };
        addMsg('bot', config.prompt || 'Por favor, informe seus dados:');
        addMsg('system', `📋 Campos solicitados: ${fields.map(f => fieldLabels[f] || f).join(', ')}`);
        await delay(400);
        // In simulation, we skip actual data collection
        addMsg('system', '(simulação: dados coletados automaticamente)');
        await delay(300);
        const nextAfterCollect = getNextIndex(nodeIdx);
        if (nextAfterCollect !== null) processNode(nextAfterCollect, null);
        else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
        break;
      }

      case 'ai_response': {
        addMsg('system', '🤖 Etapa de IA — digite uma mensagem para testar a resposta.');
        setCurrentNodeIndex(nodeIdx);
        setWaitingInput(true);

        if (userMessage !== null) {
          setAiLoading(true);
          try {
            const { data, error } = await supabase.functions.invoke('chatbot-process', {
              body: { test_ai: true, ai_instructions: flow.ai_instructions, ai_context: config.context || '', user_message: userMessage },
            });
            if (error) throw error;
            addMsg('bot', data?.ai_response || '(sem resposta da IA)');
          } catch {
            addMsg('bot', '(simulação: resposta da IA apareceria aqui)');
          }
          setAiLoading(false);
          setWaitingInput(false);
          await delay(300);
          const ni = getNextIndex(nodeIdx);
          if (ni !== null) processNode(ni, null);
          else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
        }
        break;
      }

      case 'transfer':
        addMsg('bot', config.message || 'Transferindo para um atendente...');
        addMsg('system', '👤 Conversa transferida para atendente humano.');
        setFinished(true);
        break;

      case 'condition': {
        addMsg('system', '⏰ Verificando horário de atendimento...');
        await delay(500);
        const withinHours = checkBusinessHours(flow.business_hours);
        if (withinHours) {
          addMsg('system', '✅ Dentro do horário. Seguindo fluxo.');
          await delay(300);
          const ni = getNextIndex(nodeIdx);
          if (ni !== null) processNode(ni, null);
          else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
        } else {
          addMsg('bot', flow.offline_message);
          addMsg('system', '🔴 Fora do horário. Fluxo encerrado.');
          setFinished(true);
        }
        break;
      }

      default: {
        const ni = getNextIndex(nodeIdx);
        if (ni !== null) processNode(ni, null);
        else { addMsg('system', '✅ Fluxo finalizado.'); setFinished(true); }
      }
    }
  };

  const handleSend = () => {
    if (!input.trim() || !waitingInput || currentNodeIndex === null) return;
    const text = input.trim();
    setInput('');
    addMsg('user', text);
    setWaitingInput(false);
    setTimeout(() => processNode(currentNodeIndex, text), 300);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm">
      <div className="w-full max-w-md h-[600px] bg-card border rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <Play size={16} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Simulador</span>
            <Badge variant="secondary" className="text-xs">{flow.name}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetSimulator} title="Reiniciar">
              <RotateCcw size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.role === 'system'
                    ? 'bg-muted text-muted-foreground text-xs italic'
                    : 'bg-secondary text-secondary-foreground'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-secondary text-secondary-foreground rounded-xl px-3 py-2 text-sm">
                  <span className="animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t p-3">
          {finished ? (
            <Button variant="outline" className="w-full" onClick={resetSimulator}>
              <RotateCcw size={14} className="mr-2" /> Reiniciar simulação
            </Button>
          ) : (
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={waitingInput ? 'Digite sua resposta...' : 'Aguardando o bot...'}
                disabled={!waitingInput || aiLoading}
                autoFocus
              />
              <Button type="submit" size="icon" disabled={!waitingInput || !input.trim() || aiLoading}>
                <Send size={16} />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkBusinessHours(businessHours: any): boolean {
  if (!businessHours || Object.keys(businessHours).length === 0) return true;
  const now = new Date();
  const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
  const dayKey = dayMap[now.getDay()];
  const dayConfig = businessHours[dayKey];
  if (!dayConfig?.enabled) return false;
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= dayConfig.start && currentTime <= dayConfig.end;
}
