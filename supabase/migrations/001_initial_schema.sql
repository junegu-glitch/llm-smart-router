-- ============================================
-- LLM Smart Router — Initial Schema
-- ============================================

-- 1. Profiles (auto-created on signup)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'User'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. API Keys (encrypted, server-side only)
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  provider text not null,
  encrypted_key text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.api_keys enable row level security;

create policy "Users can manage own keys"
  on public.api_keys for all
  using (auth.uid() = user_id);

-- 3. Conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Users can manage own conversations"
  on public.conversations for all
  using (auth.uid() = user_id);

-- 4. Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  provider text,
  category text,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(10, 6) default 0,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Users can manage own messages"
  on public.messages for all
  using (
    conversation_id in (
      select id from public.conversations where user_id = auth.uid()
    )
  );

-- Indexes for performance
create index idx_api_keys_user on public.api_keys (user_id);
create index idx_conversations_user on public.conversations (user_id, updated_at desc);
create index idx_messages_conversation on public.messages (conversation_id, created_at);
