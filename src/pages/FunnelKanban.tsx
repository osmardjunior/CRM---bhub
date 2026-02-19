import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Filter, Plus, MoreHorizontal, ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Mock data per funnel ─────────────────────────────────
const MOCK_FUNNELS: Record<string, { name: string; stages: { label: string; leads: string[]; shown: number; total: number; pct: number }[] }> = {
  '1': {
    name: '0. AÇÃO PIX',
    stages: [
      {
        label: 'ENTRADA DO LEAD',
        leads: [],
        shown: 0, total: 0, pct: 0,
      },
      {
        label: 'VENDEDOR ATUANDO',
        leads: ['Darlion', 'Deus acima de tudo.', 'Elly', 'Victor', 'Eitel Veloso 🧡', 'Rodrigho Lobo', 'Deus', 'Giselle Roberta', '6ahh土', 'Rosana', 'Alexandre Silva', 'Matheus Santos', 'Carlão', 'Hugo Leonardo', 'Wellington', 'BRUNO', 'Kauã´', 'adm...', 'Galdino 🦁'],
        shown: 50, total: 545, pct: 73,
      },
      {
        label: 'JÁ POSSUI CADASTRO',
        leads: ['Leo 8', '_Thiago', 'Professor José Junior', 'Renato Mendes', 'Luiz Felipe', '💙🥜 Júlio Braga🤙 💙', 'Fabiano Dos Santos', '🖤', 'lucas', 'Não Disponível', 'Rayane Silva 🇿🇦', '🥤', 'Arlan Freire', 'Alan Richard Esposito', 'Anderson Silva', 'Karol Guimarães', 'Gustavo', '🥱💙⭐ Liz Feitosa 🍑🤙🦋🌟', 'Canais 30 pila'],
        shown: 50, total: 85, pct: 11,
      },
      {
        label: 'CADASTRO REALIZADO',
        leads: ['–guilherme', 'Rita', 'Não Disponível', 'Aurélio Diniz', 'Biel'],
        shown: 5, total: 5, pct: 1,
      },
      {
        label: 'CPA REALIZADO',
        leads: ['Heck', 'Daniela', 'guizin', 'STELORÉ', '🍑', 'Emanuel', 'Lesqueves', 'wagner wfj8001', '.', 'Gabriel Reis', 'Cleiton', 'T002', 'Tiago Rodrigues', 'Rafa', 'Diego Silva', 'Jefin', 'Alessandro 🤘 🅰', 'Aurélio Diniz', '🔵'],
        shown: 39, total: 39, pct: 5,
      },
      {
        label: 'REDEPÓSITO',
        leads: ['Jefim', 'Rafael'],
        shown: 2, total: 2, pct: 0,
      },
      {
        label: 'VENDA REALIZADA',
        leads: [],
        shown: 0, total: 0, pct: 0,
      },
      {
        label: 'RECUPERAÇÃO 1',
        leads: ['Victor Spinal', 'Gustavo', 'Júlia Souza', 'Fábio', 'Erick', 'Cristian', 'José Roberto', 'Rayane Silva 🇿🇦', 'Juliano Ibrahimovic', 'luendson10', 'Não Disponível', 'Kelly', 'Jéssica Santos 🌮 🌿 ✏', 'Toninho Barros', 'Não Disponível', 'Bruno Lopes', 'Matheus Pavese', 'Luiz Sousa', 'Guilherme Batista'],
        shown: 33, total: 33, pct: 4,
      },
      {
        label: 'RECUPERAÇÃO 2',
        leads: [],
        shown: 0, total: 0, pct: 0,
      },
      {
        label: 'SEM INTERAÇÃO',
        leads: ['Barbosa', 'Adrian', 'Gabriel Felinto', 'Não Disponível', 'Rafael', '🧡 🟢', 'Gite', 'DG🔴', '–', 'marins', 'July', 'Teixeira', 'Jean Carlos Galvão', '–', 'Allyson', 'Jeferson Silva 🔲', 'RV', 'Antonio', 'Cristiano Quadros'],
        shown: 42, total: 42, pct: 6,
      },
    ],
  },
  '2': {
    name: '00. ROLETA',
    stages: [
      { label: 'ENTRADA DO LEAD', leads: [], shown: 0, total: 0, pct: 0 },
      { label: 'VENDEDOR ATUANDO', leads: ['Ana', 'Carlos', 'Pedro', 'Maria'], shown: 4, total: 366, pct: 60 },
      { label: 'CADASTRO REALIZADO', leads: ['João', 'Beatriz', 'Lucas'], shown: 3, total: 7, pct: 10 },
      { label: 'CPA REALIZADO', leads: ['Fernanda', 'Ricardo'], shown: 2, total: 21, pct: 15 },
      { label: 'JÁ TEM CADASTRO', leads: ['Marcos', 'Juliana', 'André'], shown: 3, total: 128, pct: 10 },
      { label: 'REDEPÓSITO', leads: ['Sofia'], shown: 1, total: 1, pct: 1 },
      { label: 'VENDA REALIZADA', leads: ['Diego'], shown: 1, total: 1, pct: 1 },
      { label: 'RECUPERAÇÃO 1', leads: [], shown: 0, total: 0, pct: 0 },
      { label: 'RECUPERAÇÃO 2', leads: [], shown: 0, total: 0, pct: 0 },
      { label: 'SEM INTERAÇÃO', leads: [], shown: 0, total: 0, pct: 0 },
    ],
  },
};

// ── Lead Card ────────────────────────────────────────────
function LeadCard({ name }: { name: string }) {
  return (
    <div className="bg-white rounded border border-amber-200 px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-amber-50 transition-colors shadow-sm">
      {name}
    </div>
  );
}

// ── Stage Column ─────────────────────────────────────────
function StageColumn({
  label,
  leads,
  shown,
  total,
  pct,
}: {
  label: string;
  leads: string[];
  shown: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="flex flex-col w-[200px] min-w-[200px] bg-amber-200 rounded-lg overflow-hidden border border-amber-300 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between bg-sidebar px-3 py-2.5">
        <div>
          <p className="text-[10px] font-bold text-sidebar-foreground uppercase tracking-wide leading-none">
            {label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{total}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem>Renomear etapa</DropdownMenuItem>
            <DropdownMenuItem>Mover para esquerda</DropdownMenuItem>
            <DropdownMenuItem>Mover para direita</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Excluir etapa</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Leads list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[400px] max-h-[calc(100vh-220px)]">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-xs text-amber-700 font-medium">{shown}/{total}</p>
            <p className="text-[10px] text-amber-600">({pct}%)</p>
          </div>
        ) : (
          leads.map((name, i) => <LeadCard key={i} name={name} />)
        )}
      </div>

      {/* Column footer */}
      <div className="bg-amber-100 border-t border-amber-300 px-2 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-amber-800 font-semibold">
            {shown}/{total}{' '}
            <span className="font-normal text-amber-700">({pct}%)</span>
          </span>
        </div>
        <button className="w-full flex items-center justify-center gap-1 bg-white/80 hover:bg-white text-amber-800 text-[10px] font-semibold py-1 rounded border border-amber-300 transition-colors">
          <Plus size={10} />
          Adicionar Chats
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function FunnelKanban() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const funnel = MOCK_FUNNELS[id ?? '1'] ?? MOCK_FUNNELS['1'];

  const filteredStages = funnel.stages.map((stage) => ({
    ...stage,
    leads: search
      ? stage.leads.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
      : stage.leads,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] -mt-2 -mx-4 lg:-mx-6 overflow-hidden">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 bg-sidebar px-4 py-2.5 shrink-0">
        {/* Back + funnel name */}
        <button
          onClick={() => navigate('/pipeline')}
          className="flex items-center gap-1.5 text-sidebar-foreground hover:text-sidebar-accent-foreground text-sm font-medium transition-colors mr-1"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">{funnel.name}</span>
        </button>

        <span className="text-sidebar-muted hidden sm:inline">|</span>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-muted" />
          <Input
            placeholder="Pesquisar Chat:"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-muted rounded focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        {/* Filter button */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded transition-colors ${filtersOpen ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60'}`}
        >
          <Filter size={12} />
          <span>Filtros</span>
          <ChevronDown size={10} />
        </button>

        <div className="flex-1" />

        {/* Nova Etapa */}
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-success hover:bg-success/90 text-success-foreground"
          onClick={() => {}}
        >
          <Plus size={12} />
          Nova Etapa
        </Button>
      </div>

      {/* Filter bar (expandable) */}
      {filtersOpen && (
        <div className="flex items-center gap-3 bg-sidebar px-4 py-2 border-t border-sidebar-border shrink-0">
          <span className="text-xs text-sidebar-muted">Filtrar por:</span>
          <select className="h-6 text-xs bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded px-2">
            <option>Todos os status</option>
            <option>Aberto</option>
            <option>Pendente</option>
          </select>
          <select className="h-6 text-xs bg-sidebar-accent text-sidebar-foreground border border-sidebar-border rounded px-2">
            <option>Todos os agentes</option>
          </select>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-amber-100 p-3">
        <div className="flex gap-3 h-full min-w-max">
          {filteredStages.map((stage, idx) => (
            <StageColumn key={idx} {...stage} />
          ))}

          {/* Add stage button */}
          <div className="flex flex-col w-[180px] min-w-[180px] shrink-0">
            <button className="flex items-center justify-center gap-2 h-full border-2 border-dashed border-amber-400 rounded-lg text-amber-700 hover:bg-amber-200 hover:border-amber-500 transition-colors text-sm font-medium">
              <Plus size={16} />
              Nova Etapa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
