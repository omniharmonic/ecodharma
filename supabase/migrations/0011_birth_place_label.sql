-- 0011_birth_place_label.sql
-- Store the human-readable birthplace (e.g. "Salem, Oregon, United States") so a
-- person can VERIFY on their profile that the right city was used — the miss that
-- silently gave one tester an India timezone for a US "Salem".

alter table birth_data add column if not exists place_label text;
