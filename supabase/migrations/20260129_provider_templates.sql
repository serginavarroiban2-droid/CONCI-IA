-- Create providers table
create table if not exists providers (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null unique,
  nif text,
  address text,
  sample_invoice_url text,
  extraction_config jsonb -- To store specific patterns or keys relevant for this provider
);

-- Enable RLS
alter table providers enable row level security;

-- Create policies (permissive for now, similar to other tables in this local/dev setup)
create policy "Enable read access for all users" on providers for select using (true);
create policy "Enable insert access for all users" on providers for insert with check (true);
create policy "Enable update access for all users" on providers for update using (true);
create policy "Enable delete access for all users" on providers for delete using (true);

-- Storage bucket for provider samples
-- We assume 'factures' bucket exists, we can use a folder 'provider_samples' inside it or create a new bucket.
-- Let's use the existing 'factures' bucket to keep it simple, organizing by folder.
