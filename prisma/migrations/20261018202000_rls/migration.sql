-- Règles RLS : un client ne voit que ses données, l'équipe (ADMIN) voit tout.
-- L'app serveur (Prisma, rôle postgres) n'est pas soumise au RLS ; ces règles
-- protègent tout accès direct via les clés Supabase (anon / authenticated).

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from "User" where id = auth.uid()::text and role = 'ADMIN');
$$;

create or replace function public.my_client_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select "clientId" from "ClientMembership" where "userId" = auth.uid()::text;
$$;

create or replace function public.my_site_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select s.id from "Site" s where s."clientId" in (select public.my_client_ids());
$$;

-- Activer le RLS partout
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Lecture côté client (membres du client)
create policy member_read on "Client"           for select to authenticated using (id in (select public.my_client_ids()));
create policy member_read on "ClientMembership" for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Invitation"       for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Site"             for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Order"            for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Subscription"     for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Conversation"     for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Document"         for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Referral"         for select to authenticated using ("referrerClientId" in (select public.my_client_ids()));
create policy member_read on "ReviewPrompt"     for select to authenticated using ("clientId" in (select public.my_client_ids()));
create policy member_read on "Notification"     for select to authenticated using ("clientId" in (select public.my_client_ids()));

create policy member_read on "SiteAsset"          for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "SiteHistoryEntry"   for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "SiteHealthCheck"    for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "ContactRequest"     for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "SearchStatsMonthly" for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "MonthlyRecap"       for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "Review"             for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "ChangeRequest"      for select to authenticated using ("siteId" in (select public.my_site_ids()));
create policy member_read on "GuideProgress"      for select to authenticated using ("siteId" in (select public.my_site_ids()));

create policy member_read on "ChangeRequestAttachment" for select to authenticated
  using ("changeRequestId" in (select id from "ChangeRequest" where "siteId" in (select public.my_site_ids())));
create policy member_read on "ChangeRequestComment" for select to authenticated
  using ("changeRequestId" in (select id from "ChangeRequest" where "siteId" in (select public.my_site_ids())));
create policy member_read on "Message" for select to authenticated
  using ("conversationId" in (select id from "Conversation" where "clientId" in (select public.my_client_ids())));

-- Données personnelles de l'utilisateur
create policy self_read   on "User"                   for select to authenticated using (id = auth.uid()::text);
create policy self_all    on "PushSubscription"       for all    to authenticated using ("userId" = auth.uid()::text) with check ("userId" = auth.uid()::text);
create policy self_all    on "NotificationPreference" for all    to authenticated using ("userId" = auth.uid()::text) with check ("userId" = auth.uid()::text);

-- Catalogue visible par tout utilisateur connecté
create policy auth_read on "Offer"     for select to authenticated using (true);
create policy auth_read on "Promotion" for select to authenticated using (true);
create policy auth_read on "Guide"     for select to authenticated using (true);
