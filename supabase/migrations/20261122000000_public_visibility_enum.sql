-- Explicit opt-in to share an anonymous version of a report publicly (after moderator review).
-- Separate migration: a new enum value cannot be used in the same transaction that adds it.
alter type public.visibility_pref add value if not exists 'public_after_review';
