import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Empresa, Usuario, Producto, Carrito, Pedido, Promocion, Tarjeta, FormaPago } from './models';
import { normalizarMultimediaProducto } from './shared/utils/producto.utils';

import { environment } from '../environments/environment';
const API = `${environment.apiUrl}/api`;

@Injectable({ providedIn: 'root' })
export class ApiService {
    /**
     * Califica un producto (rating del usuario autenticado)
     */
    setProductoRating(productoId: number, rating: number): Observable<any> {
      // Obtener appId igual que en dashboard
      const appId = (window as any).environment?.empresaCodigoWeb || (window as any).environment?.empresaCodigo || 1;
      return this.http.post(`${API}/ratings`, { productoId, rating, appId }, { headers: this.getAuthHeaders() });
    }

    /**
     * Quita la calificación del usuario para un producto
     */
    removeProductoRating(productoId: number): Observable<any> {
      // Suponiendo que el backend elimina el rating por productoId del usuario autenticado
      return this.http.request('delete', `${API}/ratings`, { headers: this.getAuthHeaders(), body: { productoId } });
    }
  /**
   * Obtiene datos para Mercado Pago (preferenceId y apiKeyPublic)
   */
  getMercadoPagoPreference(
    pedidoId: number,
    appId: number,
    alias?: string,
    isRetry?: boolean
  ): Observable<{ preferenceId: string, apiKeyPublic: string }> {
    return this.http.post<{ preferenceId: string, apiKeyPublic: string }>(
      `${API}/pedido/${pedidoId}/mercadopago`,
      { appId, alias, isRetry },
      { headers: this.getAuthHeaders() }
    );
  }
  private favoritosActualizadosSubject = new Subject<number | null>();
  favoritosActualizados$ = this.favoritosActualizadosSubject.asObservable();
  private readonly selectedAppStorageKey = 'selectedAppId';

  /**
   * Busca productos por nombre y appId
   */
  buscarProductosPorNombre(nombre: string, appId: number): Observable<Producto[]> {
    const params = { nombre, appId };
    return this.http.get<Producto[]>(`${API}/productos/buscar`, { headers: this.getAuthHeaders(), params }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  constructor(private http: HttpClient) { }

  /**
   * Alias para obtener usuario por ID (compatibilidad con StoreLayoutComponent)
   */
  getUsuarioById(id: number): Observable<Usuario> {
    return this.getUsuario(id);
  }



 
  // Helper para headers JWT
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  // Empresas (protegido)
  getEmpresas(): Observable<Empresa[]> { return this.http.get<Empresa[]>(`${API}/empresas`, { headers: this.getAuthHeaders() }); }
  getEmpresa(id: number): Observable<Empresa> { return this.http.get<Empresa>(`${API}/empresas/${id}`, { headers: this.getAuthHeaders() }); }
  createEmpresa(e: Empresa): Observable<Empresa> { return this.http.post<Empresa>(`${API}/empresas`, e, { headers: this.getAuthHeaders() }); }
  updateEmpresa(e: Empresa): Observable<Empresa> { return this.http.put<Empresa>(`${API}/empresas/${e.id}`, e, { headers: this.getAuthHeaders() }); }
  deleteEmpresa(id: number): Observable<void> { return this.http.delete<void>(`${API}/empresas/${id}`, { headers: this.getAuthHeaders() }); }

  // Usuarios (protegido)
  getUsuarios(): Observable<Usuario[]> { return this.http.get<Usuario[]>(`${API}/usuarios`, { headers: this.getAuthHeaders() }); }
  getUsuario(id: number): Observable<Usuario> { return this.http.get<Usuario>(`${API}/usuarios/${id}`, { headers: this.getAuthHeaders() }); }
  updateUsuario(u: Usuario): Observable<Usuario> { return this.http.put<Usuario>(`${API}/usuarios/${u.id}`, u, { headers: this.getAuthHeaders() }); }
  deleteUsuario(id: number): Observable<void> { return this.http.delete<void>(`${API}/usuarios/${id}`, { headers: this.getAuthHeaders() }); }

  // Productos (protegido)
  getProductos(params?: any): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${API}/productos`, { headers: this.getAuthHeaders(), params }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  getProducto(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${API}/productos/${id}`, { headers: this.getAuthHeaders() }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  /**
   * Nuevo: Obtener producto por slug
   */
  getProductoPorSlug(slug: string): Observable<Producto> {
    return this.http.get<Producto>(`${API}/productos/slug/${slug}`, { headers: this.getAuthHeaders() }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  createProducto(p: Producto): Observable<Producto> { return this.http.post<Producto>(`${API}/productos`, p, { headers: this.getAuthHeaders() }); }
  updateProducto(p: Producto): Observable<Producto> { return this.http.put<Producto>(`${API}/productos/${p.id}`, p, { headers: this.getAuthHeaders() }); }
  deleteProducto(id: number): Observable<void> { return this.http.delete<void>(`${API}/productos/${id}`, { headers: this.getAuthHeaders() }); }


  // Categorías y subcategorías (nuevo endpoint)

  /**
   * Obtiene las subcategorías (subrubros) de una categoría principal (rubro)
   * @param parentId ID de la categoría principal
   * @returns Observable con array de ProductoCategoria hijos
   */
  getSubcategoriasByCategoriaId(parentId: number): Observable<any[]> {
    return this.http.get<any[]>(`${API}/categorias/${parentId}/subcategorias`, { headers: this.getAuthHeaders() });
  }

  // Carrito (protegido)
  getCarrito(medioPago?: string | null, appId?: number): Observable<Carrito> {
    const params: any = {};
    if (medioPago) {
      params.medioPago = medioPago;
    }
    const resolvedAppId = this.resolveAppId(appId);
    if (resolvedAppId) {
      params.appId = resolvedAppId;
    }
    return this.http.get<Carrito>(`${API}/carrito`, { headers: this.getAuthHeaders(), params: Object.keys(params).length ? params : undefined }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  updateCarrito(c: Carrito): Observable<Carrito> { return this.http.post<Carrito>(`${API}/carrito`, c, { headers: this.getAuthHeaders() }); }
  agregarItemCarrito(payload: { productoId: number; cantidad: number; medioPago?: string; appId?: number; promoActionDetail?: string }): Observable<Carrito> {
    const resolvedAppId = this.resolveAppId(payload?.appId);
    if (!resolvedAppId) {
      return throwError(() => new Error('appId requerido para agregar items al carrito'));
    }
    const body = { ...payload, appId: resolvedAppId };
    return this.http.post<Carrito>(`${API}/carrito/add`, body, { headers: this.getAuthHeaders() });
  }
  removerItemCarrito(payload: { productoId: number; cantidad: number; medioPago?: string; appId?: number }): Observable<Carrito> {
    const resolvedAppId = this.resolveAppId(payload?.appId);
    if (!resolvedAppId) {
      return throwError(() => new Error('appId requerido para quitar items del carrito'));
    }
    const body = { ...payload, appId: resolvedAppId };
    return this.http.post<Carrito>(`${API}/carrito/remove`, body, { headers: this.getAuthHeaders() });
  }
  vaciarCarrito(appId?: number): Observable<{ message: string }> {
    const resolvedAppId = this.resolveAppId(appId);
    const body = resolvedAppId ? { appId: resolvedAppId } : {};
    return this.http.post<{ message: string }>(`${API}/carrito/clear`, body, {
      headers: this.getAuthHeaders()
    });
  }

  getFormasPago(appId?: number, options?: { incluirInactivas?: boolean }): Observable<FormaPago[]> {
    const resolvedAppId = this.resolveAppId(appId);
    if (!resolvedAppId) {
      return throwError(() => new Error('appId requerido para consultar formas de pago'));
    }
    const params: any = { appId: resolvedAppId };
    if (options?.incluirInactivas) {
      params.incluirInactivas = options.incluirInactivas;
    }
    return this.http.get<FormaPago[]>(`${API}/formas-pago`, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  // Pedidos (protegido)
  getPedidos(): Observable<Pedido[]> { return this.http.get<Pedido[]>(`${API}/pedidos`, { headers: this.getAuthHeaders() }); }
  getPedido(id: number): Observable<Pedido> { return this.http.get<Pedido>(`${API}/pedidos/${id}`, { headers: this.getAuthHeaders() }); }
  /**
   * Devuelve las compras del usuario autenticado dentro de una app, incluyendo
   * el estado del pago y el envío (pedidoEnvio + envioEstado).
   * Endpoint backend esperado: GET /api/apps/:appId/mis-compras
   */
  getMisCompras(
    appId: number,
    opts?: { estado?: string | null; desde?: string | null; hasta?: string | null; page?: number; pageSize?: number; }
  ): Observable<Pedido[]> {
    let params: any = {};
    if (opts?.estado) params.estado = opts.estado;
    if (opts?.desde) params.desde = opts.desde;
    if (opts?.hasta) params.hasta = opts.hasta;
    if (opts?.page) params.page = String(opts.page);
    if (opts?.pageSize) params.pageSize = String(opts.pageSize);
    return this.http.get<Pedido[]>(`${API}/apps/${appId}/mis-compras`, {
      headers: this.getAuthHeaders(),
      params
    }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }
  confirmarPedido(
    productos: { title: string; quantity: number; unit_price: number; }[],
    impuestos: { nombre: string; valor: number; }[],
    cargos: { nombre: string; valor: number; }[],
    pedido: Partial<Pedido>
  ): Observable<Pedido> {
    // Enviar el objeto pedido completo, incluyendo items y cualquier otro campo
    return this.http.post<Pedido>(`${API}/pedido/confirmar`, pedido, { headers: this.getAuthHeaders() });
  }
  pagarPedido(id: number, datos: any): Observable<any> { return this.http.post(`${API}/pedidos/${id}/pagar`, datos, { headers: this.getAuthHeaders() }); }
  asignarRepartidor(id: number, repartidorId: number): Observable<any> { return this.http.post(`${API}/pedidos/${id}/asignar-repartidor`, { repartidorId }, { headers: this.getAuthHeaders() }); }
  seguimientoPedido(id: number): Observable<any> { return this.http.get(`${API}/pedidos/${id}/seguimiento`, { headers: this.getAuthHeaders() }); }

  // Promociones (protegido)
  getPromociones(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/promociones`, { headers: this.getAuthHeaders() });
  }
  getPromocion(id: number): Observable<Promocion> { return this.http.get<Promocion>(`${API}/promociones/${id}`, { headers: this.getAuthHeaders() }); }
  createPromocion(p: Promocion): Observable<Promocion> { return this.http.post<Promocion>(`${API}/promociones`, p, { headers: this.getAuthHeaders() }); }
  updatePromocion(p: Promocion): Observable<Promocion> { return this.http.put<Promocion>(`${API}/promociones/${p.id}`, p, { headers: this.getAuthHeaders() }); }
  deletePromocion(id: number): Observable<void> { return this.http.delete<void>(`${API}/promociones/${id}`, { headers: this.getAuthHeaders() }); }

  // Favoritos (protegido)
  getFavoritos(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/favoritos`, { headers: this.getAuthHeaders() }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }

  crearFavorito(payload: {
    productoId: number;
    notificarOfertas?: boolean;
    notificarNovedades?: boolean;
  }): Observable<any> {
    return this.http.post(`${API}/favoritos`, payload, { headers: this.getAuthHeaders() });
  }

  eliminarFavorito(payload: { productoId: number }): Observable<any> {
    return this.http.request('delete', `${API}/favoritos`, {
      headers: this.getAuthHeaders(),
      body: payload
    });
  }
  // Imputaciones generales (protegido)
  getModeloImputaciones(params?: any): Observable<any[]> {
    return this.http.get<any[]>(`${API}/modeloimputacion`, { headers: this.getAuthHeaders(), params });
  }
  postModeloImputaciones(body: { appId: number; aplica: string }): Observable<any[]> {
    return this.http.post<any[]>(`${API}/modeloimputacion`, body, {
      headers: this.getAuthHeaders().set('Content-Type', 'application/json')
    });
  }
  notificarFavoritosActualizados(): void {
    this.favoritosActualizadosSubject.next(null);
  }

  // Empresa pública por código (no protegido)
  getEmpresaByCodigo(codigo: string) {
    const codigoEmpresa = String(codigo || environment.empresaCodigoWeb || environment.empresaCodigo);
    // Agregado para depuración
    const cacheKey = `empresa_public_${codigoEmpresa}`;
    const cacheTsKey = `${cacheKey}_ts`;
    const cacheTtlMs = 5 * 60 * 1000;

    const cachedRaw = localStorage.getItem(cacheKey);
    const cachedTsRaw = localStorage.getItem(cacheTsKey);
    const cachedTs = cachedTsRaw ? Number(cachedTsRaw) : 0;
    const isCacheFresh = !!cachedRaw && !!cachedTs && (Date.now() - cachedTs) < cacheTtlMs;

    if (isCacheFresh) {
      try {
        return of(JSON.parse(cachedRaw) as Empresa);
      } catch {
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(cacheTsKey);
      }
    }

    return this.http.get<Empresa>(`${API}/empresas/public/${codigoEmpresa}`).pipe(
      tap((empresa) => {
        localStorage.setItem(cacheKey, JSON.stringify(empresa));
        localStorage.setItem(cacheTsKey, String(Date.now()));
      }),
      catchError((err) => {
        if (err?.status === 429 && cachedRaw) {
          try {
            return of(JSON.parse(cachedRaw) as Empresa);
          } catch {
            return throwError(() => err);
          }
        }
        return throwError(() => err);
      })
    );
  }

  // Tarjetas (protegido)
  getTarjetas(): Observable<Tarjeta[]> { return this.http.get<Tarjeta[]>(`${API}/tarjetas`, { headers: this.getAuthHeaders() }); }
  getTarjeta(id: number): Observable<Tarjeta> { return this.http.get<Tarjeta>(`${API}/tarjetas/${id}`, { headers: this.getAuthHeaders() }); }
  createTarjeta(t: Tarjeta): Observable<Tarjeta> { return this.http.post<Tarjeta>(`${API}/tarjetas`, t, { headers: this.getAuthHeaders() }); }
  updateTarjeta(t: Tarjeta): Observable<Tarjeta> { return this.http.put<Tarjeta>(`${API}/tarjetas/${t.id}`, t, { headers: this.getAuthHeaders() }); }
  deleteTarjeta(id: number): Observable<void> { return this.http.delete<void>(`${API}/tarjetas/${id}`, { headers: this.getAuthHeaders() }); }

  /**
   * Obtiene las tarjetas asociadas al usuario para una app
   * @param appId ID de la aplicación
   */
  /**
   * Obtiene las tarjetas asociadas al usuario para una app y medio de pago
   * @param appId ID de la aplicación
   * @param medioPagoId ID del medio de pago
   */
  getTarjetasUsuario(appId: number, medioPagoId?: number): Observable<Tarjeta[]> {

    const params: any = { appId };
    if (medioPagoId) params.medioPagoId = medioPagoId;
    return this.http.get<Tarjeta[]>(`${API}/tarjetas`, { headers: this.getAuthHeaders(), params });
  }

  // Auth
  register(datos: any): Observable<any> {
    return this.http.post(`${API}/auth/register`, {
      ...datos,
      empresaId: environment.empresaCodigo
    });
  }
  login(datos: any): Observable<any> { return this.http.post(`${API}/auth/login`, datos); }





  /**
   * Obtiene productos por subcategoría
   */
  getProductosPorSubcategoria(subcategoriaId: string | number): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${API}/productos/subcategoria/${subcategoriaId}`, { headers: this.getAuthHeaders() }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }


  // Ping
  ping(): Observable<any> {
    return this.http.get(`${API}/ping`);
  }

  private resolveAppId(appId?: number): number | null {
    if (typeof appId === 'number' && Number.isFinite(appId) && appId > 0) {
      return appId;
    }
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(this.selectedAppStorageKey);
      if (!raw) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  getPasarelasActivas(appId: number): Observable<{ id: number; nombre: string }[]> {
    return this.http.get<{ id: number; nombre: string }[]>(`${API}/pasarelaPago/activas/${appId}`, { headers: this.getAuthHeaders() });
  }
  /**
     * Simula el resultado de pago Mercado Pago (aprobado/rechazado) para pruebas
     * POST /api/apps/:appId/pedidos/:pedidoId/pago/mercadopago/webhook-sim
     */
  simularPagoMercadoPago(
    appId: number,
    pedidoId: number,
    status: 'approved' | 'rejected' | 'pending' | 'cancelled',
    payment_id: string,
    observacion: string
  ): Observable<any> {
    const body = { status, payment_id, observacion };
    return this.http.post(
      `${API}/apps/${appId}/pedidos/${pedidoId}/pago/mercadopago/webhook-sim`,
      body,
      { headers: this.getAuthHeaders().set('Content-Type', 'application/json') }
    );
  }





  /**
 * Obtiene el tracking de un envío por código (endpoint público)
 */
  getTracking(trackingCodigo: string) {
    return this.http.get<any>(`${API}/tracking/${trackingCodigo}`);
  }

  /**
   * Obtiene todas las categorías raíz (ProductoCategoria) de forma recursiva
   * GET /api/categorias/
   */
  getCategorias(): Observable<any[]> {
    return this.http.get<any[]>(`${API}/categorias`, { headers: this.getAuthHeaders() });
  }

  /**
   * Obtiene los productos de una categoría específica (ProductoCategoria)
   * GET /api/categorias/:id/productos
   */
  getProductosPorCategoria(categoriaId: string | number): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${API}/categorias/${categoriaId}/productos`, { headers: this.getAuthHeaders() }).pipe(
      map((response) => this.normalizarRespuestaConProductos(response))
    );
  }

  private normalizarRespuestaConProductos<T>(response: T): T {
    return normalizarMultimediaProducto(response);
  }
}
