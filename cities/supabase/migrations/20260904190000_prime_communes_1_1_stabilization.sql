-- Prime Communes · Stabilisation 1.1
-- Applied to production on 2026-09-04.
-- No business data is modified by this migration.
-- Base Delivery = current-state consolidation only; functional audit starts in 1.5.

ALTER TABLE public."GemeindeProfil"
DISABLE TRIGGER gemeinde_profil_audit;

REVOKE EXECUTE ON FUNCTION public.audit_gemeinde_profil()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.set_updated_at()
FROM PUBLIC, anon, authenticated;

REVOKE TRUNCATE, TRIGGER, REFERENCES
ON TABLE
  public."Gemeinde",
  public."GemeindeProfil",
  public."GemeindeProduct",
  public."VP",
  public."Software",
  public."ERP",
  public."Product"
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE
ON TABLE
  public."GemeindeProfil",
  public."GemeindeProduct"
FROM authenticated;

DROP POLICY IF EXISTS authenticated_write_profile
ON public."GemeindeProfil";

DROP POLICY IF EXISTS authenticated_write_gemeinde_product
ON public."GemeindeProduct";

CREATE INDEX IF NOT EXISTS gemeinde_profil_software_idx
ON public."GemeindeProfil"(software_id);

CREATE INDEX IF NOT EXISTS gemeinde_profil_prime_client_idx
ON public."GemeindeProfil"(bfs_id)
WHERE prime_client = true;

CREATE INDEX IF NOT EXISTS gemeinde_product_product_idx
ON public."GemeindeProduct"(product_id, bfs_id);

COMMENT ON TABLE public."Gemeinde"
IS 'Référentiel communal OFS. Identité géographique de référence ; ne contient pas les données commerciales Prime.';

COMMENT ON TABLE public."GemeindeProfil"
IS 'État commercial courant d’une commune pour Prime Communes 1.1. Base Delivery : pas d’historisation fonctionnelle avant la 1.5.';

COMMENT ON COLUMN public."GemeindeProfil".software_id
IS 'Logiciel métier communal courant. Distinct de l’ERP et des produits/modules additionnels.';

COMMENT ON COLUMN public."GemeindeProfil".erp_id
IS 'ERP communal courant. Distinct du logiciel métier et des produits/modules additionnels.';

COMMENT ON COLUMN public."GemeindeProfil".prime_client
IS 'Indique une relation client Prime, indépendamment de l’intégrateur ou du logiciel métier.';

COMMENT ON TABLE public."Product"
IS 'Catalogue extensible des produits/modules additionnels. Ne pas y stocker les logiciels métier, ERP ou valeurs financières.';

COMMENT ON TABLE public."GemeindeProduct"
IS 'Affectations courantes de produits/modules additionnels aux communes. Modèle extensible à plusieurs produits par commune.';

COMMENT ON TABLE public."GemeindeProfilAudit"
IS 'Historique ancien conservé mais volontairement dormant en Prime Communes 1.1. L’audit fonctionnel sera redéfini en 1.5.';

COMMENT ON FUNCTION public.save_commune_profile_v11(
  text, integer, boolean, text, text, text, text[], text
)
IS 'Passerelle d’édition limitée de Prime Communes 1.1. Sera remplacée par SSO + rôles + RLS en 1.5.';
