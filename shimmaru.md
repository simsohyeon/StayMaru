# Shimmaru (심마루)

한국 여행 코스 추천 서비스. 한국관광공사 OpenAPI를 기반으로 지역/기간을 선택하면 추천 코스를 자동 생성하고 지도에 표시하며, 찜·공유 기능을 제공한다.

## 아키텍처 개요

프론트엔드와 백엔드를 **분리형**으로 설계한다. MVP 1차는 프론트 단독으로 동작하고, 2차에서 백엔드 + DB를 붙이는 단계적 구조다.

```
[React SPA]  ──HTTPS──▶  [Spring Boot REST API]  ──▶  [MySQL / PostgreSQL]
     │                            │
     │                            └──▶  한국관광공사 OpenAPI (서버에서 프록시)
     │
     └──▶  Kakao Map JS SDK (브라우저 직접 호출)
```

- API Key는 **절대 프론트 코드에 노출하지 않는다.** 관광공사 OpenAPI 호출은 백엔드(또는 서버리스 프록시)를 통해서만 수행한다.
- Kakao Map JS SDK 키는 도메인 화이트리스트로 보호한다 (브라우저에서 직접 호출하는 키는 노출되므로 도메인 제한 필수).

## 기술 스택

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- Zustand (상태 관리)
- React Router
- Axios
- Kakao Map JavaScript API
- i18next (다국어)
- PWA

**모바일 퍼스트**로 작성한다.

### Backend
- Java 17+
- Spring Boot, Spring Web, Spring Data JPA
- Gradle
- Spring Security는 **로그인 기능 도입 시점에** 추가 (MVP에서는 미사용)

### Database
우선순위: **MySQL → PostgreSQL**
- 기본은 MySQL. 비용/배포 환경 제약이 있을 경우 PostgreSQL로 대체할 수 있도록 JPA 추상화 유지.
- 저장 대상: 사용자 저장 코스, 찜 목록, 공유 링크, 축제/장소 캐시, 관리자 통계.

### Deployment
- Frontend: Vercel 또는 Netlify
- Backend: Render, Railway, AWS EC2, Fly.io 중 비용·운영 편의에 따라 선택
- DB: 매니지드 MySQL 또는 PostgreSQL

## 개발 단계

### 1차 MVP — 프론트 단독
로그인 없음. **localStorage** 기반으로 빠르게 구현한다.

- React 화면 구성 (지역/기간 선택, 코스 결과, 지도)
- 관광공사 API 연동 (※ MVP 단계에서도 키 노출을 피하려면 간단한 서버리스 프록시 권장)
- 코스 자동 생성 로직
- Kakao Map 표시
- 찜 기능을 localStorage에 저장

> **중요:** localStorage 스키마는 추후 DB 컬럼과 1:1 매핑이 쉽도록 설계한다. (예: 코스 객체는 `id`, `regions`, `period`, `places[]`, `createdAt` 등 DB 친화적인 필드명으로.)

### 2차 — 백엔드 + DB
- Spring Boot REST API 구축
- 관광공사 OpenAPI 프록시 + 캐싱
- 코스/찜 서버 저장
- 공유 링크 생성·조회
- 관리자 대시보드 통계
- (옵션) AI 코스 생성 API 중계
- 추후 로그인 도입 시 Spring Security + 사용자 테이블 확장

## 백엔드 역할 (2차 단계)

- 한국관광공사 OpenAPI 프록시 — **API Key는 서버에만 보관**
- 장소/축제 데이터 캐싱 (DB)
- 사용자 저장 코스, 찜, 공유 링크 CRUD
- 관리자 통계 제공
- AI 코스 생성 API 중계 (외부 AI 사용 시)

## 작업 시 지켜야 할 원칙

1. **프론트엔드는 React 기반.** 다른 프레임워크로 변경하지 않는다.
2. **백엔드는 Java Spring Boot 기준.** Node/Python 등 다른 스택으로 갈아타지 않는다.
3. **DB는 MySQL 우선, PostgreSQL은 fallback.** JPA 사용으로 두 DB 간 전환 가능성을 항상 열어둔다.
4. **API Key를 프론트 번들에 포함하지 않는다.** `.env`의 `VITE_*` 변수도 빌드 결과물에 박히므로, 비밀 키는 백엔드/프록시 경유.
5. **localStorage → DB 마이그레이션이 쉬운 데이터 구조**를 처음부터 사용한다.
6. **모바일 퍼스트** — Tailwind의 모바일 기본값에서 시작해 `md:`, `lg:`로 확장.
7. 외부 호출(관광공사, Kakao, AI)은 **에러/타임아웃/빈 응답**을 가정한 UI 폴백을 갖춘다.

## 디렉터리 구조 (제안)

```
Shimmaru/
├── frontend/        # React + Vite + TS
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/        # Zustand
│   │   ├── api/           # Axios 클라이언트
│   │   ├── lib/           # localStorage 어댑터 등
│   │   └── i18n/
│   └── vite.config.ts
└── backend/         # Spring Boot (2차 단계에서 추가)
    └── src/main/java/...
```

## 외부 API 메모

- **한국관광공사 OpenAPI** — 공공데이터포털 발급 키 필요. 호출 한도/캐싱 전략을 고려해 백엔드 캐시 레이어를 둔다.
- **Kakao Map JavaScript API** — JS SDK 키는 카카오 개발자 콘솔에서 **사이트 도메인 등록** 필수. 등록되지 않은 도메인에서는 작동하지 않음.
- **AI API (optional)** — 코스 추천 품질을 높이기 위한 옵션. 키는 백엔드에서 관리, 프론트는 백엔드 엔드포인트만 호출.
