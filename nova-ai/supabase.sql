create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Nova conversa',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null check(char_length(content) between 1 and 20000),
 created_at timestamptz not null default now()
);
create index if not exists conversations_owner_idx on public.conversations(user_id,updated_at desc);
create index if not exists messages_owner_idx on public.messages(user_id,conversation_id,created_at);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
grant select,insert,update,delete on public.conversations,public.messages to authenticated;
create policy "own conversations select" on public.conversations for select to authenticated using((select auth.uid())=user_id);
create policy "own conversations insert" on public.conversations for insert to authenticated with check((select auth.uid())=user_id);
create policy "own conversations update" on public.conversations for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "own conversations delete" on public.conversations for delete to authenticated using((select auth.uid())=user_id);
create policy "own messages select" on public.messages for select to authenticated using((select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
create policy "own messages insert" on public.messages for insert to authenticated with check((select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
create policy "own messages update" on public.messages for update to authenticated using((select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))) with check((select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
create policy "own messages delete" on public.messages for delete to authenticated using((select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
