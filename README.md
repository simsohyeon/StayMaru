# 쉼(休)마루 · Shimmaru

> 경상북도 전통문화 여행 코스 추천 웹앱 · **2026 관광데이터 활용 공모전(웹·앱 개발 부문)** 출품작

한옥·서원·사찰·전통체험·전통시장·향토축제를 하나의 흐름으로 잇는 다국어(한·영·일·중) 모바일 퍼스트 PWA.
지역·기간·취향을 고르면 **실제 관광 데이터**에 근거해 동선까지 최적화한 코스를 자동 생성합니다.

🔗 https://shimmaru.vercel.app/

---

## 왜 경상북도인가 — 지역특화

군위 편입 이후 22개 시군. 안동·경주 같은 대표 도시부터 봉화·영양·청송 같은 한적한 내륙까지,
경북은 전통문화 자원의 밀도가 전국에서 가장 높으면서도 방문이 특정 지역에 쏠립니다.
쉼마루는 **숨은 시군을 데이터로 끌어올리는 것**을 핵심 가치로 삼아, 분산된 전통문화 공간을
거점·기간·날씨·취향 기반으로 한 코스로 엮습니다.

## 한국관광공사 OpenAPI 활용 (데이터 활용도)

핵심은 **단순 목록 조회를 넘어선 데이터의 조합·재가공**입니다.

| 구분 | 사용 서비스 / 오퍼레이션 | 활용 |
| --- | --- | --- |
| 관광정보(국·영·일·중) | `KorService2` 외 `areaBasedList2` · `searchKeyword2` · `locationBasedList2` · `detailCommon2` · `detailIntro2` · `detailImage2` | 장소·검색·주변·상세·갤러리, 4개 언어 자동 전환 |
| 무장애 여행 | `KorWithService2` `areaBasedList2` · `detailWithTour2` | 휠체어·유모차 등 접근성 필터/상세 (배리어프리 코스) |
| **관광지 연관 추천(빅데이터)** | `TarRlteService1` `keywordBasedList1` · `areaBasedList1` | **"함께 찾은 곳"** — 실제 동반 방문 패턴 기반 추천 |
| **한국관광 데이터랩(빅데이터)** | `DataLabService` `locgoRegnVisitrDDList` | **시군별 방문자 통계** 대시보드(`/insights`) |
| 행사·축제 | 행정안전부 **문화축제 표준데이터** + TourAPI 이미지 풀 보강 | 진행/예정/종료 상태 캘린더 |

> 빅데이터 두 서비스(`TarRlteService`·`DataLabService`)는 같은 인증키로 **무료 추가 활용신청**만
> 하면 켜집니다. 미신청 상태에서도 앱은 정상 동작(연관추천 자동 숨김, `/insights` 활용신청 안내)하며,
> 승인 후 실데이터가 자동으로 채워집니다. 가짜/목업 데이터는 사용하지 않습니다.
> 신청 방법은 `frontend/.env.example` 주석 참고.

## 데이터 기반 핵심 기능

- **코스 자동 생성 엔진** — 카테고리 가중치 × 거점 반경 감점 × 숨은지역 보너스 × 찜 가중치 ×
  **강수확률(기상청)** 가중치를 결합해 점수화 → 카테고리 다양성 보장 → 최근접 클러스터 동선 정렬.
- **함께 찾은 곳** — 관광지 상세에서 빅데이터 연관 추천을 칩으로 노출, 탭하면 그 장소로 탐색 연결.
- **경북 데이터 인사이트(`/insights`)** — 시군별 방문자 랭킹 + 빅데이터 주목 관광지.
- **무장애 여행 모드** — 접근성 등록 장소만 필터.
- **다국어 + PWA** — 4개 언어, 오프라인 폴백, 홈 화면 추가.

## 기술 스택

React 19 · TypeScript · Vite 7 · Tailwind · Zustand · React Router · i18next ·
Kakao Map JS SDK · vite-plugin-pwa · idb-keyval(캐시).

API 키는 프론트 번들에 노출하지 않습니다 — dev는 Vite 프록시, 운영은 Vercel Edge Function이
`serviceKey`를 주입합니다(`api/tour.ts`).

## 로컬 실행

```bash
cd frontend
cp .env.example .env.local   # TOUR_API_KEY, VITE_KAKAO_MAP_KEY 입력
npm install
npm run dev                  # http://localhost:5173 (Kakao 콘솔에 5173 등록 필요)
```

## 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/)

Vercel 환경변수에 `TOUR_API_KEY`, `FESTIVAL_STD_API_KEY` 설정 → `frontend` 디렉터리 빌드.
