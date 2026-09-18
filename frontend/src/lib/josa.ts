/**
 * 한글 조사 선택 — 앞말의 받침 유무로 은/는, 이/가 같은 쌍에서 하나를 고른다.
 * i18n 문자열에 시군명을 끼워 넣을 때 "안동시은" 같은 오문을 막는다.
 */

/**
 * @param word     앞말 (예: '안동시', '봉화군')
 * @param withFinal    받침이 있을 때 쓸 조사 (예: '은')
 * @param withoutFinal 받침이 없을 때 쓸 조사 (예: '는')
 *
 * 한글 음절이 아니면(영문·숫자·빈 문자열) 받침 없는 쪽을 쓴다 — 한국어 화면에
 * 외래어가 섞이는 경우가 드물고, 그때 '는/가'가 덜 어색하기 때문.
 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.at(-1)
  if (!last) return withoutFinal
  const code = last.charCodeAt(0)
  // 한글 음절 영역 밖이면 판별 불가
  if (code < 0xac00 || code > 0xd7a3) return withoutFinal
  // 유니코드 한글 음절 = (초성*21 + 중성)*28 + 종성. 나머지 0 이면 받침 없음.
  return (code - 0xac00) % 28 === 0 ? withoutFinal : withFinal
}
