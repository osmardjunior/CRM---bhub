import { Headphones, MessageSquare, BookOpen, Video, ExternalLink, Mail, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const resources = [
  {
    icon: BookOpen,
    title: 'Documentação / Wiki',
    description: 'Guias completos, tutoriais passo a passo e referência de todas as funcionalidades.',
    action: 'Acessar Wiki',
    url: 'https://all-in-crm.vercel.app/suporte',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: Video,
    title: 'Vídeos de Treinamento',
    description: 'Assista aos vídeos explicativos de cada funcionalidade do sistema.',
    action: 'Ver Vídeos',
    url: 'https://all-in-crm.vercel.app/suporte',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
  {
    icon: MessageSquare,
    title: 'Chat com Suporte',
    description: 'Converse em tempo real com nossa equipe de suporte técnico especializada.',
    action: 'Abrir Chat',
    url: 'https://all-in-crm.vercel.app/suporte',
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-950/30',
  },
  {
    icon: Mail,
    title: 'Suporte por E-mail',
    description: 'Envie sua dúvida ou problema por e-mail e retornaremos em até 24 horas.',
    action: 'Enviar E-mail',
    url: 'mailto:suporte@allinsolucoes.com.br',
    color: 'text-purple-500',
    bg: 'bg-purple-50 dark:bg-purple-950/30',
  },
];

const faqs = [
  {
    q: 'Como conectar meu WhatsApp ao sistema?',
    a: 'Acesse Celulares WhatsApp no menu lateral, clique em "Adicionar Aparelho" e siga as instruções do assistente. Para Evolution API, escaneie o QR Code gerado.',
  },
  {
    q: 'Como criar respostas automáticas fora do horário?',
    a: 'Crie um Diálogo no Chatbot com trigger "Condição de Horário" configurado para fora do expediente. Adicione a ação "Responder" com a mensagem desejada.',
  },
  {
    q: 'Como exportar contatos para CSV?',
    a: 'Na página Contatos, aplique os filtros desejados e clique no botão "Exportar" no canto superior direito. O arquivo CSV será baixado automaticamente.',
  },
  {
    q: 'Como configurar o NPS automático?',
    a: 'No Chatbot, crie um Diálogo com trigger "Status de Atendimento: Resolvido" e adicione a ação "NPS" selecionando a pesquisa desejada.',
  },
  {
    q: 'Como transferir um chat para outro atendente?',
    a: 'No painel de detalhes do chat (botão ⓘ no Inbox), localize o campo "Responsável" e selecione o atendente ou departamento desejado.',
  },
];

export default function SuportePage() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
          <Headphones size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Encontre respostas rápidas ou entre em contato com nossa equipe.
          </p>
        </div>
      </div>

      {/* Horário */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-4 py-2.5 w-fit">
        <Clock size={14} />
        <span>Suporte disponível: <strong className="text-foreground">Segunda a Sexta, 9h às 18h</strong></span>
      </div>

      {/* Resources grid */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Canais de suporte</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {resources.map((r) => (
            <div key={r.title} className={`rounded-xl border border-border ${r.bg} p-4 flex items-start gap-3`}>
              <div className={`mt-0.5 shrink-0 ${r.color}`}>
                <r.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-0.5">{r.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{r.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => window.open(r.url, '_blank')}
                >
                  {r.action} <ExternalLink size={11} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Perguntas frequentes</h2>
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-border bg-card card-shadow p-4">
              <p className="text-sm font-semibold text-foreground mb-1.5">{faq.q}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
