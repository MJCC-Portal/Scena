alter table public.organizations
  add column if not exists workspace_type text not null default 'team',
  add column if not exists provisioning_kind text not null default 'team_subscription';

alter table public.organizations
  drop constraint if exists organizations_workspace_type_check,
  drop constraint if exists organizations_provisioning_kind_check;

alter table public.organizations
  add constraint organizations_workspace_type_check
    check (workspace_type in ('personal', 'team')),
  add constraint organizations_provisioning_kind_check
    check (
      (workspace_type = 'personal' and provisioning_kind in ('initial_free', 'personal_purchase'))
      or (workspace_type = 'team' and provisioning_kind = 'team_subscription')
    );

comment on table public.organizations is
  'Scena Workspaces. Internal organization naming is retained for compatibility; workspace_type distinguishes Personal and Team Workspaces.';

create unique index if not exists organizations_one_initial_personal_per_user_idx
  on public.organizations (created_by)
  where workspace_type = 'personal'
    and provisioning_kind = 'initial_free'
    and created_by is not null;

create or replace function public.enforce_workspace_identity_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_type is distinct from old.workspace_type
     or new.provisioning_kind is distinct from old.provisioning_kind
     or new.created_by is distinct from old.created_by then
    raise exception 'Workspace type, provisioning kind, and creator are immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_workspace_identity_immutable() from public, anon, authenticated;
drop trigger if exists organizations_enforce_workspace_identity on public.organizations;
create trigger organizations_enforce_workspace_identity
before update on public.organizations
for each row execute function public.enforce_workspace_identity_immutable();

alter table public.plans
  add column if not exists workspace_type text not null default 'team',
  add column if not exists billing_mode text not null default 'subscription';
alter table public.plans alter column stripe_product_id drop not null;

alter table public.plans
  drop constraint if exists plans_plan_code_check,
  drop constraint if exists plans_unit_amount_check,
  drop constraint if exists plans_complete_price_configuration_check,
  drop constraint if exists plans_workspace_type_check,
  drop constraint if exists plans_billing_mode_check,
  drop constraint if exists plans_workspace_billing_shape_check;

update public.plans
set workspace_type = 'team', billing_mode = 'subscription'
where plan_code in ('plus', 'pro', 'max');

insert into public.plans
(plan_code,name,stripe_product_id,stripe_price_id,currency,unit_amount,billing_interval,is_active,workspace_type,billing_mode)
values
('personal_free','Scena Personal Free',null,null,'usd',0,null,true,'personal','free'),
('personal_additional','Scena Additional Personal Workspace','prod_UvXfNcNeid5ki6','price_1TvgaLPV7m4tixZJcFDXPAys','usd',1500,null,true,'personal','one_time')
on conflict (plan_code) do update set
  name=excluded.name,
  stripe_product_id=excluded.stripe_product_id,
  stripe_price_id=excluded.stripe_price_id,
  currency=excluded.currency,
  unit_amount=excluded.unit_amount,
  billing_interval=excluded.billing_interval,
  is_active=excluded.is_active,
  workspace_type=excluded.workspace_type,
  billing_mode=excluded.billing_mode,
  updated_at=now();

alter table public.plans
  add constraint plans_plan_code_check
    check (plan_code in ('personal_free','personal_additional','plus','pro','max')),
  add constraint plans_unit_amount_check
    check (unit_amount is null or unit_amount >= 0),
  add constraint plans_workspace_type_check
    check (workspace_type in ('personal','team')),
  add constraint plans_billing_mode_check
    check (billing_mode in ('free','one_time','subscription')),
  add constraint plans_workspace_billing_shape_check
    check (
      not is_active
      or (plan_code='personal_free' and workspace_type='personal' and billing_mode='free' and stripe_product_id is null and stripe_price_id is null and currency='usd' and unit_amount=0 and billing_interval is null)
      or (plan_code='personal_additional' and workspace_type='personal' and billing_mode='one_time' and stripe_product_id is not null and stripe_price_id is not null and currency='usd' and unit_amount=1500 and billing_interval is null)
      or (plan_code in ('plus','pro','max') and workspace_type='team' and billing_mode='subscription' and stripe_product_id is not null and stripe_price_id is not null and currency is not null and unit_amount > 0 and billing_interval in ('month','year'))
    );

alter table public.organization_entitlements
  add column if not exists max_asset_uploads_per_month integer;
alter table public.organization_entitlements
  drop constraint if exists organization_entitlements_plan_code_check,
  drop constraint if exists organization_entitlements_plan_shape_check,
  drop constraint if exists organization_entitlements_max_asset_uploads_per_month_check;
alter table public.organization_entitlements
  add constraint organization_entitlements_plan_code_check
    check (plan_code in ('personal_free','plus','pro','max')),
  add constraint organization_entitlements_max_asset_uploads_per_month_check
    check (max_asset_uploads_per_month is null or max_asset_uploads_per_month > 0),
  add constraint organization_entitlements_plan_shape_check
    check (
      (plan_code='personal_free' and max_displays=2 and max_boards=5 and max_members=1 and max_concurrent_sessions=1 and max_displays_per_session=4 and max_asset_uploads_per_month=5 and automation_tier='none' and not allow_display_groups and not allow_session_groups and not allow_resource_access_controls)
      or (plan_code='plus' and max_displays=2 and max_boards=10 and max_members=5 and max_concurrent_sessions=1 and max_displays_per_session=4 and max_asset_uploads_per_month is null and automation_tier='none' and not allow_display_groups and not allow_session_groups and not allow_resource_access_controls)
      or (plan_code='pro' and max_displays=5 and max_boards=30 and max_members=10 and max_concurrent_sessions=2 and max_displays_per_session=4 and max_asset_uploads_per_month is null and automation_tier='basic' and not allow_display_groups and not allow_session_groups and not allow_resource_access_controls)
      or (plan_code='max' and max_displays=15 and max_boards=50 and max_members=25 and max_concurrent_sessions=4 and max_displays_per_session=4 and max_asset_uploads_per_month is null and automation_tier='advanced' and allow_display_groups and allow_session_groups and allow_resource_access_controls)
    );

grant select on table public.plans to anon, authenticated;
notify pgrst, 'reload schema';
