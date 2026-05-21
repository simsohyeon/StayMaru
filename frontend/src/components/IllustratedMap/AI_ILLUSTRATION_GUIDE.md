# AI 일러스트 생성 → 교체 가이드

`GyeongbukSvg.tsx` 의 mock 일러스트를 AI 가 생성한 실제 일러스트로 갈아끼우는 절차.

핀(`Place`) 좌표는 **위경도 ↔ 일러스트 픽셀 변환** 기반이라, 새 일러스트가 같은 bounding box 를 따라 그려져 있기만 하면 핀이 알아서 맞는 자리에 떨어진다.

## 1. 일러스트가 따라야 할 조건

| 항목 | 값 | 비고 |
|---|---|---|
| 좌표계 | 정사영 (top-down) | 위성지도와 같은 위에서 본 시점 |
| 좌상단 모서리 | 위경도 **(37.10°N, 128.00°E)** | `MAINLAND_BBOX.north`, `MAINLAND_BBOX.west` |
| 우하단 모서리 | 위경도 **(35.50°N, 129.55°E)** | `MAINLAND_BBOX.south`, `MAINLAND_BBOX.east` |
| 가로:세로 비율 | 약 **0.79 : 1** (800 × 1010) | 위경도 1.55° × 1.60° 의 km 비율 |
| 울릉/독도 | 일러스트에 **포함하지 말 것** | 별도 inset (`UlleungInset.tsx`) 으로 처리 |
| 시·군 행정경계 | 정확하지 않아도 OK | 인식 가능한 수준이면 충분 |

## 2. Midjourney / DALL·E / Sora 프롬프트 (모던 동양화 톤)

복사해서 그대로 쓰거나 살짝 조정. 영문/한국어 모두 첨부.

### 영문 (Midjourney 권장)

```
Top-down illustrated map of Gyeongsangbuk-do province in South Korea, modern Korean ink-wash painting style (현대 수묵화), aerial bird's-eye view, subtle Hanji paper texture background in warm cream beige (#f4ecd8), soft pastel color zones for 22 cities and counties — muted olive for northern mountains (Bonghwa, Yeongyang, Yeongju, Mungyeong, Yecheon, Sangju), warm beige for central plains (Andong, Uiseong, Cheongsong), dusty pink for southwest (Gimcheon, Gumi, Chilgok, Seongju, Goryeong), apricot for southeast (Gyeongsan, Yeongcheon, Gyeongju, Cheongdo), pale teal for east coast (Uljin, Yeongdeok, Pohang). Thin black ink outlines (sumi-e), scattered minimalist pine tree silhouettes in northern mountain areas, faint mountain ridge lines, traditional Korean Hanok roof silhouette over Andong, a small stone pagoda silhouette near Gyeongju, pale teal East Sea (동해) on the right side with three soft horizontal wave lines, label "東海" in calligraphy on the east. Each city/county centered roughly at its real geographic position, with a small Korean name label in fine serif font. Composition has 5% border margin. No text overlay other than place names. Elegant, restful, contemplative atmosphere. Style references: Lee Ungno modern brush painting, Sumi-e map, Studio Ghibli countryside maps.

Aspect ratio: 800:1010 (vertical-ish, 0.79:1). High detail, 8K, vector-friendly style.
```

### 한국어 (ChatGPT 이미지 모델)

```
경상북도(대한민국) 22개 시·군의 위에서 내려다본 일러스트 지도. 모던 한국 수묵화 톤. 한지 텍스처 베이지 배경(#f4ecd8). 시·군별로 5개 톤으로 분류해서 부드러운 파스텔 색칠:
- 북부 산악(봉화, 영양, 영주, 문경, 예천, 상주): 옅은 올리브
- 중부(안동, 의성, 청송): 베이지
- 남서부(김천, 구미, 칠곡, 성주, 고령): 분홍 베이지
- 남동부(경산, 영천, 경주, 청도): 살구색
- 동해안(울진, 영덕, 포항): 옅은 청록
가는 먹선으로 시·군 경계, 북부에 미니멀한 소나무 실루엣 4~5그루, 산맥 능선, 안동에 한옥 지붕 실루엣, 경주에 석탑 실루엣, 우측에 옅은 청록 동해 + 가로 물결선 3줄, 한자로 "東海" 캘리그라피. 각 시·군 중앙에 한글 명조체 라벨. 액자 여백 5%. 울릉도/독도는 포함하지 말 것 (별도 처리). 차분하고 명상적인 분위기. 8K 고해상도.

비율: 가로:세로 = 800:1010 (대략 0.79:1, 세로 약간 김).
```

### 핵심 키워드 모음 (잘 안 나오면 강화)

- "modern Korean ink-wash painting" / "수묵화" / "Sumi-e"
- "Hanji paper texture" (한지)
- "top-down map" / "bird's-eye view"
- "muted pastel color zones"
- "thin black ink outlines"
- "minimalist pine silhouettes"
- "Studio Ghibli countryside map"

## 3. 생성 후 처리

1. **포맷**: PNG (가능하면 8K) 또는 SVG.
2. **크롭**: 위 bbox 모서리 4점이 정확히 이미지 모서리에 오도록 크롭. Photoshop / GIMP / Figma 에서 (37.10°N, 128.00°E) 가 좌상단, (35.50°N, 129.55°E) 가 우하단이 되도록 트리밍.
3. **파일 저장**:
   - 옵션 A: `frontend/public/illustrations/gyeongbuk.png` (또는 `.svg`)
   - 옵션 B: Vercel 정적 자산 호스팅에 업로드 후 URL.

## 4. 코드 교체

`GyeongbukSvg.tsx` 의 본문 전체를 아래로 갈아끼우면 끝.

```tsx
import { MAINLAND_VIEWBOX } from './sigunguGeo'

const W = MAINLAND_VIEWBOX.width
const H = MAINLAND_VIEWBOX.height

export default function GyeongbukSvg() {
  return (
    <image
      href="/illustrations/gyeongbuk.png"
      x={0}
      y={0}
      width={W}
      height={H}
      preserveAspectRatio="none"
    />
  )
}

export function GyeongbukDefs() {
  return null
}
```

`preserveAspectRatio="none"` 으로 강제 정합 — 일러스트와 viewBox 가 같은 비율이라 왜곡되지 않는다.

## 5. 핀이 어긋날 때 보정

새 일러스트가 정확히 bbox 와 맞지 않으면 핀 위치가 미세하게 어긋날 수 있다. 두 가지 해결:

**(a) bbox 를 일러스트에 맞춰 재조정** — `sigunguGeo.ts` 의 `MAINLAND_BBOX` 값 살짝 수정. 가장 안전.

**(b) 일러스트를 bbox 에 맞춰 재크롭** — Figma 에서 픽셀 단위로 정렬.

핀 위치는 결국 `(lng - west)/(east - west) * W` 같은 단순 선형 변환이라 bbox 두 값(`north`/`south`/`west`/`east`)만 미세 조정해도 전체 보정된다.

## 6. (선택) 시·군 클릭 영역 추가

김포 사이트처럼 시·군을 클릭하면 해당 지역 페이지로 이동시키고 싶다면:

- AI 일러스트에 시·군 경계가 보이므로 그 위에 invisible polygon (또는 circle) 을 띄워서 hover/click 처리.
- `GyeongbukSvg.tsx` 의 mock 패턴(시·군 중심점에 원형 패치) 을 유지하고 그 원에 `onClick` 만 붙여도 됨.

```tsx
<circle
  cx={x}
  cy={y}
  r={56}
  fill="transparent"
  style={{ cursor: 'pointer' }}
  onClick={() => nav(`/explore?sigungu=${s.code}`)}
/>
```
