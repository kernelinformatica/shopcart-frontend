# Prompt para el backend — Endpoint "Mis compras"

## Contexto

El front-end Angular muestra al usuario autenticado un listado de **sus compras** (pedidos)
dentro de una app concreta, con el estado del pago y el estado de la logística/envío.
La UI se abre como modal "Mis compras" en el header.

El front ya consume el endpoint con esta firma (ver `api.service.ts`):

```ts
getMisCompras(appId: number): Observable<Pedido[]> {
  return this.http.get<Pedido[]>(`${API}/apps/${appId}/mis-compras`, {
    headers: this.getAuthHeaders()
  });
}
```

Por favor implementar el endpoint que se describe abajo en el proyecto
`back-end-rest-express`.

---

## Endpoint a implementar

### `GET /api/apps/:appId/mis-compras`

- **Autenticación**: obligatoria (JWT Bearer, mismo middleware que ya usan los demás
  endpoints de `/api/apps/:appId/pedidos`).
- **Autorización**: el usuario solo puede ver **sus propios** pedidos. El backend
  debe filtrar por `usuarioId = req.user.id` (no aceptar override por query).
- **Multi-tenant**: filtrar por `appId` recibido en la ruta. Validar que el usuario
  tenga acceso a esa app.
- **Query params opcionales** (recomendados, no bloqueantes para esta iteración):
  - `estado` (string): filtrar por estado del pedido.
  - `desde` / `hasta` (ISO date): rango de fechas.
  - `page`, `pageSize` (number): paginación. Por defecto sin paginar para la primera versión.

### Respuesta esperada (`200 OK`)

Array de pedidos ordenados por **fecha de creación descendente** (más recientes primero).
Cada pedido debe incluir el `pedidoEnvio` embebido con su `envioEstado` para que el
front pueda mostrar el estado de logística sin hacer N+1 llamadas.

Estructura mínima por ítem (en TypeScript, ya tipada en `front-end/src/app/models.ts`):

```ts
interface Pedido {
  id: number;
  usuarioId: number;
  estado: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado' | 'rechazado';
  total: number;
  metodoPago: string;          // 'mercadopago', 'efectivo', 'cuenta_corriente', etc.
  tipoEntrega?: 'retiro' | 'domicilio' | 'programado';
  costoEnvio?: number;
  cuponCodigo?: string;
  notas?: string;
  createdAt?: string;          // ISO 8601 - REQUERIDO para ordenar
  items: Array<{
    cantidad: number;
    precioUnitario?: number;
    producto?: { id: number; nombre: string; };
  }>;
  pedidoEnvio?: {              // opcional, solo si existe pedidoEnvio asociado
    id: number;
    pedidoId: number;
    appId: number;
    trackingCodigo?: string;
    fechaProgramada?: string;
    horaVentanaDesde?: string;
    horaVentanaHasta?: string;
    envioEstado?: {
      id: number;
      codigo: string;         // 'pendiente_preparacion' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado' | etc.
      descripcion?: string;   // texto user-friendly que muestra el front
      esFinal: boolean;
    };
    usuarioDireccion?: {
      calle?: string;
      numero?: string;
      localidad?: { nombre?: string };
    };
  };
}
```

### Códigos de error

- `401 Unauthorized` — token inválido o ausente.
- `403 Forbidden` — usuario no tiene acceso a la app.
- `404 Not Found` — appId no existe.
- `500 Internal Server Error` — error interno (loguear stack).

---

## Reglas de seguridad importantes (OWASP)

- **No** aceptar `usuarioId` como query param; usar siempre `req.user.id`.
- Validar que `req.user` pertenezca a esa `appId` (consulta usuario-app o claim en token).
- Sanitizar `appId` (`Number.isInteger`, `> 0`).
- No exponer datos sensibles de otros usuarios (direcciones, repartidor, etc. solo del propio pedido).

---

## Implementación sugerida (Express + Sequelize, ajustar al stack real)

```js
// routes/apps.routes.js  (o donde estén las rutas de app-scoped)
router.get(
  '/apps/:appId/mis-compras',
  authMiddleware,
  ensureUserBelongsToApp,
  misComprasController.list
);

// controllers/misCompras.controller.js
exports.list = async (req, res, next) => {
  try {
    const appId = Number(req.params.appId);
    if (!Number.isInteger(appId) || appId <= 0) {
      return res.status(400).json({ error: 'appId inválido' });
    }
    const usuarioId = req.user.id;

    const pedidos = await Pedido.findAll({
      where: { appId, usuarioId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: PedidoItem, as: 'items', include: [{ model: Producto, attributes: ['id', 'nombre'] }] },
        {
          model: PedidoEnvio,
          as: 'pedidoEnvio',
          include: [
            { model: EnvioEstado, as: 'envioEstado' },
            { model: UsuarioDireccion, as: 'usuarioDireccion', include: [{ model: Localidad, as: 'localidad' }] }
          ]
        }
      ]
    });

    return res.json(pedidos);
  } catch (err) {
    return next(err);
  }
};
```

---

## Validación end-to-end

Probar desde el front:

1. Loguearse como usuario con compras.
2. Seleccionar una app.
3. Hacer click en el icono de bolsa (al lado de la campana) en el header.
4. El modal "Mis compras" debe mostrar:
   - Pedido # con `estado` (badge color según pago).
   - `metodoPago` y `tipoEntrega`.
   - Total y cantidad de ítems.
   - `pedidoEnvio.envioEstado.descripcion` como badge de logística.
   - `trackingCodigo`, dirección y ventana horaria si están presentes.
5. Tras un pago aprobado por webhook, el front llama nuevamente al endpoint
   y la nueva compra debe aparecer en la primera posición.

---

## Notas adicionales

- El front ya tolera `404` (muestra "Aún no hay un endpoint de compras disponible.")
  y `401/403` (muestra "Iniciá sesión para ver tus compras."). No es bloqueante deployar
  el front antes que el backend.
- Si en el corto plazo no se puede agregar el endpoint dedicado, una alternativa es
  reutilizar `GET /api/pedidos` filtrando por `usuarioId` y `appId` en el servicio, pero
  se pierde el filtro multi-tenant a nivel ruta y debe quedar documentado como deuda técnica.
