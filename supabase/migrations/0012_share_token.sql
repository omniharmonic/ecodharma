-- Social share cards: an opt-in, per-user public share token.
--
-- Null token = sharing off (the default). When a user chooses to share their
-- reading, we mint a urlsafe token and store it here; the public share page
-- (/r/[token]) and OG-image route resolve it — read-only, and only ever expose
-- a strict whitelist (the recognition opener + archetype names), never the full
-- gift_profiles.content_json. Idempotent so scripts/dev-db.sh apply can re-run.
alter table profiles add column if not exists share_token text;

create unique index if not exists profiles_share_token_key on profiles (share_token);
