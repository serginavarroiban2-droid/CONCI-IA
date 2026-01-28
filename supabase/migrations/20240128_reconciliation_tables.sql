-- ============================================================================
-- SQL SCRIPT PER CREAR LES TAULES DE CONCILIACIÓ
-- ============================================================================
-- Aquest script crea les taules necessàries per l'aplicació ReconciliationTool
-- Executa aquest SQL al SQL Editor de Supabase
-- ============================================================================

-- Taula principal per guardar registres comptables (factures i moviments bancaris)
CREATE TABLE IF NOT EXISTS registres_comptables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Tipus de registre: 'factura' o 'banc'
  tipus TEXT NOT NULL CHECK (tipus IN ('factura', 'banc')),
  
  -- Contingut JSON amb totes les dades del registre
  contingut JSONB NOT NULL,
  
  -- Exercici i trimestre per filtrar
  ejercicio INTEGER NOT NULL,
  trimestre INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  
  -- Hash únic per evitar duplicats
  unique_hash TEXT UNIQUE NOT NULL
);

-- Taula per guardar les conciliacions
CREATE TABLE IF NOT EXISTS conciliacions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Hash de la factura (clau primària alternativa)
  factura_hash TEXT UNIQUE NOT NULL,
  
  -- Hash del moviment bancari (pot ser NULL si és cash o exclos)
  banc_hash TEXT,
  
  -- Tipus de conciliació: 'banc', 'cash', 'exclos'
  tipus_conciliacio TEXT NOT NULL CHECK (tipus_conciliacio IN ('banc', 'cash', 'exclos'))
);

-- Índexs per millorar el rendiment
CREATE INDEX IF NOT EXISTS idx_registres_tipus ON registres_comptables(tipus);
CREATE INDEX IF NOT EXISTS idx_registres_ejercicio ON registres_comptables(ejercicio);
CREATE INDEX IF NOT EXISTS idx_registres_trimestre ON registres_comptables(trimestre);
CREATE INDEX IF NOT EXISTS idx_registres_hash ON registres_comptables(unique_hash);

CREATE INDEX IF NOT EXISTS idx_conciliacions_factura ON conciliacions(factura_hash);
CREATE INDEX IF NOT EXISTS idx_conciliacions_banc ON conciliacions(banc_hash);
CREATE INDEX IF NOT EXISTS idx_conciliacions_tipus ON conciliacions(tipus_conciliacio);

-- Trigger per actualitzar updated_at automàticament
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conciliacions_updated_at BEFORE UPDATE ON conciliacions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentaris per documentar les taules
COMMENT ON TABLE registres_comptables IS 'Registres comptables (factures i moviments bancaris)';
COMMENT ON TABLE conciliacions IS 'Relacions de conciliació entre factures i moviments bancaris';

-- ============================================================================
-- FI DE L'SCRIPT
-- ============================================================================
