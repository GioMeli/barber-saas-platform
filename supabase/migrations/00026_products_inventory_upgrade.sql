-- 00026_products_inventory_upgrade.sql
begin;

alter table public.products
  add column if not exists barcode text,
  add column if not exists brand text,
  add column if not exists supplier_name text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists products_business_sku_unique
  on public.products (business_id, lower(sku))
  where sku is not null and btrim(sku) <> '';

create unique index if not exists products_business_barcode_unique
  on public.products (business_id, barcode)
  where barcode is not null and btrim(barcode) <> '';

create index if not exists products_business_category_idx
  on public.products (business_id, category);

create index if not exists products_business_stock_idx
  on public.products (business_id, current_stock, min_stock);

alter table public.stock_movements
  drop constraint if exists stock_movements_type_check;

alter table public.stock_movements
  add constraint stock_movements_type_check
  check (
    type in (
      'purchase',
      'sale',
      'damage',
      'return',
      'correction',
      'internal_use',
      'expired'
    )
  );

create index if not exists stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);

commit;
