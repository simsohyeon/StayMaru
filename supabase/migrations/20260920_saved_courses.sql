-- 쉼마루 저장 코스 — Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--
-- 배경: 저장 코스는 브라우저 localStorage(zustand persist)에만 있어 기기를 바꾸거나 저장소를 지우면 사라졌다.
-- 서버(api/courses.ts)가 이 표에 보관하고, 클라이언트 스토어는 localStorage 를 오프라인 캐시로 유지한다.
--
-- 접근 모델: 로그인이 없으므로 브라우저가 만든 익명 클라이언트 id(localStorage 의 UUID)로 구분한다.
-- 즉 "같은 브라우저"가 소유 단위이고 기기 간 공유는 아니다 (기기 간 공유는 로그인 도입 후 과제).
-- 서버만 service_role 키로 읽고 쓴다. RLS 는 정책 없이 켜서 anon/authenticated 접근을 막는다.
create table if not exists public.saved_courses (
  client_id   text        not null,
  course_id   text        not null,
  course      jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (client_id, course_id)
);

create index if not exists saved_courses_client_updated_idx
  on public.saved_courses (client_id, updated_at desc);

alter table public.saved_courses enable row level security;
-- 정책 없음 = anon/authenticated 거부. service_role 은 RLS 를 우회한다.
