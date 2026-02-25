import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, Wifi, QrCode, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EvolutionQRModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string | null;
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

type Phase = 'creating' | 'qrcode' | 'connected' | 'error';

export default function EvolutionQRModal({
  open,
  onOpenChange,
  integrationId,
  apiUrl,
  apiKey,
  instanceName,
}: EvolutionQRModalProps) {
  const [phase, setPhase] = useState<Phase>('creating');
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const callEvolution = useCallback(
    async (action: string) => {
      const { data, error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action,
          api_url: apiUrl,
          api_key: apiKey,
          instance_name: instanceName,
          integration_id: integrationId,
        },
      });
      if (error) {
        // Try to extract the actual error message from the response body
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.json) {
            const json = await ctx.json();
            msg = json?.error || json?.message || msg;
          } else if (typeof ctx?.text === 'function') {
            const text = await ctx.text();
            const parsed = JSON.parse(text);
            msg = parsed?.error || parsed?.message || msg;
          }
        } catch { /* use original message */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    [apiUrl, apiKey, instanceName, integrationId]
  );

  const createInstance = useCallback(async () => {
    setPhase('creating');
    setError(null);
    try {
      const result = await callEvolution('create-instance');
      if (result.qrcode) {
        setQrcode(result.qrcode);
        setPairingCode(result.pairingCode || null);
        setPhase('qrcode');
      } else {
        // Instance created but no QR - try fetching it
        const qrResult = await callEvolution('get-qrcode');
        setQrcode(qrResult.qrcode || null);
        setPairingCode(qrResult.pairingCode || null);
        setPhase('qrcode');
      }

      // Set webhook (non-critical: failure doesn't block connection)
      try {
        await callEvolution('set-webhook');
      } catch {
        // Webhook setup is best-effort
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar instância');
      setPhase('error');
    }
  }, [callEvolution]);

  const checkStatus = useCallback(async () => {
    try {
      const result = await callEvolution('check-status');
      if (result.connected) {
        setPhase('connected');
        // Stop all polling
        if (pollRef.current) clearInterval(pollRef.current);
        if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
        pollRef.current = null;
        qrRefreshRef.current = null;
        toast.success('WhatsApp conectado com sucesso!');
      }
    } catch {
      // Ignore errors during polling
    }
  }, [callEvolution]);

  const refreshQR = useCallback(async () => {
    try {
      const result = await callEvolution('get-qrcode');
      if (result.qrcode) {
        setQrcode(result.qrcode);
        setPairingCode(result.pairingCode || null);
      }
    } catch {
      // Ignore refresh errors
    }
  }, [callEvolution]);

  // Start instance creation when modal opens
  useEffect(() => {
    if (open && apiUrl && apiKey && instanceName) {
      createInstance();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
      pollRef.current = null;
      qrRefreshRef.current = null;
    };
  }, [open, apiUrl, apiKey, instanceName, createInstance]);

  // Start polling when QR code is shown
  useEffect(() => {
    if (phase === 'qrcode') {
      // Poll connection status every 3s
      pollRef.current = setInterval(checkStatus, 3000);
      // Refresh QR code every 30s (they expire)
      qrRefreshRef.current = setInterval(refreshQR, 30000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
      pollRef.current = null;
      qrRefreshRef.current = null;
    };
  }, [phase, checkStatus, refreshQR]);

  const handleCopy = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (qrRefreshRef.current) clearInterval(qrRefreshRef.current);
      pollRef.current = null;
      qrRefreshRef.current = null;
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode size={18} />
            Conectar WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Creating phase */}
          {phase === 'creating' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Criando instância...</p>
                <p className="text-xs text-muted-foreground mt-1">Aguarde enquanto preparamos a conexão</p>
              </div>
            </div>
          )}

          {/* QR Code phase */}
          {phase === 'qrcode' && (
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border-2 border-primary/20 bg-white p-3">
                {qrcode ? (
                  <img
                    src={qrcode.startsWith('data:') ? qrcode : `data:image/png;base64,${qrcode}`}
                    alt="QR Code WhatsApp"
                    className="h-56 w-56 object-contain"
                  />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Escaneie o QR Code</p>
                <p className="text-xs text-muted-foreground">
                  Abra o WhatsApp no celular → Menu (⋮) → Aparelhos conectados → Conectar aparelho
                </p>
              </div>

              {pairingCode && (
                <div className="w-full rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Ou use o código de pareamento:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-center text-lg font-bold tracking-[0.3em] text-foreground">
                      {pairingCode}
                    </code>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[11px] gap-1 bg-warning/10 text-warning border-warning/20">
                  <Loader2 size={10} className="animate-spin" />
                  Aguardando pareamento...
                </Badge>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshQR} title="Atualizar QR Code">
                  <RefreshCw size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* Connected phase */}
          {phase === 'connected' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 size={32} className="text-success" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">WhatsApp conectado!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Seu aparelho está pronto para enviar e receber mensagens.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Wifi size={12} className="text-success" />
                <span className="text-xs font-medium text-success">Online</span>
              </div>
              <Button size="sm" onClick={() => handleClose(false)}>
                Fechar
              </Button>
            </div>
          )}

          {/* Error phase */}
          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 w-full">
                <p className="text-sm font-medium text-destructive mb-1">Erro na conexão</p>
                <p className="text-xs text-destructive/80 break-all">{error}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={createInstance} className="gap-1.5">
                  <RefreshCw size={12} /> Tentar novamente
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
