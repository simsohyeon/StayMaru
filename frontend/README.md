# 쉼(休)마루 — Frontend

React + Vite + TypeScript + Tailwind + Zustand + i18next 기반 모바일 우선 PWA.
한국관광공사 OpenAPI(국문·영문·일문·중문)와 카카오맵을 연동해 경상북도 전통문화 코스를 자동 설계한다.

## 빠른 시작

```bash
cp .env.example .env.local
# .env.local 에 TOUR_API_KEY 와 VITE_KAKAO_MAP_KEY 설정 (아래 발급 가이드 참조)
npm install
npm run dev
```

API 키가 없어도 mock 데이터로 모든 화면이 동작합니다(`src/constants/mockData.ts`).
키를 넣지 않은 채로 dev 서버를 띄우면 브라우저 콘솔에 폴백 사유가 출력됩니다.

---

## API 키 발급 가이드

### 1) 한국관광공사 TourAPI (필수)

1. 공공데이터포털 회원가입: <https://www.data.go.kr>
2. 검색창에 **"한국관광공사_국문 관광정보 서비스_GW"** 입력 → 첫 결과 클릭
3. 우측 상단 **"활용신청"** → 활용목적 입력(예: "개인 프로젝트 — 경북 관광 코스 추천 서비스 개발") → 신청.
   - **TourAPI(GW) 계열은 자동 승인**이라 즉시 키가 발급됩니다.
4. 마이페이지 → **개발계정 상세보기** → **일반 인증키(Decoding)** 복사.
   - "Encoding" 키가 아니라 **Decoding** 키여야 합니다. `URLSearchParams`가 인코딩을 자동으로 처리합니다.
5. 같은 화면에서 영문/일문/중문 서비스도 함께 활용신청해두면 다국어 전환 시 바로 동작합니다.
   - "한국관광공사_영문 관광정보 서비스_GW" / "_일본어_GW" / "_중국어 간체_GW".

> 발급된 키는 보통 100~150자의 영숫자/특수문자 혼합 문자열입니다 (예: `abc...xyz==`).

### 2) Kakao Map JavaScript API (필수 — 지도 표시용)

1. 카카오 개발자 계정 생성: <https://developers.kakao.com>
2. **내 애플리케이션 → 애플리케이션 추가하기** → 앱 이름 "shimmaru" (자유) → 저장
3. 좌측 **앱 키** 메뉴 → **JavaScript 키** 복사 (보통 32자리 영숫자)
4. 좌측 **플랫폼** 메뉴 → **Web 플랫폼 등록** → 사이트 도메인에 아래를 모두 입력:
   ```
   http://127.0.0.1:5173
   http://localhost:5173
   ```
   - **도메인 등록 없이는 SDK가 로드되지 않습니다.** 콘솔에 도미인 미등록 에러가 보입니다.
   - 운영 도메인을 정한 뒤에는 운영 도메인도 추가해야 합니다.

### 3) `.env.local` 작성

`frontend/.env.local` 파일을 만들고:

```env
# 관광공사 (Decoding 키)
TOUR_API_KEY=여기에_관광공사_일반인증키_Decoding_붙여넣기

# 카카오 (JavaScript 키)
VITE_KAKAO_MAP_KEY=여기에_카카오_JS_키_붙여넣기
```

> ⚠️ **이름이 중요합니다.**
> - `TOUR_API_KEY` 는 `VITE_` 접두 **없이** — Vite dev 프록시 서버에서만 읽혀서 클라이언트 번들에 노출되지 않습니다.
> - `VITE_KAKAO_MAP_KEY` 는 `VITE_` 접두 **있음** — 브라우저에서 직접 호출하므로 어차피 노출됩니다. 카카오 콘솔의 도메인 화이트리스트로 보호하세요.

### 4) dev 서버 재시작

```bash
# 실행 중이면 Ctrl+C 후
npm run dev
```

Vite는 `.env.local` 변경을 hot-reload 하지 않으므로 **반드시 재시작** 필요합니다.

### 5) 동작 확인

- 브라우저 콘솔(F12)에 `[tour:*]` 또는 `[kakao]` 경고가 보이지 않으면 정상 연동입니다.
- 콘솔에 다음과 같이 보이면 가이드 메시지대로 조치:
  - `[tour:searchPlaces] ... resultCode=30 ... TOUR_API_KEY 가 등록되지 않았거나` → 키 미설정 또는 오타
  - `[kakao] SDK 스크립트 로드 실패. ...` → 도메인 미등록 또는 키 오타

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Vite 개발 서버 (http://localhost:5173) |
| `npm run build` | 타입체크 + 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint |

## 폴더 구조

```
src/
├── api/             # 한국관광공사 API 클라이언트 + IndexedDB 캐시
├── components/      # AppShell, TopBar, KakaoMap, PlaceCard, CategoryBadge
├── constants/       # 카테고리·시군구·코스 유형 가중치·mock 데이터
├── i18n/            # 한국어/영어/일본어/중국어 리소스
├── lib/             # geo (Haversine), courseEngine (NN + 가중치), share
├── pages/           # SCR-01 ~ SCR-12 (히트맵 제거 후 결번 유지)
├── stores/          # Zustand: settings, favorites, courses, location
├── types/           # 도메인 타입 (DB 마이그레이션 친화)
└── routes.tsx       # React Router v6
```

## 핵심 매핑 (요구사항 ↔ 코드)

| ID | 요구사항 | 구현 위치 |
|---|---|---|
| FR-01 | 지역 선택 | `pages/Home.tsx`, `pages/Regions.tsx` |
| FR-02 | 여행 기간 | `pages/Home.tsx` |
| FR-03 | 코스 자동 생성 | `lib/courseEngine.ts#generateCourse` |
| FR-04 | 소외 지역 가중치 | `constants/sigungu.ts#hiddenBoost` + 엔진 `scoreOf` |
| FR-06 | 지도 동선 | `components/KakaoMap.tsx` (Kakao SDK + SVG 폴백) |
| FR-07/20 | 장소 상세 | `pages/PlaceDetail.tsx` |
| FR-08 | 예약 링크 | `Place.bookingUrl` 필드 |
| FR-09 | 다국어 | `i18n/*` + API 언어 자동 전환 (`api/tour.ts` LANG_PATH) |
| FR-10 | 찜 | `stores/favorites.ts` (localStorage persist) |
| FR-11 | 공유 | `lib/share.ts` + `/course/shared/:payload` |
| FR-12 | 운영 대시보드 | `pages/Admin.tsx` (스텁) |
| FR-13/14 | 카테고리·키워드 탐색 | `pages/Explore.tsx`, `api/tour.ts#searchPlaces` |
| FR-15/16 | 축제 + 기간 매칭 | `pages/Festivals.tsx`, `api/tour.ts#searchFestivals` |
| FR-17 | 찜 기반 AI 코스 | `pages/Favorites.tsx`, 엔진의 favorite 가중치 |
| FR-18 | 동선 최적화 | `lib/courseEngine.ts#nearestNeighborOrder` |
| FR-19 | 코스 편집 | `pages/CourseEdit.tsx` (dnd-kit) |
| FR-21 | 코스 유형 | `constants/categories.ts#PROFILE_WEIGHTS` |
| FR-22 | 주변 추천 | `api/tour.ts#searchAround` + `stores/location.ts` |
| FR-23 | 코스 저장/재사용 | `stores/courses.ts` |
| FR-24 | 축제 주변 연계 | `pages/FestivalDetail.tsx` |

NFR-P03 (API 실패 시 캐시 폴백) → `lib/cache.ts` (idb-keyval, 24h TTL).
NFR-S01 (API 키 비노출) → Vite dev proxy + 운영 시 `VITE_TOUR_PROXY_BASE`.

## 보안 — API 키

- **`TOUR_API_KEY`** (관광공사) — 접두 없이 두어 **클라이언트 번들에 들어가지 않는다**.
  - 개발: `vite.config.ts`의 dev proxy(`/api/tour`)가 키를 주입해 `apis.data.go.kr`로 포워드.
  - 운영: Vercel/Netlify Edge Function 같은 서버리스 프록시를 같은 경로에 배치.
- **`VITE_KAKAO_MAP_KEY`** — JS SDK는 브라우저에서 직접 호출하므로 키 자체는 노출됨.
  반드시 카카오 개발자 콘솔에서 **사이트 도메인 화이트리스트**로 보호.

## 알려진 환경 이슈 — Windows + 한글 경로에서 `npm run build`

프로젝트 경로(`D:\심소현\개인\Shimmaru`)에 한글이 포함되어 있으면 Vite 빌드가
`STATUS_STACK_BUFFER_OVERRUN` (exit -1073740791)로 멈추는 현상이 있다.

- 원인: Rollup의 사전 컴파일 윈도우 네이티브 바이너리가 한글 경로에서 충돌한다.
  모듈 transform(`164 modules transformed`)까지는 통과한 뒤 chunk render 단계에서 죽는다.
- **`npm run dev` 는 영향 없음** — esbuild 기반이라 정상 동작.
- **`tsc -b` 타입체크는 통과** — 코드 자체는 문제 없음.
- ASCII 경로에서 빌드 통과 확인: 약 2.3초, 480KB(gzip 159KB).

해결 방법(택1):

1. **권장:** 배포 빌드는 Vercel/Netlify/GitHub Actions에서 — 해당 환경은 ASCII 경로.
2. 로컬 빌드가 필요하면 프로젝트를 임시로 ASCII 경로(`C:\dev\Shimmaru` 등)에
   복사 후 빌드.
3. `scripts/patch-rollup-native.cjs` (postinstall) 가 `@rollup/wasm-node` 폴백을
   자동 적용한다 — 향후 Rollup 버전이 다른 native 호출까지 WASM 경로를 타게
   되면 이 패치만으로 충분해질 수 있다.
