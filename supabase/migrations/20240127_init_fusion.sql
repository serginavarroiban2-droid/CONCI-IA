-- Create table for merged fiscal records
CREATE TABLE IF NOT EXISTS registres_fiscals_fusionats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Identificació
  data DATE,
  proveedor TEXT,
  nif_proveedor TEXT,
  num_factura TEXT,
  
  -- Detall IVA (Bases i Cuotes)
  base_iva_2 NUMERIC DEFAULT 0,
  import_iva_2 NUMERIC DEFAULT 0,
  base_iva_4 NUMERIC DEFAULT 0,
  import_iva_4 NUMERIC DEFAULT 0,
  base_iva_5 NUMERIC DEFAULT 0,
  import_iva_5 NUMERIC DEFAULT 0,
  base_iva_10 NUMERIC DEFAULT 0,
  import_iva_10 NUMERIC DEFAULT 0,
  base_iva_21 NUMERIC DEFAULT 0,
  import_iva_21 NUMERIC DEFAULT 0,
  
  -- Camps Especialitzats
  base_exempta NUMERIC DEFAULT 0,
  
  -- IRPF
  base_irpf NUMERIC DEFAULT 0,
  percentatge_irpf NUMERIC DEFAULT 0,
  import_irpf NUMERIC DEFAULT 0,
  
  -- Totals i Control
  total_factura NUMERIC DEFAULT 0,
  url_document TEXT, -- Link to Supabase Storage
  unique_hash TEXT UNIQUE -- Hash to prevent duplicates
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_registres_fiscals_data ON registres_fiscals_fusionats(data);
CREATE INDEX IF NOT EXISTS idx_registres_fiscals_proveedor ON registres_fiscals_fusionats(proveedor);
