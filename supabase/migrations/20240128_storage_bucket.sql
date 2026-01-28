-- ============================================================================
-- SQL SCRIPT PER CREAR EL BUCKET D'EMMAGATZEMATGE DE FACTURES
-- ============================================================================
-- Executa aquest script al SQL Editor de Supabase
-- https://supabase.com/dashboard/project/wnqompnckucgkisvuojc/sql/new
-- ============================================================================

-- 1. Crear el bucket 'factures' si no existeix
INSERT INTO storage.buckets (id, name, public) 
VALUES ('factures', 'factures', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política de seguretat: Permetre pujar fitxers a tothom
-- (En un entorn de producció, això s'hauria de restringir a usuaris autenticats)
CREATE POLICY "Permetre pujada publica factures" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'factures');

-- 3. Política de seguretat: Permetre veure fitxers a tothom
CREATE POLICY "Permetre lectura publica factures" ON storage.objects 
FOR SELECT USING (bucket_id = 'factures');

-- 4. Política de seguretat: Permetre actualitzar (per si es re-puja)
CREATE POLICY "Permetre update public factures" ON storage.objects 
FOR UPDATE USING (bucket_id = 'factures');

-- 5. Política de seguretat: Permetre esborrar
CREATE POLICY "Permetre delete public factures" ON storage.objects 
FOR DELETE USING (bucket_id = 'factures');
