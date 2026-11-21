// API de la tienda. Servidor con el módulo http de Node, sin dependencias.
const http = require('node:http')
const { PRODUCTOS, calcularTotal } = require('./src/precios')

const PORT = process.env.PORT || 3000

function responder(res, estado, cuerpo) {
  res.writeHead(estado, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(cuerpo))
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/productos') return responder(res, 200, PRODUCTOS)

  if (url.pathname === '/total') {
    try {
      const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean).map(Number)
      const items = ids.map((id) => {
        const p = PRODUCTOS.find((x) => x.id === id)
        if (!p) throw new Error(`Producto ${id} no existe`)
        return { precio: p.precio, cantidad: 1 }
      })
      return responder(res, 200, { total: calcularTotal(items, url.searchParams.get('cupon')) })
    } catch (e) {
      return responder(res, 400, { error: e.message })
    }
  }

  return responder(res, 404, { error: 'no encontrado' })
})

servidor.listen(PORT, () => console.log(`Servidor en el puerto ${PORT}`))
