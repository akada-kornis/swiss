-- Prime Communes 1.1
-- Migration applied to production Supabase on 2026-09-04.
-- Scope: native Prime-client flag, ERP catalogue/mappings, module cleanup, live view.
-- Audit trail is explicitly disabled until roadmap 1.5.

ALTER TABLE public."GemeindeProfil"
DISABLE TRIGGER gemeinde_profil_audit;

ALTER TABLE public."GemeindeProfil"
ADD COLUMN IF NOT EXISTS prime_client boolean NOT NULL DEFAULT false;

UPDATE public."GemeindeProfil" gp
SET prime_client = true
FROM public."VP" vp
WHERE gp.vp_id = vp.id
  AND vp.code = 'prime';

UPDATE public."GemeindeProfil" gp
SET prime_client = true
FROM public."Gemeinde" g
WHERE g.bfs_id = gp.bfs_id
  AND g.canton = 'GE'
  AND EXISTS (
    SELECT 1
    FROM public."GemeindeProduct" gpr
    JOIN public."Product" p ON p.id = gpr.product_id
    WHERE gpr.bfs_id = g.bfs_id
      AND p.code = 'eadmin'
  );

UPDATE public."GemeindeProfil"
SET prime_client = true
WHERE bfs_id = 5627;

CREATE TABLE IF NOT EXISTS public."ERP" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."GemeindeProfil"
ADD COLUMN IF NOT EXISTS erp_id uuid
REFERENCES public."ERP"(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gemeinde_profil_erp_idx
ON public."GemeindeProfil"(erp_id);

DROP TRIGGER IF EXISTS erp_updated_at ON public."ERP";

CREATE TRIGGER erp_updated_at
BEFORE UPDATE ON public."ERP"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public."ERP" (code, name)
VALUES
  ('abacus',     'Abacus'),
  ('proconcept', 'ProConcept'),
  ('urbanus',    'Urbanus'),
  ('citizen',    'Citizen'),
  ('bdi',        'BDI'),
  ('epsilon',    'Epsilon'),
  ('cresus',     'Crésus'),
  ('ruf',        'Ruf'),
  ('opale',      'Opale')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = true,
    updated_at = now();

UPDATE public."GemeindeProfil" gp
SET erp_id = erp.id
FROM public."Software" sw
JOIN public."ERP" erp
  ON erp.code =
    CASE sw.code
      WHEN 'etic'    THEN 'abacus'
      WHEN 'urbanus' THEN 'urbanus'
      WHEN 'citizen' THEN 'citizen'
      WHEN 'bdi'     THEN 'bdi'
      WHEN 'epsilon' THEN 'epsilon'
      WHEN 'cresus'  THEN 'cresus'
      WHEN 'ruf'     THEN 'ruf'
      WHEN 'calvin'  THEN 'opale'
    END
WHERE gp.software_id = sw.id
  AND sw.code IN (
    'etic',
    'urbanus',
    'citizen',
    'bdi',
    'epsilon',
    'cresus',
    'ruf',
    'calvin'
  );

UPDATE public."GemeindeProfil" gp
SET erp_id = erp.id
FROM public."ERP" erp
WHERE erp.code = 'proconcept'
  AND gp.bfs_id IN (
    5702,5746,5613,2238,6774,5551,5892,6778,5711,431,432,433,5477,6708,6709,434,6710,5480,6711,5633,5427,5721,5561,6809,435,723,5498,5638,5487,5606,5922,6831,5886,724,5565,5495,450,726,6800,5725,703,441,5861,442,706,443,5646,444,445,713,5889,5571,446,6730,5890,5414,448
  );

UPDATE public."GemeindeProfil" gp
SET erp_id = erp.id
FROM public."ERP" erp
WHERE erp.code = 'abacus'
  AND gp.bfs_id IN (5451,5586,2206,5642);

UPDATE public."GemeindeProfil" gp
SET erp_id = erp.id
FROM public."ERP" erp
WHERE erp.code = 'urbanus'
  AND gp.bfs_id = 5627;

UPDATE public."GemeindeProfil"
SET erp_id = NULL
WHERE bfs_id IN (687,5819);

DELETE FROM public."GemeindeProduct" gp
USING public."Product" p
WHERE gp.product_id = p.id
  AND p.code = 'citizen';

DELETE FROM public."Product"
WHERE code = 'citizen';

INSERT INTO public."Product" (code, name)
VALUES ('clevertax', 'Clever.Tax')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = true,
    updated_at = now();

INSERT INTO public."GemeindeProduct"
  (bfs_id, product_id, confidence, notes)
SELECT
  2206,
  p.id,
  'confirmed',
  'Éditeur : KMS'
FROM public."Product" p
WHERE p.code = 'clevertax'
ON CONFLICT (bfs_id, product_id) DO UPDATE
SET confidence = EXCLUDED.confidence,
    notes = EXCLUDED.notes,
    updated_at = now();

INSERT INTO public."Product" (code, name)
VALUES ('abacus', 'Abacus')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = true,
    updated_at = now();

INSERT INTO public."GemeindeProduct"
  (bfs_id, product_id, confidence, notes)
SELECT
  5627,
  p.id,
  'confirmed',
  'SIRH fourni par Prime'
FROM public."Product" p
WHERE p.code = 'abacus'
ON CONFLICT (bfs_id, product_id) DO UPDATE
SET confidence = EXCLUDED.confidence,
    notes = EXCLUDED.notes,
    updated_at = now();

CREATE OR REPLACE VIEW public."GemeindeAktuell" AS
SELECT DISTINCT ON (g.bfs_id)
  g.bfs_id,
  g.name,
  g.canton,
  g.market,
  g.active,
  ds.expected_population,
  ds.received_population,
  ds.received_on,
  ds.delivery_status,
  ds.comment,
  ds.ech_version,
  ds.missing_ewid,
  ds.ewid_error_rate,
  vp.name AS integrator,
  sw.name AS software,
  gp.sales_status,
  gp.confidence,
  gp.notes,
  gp.updated_at AS profile_updated_at,
  di.reference_date,
  di.completed_at AS delimo_updated_at,
  COALESCE((
    SELECT array_agg(p.name ORDER BY p.name)
    FROM public."GemeindeProduct" gpr
    JOIN public."Product" p ON p.id = gpr.product_id
    WHERE gpr.bfs_id = g.bfs_id
  ), '{}'::text[]) AS products,
  g.bezirk_code,
  b.name AS bezirk,
  gp.prime_client,
  erp.name AS erp,
  erp.code AS erp_code
FROM public."Gemeinde" g
LEFT JOIN public."Bezirk" b
  ON b.code = g.bezirk_code
LEFT JOIN public."GemeindeProfil" gp
  ON gp.bfs_id = g.bfs_id
LEFT JOIN public."VP" vp
  ON vp.id = gp.vp_id
LEFT JOIN public."Software" sw
  ON sw.id = gp.software_id
LEFT JOIN public."ERP" erp
  ON erp.id = gp.erp_id
LEFT JOIN public."DelimoStand" ds
  ON ds.bfs_id = g.bfs_id
LEFT JOIN public."DelimoImport" di
  ON di.id = ds.import_id
 AND di.status = 'success'
ORDER BY
  g.bfs_id,
  di.completed_at DESC NULLS LAST;

ALTER TABLE public."ERP" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_read_erp
ON public."ERP";

CREATE POLICY authenticated_read_erp
ON public."ERP"
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public."ERP" TO authenticated;
GRANT SELECT ON public."GemeindeAktuell" TO anon, authenticated;
