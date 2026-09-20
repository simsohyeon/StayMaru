-- 쉼마루 테마 코스(큐레이션) — Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--
-- 배경: 홈·테마 화면에 걸리는 추천 코스가 frontend/src/constants/curatedCourses.ts 에 박혀 있어
-- 문구 한 줄을 고치려도 코드를 고치고 다시 배포해야 했다. 이 표에 올려 두면 /admin 에서 바꾼다.
--
-- 폴백 규칙: 이 표가 비어 있거나(또는 Supabase 미설정) 서버가 응답하지 못하면
-- 앱은 코드에 있는 기본 6개 코스를 그대로 쓴다 — 오프라인·장애에도 화면이 비지 않는다.
-- 따라서 표를 만들기만 하고 비워 두어도 지금과 똑같이 동작한다.
--
-- 서버(api/admin.ts · api/content.ts)만 service_role 키로 읽고 쓴다.
-- RLS 는 정책 없이 켜서 anon/authenticated 직접 접근을 막는다.
create table if not exists public.curated_courses (
  id            text        primary key,
  -- 노출 순서(작을수록 앞). 관리자 화면의 위/아래 이동이 이 값을 다시 매긴다.
  sort_order    integer     not null default 0,
  -- 끄면 관리자에게만 보이고 앱에는 나가지 않는다 (지우지 않고 잠시 내릴 때).
  published     boolean     not null default true,
  sigungu_codes integer[]   not null,
  profile       text        not null,
  duration      text        not null,
  themes        text[]      not null default '{}',
  accent        text        not null default '#8B4513',
  -- { ko: { title, desc }, en: {...}, ja: {...}, zh: {...} }
  i18n          jsonb       not null,
  updated_at    timestamptz not null default now()
);

create index if not exists curated_courses_order_idx
  on public.curated_courses (published, sort_order, id);

alter table public.curated_courses enable row level security;
-- 정책 없음 = anon/authenticated 거부. service_role 은 RLS 를 우회한다.
