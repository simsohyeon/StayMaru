/*
 * api/ 가 쓰는 런타임 전역 선언.
 *
 * 이 함수들은 Vercel Edge 런타임에서 돈다 — Node 가 아니다. 쓰는 것은 웹 표준
 * (Request·Response·fetch·crypto·URL)과 Vercel 이 얹어 주는 process.env 하나뿐이라,
 * @types/node 를 끌어오는 대신 그 하나만 여기서 선언한다.
 *
 * 이렇게 두면 타입 검사가 node_modules 위치에 기대지 않는다. 루트 tsconfig.json 은
 * 배포 환경(루트에 node_modules 가 없다)에서도 읽히는데, 거기서 @types/node 를
 * 못 찾으면 process 가 통째로 미해결이 된다.
 *
 * _lib/ 안에 두는 이유 — Vercel 은 api/ 에서 밑줄로 시작하는 경로를 함수로 보지 않는다.
 *
 * 값 모양은 places-db.ts 의 Env(=Record<string, string | undefined>)와 같게 맞춘다.
 */
declare const process: {
  env: Record<string, string | undefined>
}
