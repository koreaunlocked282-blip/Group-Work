create index if not exists story_comments_author_idx on public.story_comments (author_id);
create index if not exists story_comments_parent_idx on public.story_comments (parent_id);
