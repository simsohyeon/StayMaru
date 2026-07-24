import type { SVGProps } from 'react'

/**
 * 내비게이션/유틸 아이콘 — 24px 그리드, 1.75px 스트로크, currentColor.
 *
 * 유니코드 글리프(○ ◇ ✦ ♡ ✎ ⚙)는 기기 폰트에 따라 컬러 이모지로 바뀌거나
 * 굵기·광학 크기가 제각각으로 렌더돼 완성도를 깎는다. 인라인 SVG 로 통일해
 * 어느 플랫폼에서든 같은 선 굵기·같은 크기로 그려지게 한다.
 * 색은 currentColor — 활성/비활성 상태는 부모의 text 색을 그대로 따른다.
 */

type IconProps = SVGProps<SVGSVGElement>

function Svg(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    />
  )
}

/** 홈 — 지붕 + 몸체 */
export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 11.2 12 4.6l8 6.6" />
      <path d="M6.4 10.4V19h11.2v-8.6" />
    </Svg>
  )
}

/** 탐색 — 나침반 */
export function ExploreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M14.9 9.1 13.2 13l-3.9 1.7L11 10.9z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 축제 — 깃발 */
export function FestivalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 21V4" />
      <path d="M6 5.1c2.1-1 4.1-1 6.1.1 1.9 1 3.7 1.1 5.9.2v7c-2.2.9-4 .8-5.9-.2-2-1.1-4-1.1-6.1-.1z" />
    </Svg>
  )
}

/** 데이터 — 막대 3개 */
export function InsightsIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.2">
      <path d="M5.5 20v-7" />
      <path d="M12 20V5.5" />
      <path d="M18.5 20v-4.5" />
    </Svg>
  )
}

/** 찜/투표 — 하트. filled 로 채움/윤곽 전환(별점 StarIcon과 동일 패턴) */
export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 20.1C7 16.5 3.7 13.4 3.7 10c0-2.4 1.9-4.3 4.3-4.3 1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.4 0 4.3 1.9 4.3 4.3 0 3.4-3.3 6.5-8.3 10.1z" />
    </Svg>
  )
}

/** 기록 — 펜 */
export function JournalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 19.5l.9-3.7L16.6 4.6a2 2 0 0 1 2.8 2.8L8.2 18.6l-3.7.9z" />
      <path d="M14.7 6.5l2.8 2.8" />
    </Svg>
  )
}

/** 설정 — 조절 슬라이더 */
export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h16" />
      <circle cx="9.2" cy="8" r="2.1" fill="#fff" />
      <path d="M4 16h16" />
      <circle cx="14.8" cy="16" r="2.1" fill="#fff" />
    </Svg>
  )
}

/** 자차 — 측면 실루엣 */
export function CarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 13.5l1.4-4.2A2 2 0 0 1 6.8 8h10.4a2 2 0 0 1 1.9 1.3l1.4 4.2" />
      <path d="M3.5 13.5h17V17a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-.6H6.8V17a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z" />
      <path d="M6.8 15.2h.01M17.2 15.2h.01" />
    </Svg>
  )
}

/** 대중교통 — 버스 정면 */
export function TransitIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="4" width="14" height="14" rx="2.5" />
      <path d="M5 12h14" />
      <path d="M8.5 15.2h.01M15.5 15.2h.01" />
      <path d="M7.5 18.5V20M16.5 18.5V20" />
    </Svg>
  )
}

/** 편집 — 연필(작은 힌트용) */
export function PencilIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 19.5l.9-3.7L16.6 4.6a2 2 0 0 1 2.8 2.8L8.2 18.6l-3.7.9z" />
      <path d="M14.7 6.5l2.8 2.8" />
    </Svg>
  )
}

/** 경로 재최적화 — 굽은 동선 + 진행 화살표 */
export function RouteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="18" r="1.6" fill="currentColor" stroke="none" />
      <path d="M6 16.4V10a3 3 0 0 1 3-3h5" />
      <path d="M11.5 4.5 15 7l-3.5 2.5" />
    </Svg>
  )
}

/** 완료 — 체크 */
export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2.2">
      <path d="M5 12.5l4.2 4.3L19 7.2" />
    </Svg>
  )
}

/** 닫기 — X */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  )
}

/** 경고 — 삼각형 느낌표 */
export function WarningIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.2 21 19.5H3z" />
      <path d="M12 10.2v4M12 16.8h.01" />
    </Svg>
  )
}

/** 위치 — 핀 */
export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.1" />
    </Svg>
  )
}

/** 무장애 — 휠체어 */
export function AccessibleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5.3" r="1.6" fill="currentColor" stroke="none" />
      <path d="M11 8v4.2l4.3 1.6M11 12.2H7.2M11 8H9" />
      <path d="M8.5 12.2 7 18.7a3 3 0 1 0 5.9.9" />
      <path d="M15.3 13.8 17 18.7h2" />
    </Svg>
  )
}

/** 시장/쇼핑 — 바구니 */
export function MarketIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 9.5h14l-1.4 9.3a2 2 0 0 1-2 1.7H8.4a2 2 0 0 1-2-1.7z" />
      <path d="M8.5 9.5 9.8 5h4.4l1.3 4.5" />
    </Svg>
  )
}

/** 추천/하이라이트 — 반짝임 */
export function SparkleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5c.5 3 2 4.5 5 5-3 .5-4.5 2-5 5-.5-3-2-4.5-5-5 3-.5 4.5-2 5-5z" />
      <path d="M19 15.5c.25 1.4.95 2.1 2.3 2.3-1.4.25-2.05.95-2.3 2.3-.25-1.4-.95-2.05-2.3-2.3 1.4-.25 2.05-.95 2.3-2.3z" />
    </Svg>
  )
}

/** 지도 */
export function MapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4.5 4.5 6v13.5L9 18l6 1.5 4.5-1.5V4.5L15 6 9 4.5z" />
      <path d="M9 4.5V18M15 6v13.5" />
    </Svg>
  )
}

/** 문서/일정표 */
export function DocumentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3.5h7.3L18 7.2V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V7.2h3.7" />
      <path d="M8.7 12h6.6M8.7 15.4h6.6M8.7 18.8h4" />
    </Svg>
  )
}

/** 한적함/숨은지역 — 나뭇잎 */
export function LeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 19c-1.5-6.5 2-13 12.5-14C19.5 15 13 19 6 19z" />
      <path d="M6.5 18.5c2.7-3.4 5.4-6 9.3-9.6" />
    </Svg>
  )
}

/** 선물/리워드 */
export function GiftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="9.5" width="16" height="4" rx="0.6" />
      <rect x="5.3" y="13.5" width="13.4" height="7" rx="0.6" />
      <path d="M12 9.5V20.5" />
      <path d="M12 9.5C9.5 9.5 8 8.3 8 6.6 8 5.2 9 4 10.3 4c1.8 0 2.7 2.3 1.7 5.5zM12 9.5c2.5 0 4-1.2 4-2.9 0-1.4-1-2.6-2.3-2.6-1.8 0-2.7 2.3-1.7 5.5z" />
    </Svg>
  )
}

/** 사진/이미지 */
export function ImageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.6" />
      <circle cx="8.6" cy="9.6" r="1.6" />
      <path d="M4 17.5 9 12l3.5 3.5 2.5-2.7 5 4.7" />
    </Svg>
  )
}

/** 일정/달력 */
export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.6" />
      <path d="M4 10h16M8 3.5v3.5M16 3.5v3.5" />
    </Svg>
  )
}

/** 사찰예절 — 연꽃 */
export function LotusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20c-4-1.4-6.5-3.8-6.5-6.6 2.4.4 4.6 1.7 6.5 4 1.9-2.3 4.1-3.6 6.5-4 0 2.8-2.5 5.2-6.5 6.6z" />
      <path d="M12 17.4c-1.4-3.4-1.3-6.4.1-9.7 1.4 3.3 1.5 6.3.1 9.7z" />
    </Svg>
  )
}

/** 철도/기차 */
export function TrainIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5.5" y="4.5" width="13" height="12" rx="3" />
      <path d="M5.5 11h13M9 4.5v6.5M15 4.5v6.5" />
      <path d="M8 20 6.3 17.5M16 20l1.7-2.5" />
      <circle cx="8.7" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.3" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 협업/함께 — 맞잡은 두 곡선 */
export function HandshakeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 12.5 8 9l3 2 3-2 4.5 3.5" />
      <path d="M8 9l3.2 6.3a1.4 1.4 0 0 0 2.1.5l.5-.4a1.4 1.4 0 0 0 .4-1.9l-.8-1.4" />
      <path d="M16.5 12.5l-1 1.8a1.3 1.3 0 0 1-2 .4" />
    </Svg>
  )
}

/** 공유 링크 */
export function LinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 8l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7L15.7 12.7" />
      <path d="M13 16l-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7L8.3 11.3" />
    </Svg>
  )
}

/** 복사 — 클립보드 */
export function ClipboardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="5.5" width="12" height="15" rx="1.6" />
      <rect x="9" y="3.5" width="6" height="3.2" rx="0.9" />
      <path d="M9 11.5h6M9 15h6" />
    </Svg>
  )
}

/** 참여 코드 — 열쇠 */
export function KeyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="15.8" r="3.3" />
      <path d="M10.2 13.6 18.5 5.3M16.3 7.5l2 2M13.6 10.2l1.6 1.6" />
    </Svg>
  )
}

/** 초기화 — 휴지통 */
export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 7.5h14M9.5 7.5V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.5" />
      <path d="M7 7.5 7.8 19a1.6 1.6 0 0 0 1.6 1.5h5.2a1.6 1.6 0 0 0 1.6-1.5l.8-11.5" />
      <path d="M10.3 11v6M13.7 11v6" />
    </Svg>
  )
}

/** 전화 */
export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 4.5h3l1.2 4-2 1.5a11 11 0 0 0 5.3 5.3l1.5-2 4 1.2v3a1.6 1.6 0 0 1-1.7 1.6A15.5 15.5 0 0 1 4.4 6.2 1.6 1.6 0 0 1 6 4.5z" />
    </Svg>
  )
}

/** 한옥 — 처마 지붕 */
export function HanokIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.2 11.5c2.4-3.4 5.3-5.4 8.8-6 3.5.6 6.4 2.6 8.8 6" />
      <path d="M5.4 11v8.5h13.2V11" />
      <path d="M9.5 19.5V14h5v5.5" />
    </Svg>
  )
}

/** 평화/비둘기 */
export function DoveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13.5c2.3-3 5-3.6 7-2 .6-2 2.3-3.4 4.4-3.4-1 1.6-1.2 3-.6 4.3 2 .3 3.6 1.6 4.2 3.6-2.4-.9-4.3-.7-6 .6-2.3 1.8-5 2-7.6.9 1.7-.5 2.8-1.4 3.4-2.7-1.9.2-3.5-.3-4.8-1.3z" />
      <circle cx="16.3" cy="8.8" r="0.6" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 서원/두루마리 */
export function ScrollIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 5.5h11a1.8 1.8 0 0 1 0 3.6H8" />
      <path d="M6.5 5.5a1.8 1.8 0 0 0 0 3.6h11" />
      <path d="M17.5 9.1v9.4h-11a1.8 1.8 0 0 1 0-3.6" />
      <path d="M17.5 18.5a1.8 1.8 0 0 0 0-3.6H8" />
    </Svg>
  )
}

/** 소나무/숲 */
export function TreeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.8 16.8 11h-2.4l3.6 5.6H14v4.6h-4v-4.6H6.6L10.2 11H7.8z" />
    </Svg>
  )
}

/** 다도/체험 — 찻잔 */
export function TeaIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 10h11v5.5A3.5 3.5 0 0 1 12.5 19h-4A3.5 3.5 0 0 1 5 15.5z" />
      <path d="M16 11.2h1.3a2.3 2.3 0 0 1 0 4.6H16" />
      <path d="M8.5 7c-.5-1 .1-1.6.4-2.3M11.3 7c-.5-1 .1-1.6.4-2.3" />
    </Svg>
  )
}

/** 해안/파도 */
export function WaveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.5c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0" />
      <path d="M3.5 15c1.8-1.6 3.6-1.6 5.4 0s3.6 1.6 5.4 0 3.6-1.6 5.4 0" />
    </Svg>
  )
}

/** 사찰/신사 — 도리이 */
export function TempleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8.5c2.7-1.8 5-2.7 8-2.7s5.3.9 8 2.7" />
      <path d="M5.5 6.2v14.3M18.5 6.2v14.3" />
      <path d="M3 10.8h18" />
    </Svg>
  )
}

/** 전통체험 — 공방 물레 */
export function ExperienceIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="13" r="6.3" />
      <path d="M12 13 15.8 9.5" />
      <path d="M9 4.2c1-.5 2-.7 3-.7s2 .2 3 .7" />
    </Svg>
  )
}

/** 맛집 — 포크&나이프 */
export function RestaurantIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3.5v7a2 2 0 0 0 4 0v-7M9 3.5v17M7 6.5v2.4M11 6.5v2.4" />
      <path d="M16.5 3.5c-1.6 0-2.5 1.6-2.5 4.3 0 2 1 3.3 2 3.7v9" />
    </Svg>
  )
}

/** 둘레길 — 등산화/오솔길 */
export function TrailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20c1.5-4 3-6 3-9a3 3 0 0 1 6 0c0 2.4-1 3.7-1 5.5 0 2 1.5 3.5 4 3.5" />
      <circle cx="7" cy="6.3" r="1.7" />
      <circle cx="17" cy="10" r="1.4" />
    </Svg>
  )
}

/** 명상/수행 */
export function MeditateIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="6.3" r="2.1" />
      <path d="M5.5 18.5c0-3 2.6-5.3 6.5-5.3s6.5 2.3 6.5 5.3" />
      <path d="M4 18.5h16" />
    </Svg>
  )
}

/** 계곡/풍경 */
export function LandscapeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 18.5 8.5 10l3.3 4.3L14.5 11l6.5 7.5z" />
      <circle cx="16.5" cy="6.5" r="1.8" />
    </Svg>
  )
}

/** 전통/유산 — 인장 */
export function HeritageIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 12h6M12 9v6" />
    </Svg>
  )
}

/** 밤하늘/별 */
export function StarsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 5.5c.35 1.7 1.15 2.5 2.9 2.9-1.75.35-2.55 1.15-2.9 2.9-.35-1.75-1.15-2.55-2.9-2.9 1.75-.4 2.55-1.2 2.9-2.9z" />
      <path d="M16.5 11c.5 2.4 1.7 3.6 4.1 4.1-2.4.5-3.6 1.7-4.1 4.1-.5-2.4-1.7-3.6-4.1-4.1 2.4-.5 3.6-1.7 4.1-4.1z" />
    </Svg>
  )
}

/** 다리/연결 */
export function BridgeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 15c2-3 5-4.5 9-4.5s7 1.5 9 4.5" />
      <path d="M3 15v4M21 15v4" />
      <path d="M7.5 12.3V16M16.5 12.3V16" />
    </Svg>
  )
}

/** 도자기/공예 */
export function PotteryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 4.5h8M9 4.5v3.3c0 1-1.5 1.7-1.5 4.2 0 3.6 1.8 6.5 4.5 6.5s4.5-2.9 4.5-6.5c0-2.5-1.5-3.2-1.5-4.2V4.5" />
    </Svg>
  )
}

/** 탈춤/전통연희 — 가면 */
export function MaskIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 9.5c0-3.6 3.3-6 7.5-6s7.5 2.4 7.5 6c0 4.3-3 8.2-7.5 8.2s-7.5-3.9-7.5-8.2z" />
      <path d="M9 9.3h.01M15 9.3h.01" />
      <path d="M9 13.2c1 .8 5 .8 6 0" />
    </Svg>
  )
}

/** 벚꽃 */
export function CherryBlossomIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7.5" r="2.6" />
      <circle cx="7" cy="12" r="2.6" />
      <circle cx="17" cy="12" r="2.6" />
      <circle cx="9.3" cy="17" r="2.6" />
      <circle cx="14.7" cy="17" r="2.6" />
    </Svg>
  )
}

/** 단풍 */
export function MapleLeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5v4.3M12 3.5 9.7 6.6M12 3.5l2.3 3.1" />
      <path d="M12 7.8 6 11l2.7.6-1.3 2.6L12 12.5l2.6 1.7-1.3-2.6L18 11z" />
      <path d="M12 12.5V20.5" />
    </Svg>
  )
}

/** 눈/설경 */
export function SnowflakeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5v17M4.5 8l15 8M19.5 8l-15 8" />
      <path d="M12 3.5 9.8 5.7M12 3.5l2.2 2.2M12 20.5l-2.2-2.2M12 20.5l2.2-2.2" />
    </Svg>
  )
}

/** 야경/달 */
export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18.5 14.8A7.5 7.5 0 1 1 9.2 5.5a6 6 0 0 0 9.3 9.3z" />
    </Svg>
  )
}

/** 일출 */
export function SunriseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v3.5M5.5 9.5l1.8 1.8M18.5 9.5l-1.8 1.8" />
      <path d="M7 16a5 5 0 0 1 10 0" />
      <path d="M3 16h18M3 19.5h18" />
    </Svg>
  )
}

/** 아이 동반 */
export function KidIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="6" r="2.4" />
      <path d="M7 20v-4.3a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3V20" />
      <path d="M9 20v-3M15 20v-3" />
    </Svg>
  )
}

/** 부모님 동반 */
export function ElderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5.5" r="2.4" />
      <path d="M12 7.9v5.4M12 13.3l-3.3 6.7M12 13.3l3.3 6.7" />
      <path d="M8.7 10.5h6.6" />
    </Svg>
  )
}

/** 혼자 여행 */
export function WalkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="13.3" cy="5" r="2" />
      <path d="M11 8.5 8.5 12l2 2-1 6M11 8.5l3 1.8-.7 3.7 3.2 2" />
    </Svg>
  )
}

/** 혼자 */
export function SoloIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7" r="2.6" />
      <path d="M6.5 20v-2.2a5.5 5.5 0 0 1 11 0V20" />
    </Svg>
  )
}

/** 친구들 */
export function FriendsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="7.3" r="2.3" />
      <circle cx="16" cy="8.3" r="2" />
      <path d="M4.5 19.5v-1.7a4.5 4.5 0 0 1 9 0v1.7" />
      <path d="M14.3 19.5v-1.3a3.8 3.8 0 0 1 5.7-3.3" />
    </Svg>
  )
}

/** 연인 */
export function CoupleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8.5" cy="7" r="2.3" />
      <circle cx="15.5" cy="7" r="2.3" />
      <path d="M4.5 19.5v-1.5a4 4 0 0 1 8 0M19.5 19.5v-1.5a4 4 0 0 0-6.2-3.3" />
      <path d="M12 12.2c-1.4-1.3-3.2-.4-3.2 1.1 0 1.4 1.5 2.5 3.2 4 1.7-1.5 3.2-2.6 3.2-4 0-1.5-1.8-2.4-3.2-1.1z" fill="currentColor" stroke="none" />
    </Svg>
  )
}

/** 반려동물 */
export function PetIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6.3" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17.7" cy="11" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 12.3c-2.7 0-4.6 1.8-4.6 3.9 0 1.5 1.2 2.3 2.5 1.8.8-.3 1.4-.6 2.1-.6s1.3.3 2.1.6c1.3.5 2.5-.3 2.5-1.8 0-2.1-1.9-3.9-4.6-3.9z" />
    </Svg>
  )
}

/** 유모차 */
export function StrollerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 8.5h3.5l3.5 6.5H8.2z" />
      <path d="M9.5 8.5c3-3 6.8-3.5 9-2" />
      <circle cx="8.5" cy="18" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
      <path d="M13 15h3.5" />
    </Svg>
  )
}

/** 신용카드 */
export function CardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6" width="17" height="12.5" rx="1.8" />
      <path d="M3.5 10.2h17" />
      <path d="M6.5 14.5h4" />
    </Svg>
  )
}

/** 발자국/반려동물 동반 */
export function PawIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="15" r="3.4" />
      <circle cx="6.3" cy="9.5" r="1.7" />
      <circle cx="17.7" cy="9.5" r="1.7" />
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
    </Svg>
  )
}

/** 외부 링크 */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5.5H6.5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V15.5" />
      <path d="M13.5 4.5H19.5V10.5" />
      <path d="M10.5 13.5 19.5 4.5" />
    </Svg>
  )
}

/** QR 코드 */
export function QrIcon(props: IconProps) {
  return (
    <Svg {...props} strokeWidth="1.5">
      <rect x="4" y="4" width="6" height="6" rx="0.8" />
      <rect x="14" y="4" width="6" height="6" rx="0.8" />
      <rect x="4" y="14" width="6" height="6" rx="0.8" />
      <path d="M14.5 14.5h2.2M17.8 14.5h2.2M14.5 17.5h2.2M14.5 20h5.5M17.8 20v-2.5M20 14.5v3" />
    </Svg>
  )
}

/** 홈 화면에 추가 — 휴대폰 */
export function MobileIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2.2" />
      <path d="M10.5 18h3" />
    </Svg>
  )
}

/** 별점 — 채움/빈 상태 */
export function StarIcon({ filled = true, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 4.3l2.2 4.7 5 .6-3.7 3.5.9 5.1L12 15.8l-4.4 2.4.9-5.1-3.7-3.5 5-.6z" />
    </Svg>
  )
}
