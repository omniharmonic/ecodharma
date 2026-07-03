-- Constellation-wide consent visibility.
--
-- Consent was pairwise (an invitee granted only the OWNER via has_consent), so:
--   • members could not see the owner or each other — only the owner saw everyone;
--   • the owner never wrote a consent row at all, so they showed as "awaiting
--     consent" to members and were absent from a member's relational reflection.
--
-- The intended model is: anyone who has ACTIVELY consented to a constellation is
-- mutually visible to the OTHER actively-consented members of that same
-- constellation — nothing more. This adds that, keeping the pairwise grant for
-- back-compat, and treats the owner (who consents by creating + inviting) as an
-- actively-consented member.

-- True iff `target` and `viewer` are BOTH actively-consented (non-revoked) members
-- of a shared constellation. SECURITY DEFINER (like has_consent) to avoid RLS
-- recursion when referenced from a policy.
create or replace function public.shares_consented_constellation(target uuid, viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from constellation_members mt
    join consents ct on ct.id = mt.consent_id and ct.revoked_at is null
    join constellation_members mv on mv.constellation_id = mt.constellation_id
    join consents cv on cv.id = mv.consent_id and cv.revoked_at is null
    where mt.user_id = target
      and mv.user_id = viewer
      and mt.user_id <> mv.user_id
  );
$$;

-- Broaden the read policies: self, a direct pairwise grant, OR constellation-wide
-- consent. (Recreated verbatim + the new clause.)
drop policy if exists own_or_consented_profile on gift_profiles;
create policy own_or_consented_profile on gift_profiles
  for select
  using (
    auth.uid() = user_id
    or has_consent(user_id, auth.uid())
    or shares_consented_constellation(user_id, auth.uid())
  );

drop policy if exists own_or_consented_profile_row on profiles;
create policy own_or_consented_profile_row on profiles
  for select
  using (
    auth.uid() = id
    or has_consent(id, auth.uid())
    or shares_consented_constellation(id, auth.uid())
  );

drop policy if exists own_or_consented_offerings on offerings;
create policy own_or_consented_offerings on offerings
  for select
  using (
    auth.uid() = user_id
    or has_consent(user_id, auth.uid())
    or shares_consented_constellation(user_id, auth.uid())
  );

-- Backfill: every constellation owner consents to their own constellation (by
-- creating + inviting), so existing constellations become mutually visible.
-- Idempotent — only owners still missing a consent row are touched.
do $$
declare
  r record;
  new_consent bigint;
begin
  for r in
    select constellation_id, user_id
    from constellation_members
    where role = 'owner' and consent_id is null
  loop
    insert into consents (granter_id, grantee_id, constellation_id, scope)
      values (r.user_id, null, r.constellation_id, 'constellation')
      returning id into new_consent;
    update constellation_members
      set consent_id = new_consent
      where constellation_id = r.constellation_id and user_id = r.user_id;
  end loop;
end $$;
