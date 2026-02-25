-- Modo de distribuição do rodízio: por peso relativo ou porcentagem explícita
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS round_robin_mode TEXT NOT NULL DEFAULT 'weight'
  CHECK (round_robin_mode IN ('weight', 'percentage'));

-- Ampliar range do peso para suportar porcentagem (1-100)
-- Atualiza o default para ser compatível com ambos os modos
ALTER TABLE profiles
  ALTER COLUMN round_robin_weight SET DEFAULT 1;
