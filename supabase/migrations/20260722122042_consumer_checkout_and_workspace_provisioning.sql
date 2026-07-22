-- Complete Scena consumer Checkout and paid Workspace provisioning.

alter table public.checkout_sessions
  add column if not exists workspace_type text,
  add column if not exists billing_mode text,
  add column if not exists requested_workspace_name text,
  add column if not exists requested_workspace_slug text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists provisioned_workspace_id uuid,
  add column if not exists amount_total integer,
  add column if not exists currency text;

update public.checkout_sessions
set workspace_type = coalesce(workspace_type, 'team'),
    billing_mode = coalesce(billing_mode, 'subscription'),
    requested_workspace_name = coalesce(requested_workspace_name, requested_team_name),
    requested_workspace_slug = coalesce(requested_workspace_slug, requested_team_slug)
where workspace_type is null
   or billing_mode is null
   or requested_workspace_name is null
   or requested_workspace_slug is null;

alter table public.checkout_sessions
  alter column requested_team_name drop not null,
  alter column requested_team_slug drop not null,
  alter column workspace_type set not null,
  alter column billing_mode set not null,
  alter column requested_workspace_name set not null,
  alter column requested_workspace_slug set not null;

alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_workspace_type_check,
  drop constraint if exists checkout_sessions_billing_mode_check,
  drop constraint if exists checkout_sessions_requested_workspace_name_check,
  drop constraint if exists checkout_sessions_requested_workspace_slug_check,
  drop constraint if exists checkout_sessions_amount_total_check,
  drop constraint if exists checkout_sessions_purchase_shape_check,
  drop constraint if exists checkout_sessions_provisioned_workspace_id_fkey;

alter table public.checkout_sessions
  add constraint checkout_sessions_workspace_type_check check (workspace_type in ('personal','team')),
  add constraint checkout_sessions_billing_mode_check check (billing_mode in ('one_time','subscription')),
  add constraint checkout_sessions_requested_workspace_name_check
    check (length(btrim(requested_workspace_name)) between 1 and 120),
  add constraint checkout_sessions_requested_workspace_slug_check
    check (requested_workspace_slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  add constraint checkout_sessions_amount_total_check check (amount_total is null or amount_total >= 0),
  add constraint checkout_sessions_purchase_shape_check check (
    (plan_code='personal_additional' and workspace_type='personal' and billing_mode='one_time' and stripe_subscription_id is null)
    or (plan_code in ('plus','pro','max') and workspace_type='team' and billing_mode='subscription' and stripe_payment_intent_id is null)
  ),
  add constraint checkout_sessions_provisioned_workspace_id_fkey
    foreign key (provisioned_workspace_id) references public.organizations(id) on delete set null;

create unique index if not exists checkout_sessions_payment_intent_key
  on public.checkout_sessions (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists checkout_sessions_provisioned_workspace_key
  on public.checkout_sessions (provisioned_workspace_id) where provisioned_workspace_id is not null;
create index if not exists checkout_sessions_user_status_idx
  on public.checkout_sessions (user_id,status,created_at desc);
create index if not exists checkout_sessions_workspace_slug_idx
  on public.checkout_sessions (requested_workspace_slug) where status='open';

comment on column public.checkout_sessions.plan_code is
  'Scena offering code. Includes personal_additional for one-time Personal Workspace purchases and Plus/Pro/Max for Team subscriptions.';
comment on column public.checkout_sessions.provisioned_workspace_id is
  'Workspace created only after a verified Stripe webhook finalizes this Checkout Session.';

create table if not exists public.workspace_purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  offering_code text not null references public.plans(plan_code),
  stripe_customer_id text not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  stripe_price_id text not null,
  amount_total integer not null check (amount_total >= 0),
  currency text not null check (currency = lower(currency) and length(currency)=3),
  purchased_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_purchases_offering_check check (offering_code='personal_additional')
);

comment on table public.workspace_purchases is
  'Immutable record of verified one-time purchases that provision additional Personal Workspaces.';
create index if not exists workspace_purchases_user_id_idx
  on public.workspace_purchases (user_id,purchased_at desc);

alter table public.workspace_purchases enable row level security;
revoke all on table public.workspace_purchases from anon,authenticated;
grant select on table public.workspace_purchases to authenticated;
grant all on table public.workspace_purchases to service_role;
drop policy if exists workspace_purchases_select_self on public.workspace_purchases;
create policy workspace_purchases_select_self on public.workspace_purchases
for select to authenticated using (user_id=(select auth.uid()));

alter table public.billing_notification_outbox
  drop constraint if exists billing_notification_outbox_type_check;
alter table public.billing_notification_outbox
  add constraint billing_notification_outbox_type_check check (notification_type in (
    'personal_workspace_purchased','subscription_started','renewal_reminder','payment_failed',
    'cancellation_scheduled','subscription_disabled','subscription_reactivated'
  ));

create or replace function public.provision_paid_team(
  creator_user_id uuid,team_name text,team_slug text,selected_plan text
)
returns table(org_id uuid,team_slug_result text,plan_code text)
language plpgsql security definer set search_path = '' as $$
declare
  new_org_id uuid;
  normalized_name text := btrim(team_name);
  normalized_slug text := lower(btrim(team_slug));
  normalized_plan text := lower(btrim(selected_plan));
begin
  if not exists (select 1 from auth.users u where u.id=creator_user_id) then
    raise exception 'The Workspace owner account does not exist';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('team:'||creator_user_id::text||':'||normalized_slug,0));
  if normalized_name='' or length(normalized_name)>120 then
    raise exception 'Workspace name must be between 1 and 120 characters';
  end if;
  if normalized_slug !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Workspace slug must be 3-64 lowercase letters, numbers, or hyphens';
  end if;
  if normalized_plan not in ('plus','pro','max') then
    raise exception 'A Team Workspace requires Plus, Pro, or Max';
  end if;
  if not exists (
    select 1 from public.plans p where p.plan_code=normalized_plan
      and p.workspace_type='team' and p.billing_mode='subscription' and p.is_active
  ) then raise exception 'That Team Workspace plan is unavailable'; end if;

  insert into public.organizations (
    name,slug,status,created_by,owner_user_id,workspace_type,provisioning_kind
  ) values (
    normalized_name,normalized_slug,'active',creator_user_id,creator_user_id,'team','team_subscription'
  ) returning id into new_org_id;

  insert into public.organization_entitlements (
    org_id,plan_code,max_displays_per_session,max_displays,max_boards,max_members,
    max_concurrent_sessions,max_asset_uploads_per_month,automation_tier,
    allow_display_groups,allow_session_groups,allow_resource_access_controls
  ) values (
    new_org_id,normalized_plan,4,
    case normalized_plan when 'plus' then 2 when 'pro' then 5 else 15 end,
    case normalized_plan when 'plus' then 10 when 'pro' then 30 else 50 end,
    case normalized_plan when 'plus' then 5 when 'pro' then 10 else 25 end,
    case normalized_plan when 'plus' then 1 when 'pro' then 2 else 4 end,
    null,
    case normalized_plan when 'plus' then 'none' when 'pro' then 'basic' else 'advanced' end,
    normalized_plan='max',normalized_plan='max',normalized_plan='max'
  );
  return query select new_org_id,normalized_slug,normalized_plan;
exception when unique_violation then
  if exists (select 1 from public.organizations o where o.slug=normalized_slug) then
    raise exception 'That Workspace slug is already in use';
  end if;
  raise;
end;
$$;
revoke all on function public.provision_paid_team(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.provision_paid_team(uuid,text,text,text) to service_role;

create or replace function public.finalize_personal_workspace_purchase(
  target_user_id uuid,target_stripe_checkout_session_id text,target_stripe_customer_id text,
  target_stripe_payment_intent_id text,target_stripe_price_id text,target_amount_total integer,
  target_currency text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  checkout_row public.checkout_sessions%rowtype;
  plan_row public.plans%rowtype;
  existing_workspace_id uuid;
  new_workspace_id uuid;
begin
  if target_user_id is null
     or nullif(btrim(target_stripe_checkout_session_id),'') is null
     or nullif(btrim(target_stripe_customer_id),'') is null
     or nullif(btrim(target_stripe_payment_intent_id),'') is null
     or nullif(btrim(target_stripe_price_id),'') is null then
    raise exception 'Verified payment identifiers are required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('personal-purchase:'||target_stripe_checkout_session_id,0));

  select wp.workspace_id into existing_workspace_id from public.workspace_purchases wp
  where wp.stripe_checkout_session_id=target_stripe_checkout_session_id
     or wp.stripe_payment_intent_id=target_stripe_payment_intent_id limit 1;
  if existing_workspace_id is not null then return existing_workspace_id; end if;

  select * into checkout_row from public.checkout_sessions cs
  where cs.stripe_checkout_session_id=target_stripe_checkout_session_id
    and cs.user_id=target_user_id for update;
  if checkout_row.id is null then raise exception 'Checkout Session is not registered for this user'; end if;
  if checkout_row.plan_code<>'personal_additional' or checkout_row.workspace_type<>'personal'
     or checkout_row.billing_mode<>'one_time' then
    raise exception 'Checkout Session is not an additional Personal Workspace purchase';
  end if;
  if checkout_row.stripe_customer_id<>target_stripe_customer_id then raise exception 'Checkout customer does not match'; end if;
  if checkout_row.status='complete' and checkout_row.provisioned_workspace_id is not null then
    return checkout_row.provisioned_workspace_id;
  end if;
  if checkout_row.status not in ('open','complete') then
    raise exception 'Checkout Session cannot be finalized from status %',checkout_row.status;
  end if;

  select * into plan_row from public.plans p
  where p.plan_code='personal_additional' and p.stripe_price_id=target_stripe_price_id
    and p.workspace_type='personal' and p.billing_mode='one_time' and p.is_active;
  if plan_row.plan_code is null then raise exception 'Stripe price is not mapped to the Personal Workspace offering'; end if;
  if target_amount_total is distinct from plan_row.unit_amount
     or lower(target_currency) is distinct from lower(plan_row.currency) then
    raise exception 'Paid amount or currency does not match the Personal Workspace offering';
  end if;

  insert into public.organizations (
    name,slug,status,created_by,owner_user_id,workspace_type,provisioning_kind
  ) values (
    checkout_row.requested_workspace_name,checkout_row.requested_workspace_slug,'active',
    target_user_id,target_user_id,'personal','personal_purchase'
  ) returning id into new_workspace_id;

  insert into public.organization_entitlements (
    org_id,plan_code,max_displays,max_boards,max_members,max_concurrent_sessions,
    max_displays_per_session,max_asset_uploads_per_month,automation_tier,
    allow_display_groups,allow_session_groups,allow_resource_access_controls
  ) values (new_workspace_id,'personal_free',2,5,1,1,4,5,'none',false,false,false);

  insert into public.workspace_purchases (
    workspace_id,user_id,offering_code,stripe_customer_id,stripe_checkout_session_id,
    stripe_payment_intent_id,stripe_price_id,amount_total,currency
  ) values (
    new_workspace_id,target_user_id,'personal_additional',target_stripe_customer_id,
    target_stripe_checkout_session_id,target_stripe_payment_intent_id,
    target_stripe_price_id,target_amount_total,lower(target_currency)
  );

  update public.checkout_sessions set
    stripe_payment_intent_id=target_stripe_payment_intent_id,
    provisioned_workspace_id=new_workspace_id,amount_total=target_amount_total,
    currency=lower(target_currency),status='complete',completed_at=coalesce(completed_at,now()),updated_at=now()
  where id=checkout_row.id;
  update public.user_preferences set last_org_id=new_workspace_id,updated_at=now() where user_id=target_user_id;
  return new_workspace_id;
end;
$$;
revoke all on function public.finalize_personal_workspace_purchase(uuid,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.finalize_personal_workspace_purchase(uuid,text,text,text,text,integer,text) to service_role;

create or replace function public.finalize_team_workspace_subscription(
  target_user_id uuid,target_stripe_checkout_session_id text,target_stripe_customer_id text,
  target_stripe_subscription_id text,target_stripe_price_id text,target_status text,
  target_period_start timestamptz,target_period_end timestamptz,
  target_cancel_at_period_end boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  checkout_row public.checkout_sessions%rowtype;
  existing_workspace_id uuid;
  provisioned record;
  new_workspace_id uuid;
begin
  if target_status not in ('trialing','active') then raise exception 'Subscription is not active'; end if;
  perform pg_advisory_xact_lock(hashtextextended('team-subscription:'||target_stripe_checkout_session_id,0));
  select ws.org_id into existing_workspace_id from public.workspace_subscriptions ws
  where ws.stripe_subscription_id=target_stripe_subscription_id;
  if existing_workspace_id is not null then return existing_workspace_id; end if;

  select * into checkout_row from public.checkout_sessions cs
  where cs.stripe_checkout_session_id=target_stripe_checkout_session_id
    and cs.user_id=target_user_id for update;
  if checkout_row.id is null then raise exception 'Checkout Session is not registered for this user'; end if;
  if checkout_row.workspace_type<>'team' or checkout_row.billing_mode<>'subscription'
     or checkout_row.plan_code not in ('plus','pro','max') then
    raise exception 'Checkout Session is not a Team Workspace subscription';
  end if;
  if checkout_row.stripe_customer_id<>target_stripe_customer_id then raise exception 'Checkout customer does not match'; end if;
  if not exists (
    select 1 from public.plans p where p.plan_code=checkout_row.plan_code
      and p.stripe_price_id=target_stripe_price_id and p.workspace_type='team'
      and p.billing_mode='subscription' and p.is_active
  ) then raise exception 'Stripe price is not mapped to the selected Team Workspace plan'; end if;

  select * into provisioned from public.provision_paid_team(
    target_user_id,checkout_row.requested_workspace_name,
    checkout_row.requested_workspace_slug,checkout_row.plan_code
  );
  new_workspace_id:=provisioned.org_id;

  insert into public.workspace_subscriptions (
    org_id,owner_user_id,plan_code,stripe_customer_id,stripe_subscription_id,
    stripe_price_id,status,current_period_start,current_period_end,cancel_at_period_end
  ) values (
    new_workspace_id,target_user_id,checkout_row.plan_code,target_stripe_customer_id,
    target_stripe_subscription_id,target_stripe_price_id,target_status,
    target_period_start,target_period_end,coalesce(target_cancel_at_period_end,false)
  );
  update public.checkout_sessions set stripe_subscription_id=target_stripe_subscription_id,
    provisioned_workspace_id=new_workspace_id,status='complete',
    completed_at=coalesce(completed_at,now()),updated_at=now()
  where id=checkout_row.id;
  update public.user_preferences set last_org_id=new_workspace_id,updated_at=now() where user_id=target_user_id;
  return new_workspace_id;
end;
$$;
revoke all on function public.finalize_team_workspace_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.finalize_team_workspace_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean) to service_role;

create or replace function public.sync_paid_team_subscription(
  target_stripe_subscription_id text,target_plan_code text,target_stripe_price_id text,
  target_status text,target_period_start timestamptz,target_period_end timestamptz,
  target_cancel_at_period_end boolean,target_cancelled_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_org_id uuid;
begin
  select ws.org_id into target_org_id from public.workspace_subscriptions ws
  join public.organizations o on o.id=ws.org_id
  where ws.stripe_subscription_id=target_stripe_subscription_id and o.workspace_type='team'
  for update of ws;
  if target_org_id is null then raise exception 'Team Workspace subscription mapping not found'; end if;
  if not exists (
    select 1 from public.plans p where p.plan_code=target_plan_code
      and p.stripe_price_id=target_stripe_price_id and p.workspace_type='team'
      and p.billing_mode='subscription'
  ) then raise exception 'Stripe price is not mapped to a Team Workspace plan'; end if;

  update public.workspace_subscriptions set plan_code=target_plan_code,
    stripe_price_id=target_stripe_price_id,status=target_status,
    current_period_start=target_period_start,current_period_end=target_period_end,
    cancel_at_period_end=coalesce(target_cancel_at_period_end,false),cancelled_at=target_cancelled_at,
    updated_at=now() where org_id=target_org_id;

  if target_status in ('active','trialing','past_due') then
    update public.organization_entitlements oe set plan_code=target_plan_code,
      max_displays_per_session=4,
      max_displays=case target_plan_code when 'plus' then 2 when 'pro' then 5 else 15 end,
      max_boards=case target_plan_code when 'plus' then 10 when 'pro' then 30 else 50 end,
      max_members=case target_plan_code when 'plus' then 5 when 'pro' then 10 else 25 end,
      max_concurrent_sessions=case target_plan_code when 'plus' then 1 when 'pro' then 2 else 4 end,
      max_asset_uploads_per_month=null,
      automation_tier=case target_plan_code when 'plus' then 'none' when 'pro' then 'basic' else 'advanced' end,
      allow_display_groups=(target_plan_code='max'),allow_session_groups=(target_plan_code='max'),
      allow_resource_access_controls=(target_plan_code='max'),updated_at=now()
    where oe.org_id=target_org_id;
  end if;
  update public.organizations set status=case when target_status in ('active','trialing','past_due') then 'active' else 'suspended' end,
    updated_at=now() where id=target_org_id;
  return target_org_id;
end;
$$;
revoke all on function public.sync_paid_team_subscription(text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.sync_paid_team_subscription(text,text,text,text,timestamptz,timestamptz,boolean,timestamptz) to service_role;

notify pgrst, 'reload schema';
