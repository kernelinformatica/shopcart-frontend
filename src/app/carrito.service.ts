import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Subject } from 'rxjs';
import { catchError, finalize, switchMap, take } from 'rxjs/operators';
import { ApiService } from './api.service';
import { Carrito, CarritoItem as ApiCarritoItem, Producto } from './models';
import { ToastService } from './shared/toast.service';
import { resolveBackendMediaUrl } from './shared/utils/producto.utils';

export type CarritoItem = ApiCarritoItem & { showCargos?: boolean; promoActionDetail?: string };

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly selectedAppStorageKey = 'selectedAppId';
  private readonly medioPagoStorageKey = 'carritoMedioPagoCodigo';
  private readonly productoMetadataStorageKey = 'carritoProductoMetadata';
  private itemsSubject = new BehaviorSubject<CarritoItem[]>([]);
  readonly items$ = this.itemsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  // Subject que canaliza los refreshes: switchMap cancela el anterior si llega uno nuevo
  private refreshTrigger$ = new Subject<void>();

  private medioPagoSubject = new BehaviorSubject<string | null>(this.obtenerMedioPagoDesdeStorage());
  readonly medioPago$ = this.medioPagoSubject.asObservable();

  private appIdSubject = new BehaviorSubject<number | null>(this.obtenerAppIdDesdeStorage());
  readonly appId$ = this.appIdSubject.asObservable();

  private productoMetadata = new Map<number, Producto>();
  private productosEnriqueciendo = new Set<number>();

  constructor(
    private readonly apiService: ApiService,
    private readonly toastService: ToastService
  ) {
    // switchMap cancela el request anterior si llega un nuevo refresh antes de que complete.
    // catchError DENTRO del switchMap evita que un error HTTP mate la suscripción exterior:
    // la suscripción siempre queda viva para el siguiente refreshCarrito().
    this.refreshTrigger$
      .pipe(
        switchMap(() => {
          const appId = this.ensureAppId();
          if (!appId) {
            this.loadingSubject.next(false);
            return EMPTY;
          }
          this.loadingSubject.next(true);
          return this.apiService
            .getCarrito(this.medioPagoSubject.value, appId)
            .pipe(
              finalize(() => this.loadingSubject.next(false)),
              // Error HTTP: no borrar ítems existentes, solo silenciar y seguir vivo
              catchError(() => EMPTY)
            );
        })
      )
      .subscribe({
        next: (carrito: any) => this.actualizarDesdeCarrito(carrito)
      });

    this.restaurarProductoMetadataPersistida(this.appIdSubject.value);
    this.refreshCarrito();
  }

  get items(): CarritoItem[] {
    return this.itemsSubject.value;
  }

  get medioPago(): string | null {
    return this.medioPagoSubject.value;
  }

  get appId(): number | null {
    return this.appIdSubject.value;
  }

  setAppId(appId: number | null | undefined, options?: { forceRefresh?: boolean }): void {
    const normalizado = this.normalizarAppId(appId);
    const actual = this.appIdSubject.value;
    if (normalizado === actual) {
      if (options?.forceRefresh) {
        this.refreshCarrito();
      }
      return;
    }
    this.appIdSubject.next(normalizado);
    if (normalizado) {
      this.persistirAppId(normalizado);
    } else {
      this.removerAppIdPersistido();
    }
    this.restaurarProductoMetadataPersistida(normalizado);
    this.refreshCarrito();
  }

  setMedioPago(medio: string | null | undefined): void {
    const normalizado = this.normalizarMedioPago(medio);
    if (normalizado === this.medioPagoSubject.value) {
      return;
    }
    this.medioPagoSubject.next(normalizado);
    this.persistirMedioPago(normalizado);
    this.refreshCarrito();
  }

  refreshCarrito(): void {
    this.refreshTrigger$.next();
  }

  resetSesion(): void {
    this.itemsSubject.next([]);
    this.loadingSubject.next(false);
    this.medioPagoSubject.next(null);
    this.appIdSubject.next(null);
    this.productoMetadata.clear();
    this.productosEnriqueciendo.clear();
    this.removerAppIdPersistido();
    this.persistirMedioPago(null);
    this.persistirProductoMetadata();
  }

  agregar(producto: Producto, cantidad: number = 1, promoActionDetail?: string): void {
    const productoId = Number(producto?.id);
    if (!Number.isFinite(productoId) || productoId <= 0) {
      return;
    }
    const cantidadNormalizada = Math.max(1, Math.floor(Number(cantidad) || 1));
    this.cacheProductoMetadata(producto);
    this.enviarAdd(productoId, cantidadNormalizada, promoActionDetail);

    const nombre = producto?.nombre || 'Producto';
    const rawImg = producto?.imagenPrincipal || producto?.imagen || '';
    const imageUrl = rawImg ? resolveBackendMediaUrl(rawImg) : undefined;
    const cantMsg = cantidadNormalizada > 1 ? `${cantidadNormalizada} unidades agregadas` : 'Agregado al carrito';
    this.toastService.success(nombre, cantMsg, { imageUrl });
  }

  quitar(productoId: number): void {
    const existente = this.items.find((item) => item.producto.id === productoId);
    if (!existente) {
      return;
    }
    this.enviarRemove(productoId, existente.cantidad);
  }

  actualizarCantidad(productoId: number, cantidad: number, opciones?: { permitirCero?: boolean }): void {
    const permitirCero = opciones?.permitirCero !== false;
    const id = Number(productoId);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    const cantidadNormalizada = Math.floor(Number(cantidad) || 0);
    const cantidadObjetivo = permitirCero ? Math.max(0, cantidadNormalizada) : Math.max(1, cantidadNormalizada);
    if (!permitirCero && cantidadObjetivo <= 0) {
      return;
    }
    const itemActual = this.items.find((item) => item.producto.id === id);
    if (!itemActual) {
      if (cantidadObjetivo > 0) {
        this.refreshCarrito();
      }
      return;
    }
    const actual = itemActual.cantidad ?? 0;
    const diferencia = cantidadObjetivo - actual;
    if (diferencia === 0) {
      return;
    }
    this.aplicarCantidadLocal(id, cantidadObjetivo, itemActual.producto);
    if (!permitirCero && cantidadObjetivo > 0 && diferencia < 0) {
      this.sincronizarCarritoEstadoActual();
      return;
    }
    if (cantidadObjetivo === 0) {
      this.enviarRemove(id, actual);
    } else if (diferencia > 0) {
      this.enviarAdd(id, diferencia);
    } else {
      this.enviarRemove(id, Math.abs(diferencia));
    }
  }

  limpiar(): void {
    const appId = this.ensureAppId();
    if (!appId) {
      this.itemsSubject.next([]);
      return;
    }
    this.itemsSubject.next([]);
    this.loadingSubject.next(true);
    this.apiService
      .vaciarCarrito(appId)
      .pipe(take(1), finalize(() => this.refreshCarrito()))
      .subscribe({
        next: () => {},
        error: (error) => {
          if (error?.status === 404) {
            this.itemsSubject.next([]);
          }
        }
      });
  }

  private aplicarCantidadLocal(productoId: number, cantidad: number, producto?: Producto): void {
    const items = [...this.itemsSubject.value];
    const index = items.findIndex((item) => Number(item?.producto?.id) === productoId);
    if (index >= 0) {
      if (cantidad <= 0) {
        items.splice(index, 1);
      } else {
        items[index] = { ...items[index], cantidad };
      }
      this.itemsSubject.next(items);
      return;
    }
    if (cantidad > 0 && producto) {
      items.push({ producto, cantidad });
      this.itemsSubject.next(items);
    }
  }

  private sincronizarCarritoEstadoActual(): void {
    const appId = this.ensureAppId();
    if (!appId) {
      this.refreshCarrito();
      return;
    }
    const payload: any = {
      appId,
      items: this.itemsSubject.value.map((item) => ({
        producto: item.producto,
        cantidad: item.cantidad
      })),
      total: this.total,
      metodoPago: this.medioPagoSubject.value || '',
      medioPagoReferencia: null,
      tarjetaId: null,
      promocionesAplicadas: null
    };
    this.loadingSubject.next(true);
    this.apiService
      .updateCarrito(payload)
      .pipe(take(1), finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (carrito) => this.actualizarDesdeCarrito(carrito),
        error: () => this.refreshCarrito()
      });
  }

  get total(): number {
    return this.items.reduce((sum, item) => {
      const precioUnitario = this.getPrecioAplicadoProducto(item.producto);
      return sum + precioUnitario * item.cantidad;
    }, 0);
  }

  getPrecioAplicadoProducto(producto?: Producto | null): number {
    if (!producto) {
      return 0;
    }
    const promoCantidad = this.obtenerPromoCantidad(producto);
    if (promoCantidad && promoCantidad.llevar > 0 && promoCantidad.pagar > 0) {
      const cantidadEnCarrito = this.obtenerCantidadEnCarrito(producto);
      const precioBaseCantidad = this.normalizarPrecio(
        (producto as any)?.precioDescuento ??
        (producto as any)?.precio_descuento ??
        (producto as any)?.finalPrice ??
        (producto as any)?.final_price ??
        producto.precioFinal ??
        (producto as any)?.precioFinal ??
        (producto as any)?.precio_final ??
        producto.precio ??
        producto.precioLista ??
        (producto as any)?.precioLista ??
        (producto as any)?.precio_lista ??
        producto.precioBase ??
        (producto as any)?.precio_base
      ) ?? 0;
      if (cantidadEnCarrito < promoCantidad.llevar) {
        return precioBaseCantidad;
      }
      const grupos = Math.floor(cantidadEnCarrito / promoCantidad.llevar);
      const resto = cantidadEnCarrito % promoCantidad.llevar;
      const totalPagar = (grupos * promoCantidad.pagar * precioBaseCantidad) + (resto * precioBaseCantidad);
      return cantidadEnCarrito > 0 ? totalPagar / cantidadEnCarrito : precioBaseCantidad;
    }
    const precioFinal = this.normalizarPrecio((producto as any)?.finalPrice ?? (producto as any)?.final_price ?? producto.precioFinal ?? (producto as any)?.precioFinal ?? (producto as any)?.precio_final);
    // Priorizar siempre el precio final de la promoción; precioVisual queda solo como respaldo.
    if (precioFinal !== null) {
      return precioFinal;
    }
    const precioDescuento = this.normalizarPrecio(
      (producto as any)?.precioDescuento ??
      (producto as any)?.precio_descuento ??
      (producto as any)?.precioPromo ??
      (producto as any)?.precio_promo
    );
    if (precioDescuento !== null) {
      return precioDescuento;
    }
    // Si el producto tiene precioVisual, usarlo como fallback (ya calculado en item-producto).
    if (producto.precioVisual !== undefined && producto.precioVisual !== null) {
      return this.normalizarPrecio(producto.precioVisual) ?? 0;
    }
    const precioOriginal = this.normalizarPrecio((producto as any)?.originalPrice ?? (producto as any)?.original_price ?? producto.precioLista ?? (producto as any)?.precioLista ?? (producto as any)?.precio_lista ?? producto.precio ?? producto.precioBase ?? producto.precioBase ?? (producto as any)?.precio_base);

    // Lógica original como backup
    const promos = Array.isArray(producto.promociones) ? producto.promociones : [];
    const candidatosBase = [
      precioOriginal,
      this.normalizarPrecio(producto.precioConImpuestos),
      this.normalizarPrecio((producto as any)?.precioConImpuestos),
      this.normalizarPrecio((producto as any)?.precio_con_impuestos),
      this.normalizarPrecio(producto.precioUnitario),
      this.normalizarPrecio((producto as any)?.precioUnitario),
      this.normalizarPrecio((producto as any)?.precio_unitario)
    ];
    let valor = candidatosBase.find((precio) => precio !== null) ?? null;

    // --- Lógica especial para x_por_y ---
    // Buscar si hay promo x_por_y activa
    const promoXPorY = promos.find((p: any) => {
      const alias = p.promocionTipo?.alias || p.tipo || '';
      return alias === 'x_por_y' && Array.isArray(p.acciones) && p.acciones.length > 0;
    });
    if (promoXPorY && Array.isArray(promoXPorY.acciones)) {
      // Buscar la acción relevante
      const accion = promoXPorY.acciones.find((a: any) => a.tipoAccion === 'x_por_y');
      // Obtener cantidad en carrito (si existe)
      let cantidadEnCarrito = 1;
      // Buscar en items del carrito
      const itemCarrito = this.items.find((item) => item.producto.id === producto.id);
      if (itemCarrito) {
        cantidadEnCarrito = itemCarrito.cantidad ?? 1;
      } else if (typeof producto.cantidad === 'number') {
        cantidadEnCarrito = producto.cantidad;
      }
      // El umbral es el valor principal de la acción (ej: 3 en 3x2)
      const llevar = accion?.valor ?? 0;
      const pagar = accion?.valorExtra ?? 0;
      if (llevar > 0 && cantidadEnCarrito < llevar) {
        // No aplicar descuento, mostrar precio normal
        return valor ?? 0;
      } else if (llevar > 0 && pagar > 0 && cantidadEnCarrito >= llevar) {
        // Si cumple el umbral, calcular precio unitario efectivo x_por_y
        // Ejemplo: 3x2 => llevar=3, pagar=2
        const precioRegular = valor ?? 0;
        // Calcular cuántos grupos de promo entran
        const grupos = Math.floor(cantidadEnCarrito / llevar);
        const resto = cantidadEnCarrito % llevar;
        // Total a pagar: grupos * pagar * precioRegular + resto * precioRegular
        const totalPagar = (grupos * pagar * precioRegular) + (resto * precioRegular);
        // Precio unitario efectivo
        const precioUnitarioEfectivo = totalPagar / cantidadEnCarrito;
        return precioUnitarioEfectivo;
      }
      // Si no hay precio promocional, dejar que siga la lógica normal
    }

    // Solo aplicar descuento si hay promo de tipo 'descuento'
    const tieneSoloCuotasOBanco = promos.length > 0 && promos.every((p: any) => {
      const alias = p.promocionTipo?.alias || p.tipo || '';
      return alias.includes('cuota') || alias.includes('banco');
    });
    const tieneDescuento = promos.some((p: any) => {
      const alias = p.promocionTipo?.alias || p.tipo || '';
      if (alias === 'descuento') return true;
      if (Array.isArray(p.acciones)) {
        return p.acciones.some((a: any) => a.tipoAccion === 'descuento');
      }
      return false;
    });
    if (!tieneSoloCuotasOBanco && tieneDescuento) {
      const candidatosDescuento = [
        this.normalizarPrecio(producto.precioDescuento),
        this.normalizarPrecio((producto as any)?.precio_descuento),
        this.normalizarPrecio((producto as any)?.finalPrice),
        this.normalizarPrecio((producto as any)?.final_price)
      ];
      const mejorPromo = this.obtenerMejorPrecioPromo(producto);
      for (const descuento of candidatosDescuento) {
        if (descuento !== null) {
          valor = valor === null ? descuento : Math.min(valor, descuento);
        }
      }
      if (mejorPromo !== null) {
        valor = valor === null ? mejorPromo : Math.min(valor, mejorPromo);
      }
    }
    return valor ?? 0;
  }

  private obtenerCantidadEnCarrito(producto: Producto): number {
    const itemCarrito = this.items.find((item) => item.producto.id === producto.id);
    if (itemCarrito) {
      return Math.max(1, Math.floor(Number(itemCarrito.cantidad) || 1));
    }
    if (typeof (producto as any)?.cantidad === 'number') {
      return Math.max(1, Math.floor(Number((producto as any).cantidad) || 1));
    }
    return 1;
  }

  private obtenerPromoCantidad(producto?: Producto | null): { llevar: number; pagar: number } | null {
    if (!producto || !Array.isArray(producto.promociones)) {
      return null;
    }

    for (const promo of producto.promociones as any[]) {
      const alias = String(promo?.promocionTipo?.alias || promo?.tipo || '').trim();
      if (alias !== 'x_por_y') {
        continue;
      }

      const acciones = Array.isArray(promo?.acciones) ? promo.acciones : [];
      const accion = acciones.find((a: any) => {
        const tipoAccion = String(a?.tipoAccion || '').trim().toLowerCase();
        return tipoAccion === 'x_por_y' || tipoAccion === 'promo_cantidad' || /^\d+x\d+$/.test(tipoAccion);
      }) ?? acciones[0];

      const desdeAccion = this.extraerPromoCantidadDesdeAccion(accion);
      if (desdeAccion) {
        return desdeAccion;
      }

      const desdePromo = this.extraerPromoCantidadDesdeTexto(promo);
      if (desdePromo) {
        return desdePromo;
      }
    }

    return null;
  }

  private extraerPromoCantidadDesdeAccion(accion: any): { llevar: number; pagar: number } | null {
    if (!accion) {
      return null;
    }

    const tipoAccion = String(accion?.tipoAccion || '').trim().toLowerCase();
    const valor = this.normalizarEntero(accion?.valor);
    const valorExtra = this.normalizarEntero(accion?.valorExtra);

    if (/^\d+x\d+$/.test(tipoAccion)) {
      const partes = tipoAccion.split('x').map((parte) => Number(parte));
      if (partes.length === 2 && partes.every((numero) => Number.isFinite(numero) && numero > 0)) {
        return { llevar: partes[0], pagar: partes[1] };
      }
    }

    if (tipoAccion === 'x_por_y' || tipoAccion === 'promo_cantidad') {
      if (valor > 0 && valorExtra > 0) {
        return { llevar: valor, pagar: valorExtra };
      }
      if (valor > 0 && valorExtra === 0) {
        return { llevar: valor, pagar: 1 };
      }
    }

    return null;
  }

  private extraerPromoCantidadDesdeTexto(promo: any): { llevar: number; pagar: number } | null {
    const candidatos = [
      promo?.nombre,
      promo?.descripcion,
      promo?.beneficioDetalle?.join(' '),
      promo?.acciones?.map((a: any) => a?.detalle).filter(Boolean).join(' ')
    ];

    for (const candidato of candidatos) {
      const texto = String(candidato || '').toLowerCase().replace(/\s+/g, '');
      const match = texto.match(/(\d+)x(\d+)/);
      if (match) {
        const llevar = Number(match[1]);
        const pagar = Number(match[2]);
        if (Number.isFinite(llevar) && Number.isFinite(pagar) && llevar > 0 && pagar > 0) {
          return { llevar, pagar };
        }
      }
    }

    return null;
  }

  private normalizarEntero(valor: unknown): number {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero <= 0) {
      return 0;
    }
    return Math.floor(numero);
  }

  getPrecioReferenciaProducto(producto?: Producto | null): number | null {
    if (!producto) {
      return null;
    }
    const precioFinal = this.getPrecioAplicadoProducto(producto);
    const epsilon = 0.0001;
    const candidatos: Array<unknown> = [
      (producto as any)?.precioOriginal,
      (producto as any)?.precio_original,
      (producto as any)?.precioPublico,
      (producto as any)?.precio_publico,
      (producto as any)?.precioLista,
      (producto as any)?.precio_lista,
      (producto as any)?.precioCliente,
      (producto as any)?.precio_cliente,
      producto.precioLista,
      producto.precio,
      (producto as any)?.precio,
      producto.precioConImpuestos,
      (producto as any)?.precioConImpuestos,
      (producto as any)?.precio_con_impuestos,
      producto.precioBase,
      producto.precio_base,
      (producto as any)?.precioBase,
      (producto as any)?.precio_base,
      producto.precioVisual,
      (producto as any)?.precioVisual,
      (producto as any)?.precio_visual
    ];

    let referencia: number | null = null;
    for (const candidato of candidatos) {
      const valor = this.normalizarPrecio(candidato);
      if (valor !== null && valor > precioFinal + epsilon) {
        referencia = referencia === null ? valor : Math.max(referencia, valor);
      }
    }
    return referencia;
  }

  private enviarAdd(productoId: number, cantidad: number, promoActionDetail?: string): void {
    if (!Number.isFinite(productoId) || productoId <= 0 || cantidad <= 0) {
      return;
    }
    const appId = this.ensureAppId();
    if (!appId) {
      return;
    }
    this.loadingSubject.next(true);
    this.apiService
      .agregarItemCarrito({ productoId, cantidad, medioPago: this.medioPagoSubject.value || undefined, appId, promoActionDetail })
      .pipe(take(1), finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (carrito) => {
          if (carrito && Array.isArray(carrito.items)) {
            this.actualizarDesdeCarrito(carrito);
          } else {
            this.refreshCarrito();
          }
        },
        error: () => this.refreshCarrito()
      });
  }

  private enviarRemove(productoId: number, cantidad: number): void {
    if (!Number.isFinite(productoId) || productoId <= 0 || cantidad <= 0) {
      return;
    }
    const appId = this.ensureAppId();
    if (!appId) {
      return;
    }
    this.loadingSubject.next(true);
    this.apiService
      .removerItemCarrito({ productoId, cantidad, medioPago: this.medioPagoSubject.value || undefined, appId })
      .pipe(take(1), finalize(() => this.loadingSubject.next(false)))
      .subscribe({
        next: (carrito) => {
          if (carrito && Array.isArray(carrito.items)) {
            this.actualizarDesdeCarrito(carrito);
          } else {
            this.refreshCarrito();
          }
        },
        error: () => this.refreshCarrito()
      });
  }

  private actualizarDesdeCarrito(carrito?: Carrito | null): void {
    if (!carrito || !Array.isArray(carrito.items)) {
      return;
    }
    const itemsNormalizados = carrito.items.map((item) => this.normalizarItemCarrito(item));
    const items = this.mergeItemsConMetadata(itemsNormalizados);
    items.forEach((item) => this.cacheProductoMetadata(item.producto));
    this.itemsSubject.next(items);
    this.enriquecerProductosDesdeApi(items);
  }

  private ensureAppId(): number | null {
    const actual = this.appIdSubject.value;
    if (typeof actual === 'number' && actual > 0) {
      return actual;
    }
    const almacenado = this.obtenerAppIdDesdeStorage();
    if (almacenado) {
      this.appIdSubject.next(almacenado);
      return almacenado;
    }
    return null;
  }

  private obtenerAppIdDesdeStorage(): number | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(this.selectedAppStorageKey);
    return this.normalizarAppId(raw);
  }

  private obtenerMedioPagoDesdeStorage(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(this.medioPagoStorageKey);
    return this.normalizarMedioPago(raw);
  }

  private normalizarAppId(valor: unknown): number | null {
    const parsed = Number(valor);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private normalizarMedioPago(valor: unknown): string | null {
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      return String(valor);
    }
    if (typeof valor === 'string') {
      const trimmed = valor.trim();
      return trimmed.length ? trimmed : null;
    }
    return null;
  }

  private persistirAppId(appId: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(this.selectedAppStorageKey, String(appId));
    } catch {}
  }

  private persistirMedioPago(codigo: string | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      if (codigo) {
        localStorage.setItem(this.medioPagoStorageKey, codigo);
      } else {
        localStorage.removeItem(this.medioPagoStorageKey);
      }
    } catch {}
  }

  private removerAppIdPersistido(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(this.selectedAppStorageKey);
    } catch {}
  }

  private getProductoMetadataStorageKey(appIdOverride?: number | null): string {
    const appIdPersistido = typeof appIdOverride === 'number' && appIdOverride > 0
      ? appIdOverride
      : this.appIdSubject.value ?? this.obtenerAppIdDesdeStorage();
    return appIdPersistido
      ? `${this.productoMetadataStorageKey}_app_${appIdPersistido}`
      : this.productoMetadataStorageKey;
  }

  private persistirProductoMetadata(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const key = this.getProductoMetadataStorageKey();
      if (!this.productoMetadata.size) {
        localStorage.removeItem(key);
        return;
      }
      const plain: Record<string, Producto> = {};
      for (const [id, data] of this.productoMetadata.entries()) {
        plain[String(id)] = data;
      }
      localStorage.setItem(key, JSON.stringify(plain));
    } catch {}
  }

  private restaurarProductoMetadataPersistida(appIdOverride?: number | null): void {
    this.productoMetadata.clear();
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const key = this.getProductoMetadataStorageKey(appIdOverride);
      const raw = localStorage.getItem(key);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return;
      }
      Object.entries(parsed).forEach(([keyId, value]) => {
        const id = Number(keyId);
        if (!Number.isFinite(id)) {
          return;
        }
        this.productoMetadata.set(id, this.normalizarProductoCampos(value as Producto));
      });
    } catch {}
  }

  private normalizarItemCarrito(item: CarritoItem): CarritoItem {
    const productoNormalizado = this.normalizarProductoCampos(item?.producto);
    const cantidad = Number(item?.cantidad) && Number(item?.cantidad) > 0 ? Number(item.cantidad) : 1;
    const precioConImpuestos = this.normalizarPrecio((item as any)?.precioConImpuestos ?? (item as any)?.precio_con_impuestos);
    const precioBase = this.normalizarPrecio((item as any)?.precioBase ?? (item as any)?.precio_base);
    let precioUnitario = this.normalizarPrecio((item as any)?.precioUnitario ?? (item as any)?.precio_unitario);

    if (precioUnitario === null) {
      if (precioConImpuestos !== null) {
        precioUnitario = precioConImpuestos;
      } else if (precioBase !== null) {
        precioUnitario = precioBase;
      }
    }

    if (precioUnitario === null) {
      const total = this.normalizarPrecio(
        (item as any)?.total ?? (item as any)?.importe ?? (item as any)?.precioTotal ?? (item as any)?.subtotal
      );
      if (total !== null && cantidad > 0) {
        precioUnitario = total / cantidad;
      }
    }

    if (precioBase !== null) {
      if (productoNormalizado.precioBase == null) {
        productoNormalizado.precioBase = precioBase;
      }
      if (productoNormalizado.precio_base == null) {
        productoNormalizado.precio_base = precioBase;
      }
    }

    if (precioConImpuestos !== null) {
      if ((productoNormalizado as any).precioConImpuestos == null) {
        (productoNormalizado as any).precioConImpuestos = precioConImpuestos;
      }
      if ((productoNormalizado as any).precio_con_impuestos == null) {
        (productoNormalizado as any).precio_con_impuestos = precioConImpuestos;
      }
      if (productoNormalizado.precio == null) {
        productoNormalizado.precio = precioConImpuestos;
      }
      if (productoNormalizado.precioFinal == null) {
        productoNormalizado.precioFinal = precioConImpuestos;
      }
    }

    if (precioUnitario !== null) {
      if (productoNormalizado.precio == null) {
        productoNormalizado.precio = precioUnitario;
      }
      if ((productoNormalizado as any).precioUnitario == null) {
        (productoNormalizado as any).precioUnitario = precioUnitario;
      }
      if (productoNormalizado.precioLista == null) {
        productoNormalizado.precioLista = precioUnitario;
      }
    }

    return {
      ...item,
      cantidad,
      precioUnitario: precioUnitario ?? (item as any)?.precioUnitario ?? undefined,
      precioConImpuestos: precioConImpuestos ?? (item as any)?.precioConImpuestos ?? undefined,
      precioBase: precioBase ?? (item as any)?.precioBase ?? undefined,
      producto: productoNormalizado
    };
  }

  private mergeItemsConMetadata(items: CarritoItem[]): CarritoItem[] {
    if (!items?.length) {
      return [];
    }
    return items.map((item) => {
      const id = this.obtenerIdProducto(item?.producto);
      let productoMezclado: Producto | null = item.producto ?? null;
      if (id) {
        const metadata = this.productoMetadata.get(id);
        if (metadata) {
          console.log('[mergeItemsConMetadata] Producto', id, 'metadata.modeloImputacion:', metadata.modeloImputacion, 'item.producto.modeloImputacion:', item.producto?.modeloImputacion);
          // Elegir el array más completo
          let modeloImputacionFinal = undefined;
          const arrMeta = Array.isArray(metadata.modeloImputacion) ? metadata.modeloImputacion : [];
          const arrProd = Array.isArray(item.producto?.modeloImputacion) ? item.producto.modeloImputacion : [];
          if (arrMeta.length >= arrProd.length && arrMeta.length > 0) {
            modeloImputacionFinal = arrMeta;
          } else if (arrProd.length > 0) {
            modeloImputacionFinal = arrProd;
          }
          productoMezclado = {
            ...item.producto,
            ...metadata,
            modeloImputacion: modeloImputacionFinal
          };
        }
      }
      const productoNormalizado = this.normalizarProductoCampos(productoMezclado);
      console.log('[mergeItemsConMetadata] Producto', id, 'productoNormalizado.modeloImputacion:', productoNormalizado?.modeloImputacion);
      return {
        ...item,
        producto: productoNormalizado
      };
    });
  }

  private cacheProductoMetadata(producto?: Producto | null): void {
    const id = this.obtenerIdProducto(producto);
    if (!id) {
      return;
    }
    const normalizado = this.normalizarProductoCampos(producto);
    const existente = this.productoMetadata.get(id);
    if (existente) {
      this.productoMetadata.set(id, this.combinarProductoMetadata(existente, normalizado));
    } else {
      this.productoMetadata.set(id, normalizado);
    }
    this.persistirProductoMetadata();
  }

  private combinarProductoMetadata(actual: Producto, nuevo: Producto): Producto {
    const resultado: any = { ...actual };
    Object.entries(nuevo ?? {}).forEach(([clave, valor]) => {
      if (Array.isArray(valor)) {
        if (valor.length) {
          resultado[clave] = valor;
        }
        return;
      }
      if (valor !== undefined && valor !== null) {
        resultado[clave] = valor;
      }
    });
    return resultado as Producto;
  }

  private normalizarProductoCampos(producto?: Producto | null): Producto {
    const base: any = { ...(producto ?? {}) };
    const precioPrincipal = this.extraerValorNumerico(base, [
      'precioFinal',
      'precio_final',
      'precio',
      'precio_lista',
      'precioLista',
      'precioVenta',
      'precio_venta',
      'precioPublico',
      'precio_publico',
      'precioCliente',
      'precio_cliente',
      'precioConImpuestos',
      'precio_con_impuestos',
      'precioBase',
      'precio_base',
      'precioUnitario',
      'precio_unitario',
      'precioVisual',
      'precio_visual',
      'originalPrice',
      'original_price'
    ]);
    if (base.precio == null && precioPrincipal !== null) {
      base.precio = precioPrincipal;
    }
    if (base.originalPrice == null) {
      const originalPrice = this.extraerValorNumerico(base, ['originalPrice', 'original_price', 'precioLista', 'precio_lista', 'precioBase', 'precio_base', 'precio']);
      if (originalPrice !== null) {
        base.originalPrice = originalPrice;
      }
    }
    if (base.original_price == null && base.originalPrice != null) {
      base.original_price = base.originalPrice;
    }
    if (base.precioLista == null) {
      const precioLista = this.extraerValorNumerico(base, ['precio_lista', 'precioLista', 'precioPublico', 'precio_publico']);
      if (precioLista !== null) {
        base.precioLista = precioLista;
      } else if (base.precio != null) {
        base.precioLista = base.precio;
      }
    }
    if (base.precioFinal == null) {
      const precioFinal = this.extraerValorNumerico(base, ['finalPrice', 'final_price', 'precioFinal', 'precio_final']);
      if (precioFinal !== null) {
        base.precioFinal = precioFinal;
      }
    }
    if ((base as any).finalPrice == null && base.precioFinal != null) {
      (base as any).finalPrice = base.precioFinal;
    }
    if ((base as any).final_price == null && base.precioFinal != null) {
      (base as any).final_price = base.precioFinal;
    }
    if ((base as any).precioConImpuestos == null) {
      const precioConImpuestos = this.extraerValorNumerico(base, ['precioConImpuestos', 'precio_con_impuestos']);
      if (precioConImpuestos !== null) {
        base.precioConImpuestos = precioConImpuestos;
      }
    }
    if (base.precio_con_impuestos == null && base.precioConImpuestos != null) {
      base.precio_con_impuestos = base.precioConImpuestos;
    }
    if (base.precioBase == null) {
      const precioBaseValor = this.extraerValorNumerico(base, ['precioBase', 'precio_base']);
      if (precioBaseValor !== null) {
        base.precioBase = precioBaseValor;
      }
    }
    if (base.precio_base == null && base.precioBase != null) {
      base.precio_base = base.precioBase;
    }
    if (base.precioUnitario == null) {
      const precioUnitario = this.extraerValorNumerico(base, ['precioUnitario', 'precio_unitario']);
      if (precioUnitario !== null) {
        base.precioUnitario = precioUnitario;
      }
    }
    if (base.precio == null && base.precioUnitario != null) {
      base.precio = base.precioUnitario;
    }
    if (base.precioDescuento == null) {
      const precioDescuento = this.extraerValorNumerico(base, ['precioDescuento', 'precio_descuento', 'precioPromo', 'precio_promo']);
      if (precioDescuento !== null) {
        base.precioDescuento = precioDescuento;
      }
    }
    if (base.precio == null && Array.isArray(base.precios)) {
      for (const item of base.precios) {
        const valor = this.extraerValorNumerico(item, ['precio', 'precioVenta', 'precio_venta', 'precio_lista', 'precioLista']);
        if (valor !== null) {
          base.precio = valor;
          if (base.precioLista == null) {
            base.precioLista = valor;
          }
          break;
        }
      }
    }
    // Unificar: si existe modeloImputaciones, siempre lo asignamos a modeloImputacion
    if (Array.isArray(base.modeloImputaciones)) {
      base.modeloImputacion = base.modeloImputaciones;
      delete base.modeloImputaciones;
    }
    console.log('[normalizarProductoCampos] id:', base?.id, 'modeloImputacion:', base?.modeloImputacion);
    return base as Producto;
  }

  private extraerValorNumerico(fuente: any, claves: string[]): number | null {
    if (!fuente) {
      return null;
    }
    for (const clave of claves) {
      if (fuente[clave] === undefined || fuente[clave] === null) {
        continue;
      }
      const valor = this.normalizarPrecio(fuente[clave]);
      if (valor !== null) {
        return valor;
      }
    }
    return null;
  }

  private enriquecerProductosDesdeApi(items: CarritoItem[]): void {
    if (!items?.length) {
      return;
    }
    const procesados = new Set<number>();
    for (const item of items) {
      const id = this.obtenerIdProducto(item?.producto);
      if (!id || procesados.has(id) || this.productoMetadata.has(id) || this.productosEnriqueciendo.has(id)) {
        continue;
      }
      procesados.add(id);
      this.productosEnriqueciendo.add(id);
      this.apiService
        .getProducto(id)
        .pipe(take(1), finalize(() => this.productosEnriqueciendo.delete(id)))
        .subscribe({
          next: (productoDetalle) => {
            this.cacheProductoMetadata(productoDetalle);
            this.itemsSubject.next(this.mergeItemsConMetadata(this.itemsSubject.value));
          },
          error: () => {}
        });
    }
  }

  private obtenerIdProducto(producto?: Producto | null): number | null {
    const id = Number(producto?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private obtenerMejorPrecioPromo(producto?: Producto | null): number | null {
    if (!producto?.promociones?.length) {
      return null;
    }
    let mejor: number | null = null;
    for (const promo of producto.promociones) {
      const candidatos = [promo?.['precio_descuento'], promo?.['precio']];
      for (const candidato of candidatos) {
        const valor = this.normalizarPrecio(candidato);
        if (valor === null) {
          continue;
        }
        if (mejor === null || valor < mejor) {
          mejor = valor;
        }
      }
    }
    return mejor;
  }

  private normalizarPrecio(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
    if (typeof value === 'string') {
      const sanitized = value
        .replace(/[^0-9,.-]/g, '')
        .replace(/(?!^)-/g, '')
        .replace(/\.(?=.*\.)/g, '')
        .replace(',', '.');
      const parsed = Number(sanitized);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }
    return null;
  }

}
