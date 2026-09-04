-- Prime Communes · Base Delivery 1.1
-- No functional history is retained before 1.5.

TRUNCATE TABLE public."GemeindeProfilAudit";

COMMENT ON TABLE public."GemeindeProfilAudit"
IS 'Structure réservée/dormante. Prime Communes 1.1 est une Base Delivery sans historique : table vide et trigger désactivé. L’audit fonctionnel sera redéfini à partir de la 1.5.';
