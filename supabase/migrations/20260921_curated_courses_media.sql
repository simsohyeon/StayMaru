-- 테마 코스에 '사진'과 '고정 장소' 추가 — Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
-- (20260920_curated_courses.sql 을 먼저 실행해 두었어야 합니다. 이미 실행했다면 이 파일만 더 실행하면 됩니다.)
--
-- image  : 카드 배경 사진 URL. 비워 두면 지금처럼 관광공모전 수상작을 거점 시군으로 자동 매칭한다.
-- places : 코스에 반드시 들어갈 장소 [{ id, title }]. 비워 두면 지금처럼 엔진이 알아서 고른다.
--          id 는 TourAPI contentid — 코스 생성 시 이 장소들이 먼저 자리를 잡고 나머지를 채운다.
alter table public.curated_courses
  add column if not exists image  text,
  add column if not exists places jsonb not null default '[]'::jsonb;
