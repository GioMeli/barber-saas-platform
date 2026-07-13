alter table businesses add column if not exists photos text[] default '{}';
alter table businesses add column if not exists map_url text;