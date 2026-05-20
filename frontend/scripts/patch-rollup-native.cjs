/**
 * Rollup native binding patch.
 *
 * Why this exists:
 *  - On Windows, the precompiled `@rollup/rollup-win32-x64-msvc` binary crashes
 *    (STATUS_STACK_BUFFER_OVERRUN / exit -1073740791) when the project path
 *    contains non-ASCII characters (e.g. Korean). The crash happens during the
 *    "render chunks" phase, after module transforms succeed.
 *  - Dev mode (`vite`) is unaffected because it uses esbuild + the parser
 *    only — the crash is in the bundle/emit pass.
 *
 * What we do:
 *  - When (a) we are on win32, (b) the resolved CWD contains a non-ASCII
 *    char, and (c) `@rollup/wasm-node` is installed, replace
 *    `node_modules/rollup/dist/native.js` so it delegates to the WASM bindings.
 *  - The patch is idempotent and a no-op everywhere else.
 *
 * Wired up via `package.json` `scripts.postinstall`.
 */
const fs = require('node:fs')
const path = require('node:path')

function hasNonAscii(s) {
  return /[^\x00-\x7f]/.test(s)
}

function main() {
  if (process.platform !== 'win32') return
  if (!hasNonAscii(process.cwd())) return

  const targetDir = path.resolve(__dirname, '..', 'node_modules', 'rollup', 'dist')
  const targetFile = path.join(targetDir, 'native.js')
  const wasmBindings = path.resolve(
    __dirname,
    '..',
    'node_modules',
    '@rollup',
    'wasm-node',
    'dist',
    'wasm-node',
    'bindings_wasm.js',
  )

  if (!fs.existsSync(targetFile)) return
  if (!fs.existsSync(wasmBindings)) {
    console.warn(
      '[patch-rollup-native] @rollup/wasm-node not installed; skipping patch. Run `npm i -D @rollup/wasm-node`.',
    )
    return
  }

  const patched = `// Patched by scripts/patch-rollup-native.cjs to route Rollup's native bindings
// through @rollup/wasm-node — required because the precompiled win32 binary
// crashes on Korean-character project paths.
const {
  parse,
  xxhashBase64Url,
  xxhashBase36,
  xxhashBase16
} = require('@rollup/wasm-node/dist/wasm-node/bindings_wasm.js');

exports.parse = parse;
exports.parseAsync = async (code, allowReturnOutsideFunction, jsx, _signal) =>
  parse(code, allowReturnOutsideFunction, jsx);
exports.xxhashBase64Url = xxhashBase64Url;
exports.xxhashBase36 = xxhashBase36;
exports.xxhashBase16 = xxhashBase16;
`

  fs.writeFileSync(targetFile, patched, 'utf8')
  console.log('[patch-rollup-native] Rollup native.js → WASM bindings (Korean path workaround).')
}

main()
