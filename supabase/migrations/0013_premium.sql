-- Premium subscription (single paid tier). The reflection bot + weekly dharma
-- nudges gate on this. Plan is 'free' by default; 'premium' is set either by a
-- Stripe subscription (current_period_end tracks renewal) or an admin comp
-- (current_period_end null = never expires). Idempotent.
alter table profiles add column if not exists plan text not null default 'free';
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists current_period_end timestamptz;

create index if not exists profiles_stripe_customer_idx on profiles (stripe_customer_id);
