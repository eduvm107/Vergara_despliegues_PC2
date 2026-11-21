// Reglas de precios de la tienda.
const IGV = 0.18

const PRODUCTOS = [
  { id: 1, nombre: 'Cuaderno', precio: 8.5 },
  { id: 2, nombre: 'Lapicero', precio: 2 },
  { id: 3, nombre: 'Mochila', precio: 75 },
]

const CUPONES = { DESC10: 0.1, DESC20: 0.2 }

function validarCantidad(cantidad) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new Error('La cantidad debe ser un entero mayor que cero')
  }
  return cantidad
}

function subtotal(items) {
  return items.reduce((suma, item) => suma + item.precio * validarCantidad(item.cantidad), 0)
}

function aplicarCupon(monto, cupon) {
  const codigo = String(cupon || '').trim().toUpperCase()
  const descuento = CUPONES[codigo]
  if (descuento === undefined) return monto
  return monto * (1 - descuento)
}

function calcularTotal(items, cupon) {
  const conCupon = aplicarCupon(subtotal(items), cupon)
  const total = conCupon * (1 + IGV)
  return Math.round(total * 100) / 100
}

module.exports = { PRODUCTOS, validarCantidad, subtotal, aplicarCupon, calcularTotal }
