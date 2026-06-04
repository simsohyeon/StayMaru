/**
 * 쉼마루 dev 서버는 카카오 지도/공유 도메인이 localhost:5173 에만 등록돼 있어
 * 반드시 5173 을 써야 한다(vite strictPort). 다른 프로세스가 5173 을 점유하고 있으면
 * vite 가 아예 못 뜨므로, dev 실행 직전(predev)에 그 프로세스를 종료해 5173 을 확보한다.
 *
 * 사용: node scripts/free-port.cjs [port=5173]
 * win32: PowerShell Get-NetTCPConnection 우선(IPv6 포함), 실패 시 netstat 폴백.
 * posix: lsof.
 */
const { execSync } = require('node:child_process')

const port = process.argv[2] || '5173'
const isWin = process.platform === 'win32'

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

function pidsOnPort(p) {
  const pids = new Set()
  if (isWin) {
    // ① PowerShell — IPv4/IPv6 모두 정확히 잡힌다.
    const psOut = run(
      `powershell.exe -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${p} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`,
    )
    for (const line of psOut.split(/\r?\n/)) {
      const t = line.trim()
      if (/^\d+$/.test(t)) pids.add(t)
    }
    if (pids.size > 0) return [...pids]
    // ② netstat 폴백 — `-p tcp` 는 IPv6(TCPv6)를 제외하므로 필터 없이 전체에서 매칭.
    const out = run('netstat -ano')
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*TCP(?:v6)?\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)/i)
      if (m && m[1].endsWith(`:${p}`)) pids.add(m[2])
    }
    return [...pids]
  }
  const out = run(`lsof -ti tcp:${p} -sTCP:LISTEN`)
  return out.split(/\s+/).filter(Boolean)
}

function processName(pid) {
  if (isWin) {
    const out = run(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`)
    const m = out.match(/^"([^"]+)"/)
    return m ? m[1] : 'unknown'
  }
  return run(`ps -p ${pid} -o comm=`).trim() || 'unknown'
}

const pids = pidsOnPort(port).filter((pid) => pid && pid !== '0')
if (pids.length === 0) {
  console.log(`[free-port] ${port} 비어 있음 — 쉼마루가 그대로 점유합니다.`)
  process.exit(0)
}

for (const pid of pids) {
  const name = processName(pid)
  if (isWin) run(`taskkill /F /PID ${pid}`)
  else run(`kill -9 ${pid}`)
  console.log(`[free-port] ${port} 을(를) 점유하던 PID ${pid} (${name}) 종료 → 5173 확보`)
}
