# Consumo y Visualización de Promociones en el Frontend

## ¿Qué hace el backend?
El backend envía, para cada producto, un array `promociones` que contiene:
- La mejor promoción de descuento/oferta (la que deja el precio más bajo).
- La promoción de cuotas sin interés (si existe para ese producto).
- Cada promoción incluye sus condiciones (ej: banco, tarjeta, canal) y acciones (ej: descuento, cuotas, envío gratis), además del tipo de promoción (`descuento`, `oferta`, `cuotas_sin_interes`, etc.).

## ¿Qué debe hacer el frontend?
1. Mostrar el precio final del producto considerando la mejor promoción de descuento/oferta (si existe).
2. Mostrar, junto al precio, la información de cuotas sin interés si hay una promoción de ese tipo.
3. Mostrar los detalles de cada promoción:
   - Si la promo tiene condiciones (ej: solo con Visa, solo Santander), mostrar los requisitos.
   - Si la promo es de cuotas, mostrar el número de cuotas y si son sin interés.
   - Si la promo es de descuento/oferta, mostrar el porcentaje o monto de descuento.
4. No mostrar promociones que no estén en el array `promociones` del producto (el backend ya filtró las relevantes).
5. Si quieres mostrar un badge o destacado, usa el campo `promocionTipo.alias` para distinguir entre “descuento”, “oferta”, “cuotas_sin_interes”, etc.

### Ejemplo de respuesta del backend
```json
{
  "id": 5,
  "nombre": "Leche Descremada",
  "precio": 100,
  "precioDescuento": 80,
  "promociones": [
    {
      "id": 2,
      "nombre": "Promo Visa 20%",
      "descripcion": "20% de descuento pagando con Visa",
      "promocionTipo": {
        "alias": "descuento",
        "nombre": "Descuento"
      },
      "condiciones": [
        { "tipoCondicion": "tarjeta", "valor": "Visa" }
      ],
      "acciones": [
        { "tipoAccion": "descuento", "valor": 20 }
      ]
    },
    {
      "id": 7,
      "nombre": "12 cuotas sin interés BBVA",
      "promocionTipo": {
        "alias": "cuotas_sin_interes",
        "nombre": "Cuotas sin interés"
      },
      "condiciones": [
        { "tipoCondicion": "banco", "valor": "BBVA" }
      ],
      "acciones": [
        { "tipoAccion": "cuotas_sin_interes", "valor": 12 }
      ]
    }
  ]
}
```

## Resumen
- El backend ya filtra y calcula la mejor promo y la de cuotas.
- El frontend solo debe mostrar lo que recibe en el array `promociones`, interpretando condiciones y acciones según el tipo.
- Si necesitas lógica de stacking/combinación, consulta antes porque actualmente solo se envía la mejor promo de cada tipo.

## UI de administración (nuevo)

He añadido un conjunto de componentes para gestionar campañas comerciales desde el panel de `admin`:

- `src/app/features/admin/campanas-comerciales/campanas-comerciales.service.ts`: wrapper HTTP para `/api/promociones` (list, get, create, update, delete, acciones, condiciones, productos, tarjetas, stacking, tipos).
- `src/app/features/admin/campanas-comerciales/campanas-comerciales-list.component.ts` (+ HTML/SCSS): listado, búsqueda, filtros por tipo, acciones (editar, activar/desactivar, eliminar).
- `src/app/features/admin/campanas-comerciales/campana-comercial-form.component.ts` (+ HTML/SCSS): editor con pestañas (General, Productos, Acciones, Condiciones, Tarjetas, Stacking). Conecta con `CampanasComercialesService`.
- Componentes auxiliares: `producto-multi-select.component.ts`, `lista-acciones.component.ts`, `lista-condiciones.component.ts`, `editor-apilamiento.component.ts`.

Rutas añadidas (dentro de `AdminRoutingModule`):
- `/admin/campanas-comerciales` — listado
- `/admin/campanas-comerciales/nuevo` — crear
- `/admin/campanas-comerciales/:id` — editar

Notas rápidas:
- El servicio de `campanas-comerciales` añade `Authorization: Bearer <token>` leyendo `localStorage.token`.
- Los botones de modificación están ocultos/deshabilitados si el rol del usuario (alias) no está en `['administrador','operador','super_admin']`.
- Los componentes auxiliares contienen implementaciones básicas listas para mejorar (buscador de productos, upload de imagen, multiselección de tarjetas).

Si querés, completo ahora:
- subida de `imagenSlide` (upload a endpoint específico), búsqueda de productos por nombre/categoría, y reemplazo del selector de tarjetas por un multi-select con datos reales.

