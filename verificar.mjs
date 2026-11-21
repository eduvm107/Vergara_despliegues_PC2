// Autoverificación de la PC02: node verificar.mjs
// Calcula el puntaje de la parte práctica (máximo 10). No modifica ningún archivo.
import { spawnSync, spawn } from 'node:child_process'
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

let total = 0
const resultados = []
function check(tarea, descripcion, pts, ok) {
  if (ok) total += pts
  resultados.push({ tarea, descripcion, pts, ok })
}
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', ...opts })

// ---------- T1: calidad antes del despliegue (2 pts) ----------
const cov = sh('node', ['--test', '--experimental-test-coverage'])
const salida = (cov.stdout || '') + (cov.stderr || '')
const nTests = Number((salida.match(/# tests (\d+)/) || [])[1] || 0)
const filaPrecios = salida.split('\n').find((l) => /precios\.js/.test(l) && !/test/.test(l)) || ''
const lineas = Number((filaPrecios.split('|')[1] || '').trim())
check('T1', 'Todas las pruebas pasan y hay una prueba nueva (6 o más pruebas)', 1, cov.status === 0 && nTests >= 6)
check('T1', 'Cobertura de líneas de src/precios.js = 100 %', 1, lineas === 100)

// ---------- Utilidades para T2 y T3 ----------
async function conServidor(env, fn) {
  const port = 3900 + Math.floor(Math.random() * 90)
  const hijo = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  hijo.stdout.on('data', (d) => (out += d))
  hijo.stderr.on('data', (d) => (out += d))
  await new Promise((r) => setTimeout(r, 1200))
  try { return await fn(`http://localhost:${port}`, () => out) } finally { hijo.kill() }
}
const pedir = async (url) => { try { const r = await fetch(url); return { status: r.status, cuerpo: await r.text() } } catch { return { status: 0, cuerpo: '' } } }

// ---------- T2: observabilidad básica (2 pts) ----------
let listo = 0, noListo = 0, salud = { status: 0, cuerpo: '' }
await conServidor({}, async (base) => { salud = await pedir(base + '/health'); listo = (await pedir(base + '/ready')).status })
await conServidor({ BASE_DE_DATOS_OK: 'false' }, async (base) => { noListo = (await pedir(base + '/ready')).status })
check('T2', '/health responde 200 con status ok; /ready responde 200 y 503 si BASE_DE_DATOS_OK=false', 1,
  salud.status === 200 && /"status"\s*:\s*"ok"/.test(salud.cuerpo) && listo === 200 && noListo === 503)
await conServidor({}, async (base, salidaServidor) => {
  await pedir(base + '/productos')
  await new Promise((r) => setTimeout(r, 200))
  const lineasLog = salidaServidor().split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const reg = lineasLog.find((l) => l.path === '/productos')
  check('T2', 'Cada petición genera un log JSON con ts, level, msg, method, path, status y ms', 1,
    !!reg && ['ts', 'level', 'msg', 'method', 'path', 'status', 'ms'].every((c) => c in reg))
})

// ---------- T3: notificación a Slack (3 pts) ----------
// Se usa un servidor local que simula el webhook; así no se envía nada al canal real.
const recibidos = []
const mock = http.createServer((req, res) => {
  let cuerpo = ''
  req.on('data', (d) => (cuerpo += d))
  req.on('end', () => { recibidos.push({ method: req.method, cuerpo }); res.writeHead(200); res.end('ok') })
})
await new Promise((r) => mock.listen(0, r))
const urlMock = `http://127.0.0.1:${mock.address().port}/hook`
const textoDe = (r) => { try { return JSON.parse(r.cuerpo).text || '' } catch { return '' } }
const ejecutar = (args, env) => new Promise((resolve) => {
  const h = spawn('node', args, { env: { ...process.env, ...env }, stdio: 'ignore' })
  const t = setTimeout(() => { h.kill(); resolve(-1) }, 8000)
  h.on('close', (c) => { clearTimeout(t); resolve(c) })
})
const notificar = async (estado) => {
  const antes = recibidos.length
  const codigo = await ejecutar(['notificar.mjs', estado], { SLACK_WEBHOOK_URL: urlMock })
  await new Promise((x) => setTimeout(x, 200))
  return { codigo, msg: recibidos.length > antes ? recibidos[recibidos.length - 1] : null }
}
const rOk = existsSync('notificar.mjs') ? await notificar('exito') : { codigo: 1, msg: null }
const rErr = existsSync('notificar.mjs') ? await notificar('error') : { codigo: 1, msg: null }
check('T3', 'node notificar.mjs exito envía un POST con "text" que contiene ÉXITO y no contiene ERROR', 1,
  rOk.codigo === 0 && !!rOk.msg && rOk.msg.method === 'POST' && /[ÉE]XITO/i.test(textoDe(rOk.msg)) && !/ERROR/i.test(textoDe(rOk.msg)))
check('T3', 'node notificar.mjs error envía un POST con "text" que contiene ERROR y no contiene ÉXITO', 1,
  rErr.codigo === 0 && !!rErr.msg && /ERROR/i.test(textoDe(rErr.msg)) && !/[ÉE]XITO/i.test(textoDe(rErr.msg)))
mock.close()
const sinVar = existsSync('notificar.mjs') ? await ejecutar(['notificar.mjs', 'exito'], { SLACK_WEBHOOK_URL: '' }) : 0
const archivos = sh('git', ['ls-files', '-co', '--exclude-standard']).stdout?.split('\n').filter(Boolean) || []
const conUrlFija = archivos.filter((f) => !/\.(zip|png)$/.test(f) && f !== 'verificar.mjs' && existsSync(f) &&
  /hooks\.slack\.com/.test(readFileSync(f, 'utf8')))
check('T3', 'Sin SLACK_WEBHOOK_URL el script falla (código distinto de 0) y ningún archivo contiene la URL del webhook', 1,
  existsSync('notificar.mjs') && sinVar !== 0 && conUrlFija.length === 0)

// ---------- T4: integración continua con notificación (2 pts) ----------
const ruta = '.github/workflows/ci.yml'
const yml = existsSync(ruta) ? readFileSync(ruta, 'utf8') : ''
check('T4', 'ci.yml se ejecuta en pull_request, usa checkout y setup-node, y ejecuta npm ci y npm test', 1,
  /pull_request/.test(yml) && /actions\/checkout/.test(yml) && /actions\/setup-node/.test(yml) && /npm ci/.test(yml) && /npm test/.test(yml))
check('T4', 'ci.yml notifica con if: success() y if: failure() usando notificar.mjs y secrets.SLACK_WEBHOOK_URL', 1,
  /if:\s*success\(\)/.test(yml) && /if:\s*failure\(\)/.test(yml) && /notificar\.mjs/.test(yml) && /secrets\.SLACK_WEBHOOK_URL/.test(yml))

// ---------- T5: versionado y rollback (1 pt) ----------
const git = (...a) => sh('git', a)
const esRepo = git('rev-parse', '--is-inside-work-tree').stdout?.trim() === 'true'
const version = (ref) => {
  const r = git('show', `${ref}:package.json`)
  try { return JSON.parse(r.stdout).version } catch { return null }
}
const log = esRepo ? git('log', '--format=%s').stdout || '' : ''
check('T5', 'Tags v1.0.0 (versión 1.0.0) y v1.1.0 (versión 1.1.0); rollback con git revert: HEAD vuelve a 1.0.0 con un commit Revert', 1,
  esRepo && version('v1.0.0') === '1.0.0' && version('v1.1.0') === '1.1.0' && version('HEAD') === '1.0.0' && /^Revert/m.test(log))

// ---------- Informe ----------
console.log('\nPC02 - Verificación de la parte práctica\n')
resultados.sort((a, b) => a.tarea.localeCompare(b.tarea))
for (const r of resultados) console.log(`${r.ok ? '[OK]  ' : '[FALTA]'} ${r.tarea} (${r.pts} pt) ${r.descripcion}`)
console.log(`\nPuntaje práctico: ${total} / 10\n`)
