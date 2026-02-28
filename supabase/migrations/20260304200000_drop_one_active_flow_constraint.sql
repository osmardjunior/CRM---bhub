-- Remove a constraint que limitava 1 fluxo ativo por empresa
-- O sistema agora suporta múltiplos fluxos ativos simultaneamente (multi-chatbot)
DROP INDEX IF EXISTS idx_one_active_flow_per_company;
