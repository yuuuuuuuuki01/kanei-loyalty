-- =============================================================================
-- 001_loyalty_schema.sql : 金井酒造ロイヤリティシステム
-- =============================================================================

-- ── 顧客マスタ ──
create table if not exists loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  shopify_customer_id text unique,
  email text unique not null,
  name text not null,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_lc_shopify on loyalty_customers(shopify_customer_id) where shopify_customer_id is not null;
create index idx_lc_email on loyalty_customers(email);

-- ── スタンプカード ──
create table if not exists stamp_cards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references loyalty_customers(id),
  card_number integer not null default 1,
  total_spent integer not null default 0,
  stamps_earned integer generated always as (floor(total_spent / 500)::integer) stored,
  rewards_claimed integer[] not null default '{}',
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(customer_id, card_number)
);

create index idx_sc_customer on stamp_cards(customer_id);
create index idx_sc_active on stamp_cards(customer_id) where completed_at is null;

-- ── スタンプ取引履歴 ──
create table if not exists stamp_transactions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references stamp_cards(id),
  customer_id uuid not null references loyalty_customers(id),
  amount integer not null,
  stamps_before integer not null,
  stamps_after integer not null,
  staff_name text,
  note text,
  created_at timestamptz default now()
);

create index idx_st_customer on stamp_transactions(customer_id);
create index idx_st_card on stamp_transactions(card_id);
create index idx_st_created on stamp_transactions(created_at);

-- ── スタンプ付与 RPC ──
-- 金額を加算し、スタンプを自動計算、60スタンプ到達でカード完了→新カード発行
create or replace function add_purchase(
  p_customer_id uuid,
  p_amount integer,
  p_staff_name text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_card stamp_cards;
  v_old_stamps integer;
  v_new_stamps integer;
  v_new_total integer;
begin
  -- 現在のアクティブカードを取得（なければ作成）
  select * into v_card
  from stamp_cards
  where customer_id = p_customer_id and completed_at is null
  order by card_number desc
  limit 1;

  if v_card is null then
    insert into stamp_cards (customer_id, card_number, total_spent)
    values (p_customer_id, 1, 0)
    returning * into v_card;
  end if;

  v_old_stamps := floor(v_card.total_spent / 500)::integer;
  v_new_total := v_card.total_spent + p_amount;
  v_new_stamps := floor(v_new_total / 500)::integer;

  -- カード更新
  update stamp_cards
  set total_spent = v_new_total
  where id = v_card.id;

  -- 60スタンプ到達 → カード完了
  if v_new_stamps >= 60 then
    update stamp_cards
    set completed_at = now()
    where id = v_card.id;

    -- 繰越金額で新カード作成
    declare
      v_carry_over integer := v_new_total - (60 * 500);
      v_next_number integer := v_card.card_number + 1;
    begin
      insert into stamp_cards (customer_id, card_number, total_spent)
      values (p_customer_id, v_next_number, greatest(v_carry_over, 0));
    end;
  end if;

  -- 取引履歴記録
  insert into stamp_transactions (card_id, customer_id, amount, stamps_before, stamps_after, staff_name)
  values (v_card.id, p_customer_id, p_amount, v_old_stamps, least(v_new_stamps, 60), p_staff_name);

  return jsonb_build_object(
    'card_id', v_card.id,
    'old_stamps', v_old_stamps,
    'new_stamps', least(v_new_stamps, 60),
    'stamps_added', least(v_new_stamps, 60) - v_old_stamps,
    'card_completed', v_new_stamps >= 60
  );
end;
$$;

-- ── 顧客ランク計算ビュー ──
create or replace view v_customer_rank as
select
  c.id as customer_id,
  c.name,
  c.email,
  coalesce(cards.completed_count, 0) as cards_completed,
  coalesce(recent90.spend, 0) as recent_spend_90d,
  coalesce(recent60.spend, 0) as recent_spend_60d,
  case
    when coalesce(cards.completed_count, 0) >= 3 and coalesce(recent60.spend, 0) >= 30000 then 'diamond'
    when coalesce(cards.completed_count, 0) >= 3 and coalesce(recent90.spend, 0) >= 10000 then 'platinum'
    when coalesce(cards.completed_count, 0) >= 3 then 'gold'
    when coalesce(cards.completed_count, 0) >= 2 then 'silver'
    else 'bronze'
  end as rank
from loyalty_customers c
left join (
  select customer_id, count(*) as completed_count
  from stamp_cards where completed_at is not null
  group by customer_id
) cards on cards.customer_id = c.id
left join (
  select customer_id, sum(amount) as spend
  from stamp_transactions
  where created_at >= now() - interval '90 days'
  group by customer_id
) recent90 on recent90.customer_id = c.id
left join (
  select customer_id, sum(amount) as spend
  from stamp_transactions
  where created_at >= now() - interval '60 days'
  group by customer_id
) recent60 on recent60.customer_id = c.id;
