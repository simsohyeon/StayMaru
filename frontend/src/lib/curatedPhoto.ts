import { pickBySigungu, type AwardPhoto } from '@/api/photoAward'
import { SIGUNGUS } from '@/constants/sigungu'
import type { CuratedCourse } from '@/constants/curatedCourses'

/**
 * 테마 카드 배경 사진 URL 배정.
 *
 * 1순위는 운영자가 /admin 에서 지정한 사진(c.image)이다. 지정이 없을 때만
 * 관광공모전 수상작을 거점 시군 이름으로 매칭하고, 그것도 없으면 남은 사진을 순서대로 쓴다.
 *
 * `used` 는 한 장이 두 자리에 겹쳐 쓰이지 않게 하는 소진 집합 —
 * 같은 화면에서 다른 자리(테마 화면의 상단 밴드 등)와 사진을 나눠 쓸 때 같은 집합을 넘긴다.
 * 운영자 지정 사진은 이 집합을 건드리지 않는다(수상작 몫을 축내지 않는다).
 */
export function curatedPhotoUrls(
  courses: CuratedCourse[],
  photos: AwardPhoto[],
  used: Set<string> = new Set(),
): (string | undefined)[] {
  const spare = () => photos.find((p) => !used.has(p.id))
  return courses.map((c) => {
    if (c.image) return c.image
    const names = c.sigunguCodes
      .map((code) => SIGUNGUS.find((s) => s.code === code)?.ko)
      .filter(Boolean) as string[]
    const hit = names.map((n) => pickBySigungu(photos, n, used)).find(Boolean) ?? spare()
    if (hit) used.add(hit.id)
    return hit?.image
  })
}
