const test = require('node:test')
const assert = require('node:assert/strict')
const { subtotal, calcularTotal } = require('../src/precios')

const items = [
  { precio: 8.5, cantidad: 2 },
  { precio: 2, cantidad: 1 },
]

test('subtotal suma precio por cantidad', () => {
  assert.equal(subtotal(items), 19)
})

test('total sin cupón incluye IGV', () => {
  assert.equal(calcularTotal(items), 22.42)
})

test('cupón DESC10 descuenta 10 % antes del IGV', () => {
  assert.equal(calcularTotal(items, 'DESC10'), 20.18)
})

test('el cupón se reconoce en minúsculas', () => {
  assert.equal(calcularTotal(items, 'desc10'), 20.18)
})

test('un cupón inexistente se ignora', () => {
  assert.equal(calcularTotal(items, 'NOEXISTE'), 22.42)
})
