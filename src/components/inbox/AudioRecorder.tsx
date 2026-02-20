import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Pick the best supported mimeType for the current browser
function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

interface Props {
  onSend: (blob: Blob) => void;
}

export default function AudioRecorder({ onSend }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Capture mimeType here — recorder.mimeType is guaranteed to be set after recording
        const actualMimeType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setState('preview');
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        toast.error('Permissão de microfone negada. Habilite nas configurações do navegador.');
      } else {
        toast.error('Não foi possível acessar o microfone.');
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discard = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setState('idle');
    setDuration(0);
  }, [audioUrl]);

  const handleSend = useCallback(() => {
    if (blobRef.current) {
      onSend(blobRef.current);
      discard();
    }
  }, [onSend, discard]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (state === 'idle') {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={startRecording}>
        <Mic size={17} />
      </Button>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-destructive font-semibold animate-pulse">● {formatTime(duration)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={stopRecording}>
          <Square size={15} />
        </Button>
      </div>
    );
  }

  // preview
  return (
    <div className="flex items-center gap-1.5">
      <audio src={audioUrl ?? undefined} controls className="h-8 max-w-[160px]" />
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={discard}>
        <Trash2 size={14} />
      </Button>
      <Button size="icon" className="h-7 w-7 rounded-full" onClick={handleSend}>
        <Send size={13} />
      </Button>
    </div>
  );
}
