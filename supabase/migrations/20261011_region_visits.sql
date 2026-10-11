-- 쉼마루 시군별 방문자 통계 적재 테이블 — Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--
-- 배경: '지금 경북'(/insights)·'숨은 경북 코스'·코스 엔진의 한적 판단은 한국관광 데이터랩
-- (DataLabService/locgoRegnVisitrDDList) 의 외지인·외국인 방문자 수를 쓴다. 그런데 이 API 는
-- signguCd 필터가 없어 전국 일자별 전체를 돌려준다 — 약 1MB·7~9초. 방문자마다 이걸 받게 두면
-- 첫 로드가 느리고 공공 API 호출량도 사용자 수만큼 늘어난다.
--
-- 그래서 하루 1회 크론(api/sync-visits.ts)이 받아 이 표에 넣고, 브라우저는 /api/visits 로
-- 수 KB 만 받는다. API 가 잠깐 실패해도 마지막으로 받은 실제 수치가 남아 있어, 화면이
-- 추정 상수로 대체되는 일이 없다.
--
-- 접근 모델: 서버(api/*.ts)만 service_role 키로 읽고 쓴다. RLS 는 켜되 정책을 두지 않아
-- anon/authenticated 는 접근 불가. 공개 노출은 /api/visits 엔드포인트가 담당한다.
--
-- 필요한 Vercel 환경변수 (tour_places 와 동일):
--   SUPABASE_URL              (없으면 VITE_SUPABASE_URL 재사용)
--   SUPABASE_SERVICE_ROLE_KEY (Project Settings > API > service_role — 절대 VITE_ 접두사 금지)
--   CRON_SECRET               동기화 엔드포인트 보호용 임의 문자열
--   TOUR_API_KEY              공공데이터포털 일반 인증키(Decoding)

create table if not exists public.region_visits (
  sigungu_code integer     not null,             -- TourAPI areaCode2 기준 1~23 (5번 결번)
  visitors     bigint      not null,             -- 외지인(2) + 외국인(3) 합계, 대표 주간 누계
  base_ym      text        not null,             -- 데이터가 실제로 잡힌 기준 연월 YYYYMM
  synced_at    timestamptz not null default now(),
  primary key (sigungu_code)
);

create index if not exists region_visits_synced_at_idx on public.region_visits (synced_at);

alter table public.region_visits enable row level security;
-- 정책 없음 = anon/authenticated 거부. service_role 은 RLS 를 우회한다.
