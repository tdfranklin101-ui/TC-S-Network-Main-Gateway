-- Supabase table for Solar-tracked assets
-- This schema provides a database-backed alternative to the file-based indexing system

-- Main table: solar_assets
create table if not exists public.solar_assets (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  asset_type text check (asset_type in ('DIGITAL_ARTIFACT','AI_MODEL','DATA_CENTER','TOKEN')) default 'DIGITAL_ARTIFACT',
  energy_consumed_kwh numeric not null,
  solar_equivalent numeric generated always as (energy_consumed_kwh / 4913.0) stored,
  renewable_source text,
  verification text,
  geo_origin text,
  created_at timestamptz default now()
);

-- View: machine-readable JSON-LD export
create or replace view public.solar_assets_json as
select jsonb_build_object(
  '@context','https://schema.org',
  '@type','Product',
  'name', name,
  'identifier', coalesce(slug, id::text),
  'category', asset_type,
  'additionalProperty', jsonb_build_array(
     jsonb_build_object('@type','PropertyValue','name','energy_consumed_kWh','value',energy_consumed_kwh),
     jsonb_build_object('@type','PropertyValue','name','solar_equivalent','value',solar_equivalent),
     jsonb_build_object('@type','PropertyValue','name','renewable_source','value',renewable_source),
     jsonb_build_object('@type','PropertyValue','name','verification','value',verification),
     jsonb_build_object('@type','PropertyValue','name','geo_origin','value',geo_origin),
     jsonb_build_object('@type','PropertyValue','name','timestamp','value',now())
  )
) as jsonld
from public.solar_assets;

-- Index for slug lookups
create index if not exists idx_solar_assets_slug on public.solar_assets(slug);

-- Index for asset type filtering
create index if not exists idx_solar_assets_type on public.solar_assets(asset_type);

-- Example usage:
-- Insert a new asset:
-- INSERT INTO public.solar_assets (slug, name, asset_type, energy_consumed_kwh, renewable_source, verification, geo_origin)
-- VALUES ('kid-solar-av-001', 'Kid Solar Avatar – Intro Sequence', 'DIGITAL_ARTIFACT', 9826, 'SOLAR', 'REC', 'US-CA');

-- Query JSON-LD output:
-- SELECT jsonld FROM public.solar_assets_json WHERE slug = 'kid-solar-av-001';
