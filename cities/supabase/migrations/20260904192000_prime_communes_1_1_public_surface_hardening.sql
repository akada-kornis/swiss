-- Prime Communes · Stabilisation 1.1
-- Public surface hardening. No business data is modified.

REVOKE ALL ON TABLE public."GemeindeAktuell" FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public."GemeindeAktuell" TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
FROM PUBLIC, anon, authenticated;

COMMENT ON VIEW public."GemeindeAktuell"
IS 'Projection publique de lecture de Prime Communes 1.1. Seul SELECT est accordé à anon/authenticated. Cette vue constitue volontairement la surface de lecture du site jusqu’au passage SSO + rôles + RLS de la 1.5.';

COMMENT ON FUNCTION public.rls_auto_enable()
IS 'Event trigger technique Supabase : active automatiquement RLS sur les nouvelles tables public. Non exposé comme RPC aux rôles applicatifs.';
