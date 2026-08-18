# Ayuda para desarrolladores: Consumo de promociones

## Lógica de consumo y visualización
- El backend envía en el array `promociones` solo las promociones relevantes para cada producto.
- El frontend debe:
  1. Mostrar el precio final usando la mejor promo de descuento/oferta (si existe).
  2. Mostrar cuotas sin interés si hay promo de ese tipo.
  3. Mostrar condiciones y acciones de cada promo (banco, tarjeta, porcentaje, cuotas, etc.).
  4. No mostrar promos que no estén en el array.
  5. Usar `promocionTipo.alias` para badges y visuales.

## Ejemplo de objeto de producto
(ver README principal)

## Notas
- No se debe combinar promos ni inventar lógica extra: solo mostrar lo que viene en el array.
- Si el backend cambia la estructura, consultar antes de modificar la lógica.
