-- ============================================================
-- ShowRing IQ — Document management
-- Uploaded paperwork (memberships, licenses, transfers, non-pro
-- declarations, Coggins, health certs) attached to a person, horse,
-- and/or show. Verification workflow per CLAUDE.md: uploaded -> human
-- verifies -> used in validation/exports. Files live in a PRIVATE
-- Supabase Storage bucket; access is always through signed URLs, never
-- public paths (CLAUDE.md security section: minimal exposure for
-- sensitive documents).
-- ============================================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid references public.people (id) on delete cascade,
  horse_id uuid references public.horses (id) on delete cascade,
  show_id uuid references public.shows (id) on delete cascade,
  document_type text not null check (document_type in (
    'membership_card', 'competition_license', 'coggins', 'health_certificate',
    'non_pro_declaration', 'ownership_transfer', 'show_card', 'other'
  )),
  file_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 260),
  file_size_bytes integer,
  mime_type text,
  expiration_date date,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  uploaded_by uuid references auth.users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  constraint documents_attached_to_something
    check (person_id is not null or horse_id is not null or show_id is not null)
);

create index documents_org_idx on public.documents (organization_id);
create index documents_person_idx on public.documents (person_id) where person_id is not null;
create index documents_horse_idx on public.documents (horse_id) where horse_id is not null;
create index documents_show_idx on public.documents (show_id) where show_id is not null;

alter table public.documents enable row level security;

create policy "documents_select_permitted" on public.documents
  for select to authenticated using (public.has_org_permission(organization_id, 'org.view'));

create policy "documents_insert_permitted" on public.documents
  for insert to authenticated with check (public.has_org_permission(organization_id, 'document.upload'));

create policy "documents_update_permitted" on public.documents
  for update to authenticated
  using (
    public.has_org_permission(organization_id, 'document.verify')
    or public.has_org_permission(organization_id, 'document.reject')
  )
  with check (
    public.has_org_permission(organization_id, 'document.verify')
    or public.has_org_permission(organization_id, 'document.reject')
  );

create policy "documents_delete_permitted" on public.documents
  for delete to authenticated using (public.has_org_permission(organization_id, 'document.delete'));

-- ------------------------------------------------------------
-- Storage: private bucket, path convention "<org_id>/<uuid>-<filename>"
-- so a storage policy can check org permission from the path alone.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.has_org_permission(((storage.foldername(name))[1])::uuid, 'org.view')
  );

create policy "documents_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_org_permission(((storage.foldername(name))[1])::uuid, 'document.upload')
  );

create policy "documents_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.has_org_permission(((storage.foldername(name))[1])::uuid, 'document.delete')
  );
