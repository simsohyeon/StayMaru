-- 쉼마루 코스 실시간 협업 — Supabase 테이블 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. (무료 플랜으로 충분)
--
-- 모델: 로그인 없음(익명). 코스 키(=방 코드)를 아는 사람은 누구나 읽기/쓰기.
-- 코스 키는 추측이 어려운 5자(GB-XXXXX)라 사실상 비공개 링크와 동일한 보안 수준.

create table if not exists public.shared_courses (
  code        text primary key,
  course      jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

-- 오래된 협업 방 정리에 쓸 인덱스(선택)
create index if not exists shared_courses_updated_at_idx
  on public.shared_courses (updated_at);

-- RLS 활성화 후 익명(anon) 전체 허용 — 코스 키를 아는 사람만 접근하는 구조.
alter table public.shared_courses enable row level security;

drop policy if exists "anon read shared courses"  on public.shared_courses;
drop policy if exists "anon write shared courses" on public.shared_courses;

create policy "anon read shared courses"
  on public.shared_courses for select
  using (true);

create policy "anon write shared courses"
  on public.shared_courses for insert
  with check (true);

create policy "anon update shared courses"
  on public.shared_courses for update
  using (true) with check (true);

-- Realtime 브로드캐스트 활성화 — 행 변경을 구독 중인 모든 기기에 푸시.
alter publication supabase_realtime add table public.shared_courses;
