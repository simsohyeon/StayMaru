-- 쉼마루 장소 데이터 적재 테이블 — Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.
--
-- 배경: 코스 생성·카테고리 탐색은 브라우저가 TourAPI 를 시군 × 카테고리로 15~20회 부르고,
-- 공공 API 응답이 건당 300~800ms 라 콜드 조회가 3초쯤 걸렸다. 경북 장소 전체를 하루 1회
-- 이 테이블에 적재해 두고 api/proxy.ts 가 여기서 먼저 조회하면 사용자 경로에서 외부 API 지연이 빠진다.
--
-- 접근 모델: 서버(api/*.ts)만 service_role 키로 읽고 쓴다. RLS 는 켜되 정책을 두지 않아
-- anon/authenticated 는 접근 불가. (협업용 shared_courses 와 달리 브라우저가 직접 읽을 일이 없다)
--
-- 필요한 Vercel 환경변수:
--   SUPABASE_URL              (없으면 VITE_SUPABASE_URL 재사용)
--   SUPABASE_SERVICE_ROLE_KEY (Project Settings > API > service_role — 절대 VITE_ 접두사 금지)
--   CRON_SECRET               동기화 엔드포인트 보호용 임의 문자열 (Vercel Cron 이 Authorization 헤더로 보낸다)

-- TourAPI areaBasedList2 항목 원본(raw) + 필터·정렬에 쓰는 컬럼을 풀어 둔다.
-- 응답을 TourAPI 와 같은 형태로 돌려줘야 하므로 raw 를 그대로 보존한다.
create table if not exists public.tour_places (
  lang          text        not null,            -- ko | en | ja | zh (KorService2/EngService2/…)
  contentid     text        not null,
  contenttypeid integer,
  title         text,
  addr1         text,
  areacode      integer,
  sigungucode   integer,
  mapx          double precision,
  mapy          double precision,
  firstimage    text,                            -- 빈 문자열은 null 로 저장 (arrange O/Q/R 의 "사진 있는 것만")
  cat1          text,
  cat2          text,
  cat3          text,
  createdtime   text,                            -- TourAPI 원문 YYYYMMDDHHMMSS (arrange D/R)
  modifiedtime  text,                            -- (arrange C/Q)
  raw           jsonb       not null,
  synced_at     timestamptz not null default now(),
  primary key (lang, contentid)
);

create index if not exists tour_places_lang_sigungu_type_idx
  on public.tour_places (lang, sigungucode, contenttypeid);
create index if not exists tour_places_lang_cat3_idx
  on public.tour_places (lang, cat3);
create index if not exists tour_places_lang_title_idx
  on public.tour_places (lang, title);
create index if not exists tour_places_synced_at_idx
  on public.tour_places (lang, sigungucode, synced_at);

-- 시군·언어별 마지막 동기화 시각. 프록시는 이 표에 최근(7일 이내) 기록이 있는 시군만 DB 에서 응답하고,
-- 없으면 TourAPI 로 포워딩한다. 동기화 함수는 오래된 시군부터 처리한다.
create table if not exists public.tour_sync_state (
  lang        text        not null,
  sigungucode integer     not null,
  synced_at   timestamptz not null default now(),
  item_count  integer     not null default 0,
  primary key (lang, sigungucode)
);

alter table public.tour_places     enable row level security;
alter table public.tour_sync_state enable row level security;
-- 정책 없음 = anon/authenticated 거부. service_role 은 RLS 를 우회한다.
