# 쉼(休)마루 · Shimmaru

> 경상북도 전통문화 여행 코스 추천 PWA · 2026 관광데이터 활용 공모전 출품작

한옥·서원·사찰·전통체험·전통시장·향토축제를 하나의 흐름으로 잇는 다국어(한·영·일·중) 모바일 퍼스트 웹 서비스.

## 데이터 소스

| API | 용도 | 키 |
|---|---|---|
| 한국관광공사 TourAPI V2 | 장소·축제·상세·이미지 (`KorService2` / `EngService2` / `JpnService2` / `ChsService2`) | `TOUR_API_KEY` |
| Kakao Map JavaScript SDK | 지도 표시 | `VITE_KAKAO_MAP_KEY` |
| templestay.com (한국불교문화사업단) | 템플스테이 사찰 목록 + 사찰별 예약 페이지 | 키 불필요 (HTML 프록시) |

## 디렉터리 구조

```
/
├── frontend/        # React + Vite + TS + Tailwind 메인 앱
├── api/             # Vercel Edge Functions (운영 환경 프록시)
│   ├── tour/        # /api/tour/* → apis.data.go.kr 프록시 (TOUR_API_KEY 주입)
│   └── templestay/  # /api/templestay/* → templestay.com 프록시 (UA 위장)
├── vercel.json      # Vercel 빌드/리라이트 설정
└── shimmaru.md      # 요구사항 명세 (FR/SCR)
```

## 로컬 개발

```bash
cd frontend
cp .env.example .env.local
# .env.local 에 TOUR_API_KEY, VITE_KAKAO_MAP_KEY 입력 (frontend/README.md 참조)
npm install
npm run dev
```

Vite dev proxy 가 `/api/tour/*`, `/api/templestay/*` 를 외부 API 로 자동 포워딩.

## 배포 — Vercel (권장)

GitHub repo 를 Vercel 과 연결하면 자동 빌드·배포.

### 단계

1. https://vercel.com 가입/로그인 (GitHub 로그인 권장)
2. **New Project** → simsohyeon/Shimmaru import
3. **Root Directory**: `./` (루트 그대로 — vercel.json 이 frontend/ 빌드로 위임)
4. **Environment Variables** 입력:
   ```
   TOUR_API_KEY = (공공데이터포털 발급 일반 인증키 Decoding)
   VITE_KAKAO_MAP_KEY = (카카오 개발자 JavaScript 키)
   ```
   → `TOUR_API_KEY` 는 서버리스 함수에서만 사용되어 클라이언트 번들에 노출되지 않음
5. **Deploy**

### 배포 후 추가 설정

- **카카오 개발자 콘솔** → 플랫폼 → Web → 사이트 도메인에 Vercel 도메인 추가 (예: `https://shimmaru.vercel.app`)
  - 미등록 시 카카오 SDK 가 차단됨

## 기능 요약

- 장소 탐색 (8 카테고리: 한옥·템플스테이·서원·사찰·전통체험·시장·관광지·축제)
- 시군구 22개 필터 + 카테고리 필터 동시
- 카테고리별 정확한 `cat3` 분류 (한옥 B02011600 / 사찰 A02010800 / 전통체험 A0203 등)
- 페이지당 18개 + URL ?page=N 동기화 페이징
- 축제 상태(진행중·예정·종료) 자동 분류 + 종료 카드 마스크
- templestay.com 사찰 목록 + 사찰별 예약 페이지 직접 연결
- 한·영·일·중 다국어 (API 응답 + UI 동시 전환)
- 코스 자동 생성 (Haversine NN + 카테고리 가중치 + 숨겨진 지역 보너스)
- localStorage 찜·코스 (서버 전송 없음)

자세한 코드 구조는 `frontend/README.md`, 기능 명세는 `shimmaru.md` 참조.
