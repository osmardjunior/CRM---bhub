-- Permite que agentes vejam integrações para exibição de número no inbox.
-- Regra: membro da empresa pode ler integração se:
--   1. É admin
--   2. Integração pertence ao seu departamento
--   3. Integração está em allowed_integration_ids do seu perfil
--   4. Integração não tem departamento (department_id IS NULL) — número global

DROP POLICY IF EXISTS "Users view dept integrations" ON public.integrations;

CREATE POLICY "Users view dept integrations"
  ON public.integrations FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id() AND (
      has_role(auth.uid(), 'admin')
      OR department_id IS NULL
      OR department_id = ANY(get_user_department_ids())
      OR id = ANY(
        SELECT unnest(allowed_integration_ids)
        FROM profiles
        WHERE id = auth.uid()
          AND allowed_integration_ids IS NOT NULL
      )
    )
  );
