import { BehaviorSubject } from 'rxjs';

import { ViewChild } from '@angular/core';
import { MisComprasModalComponent } from '../features/public/pedido/mis-compras-modal/mis-compras-modal.component';
import { ToastComponent } from '../shared/components/toast/toast.component';
 

import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap, take, takeUntil, tap, timeout } from 'rxjs/operators';
import { ApiService } from '../api.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { CarritoItem, CarritoService } from '../carrito.service';
import { CompanyService } from '../company.service';
import {
  App,
  Empresa,
  EnvioEstado,
  FormaPago,
  Localidad,
  PrecisionGeo,
  UsuarioDireccion,
  EntregaTipo,
  EntregaOpcion,
  CotizacionEntregaResponse,
  CrearUsuarioDireccionPayload,
  Pedido,
  PedidoEnvio,
  PedidoEnvioPricingMetadata,
  PedidoEnvioPayload,
  PedidoItemPayload,
  PedidoEnvioEstadoCambioPayload,
  Promocion,
  Usuario
} from '../models';
import { LogisticaService } from '../logistica.service';
import { AuthUserService } from '../auth-user.service';
import { CheckoutEntregaService } from '../checkout-entrega.service';
import { environment } from '../../environments/environment';
import { Inject } from '@angular/core';
import { EscapeCurlyBracesPipe } from '../shared/escape-curly-braces.pipe';
import { resolveMarcaLogo, extractMarcaLogoValue } from '../shared/utils/producto.utils';

@Component({
  selector: 'app-store-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, MisComprasModalComponent, ToastComponent],
  templateUrl: './store-layout.component.html',
  styleUrls: ['./store-layout.component.scss']
})
export class StoreLayoutComponent implements OnInit, OnDestroy {
  // El constructor principal ya está más abajo, eliminar este duplicado
  // --- Permisos administrativos para menú admin ---
  adminPerms: any[] = [];
  esAdmin: boolean = false;
            // DEBUG: Forzar permiteProgramar en todas las opciones para depuración visual
            ngAfterViewInit(): void {
              setTimeout(() => {
                if (Array.isArray(this.entregaOpciones)) {
                  this.entregaOpciones.forEach(o => o.permiteProgramar = true);
                }
              }, 0);
            }
          // Getter para saber si la opción seleccionada permite programar
          get entregaOpcionPermiteProgramar(): boolean {
            if (!this.selectedEntregaOpcionId) return false;
            const opcion = this.entregaOpciones.find(o => o.id === this.selectedEntregaOpcionId);
            return !!opcion?.permiteProgramar;
          }
        // Campos para fecha y horario de entrega
        fechaProgramada?: string;
        horaVentanaDesde?: string;
        horaVentanaHasta?: string;
          categorias: any[] = [];
      misComprasCount$ = new BehaviorSubject<number>(0);

      actualizarMisComprasCount(): void {
        const appId = this.obtenerAppIdOperativo();
        if (!appId) {
          this.misComprasCount$.next(0);
          return;
        }
        this.apiService.getMisCompras(appId).pipe(take(1)).subscribe({
          next: compras => this.misComprasCount$.next(Array.isArray(compras) ? compras.length : 0),
          error: () => this.misComprasCount$.next(0)
        });
      }
    statusCodeConfirmacion?: number;
    mercadoPagoResultado?: 'aprobado' | 'rechazado' | 'pendiente' | null = null;
    mercadoPagoMensaje?: string;
  // Mock de cuentas/tarjetas/billeteras del usuario
  mostrarModalPago: boolean = false;
  mercadoPagoScriptLoaded = false;
  mercadoPagoWidgetLoaded = false;
  mercadoPagoPreferenceId: string | null = null;
  mercadoPagoPedidoId: number | null = null;
      private pedidoPollingInterval: any = null;
    private ultimoEstadoPedido: string | null = null;
    private ultimoEstadoNotificado: string | null = null;

  cuentasUsuario: any[] = [
    { id: 1, tipo: 'tarjeta', numero: '1234 5678 9012 3456', nombreTitular: 'Juan Pérez', vencimiento: '12/28', cvv: '123', descripcion: 'Visa débito' },
    { id: 2, tipo: 'mercadopago', cbu: '0000003100000000000001', alias: 'juan.mp', descripcion: 'Mi cuenta Mercado Pago' }
  ];
  cuentaSeleccionadaId: any = this.cuentasUsuario.length === 0 ? 'nueva' : null;
  cuentaNueva: any = { tipo: 'tarjeta' };
// Reinicia el offcanvas del carrito si está vacío
  private reiniciarOffcanvasCarritoSiVacio() {
    setTimeout(() => {
      if (this.carritoService.items.length === 0) {
        const offcanvas = document.getElementById('carritoOffcanvasGlobal');
        if (offcanvas && (window as any).bootstrap?.Offcanvas) {
          const bsOffcanvas = (window as any).bootstrap.Offcanvas.getInstance(offcanvas);
          if (bsOffcanvas) {
            bsOffcanvas.hide();
          }
        }
      }
    }, 300);
  }
  // --- Funciones auxiliares para promos x_por_y en el carrito ---
  public esPromoXPorY(item: CarritoItem): boolean {
    if (!item?.producto?.promociones) return false;
    return item.producto.promociones.some((p: any) => (p.promocionTipo?.alias || p.tipo) === 'x_por_y');
  }

  public getUmbralPromoXPorY(item: CarritoItem): number | null {
    if (!item?.producto?.promociones) return null;
    const promo = item.producto.promociones.find((p: any) => (p.promocionTipo?.alias || p.tipo) === 'x_por_y');
    if (!promo || !Array.isArray(promo.acciones)) return null;
    const accion = promo.acciones.find((a: any) => {
      const tipoAccion = String(a?.tipoAccion || '').trim().toLowerCase();
      return tipoAccion === 'x_por_y' || tipoAccion === 'promo_cantidad' || /^\d+x\d+$/.test(tipoAccion);
    }) ?? promo.acciones[0];
    const tipoAccion = String(accion?.tipoAccion || '').trim().toLowerCase();
    if (/^\d+x\d+$/.test(tipoAccion)) {
      const [llevar] = tipoAccion.split('x').map((parte) => Number(parte));
      return Number.isFinite(llevar) && llevar > 0 ? llevar : null;
    }
    return accion ? Number(accion.valor) : null;
  }

  public getFormatoPromoXPorY(item: CarritoItem): string {
    if (!item?.producto?.promociones) return '';
    const promo = item.producto.promociones.find((p: any) => (p.promocionTipo?.alias || p.tipo) === 'x_por_y');
    if (!promo || !Array.isArray(promo.acciones)) return promo?.descripcion || 'Promo';

    const accion = promo.acciones.find((a: any) => {
      const tipoAccion = String(a?.tipoAccion || '').trim().toLowerCase();
      return tipoAccion === 'x_por_y' || tipoAccion === 'promo_cantidad' || /^\d+x\d+$/.test(tipoAccion);
    }) ?? promo.acciones[0];

    const tipoAccion = String(accion?.tipoAccion || '').trim().toLowerCase();
    if (/^\d+x\d+$/.test(tipoAccion)) {
      const [llevar, pagar] = tipoAccion.split('x').map((parte) => Number(parte));
      if (Number.isFinite(llevar) && llevar > 0 && Number.isFinite(pagar) && pagar > 0) {
        return `Llevás ${llevar} pagás ${pagar}`;
      }
      return tipoAccion.replace(/\s+/g, '');
    }

    const llevar = Number(accion?.valor ?? 0);
    const pagar = Number(accion?.valorExtra ?? 0);
    if (llevar > 0 && pagar > 0) {
      return `Llevás ${llevar} pagás ${pagar}`;
    }

    return promo?.descripcion || 'Promo';
  }

  public getNombrePromoXPorY(item: CarritoItem): string {
    if (!item?.producto?.promociones) return '';
    const promo = item.producto.promociones.find((p: any) => (p.promocionTipo?.alias || p.tipo) === 'x_por_y');
    return promo?.descripcion || 'Promo';
  }
  /**
   * Convierte un nombre de categoría en un slug amigable para la URL
   */

  public getPrecioPromoXPorY(item: CarritoItem): number {
    // El precio promocional es el precioDescuento si existe, si no el precio
    return item?.producto?.precioDescuento ?? item?.producto?.precio ?? 0;
  }

  public getTotalPromoCantidadCarrito(item: CarritoItem): number {
    if (!item?.producto) {
      return 0;
    }

    const cantidad = Math.max(1, Number(item.cantidad) || 1);
    const promo = this.obtenerPromoCantidadCarrito(item);
    const precioBase = Number(
      item.producto.precio ??
      item.producto.precioLista ??
      (item.producto as any)?.precioLista ??
      (item.producto as any)?.precio_base ??
      0
    ) || 0;

    if (!promo || promo.llevar <= 0 || promo.pagar <= 0) {
      return cantidad * precioBase;
    }

    if (cantidad < promo.llevar) {
      return cantidad * precioBase;
    }

    const grupos = Math.floor(cantidad / promo.llevar);
    const resto = cantidad % promo.llevar;
    return (grupos * promo.pagar * precioBase) + (resto * precioBase);
  }

  private obtenerPromoCantidadCarrito(item: CarritoItem): { llevar: number; pagar: number } | null {
    if (!item?.producto?.promociones) {
      return null;
    }

    const promo = item.producto.promociones.find((p: any) => (p.promocionTipo?.alias || p.tipo) === 'x_por_y');
    if (!promo || !Array.isArray(promo.acciones)) return null;

    const accion = promo.acciones.find((a: any) => {
      const tipoAccion = String(a?.tipoAccion || '').trim().toLowerCase();
      return tipoAccion === 'x_por_y' || tipoAccion === 'promo_cantidad' || /^\d+x\d+$/.test(tipoAccion);
    }) ?? promo.acciones[0];

    const tipoAccion = String(accion?.tipoAccion || '').trim().toLowerCase();
    if (/^\d+x\d+$/.test(tipoAccion)) {
      const [llevar, pagar] = tipoAccion.split('x').map((parte) => Number(parte));
      if (Number.isFinite(llevar) && llevar > 0 && Number.isFinite(pagar) && pagar > 0) {
        return { llevar, pagar };
      }
    }

    const llevar = Number(accion?.valor ?? 0);
    const pagar = Number(accion?.valorExtra ?? 0);
    if (llevar > 0 && pagar > 0) {
      return { llevar, pagar };
    }

    if (llevar > 0 && pagar === 0) {
      return { llevar, pagar: 1 };
    }

    return null;
  }

  agregarCuentaUsuario() {
    const nueva = { ...this.cuentaNueva, id: Date.now() };
    this.cuentasUsuario.push(nueva);
    this.cuentaSeleccionadaId = nueva.id;
    this.cuentaNueva = { tipo: 'tarjeta' };
    this.mensajeEntrega = 'Cuenta/tarjeta/billetera agregada correctamente.';
  }

                        /**
                         * Calcula el total a pagar sumando subtotal y los impuestos generales
                         */
                        getTotalAPagar(subtotal: number): number {
                          if (!this.modeloImputacionesFijas?.length || !subtotal) return subtotal;
                          let total = subtotal;
                          for (const imp of this.modeloImputacionesFijas) {
                            if (imp.aplica === 'general') {
                              if (imp.tipo === 'porcentaje') {
                                total += subtotal * (Number(imp.valor) / 100);
                              } else if (imp.tipo === 'fijo') {
                                total += Number(imp.valor);
                              }
                            }
                          }
                          return total;
                        }
                /**
                 * Calcula los impuestos generales sobre el subtotal
                 */
                getImpuestosGeneralesSobreSubtotal(subtotal: number): { nombre: string, importe: number, tipo: string, valor: number }[] {
                  if (!this.modeloImputacionesFijas?.length || !subtotal) return [];
                  return this.modeloImputacionesFijas.map(imp => {
                    let importe = 0;
                    if (imp.tipo === 'porcentaje') {
                      importe = subtotal * (Number(imp.valor) / 100);
                    } else if (imp.tipo === 'fijo') {
                      importe = Number(imp.valor);
                    }
                    return { nombre: imp.nombre, importe, tipo: imp.tipo, valor: Number(imp.valor) };
                  });
                }
        modeloImputacionesFijas: any[] = [];
        /**
         * Devuelve el porcentaje real de la imputación sobre el precio mostrado (porcentaje incluido)
         */
          getTotalConComisiones(items: CarritoItem[]): number {
            let total = this.carritoService.total;
            // Sumar impuestos a productos (imputaciones de items)
            const impuestosProductos = this.getImputacionesResumen(items).reduce((acc, imp) => acc + (imp.importe || 0), 0);
            total += impuestosProductos;
            if (this.modeloImputacionesFijas?.length && items?.length) {
              // Buscar el primer cargo tipo porcentaje y aplicarlo al total
              const porcentajeObj = this.modeloImputacionesFijas.find(imp => imp?.tipo === 'porcentaje');
              if (porcentajeObj && porcentajeObj.valor) {
                const porcentaje = Number(porcentajeObj.valor);
                if (Number.isFinite(porcentaje) && porcentaje > 0) {
                  total += total * (porcentaje / 100);
                }
              }
            }
            return total;
          }
        getImputacionPorcentaje(item: CarritoItem, imp: any): number {
          // Solo aplica si imp.aplica === 'items'
          if (imp?.aplica === 'items' && imp?.tipo === 'porcentaje') {
            return +(imp?.valor ?? 0);
          }
          return 0;
        }

        /**
         * Devuelve el monto total de la imputación de tipo monto
         */
        getImputacionMonto(item: CarritoItem, imp: any): number {
          const cantidad = +(item?.cantidad ?? 1);
          const valor = +(imp?.valor ?? 0);
          // Usar precio_sin_impuestos para el cálculo de impuestos
          const precioBase = +(item?.producto?.precio_base ?? item?.producto?.precio ?? 0);
          if (imp?.aplica === 'items') {
            if (imp?.tipo === 'porcentaje') {
              // Monto del impuesto: precio_sin_impuestos * (alicuota / 100)
              return precioBase * cantidad * (valor / 100);
            }
            // Para tipo monto/fijo, solo multiplica
            if (imp?.tipo === 'fijo' || imp?.tipo === 'monto') {
              return valor * cantidad;
            }
          }
          return 0;
        }
      /**
   * Calcula el subtotal sin impuestos (total menos suma de imputaciones tipo porcentaje)
   */
  getSubtotalSinImpuestos(items: CarritoItem[] | undefined): number {
    if (!items || !items.length) return 0;
    const total = this.carritoService.total;
    let sumaImpuestos = 0;
    for (const item of items) {
      const producto = item?.producto;
      const cantidad = item?.cantidad ?? 1;
      if (!producto?.modeloImputacion && Array.isArray((producto as any)?.modeloImputaciones)) {
        (producto as any).modeloImputacion = (producto as any).modeloImputaciones;
      }
      const imputaciones = Array.isArray(producto?.modeloImputacion)
        ? producto.modeloImputacion
        : [];
      for (const imp of imputaciones) {
        if (imp.tipo === 'porcentaje') {
          const valor = Number(imp.valor);
          const precioFinal = Number(producto.precio ?? 0) * cantidad;
          sumaImpuestos += precioFinal * (valor / 100);
        }
      }
    }
    return total - sumaImpuestos;
  }
      /**
       * Devuelve un resumen de imputaciones sumadas por nombre para los items del carrito,
       * calculando el valor del impuesto incluido en el precio final.
       * Si es porcentaje: impuesto = (precio * cantidad) - (precio * cantidad) / (1 + porcentaje/100)
       */
      getImputacionesResumen(items: CarritoItem[]): { nombre: string, importe: number, valor?: number }[] {
        // DEBUG: Mostrar datos de entrada y modeloImputacion de cada producto
        // Guardar para mostrar en la UI
        
        const resumen: Record<string, { nombre: string, tipo?: string, aplica?: string, importe: number, valor?: number }> = {};
        // Agrupar por nombre+tipo+valor+aplica para distinguir impuestos distintos aunque tengan nombre parecido
        for (const item of items) {
          const producto = item?.producto;
          const cantidad = item?.cantidad ?? 1;
          if (!producto?.modeloImputacion && Array.isArray((producto as any)?.modeloImputaciones)) {
            (producto as any).modeloImputacion = (producto as any).modeloImputaciones;
          }
          const imputaciones = Array.isArray(producto?.modeloImputacion)
            ? producto.modeloImputacion
            : [];
          for (const imp of imputaciones) {
            // Solo mostrar impuestos a productos: aplica = 'items' y tipo = 'porcentaje'
            if (imp?.aplica === 'items' && imp?.tipo === 'porcentaje') {
              let valorImputacion = 0;
              let valorPorcentaje: number | undefined = undefined;
              // Siempre usar precio unitario, nunca el total
              let base = 0;
              if (typeof producto.precioDescuento === 'number' && !isNaN(producto.precioDescuento)) {
                base = producto.precioDescuento;
              } else if (typeof producto.precio_base === 'number' && !isNaN(producto.precio_base)) {
                base = producto.precio_base;
              } else if (typeof producto.precio === 'number' && !isNaN(producto.precio)) {
                base = producto.precio;
              }
              let clave = imp.nombre + '|' + (imp.tipo ?? '') + '|' + (imp.valor ?? '') + '|' + (imp.aplica ?? '');
              const valor = Number(imp.valor);
              valorImputacion = base * cantidad * (valor / 100);
              valorPorcentaje = valor;
              // Log detallado para IVA 10.5%
             
              if (imp.nombre) {
                if (!resumen[clave]) {
                  resumen[clave] = { nombre: imp.nombre, tipo: imp.tipo, aplica: imp.aplica, importe: 0 };
                }
                resumen[clave].importe += valorImputacion;
                if (valorPorcentaje !== undefined) {
                  resumen[clave].valor = valorPorcentaje;
                }
              }
            }
          }
        }
        // Convertir a array
        const resultado = Object.values(resumen);
        // DEBUG: Mostrar resultado final
        return resultado;
      }
    /**
     * Calcula el ahorro individual por producto/cantidad
     */
    getAhorroPorProducto(item: CarritoItem): number {
      if (!item?.producto) {
        return 0;
      }
      const cantidad = item.cantidad ?? 1;
      const precioFinal = this.carritoService.getPrecioAplicadoProducto(item.producto);
      const precioReferencia = this.carritoService.getPrecioReferenciaProducto(item.producto);
      if (precioReferencia !== null && precioReferencia > precioFinal) {
        return (precioReferencia - precioFinal) * cantidad;
      }
      return 0;
    }

    onToggleImpuestos(item: CarritoItem, event?: MouseEvent): void {
      event?.stopPropagation();
      const nextState = !item?.showCargos;
      this.cerrarPopoversImpuestos(item);
      if (item) {
        item.showCargos = nextState;
      }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
      const target = event?.target as HTMLElement | null;
      if (!target) {
        this.cerrarPopoversImpuestos();
        return;
      }
      if (target.closest('.carrito-impuestos-toggle') || target.closest('.carrito-impuestos-popover')) {
        return;
      }
      this.cerrarPopoversImpuestos();
    }

    private cerrarPopoversImpuestos(except?: CarritoItem): void {
      const items = this.carritoService.items;
      if (!items?.length) {
        return;
      }
      items.forEach((cartItem) => {
        if (cartItem !== except && cartItem.showCargos) {
          cartItem.showCargos = false;
        }
      });
    }
  private readonly selectedAppStorageKey = 'selectedAppId';
  breadcrumbItems: { label: string; url: string }[] = [];
  rubros: any[] = [];
  productos: any[] = [];
  resultadosBusqueda: any[] = [];
  busquedaNombre = '';
  selectedAppId: number | null = null;
  empresa: Empresa | null = null;
  usuario: any = null;
    // Eliminar este ngOnInit duplicado, fusionar lógica en el principal
    // ...resto del código...
  notificaciones: { mensaje: string }[] = [];
  favoritosCount = 0;
  conteoProductosPorSubrubro: Record<string, number> = {};
  conteosCargados = false;
  formasPago: FormaPago[] = [];
  formasPagoLoading = false;
  formasPagoError?: string;
  formaPagoSeleccionada?: FormaPago;
  readonly precisionGeoOptions: PrecisionGeo[] = ['manual', 'exacta', 'aproximada'];
  metodoPagoControl = new FormControl<string | null>(null, { validators: [Validators.required] });
  metodoPagoReferenciaControl = new FormControl<string>('');
  localidadBusquedaControl = new FormControl<string>('', { nonNullable: true });
  localidadesSugeridas: Localidad[] = [];
  localidadBusquedaLoading = false;
  localidadBusquedaError?: string;
  mostrarLocalidadDropdown = false;
  direccionForm: FormGroup;
  direcciones: UsuarioDireccion[] = [];
  loadingDirecciones = false;
  direccionError?: string;
  mostrarFormularioDireccion = false;
  entregaTipos: EntregaTipo[] = [];
  entregaOpciones: EntregaOpcion[] = [];
  todasEntregaOpciones: EntregaOpcion[] = [];
  entregaLoading = false;
  entregaError?: string;
  mostrarCtaOrigenEnvio = false;
  esUsuarioStaff = false;
  selectedDireccionId: number | null = null;
  selectedEntregaTipoId: number | null = null;
  selectedEntregaTipoCodigo: string | null = null;
  selectedEntregaTipoNombre: string | null = null;
  selectedEntregaOpcionId: number | null = null;
  cotizacion?: CotizacionEntregaResponse;
 
 
  entregaConfirmada = false;
  mensajeEntrega?: string;
  appId: number | null = null;
  usuarioId: number | null = null;
  cuponCodigo = '';
  notaPedido = '';
  procesandoPedido = false;
  pedidoCreado?: Pedido;
  pedidoEnvioRegistrado?: PedidoEnvio;
  errorPago?: string;
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();
  private localidadSeleccionadaLabel = '';
  private localidadSeleccionada?: Localidad;

  private destroy$ = new Subject<void>();

  /**
   * Calcula el ahorro total acumulado por descuentos en el carrito.
   */
  getAhorroTotal(items: CarritoItem[]): number {

    if (!items?.length) return 0;
    return items.reduce((acc, item) => acc + this.getAhorroPorProducto(item), 0);
  }

  esStockAgotado(stock: number | string | null | undefined): boolean {
    if (stock === null || stock === undefined) {
      return false;
    }
    const normalizado = typeof stock === 'string' ? stock.replace(',', '.') : stock;
    const valor = Number(normalizado);
    if (!Number.isFinite(valor)) {
      return false;
    }
    return Math.abs(valor) < 0.00001;
  }

  getEtiquetaPromocion(item: CarritoItem | null | undefined): string | null {
    if (!item?.producto) {
      return null;
    }
    let promocion = null;
    const promoAplicada = item.producto.promocionAplicada;
    // Si promocionAplicada es un objeto promo, úsalo
    if (promoAplicada && typeof promoAplicada === 'object' && promoAplicada.nombre) {
      promocion = promoAplicada;
    } else if (promoAplicada === true && Array.isArray(item.producto.promociones) && item.producto.promociones.length > 0) {
      // Si es true, tomar la primera promo del array
      promocion = item.producto.promociones[0];
    } else if (typeof promoAplicada === 'number' && Array.isArray(item.producto.promociones)) {
      // Si es un id, buscar la promo con ese id
      promocion = item.producto.promociones.find(p => p.id === promoAplicada) || null;
    } else if (Array.isArray(item.producto.promociones) && item.producto.promociones.length > 0) {
      // Fallback: promo destacada
      promocion = this.obtenerPromoDestacada(item.producto.promociones);
    }
    if (promocion) {
      return this.formatearEtiquetaPromocion(promocion);
    }
    return this.getAhorroPorProducto(item) > 0 ? 'Promo' : null;
  }

  private obtenerPromoDestacada(promociones?: Promocion[] | null): Promocion | null {
    if (!promociones?.length) {
      return null;
    }
    let seleccionada: Promocion | null = null;
    let mejorValor = -Infinity;
    for (const promo of promociones) {
      if (!promo) {
        continue;
      }
      const valor = Number(promo['valor']);
      const peso = Number.isFinite(valor) ? valor : 0;
      if (!seleccionada || peso > mejorValor) {
        seleccionada = promo;
        mejorValor = peso;
      }
    }
    return seleccionada ?? promociones[0] ?? null;
  }

  private formatearEtiquetaPromocion(promo: Promocion | null | undefined): string {
    if (!promo) {
      return 'Promo';
    }

    const nombre = promo.nombre?.trim() || promo.descripcion?.trim() || 'Promo';
    let detalle = '';
    if (Array.isArray((promo as any).acciones) && (promo as any).acciones.length > 0) {
      detalle = (promo as any).acciones[0]?.detalle?.trim() || '';
    }
    if (detalle) {
      //return `${nombre}: ${detalle}`;
      return `${detalle}`;

    }
    return nombre;
  }

  getPrecioUnitarioCarrito(item: CarritoItem | null | undefined): number {
    if (!item) {
      return 0;
    }
    return this.carritoService.getPrecioAplicadoProducto(item.producto);
  }

  getPrecioOriginalCarrito(item: CarritoItem | null | undefined): number | null {
    if (!item) {
      return null;
    }
    const final = this.getPrecioUnitarioCarrito(item);
    const original = this.carritoService.getPrecioReferenciaProducto(item.producto);
    return original !== null && original > final ? original : null;
  }

  get formasPagoDisponibles(): FormaPago[] {
    return this.formasPago?.filter((fp) => fp.activo) ?? [];
  }

  private obtenerAppIdOperativo(): number | null {
    const candidatos = [
      this.selectedAppId,
      this.appId,
      this.carritoService.appId,
      Number(localStorage.getItem(this.selectedAppStorageKey)),
      this.empresa?.apps?.[0]?.id,
      this.usuario?.apps?.[0]?.id
    ];

    for (const candidato of candidatos) {
      const valor = Number(candidato);
      if (Number.isFinite(valor) && valor > 0) {
        return valor;
      }
    }

    return null;
  }

  get appIdOperativo(): number | null {
    return this.obtenerAppIdOperativo();
  }

  cargarFormasPago(forceRefresh = false): void {
    const appId = this.obtenerAppIdOperativo();
   
    if (!appId) {
      this.formasPago = [];
      this.formasPagoError = 'Selecciona una app para ver los medios de pago disponibles.';
      this.formasPagoLoading = false;
      this.metodoPagoControl.reset(null, { emitEvent: false });
      this.actualizarFormaPagoSeleccionada(null);
      this.carritoService.setMedioPago(null);
      return;
    }

    if (this.formasPago.length && !forceRefresh) {
      const preferida = this.resolverFormaPagoPreferida(this.formasPago);
      if (preferida) {
        this.metodoPagoControl.setValue(preferida, { emitEvent: false });
        this.carritoService.setMedioPago(preferida);
      } else {
        this.metodoPagoControl.reset(null, { emitEvent: false });
        this.carritoService.setMedioPago(null);
      }
      this.actualizarFormaPagoSeleccionada(preferida);
      return;
    }

    this.formasPagoLoading = true;
    this.formasPagoError = undefined;
    this.apiService
      .getFormasPago(appId)
      .pipe(take(1))
      .subscribe({
        next: (formas) => {
          this.formasPagoLoading = false;
          this.formasPago = [...(formas ?? [])].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
          const preferida = this.resolverFormaPagoPreferida(this.formasPago);
          if (preferida) {
            this.metodoPagoControl.setValue(preferida, { emitEvent: false });
            this.carritoService.setMedioPago(preferida);
          } else {
            this.metodoPagoControl.reset(null, { emitEvent: false });
            this.carritoService.setMedioPago(null);
          }
          this.actualizarFormaPagoSeleccionada(preferida);
        },
        error: () => {
          this.formasPagoLoading = false;
          this.formasPagoError = 'No pudimos cargar las formas de pago disponibles.';
          this.metodoPagoControl.reset(null, { emitEvent: false });
          this.actualizarFormaPagoSeleccionada(null);
          this.carritoService.setMedioPago(null);
        }
      });
  }

  private resolverFormaPagoPreferida(lista: FormaPago[]): string | null {
    if (!lista?.length) {
      return null;
    }
    const candidatos = [this.metodoPagoControl.value, this.carritoService.medioPago];
    for (const candidato of candidatos) {
      if (candidato && lista.some((fp) => fp.codigo === candidato && fp.activo)) {
        return candidato;
      }
    }
    const activa = lista.find((fp) => fp.activo);
    return activa?.codigo ?? lista[0]?.codigo ?? null;
  }

  private actualizarFormaPagoSeleccionada(codigo: string | null | undefined): void {
    this.formaPagoSeleccionada = codigo ? this.formasPago.find((fp) => fp.codigo === codigo) : undefined;
    if (this.formaPagoSeleccionada && !this.esFormaPagoSeleccionable(this.formaPagoSeleccionada)) {
      this.formaPagoSeleccionada = undefined;
      this.metodoPagoControl.reset(null, { emitEvent: false });
    }
    // Reset cuentaSeleccionadaId si cambia la forma de pago
    if (this.formaPagoSeleccionada && (this.formaPagoSeleccionada.codigo === 'tarjeta' || this.formaPagoSeleccionada.codigo === 'mercadopago')) {
      this.cuentaSeleccionadaId = this.cuentasUsuario.length === 0 ? 'nueva' : null;
    } else {
      this.cuentaSeleccionadaId = null;
    }
    if (this.formaPagoSeleccionada?.requiereReferencia) {
      this.metodoPagoReferenciaControl.setValidators([Validators.required]);
      this.metodoPagoReferenciaControl.enable({ emitEvent: false });
    } else {
      this.metodoPagoReferenciaControl.clearValidators();
      this.metodoPagoReferenciaControl.reset('', { emitEvent: false });
      this.metodoPagoReferenciaControl.disable({ emitEvent: false });
    }
    this.metodoPagoReferenciaControl.updateValueAndValidity({ emitEvent: false });
  }

  esFormaPagoSeleccionable(forma: FormaPago | null | undefined): boolean {
    if (!forma) {
      return false;
    }

    const codigo = String(forma.codigo ?? '').trim().toLowerCase();
 
    if (codigo !== 'cuenta-corriente') {
      return true;
    }

    return this.tieneCuentaCorrienteHabilitada();
  }

  getCuentaCorrienteUsuario(): any {
    return this.authUserService.getUsuario() ?? this.usuario ?? null;
  }

  tieneCuentaCorrienteHabilitada(): boolean {
    const usuario = this.getCuentaCorrienteUsuario();
    const cuentaCorriente = Number(usuario?.nrocuentacorriente ?? usuario?.nroCuentaCorriente ?? usuario?.nro_cuenta_corriente ?? 0);
    const confirmadaRaw = usuario?.nrocuentacorrienteConfirmada ?? usuario?.nroCuentaCorrienteConfirmada ?? usuario?.nro_cuenta_corriente_confirmada ?? 0;
    const confirmada = confirmadaRaw === true || Number(confirmadaRaw) === 1;
    return Number.isFinite(cuentaCorriente) && cuentaCorriente > 0 && confirmada;
  }

  motivoCuentaCorrienteDeshabilitada(): boolean {
    const usuario = this.getCuentaCorrienteUsuario();
    const cuentaCorriente = Number(usuario?.nrocuentacorriente ?? usuario?.nroCuentaCorriente ?? usuario?.nro_cuenta_corriente ?? 0);
    const confirmadaRaw = usuario?.nrocuentacorrienteConfirmada ?? usuario?.nroCuentaCorrienteConfirmada ?? usuario?.nro_cuenta_corriente_confirmada ?? 0;
    const confirmada = confirmadaRaw === true || Number(confirmadaRaw) === 1;
    if (!Number.isFinite(cuentaCorriente) || cuentaCorriente <= 0) {
      return false
      //return 'Nro de cuenta  no habilitada para operar, comunicate con la administración, o bien selecciona otro medio de pago.';
    }
    if (!confirmada) {
      return false//return 'Nro de cuenta '+cuentaCorriente+' no habilitada para operar, comuníquese con la administración para habilitar su cuenta, o bien seleccione otro medio de pago.';
    }
    return true;
  }

  mensajeCuentaCorrienteHabilitada(): string {
    const usuario = this.getCuentaCorrienteUsuario();
    const cuentaCorriente = String(usuario?.nrocuentacorriente ?? usuario?.nroCuentaCorriente ?? usuario?.nro_cuenta_corriente ?? '').trim();
    if (!cuentaCorriente) {
      return '';
    }
    return `Nro de cuenta corriente ${cuentaCorriente} habilitada para operar.`;
  }

  get direccionSeleccionada(): UsuarioDireccion | undefined {
    return this.direcciones.find((dir) => dir.id === this.selectedDireccionId);
  }

  get entregaOpcionSeleccionada(): EntregaOpcion | undefined {
   
    return this.entregaOpciones.find((op) => op.id === this.selectedEntregaOpcionId);
  }
  get entregaTipoSeleccionado(): EntregaTipo | undefined {
    return this.entregaTipos.find((tipo) => tipo.codigo === this.selectedEntregaTipoCodigo);
  }

  get pedidoEnvioCostoCliente(): number | null {
    const costoCliente = this.pedidoEnvioRegistrado?.costoCliente;
    if (typeof costoCliente === 'number') {
      return costoCliente;
    }
    const costo = this.pedidoEnvioRegistrado?.costo;
    return typeof costo === 'number' ? costo : null;
  }

  get pedidoEnvioPricing(): PedidoEnvioPricingMetadata | null {
    const metadata = this.pedidoEnvioRegistrado?.metadata as { pricing?: unknown } | null | undefined;
    if (!metadata?.pricing || typeof metadata.pricing !== 'object') {
      return null;
    }
    return metadata.pricing as PedidoEnvioPricingMetadata;
  }

  get cotizacionCostoEstimado(): number {
    return this.obtenerCostoCotizacion(this.cotizacion);
  }

  get cotizacionDistanciaKm(): number | null {
    return this.obtenerDistanciaCotizacion(this.cotizacion);
  }

  get cotizacionMoneda(): string | null {
    const pricing = (this.cotizacion?.metadata as { pricing?: PedidoEnvioPricingMetadata } | undefined)?.pricing;
    const moneda = pricing?.moneda ?? this.cotizacion?.moneda;
    return typeof moneda === 'string' && moneda.trim().length ? moneda.trim() : null;
  }

  get puedeConfirmarPedido(): boolean {
    if (this.procesandoPedido) {
      return false;
    }
    if (!this.carritoService.items.length || !this.appIdOperativo || !this.usuarioId) {
      return false;
    }
    if (!this.entregaConfirmada || !this.cotizacion || !this.direccionSeleccionada || !this.entregaOpcionSeleccionada) {
      return false;
    }
    // Si la opción de entrega requiere fecha programada, validar que esté completa
    const opcion = this.entregaOpcionSeleccionada;
    if (opcion?.permiteProgramar && !this.fechaProgramada) {
      return false;
    }
    if (!this.formaPagoSeleccionada || !this.metodoPagoControl.value) {
      return false;
    }
    if (this.formaPagoSeleccionada.requiereReferencia && this.metodoPagoReferenciaControl.invalid) {
      return false;
    }
    if (this.formasPagoLoading || !!this.formasPagoError) {
      return false;
    }
    return true;
  }

  onLocalidadInputFocus(): void {
    if (this.localidadesSugeridas.length) {
      this.mostrarLocalidadDropdown = true;
    }
  }

  onLocalidadInputBlur(): void {
    setTimeout(() => {
      this.mostrarLocalidadDropdown = false;
    }, 180);
    this.direccionForm.get('localidadId')?.markAsTouched();
  }

  onLocalidadBusquedaInput(valor: string): void {
    const term = (valor ?? '').toString();
    if (term !== this.localidadBusquedaControl.value) {
      this.localidadBusquedaControl.setValue(term);
    }
    this.buscarLocalidadesManual(term);
  }

  private buscarLocalidadesManual(term: string): void {
    const normalized = (term ?? '').trim();
    if (!normalized) {
      this.localidadBusquedaError = undefined;
      this.localidadBusquedaLoading = false;
      this.localidadesSugeridas = [];
      this.mostrarLocalidadDropdown = false;
      return;
    }
    if (normalized.length < 2) {
      this.localidadBusquedaError = 'Ingresá al menos dos letras.';
      this.localidadBusquedaLoading = false;
      this.localidadesSugeridas = [];
      this.mostrarLocalidadDropdown = false;
      return;
    }

    this.localidadBusquedaError = undefined;
    this.localidadBusquedaLoading = true;
    this.logisticaService
      .buscarLocalidadesSeguras(normalized)
      .pipe(take(1))
      .subscribe({
        next: (resultados) => {
          this.localidadBusquedaLoading = false;
          this.localidadesSugeridas = resultados ?? [];
          this.mostrarLocalidadDropdown = this.localidadesSugeridas.length > 0;
        },
        error: (error) => {
          this.localidadBusquedaLoading = false;
          this.localidadBusquedaError = this.mapLocalidadBusquedaError(error);
          this.localidadesSugeridas = [];
          this.mostrarLocalidadDropdown = false;
        }
      });
  }

  onSeleccionarLocalidad(localidad: Localidad): void {
    if (!localidad) {
      return;
    }
    this.localidadSeleccionada = localidad;
    const display = this.formatearLocalidad(localidad);
    this.localidadSeleccionadaLabel = display;
    this.localidadBusquedaControl.setValue(display, { emitEvent: false });
    this.localidadBusquedaError = undefined;
    this.localidadBusquedaLoading = false;
    this.localidadesSugeridas = [];
    this.mostrarLocalidadDropdown = false;

    this.direccionForm.patchValue(
      {
        localidadId: localidad.id
      },
      { emitEvent: false }
    );
    if (localidad.codigoPostal) {
      this.direccionForm.patchValue({ codigoPostal: localidad.codigoPostal }, { emitEvent: false });
    }
    const localidadControl = this.direccionForm.get('localidadId');
    localidadControl?.markAsTouched();
    localidadControl?.updateValueAndValidity({ emitEvent: false });
  }

  toggleFormularioDireccion(): void {
    this.mostrarFormularioDireccion = !this.mostrarFormularioDireccion;
    if (!this.mostrarFormularioDireccion) {
      this.resetDireccionFormulario();
    }
  }

  private inicializarLocalidadAutocomplete(): void {
    this.localidadBusquedaControl.valueChanges
      .pipe(
        map((valor) => (valor ?? '').trim()),
        tap((term) => {
          if (this.localidadSeleccionada && term !== this.localidadSeleccionadaLabel) {
            this.clearLocalidadSeleccion({ keepTerm: true });
          }
        }),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) {
            this.localidadBusquedaError = undefined;
            this.localidadBusquedaLoading = false;
            this.localidadesSugeridas = [];
            this.mostrarLocalidadDropdown = false;
            return of([]);
          }
          if (term.length < 2) {
            this.localidadBusquedaError = 'Ingresá al menos dos letras.';
            this.localidadBusquedaLoading = false;
            this.localidadesSugeridas = [];
            this.mostrarLocalidadDropdown = false;
            return of([]);
          }
          this.localidadBusquedaError = undefined;
          this.localidadBusquedaLoading = true;
          return this.logisticaService.buscarLocalidadesSeguras(term).pipe(
            catchError((error) => {
              this.localidadBusquedaError = this.mapLocalidadBusquedaError(error);
              return of([]);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((resultados) => {
        this.localidadBusquedaLoading = false;
        this.localidadesSugeridas = resultados;
        this.mostrarLocalidadDropdown = resultados.length > 0;
      });
  }

  private mapLocalidadBusquedaError(error: any): string {
    const status = error?.status;
    if (status === 400) {
      return 'Ingresá al menos dos letras.';
    }
    if (status === 401 || status === 403) {
      return 'Tu sesión expiró, volvé a iniciar sesión.';
    }
    return 'No pudimos buscar localidades en este momento.';
  }

  private clearLocalidadSeleccion(options?: { keepTerm?: boolean }): void {
    this.localidadSeleccionada = undefined;
    this.localidadSeleccionadaLabel = '';
    this.direccionForm.patchValue(
      { localidadId: null, codigoPostal: '' },
      { emitEvent: false }
    );
    if (!options?.keepTerm) {
      this.localidadBusquedaControl.setValue('', { emitEvent: false });
    }
  }

  private formatearLocalidad(localidad: Localidad): string {
    const partes: string[] = [localidad.nombre];
    if (localidad.codigoPostal) {
      partes.push(`CP ${localidad.codigoPostal}`);
    }
    if (localidad.provincia?.nombre) {
      partes.push(localidad.provincia.nombre);
    }
    return partes.join(' - ');
  }

  private resetDireccionFormulario(): void {
    this.direccionForm.reset({ precisionGeo: 'manual', esPrincipal: false, geocode: true });
    this.localidadBusquedaControl.setValue('', { emitEvent: false });
    this.localidadBusquedaControl.markAsPristine();
    this.localidadBusquedaControl.markAsUntouched();
    this.localidadBusquedaError = undefined;
    this.localidadBusquedaLoading = false;
    this.localidadesSugeridas = [];
    this.mostrarLocalidadDropdown = false;
    this.localidadSeleccionada = undefined;
    this.localidadSeleccionadaLabel = '';
    const localidadControl = this.direccionForm.get('localidadId');
    localidadControl?.markAsPristine();
    localidadControl?.markAsUntouched();
  }

  cargarDirecciones(): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.usuarioId) {
      return;
    }
    this.loadingDirecciones = true;
    this.direccionError = undefined;
    this.logisticaService
      .getUsuarioDirecciones(appId, this.usuarioId)
      .pipe(take(1))
      .subscribe({
        next: (direcciones) => {
          this.direcciones = direcciones ?? [];
          this.loadingDirecciones = false;
          const snapshot = this.checkoutEntregaService.snapshot.direccion;
          if (snapshot) {
            const encontrada = this.direcciones.find((dir) => dir.id === snapshot.id);
            this.selectedDireccionId = encontrada?.id ?? null;
          }
          if (!this.selectedDireccionId && this.direcciones.length) {
            const principal = this.direcciones.find((dir) => dir.esPrincipal);
            this.selectedDireccionId = principal?.id ?? this.direcciones[0].id;
          }
          if (this.selectedDireccionId) {
            this.checkoutEntregaService.setDireccion(this.direccionSeleccionada);
            this.cargarEntregaOpciones();
          }
        },
        error: () => {
          this.loadingDirecciones = false;
          this.direccionError = 'No pudimos cargar tus direcciones guardadas.';
        }
      });
  }

  guardarDireccion(): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.usuarioId) return;
    if (this.direccionForm.invalid) {
      this.direccionForm.markAllAsTouched();
      return;
    }

    const raw = this.direccionForm.value;
    const localidadId = Number(raw.localidadId);
    const provinciaId = this.localidadSeleccionada?.provinciaId ?? this.localidadSeleccionada?.provincia?.id;
    if (!Number.isFinite(localidadId) || localidadId <= 0) {
      this.direccionForm.get('localidadId')?.setErrors({ invalid: true });
      return;
    }

    const payload: CrearUsuarioDireccionPayload = {
      alias: raw.alias || undefined,
      receptorNombre: this.toOptionalText(raw.receptorNombre),
      receptorTelefono: this.toOptionalText(raw.receptorTelefono),
      calle: raw.calle ?? '',
      numero: raw.numero || undefined,
      piso: raw.piso || undefined,
      departamento: raw.departamento || undefined,
      entreCalles: this.toOptionalText(raw.entreCalles),
      referencia: this.toOptionalText(raw.referencia),
      codigoPostal: raw.codigoPostal || undefined,
      localidadId,
      provinciaId: provinciaId ? Number(provinciaId) : undefined,
      latitud: raw.latitud ? Number(raw.latitud) : undefined,
      longitud: raw.longitud ? Number(raw.longitud) : undefined,
      precisionGeo: (raw.precisionGeo as PrecisionGeo) || 'manual',
      esPrincipal: !!raw.esPrincipal,
      geocode: true
    };

    this.logisticaService
      .createUsuarioDireccion(appId, this.usuarioId, payload)
      .pipe(take(1))
      .subscribe({
        next: (direccion) => {
          this.mostrarFormularioDireccion = false;
          this.resetDireccionFormulario();
          this.direcciones = [...this.direcciones.filter((d) => d.id !== direccion.id), direccion];
          this.selectedDireccionId = direccion.id;
          this.checkoutEntregaService.setDireccion(direccion);
          this.todasEntregaOpciones = [];
          this.entregaOpciones = [];
          this.cargarEntregaOpciones();
          this.mensajeEntrega = 'Dirección guardada correctamente.';
        },
        error: () => {
          this.mensajeEntrega = 'No pudimos guardar la dirección. Revisa los datos e intenta nuevamente.';
        }
      });
  }

  private toOptionalText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  establecerPrincipal(direccion: UsuarioDireccion): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.usuarioId || !direccion?.id) return;
    this.logisticaService
      .setDireccionPrincipal(appId, this.usuarioId, direccion.id)
      .pipe(take(1))
      .subscribe({
        next: () => this.cargarDirecciones(),
        error: () => {
          this.mensajeEntrega = 'No pudimos actualizar la dirección principal.';
        }
      });
  }

  eliminarDireccion(direccion: UsuarioDireccion): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.usuarioId || !direccion?.id) return;
    this.logisticaService
      .deleteUsuarioDireccion(appId, this.usuarioId, direccion.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.direcciones = this.direcciones.filter((dir) => dir.id !== direccion.id);
          if (this.selectedDireccionId === direccion.id) {
            this.selectedDireccionId = null;
            this.checkoutEntregaService.reset();
            this.entregaOpciones = [];
            this.todasEntregaOpciones = [];
            this.cotizacion = undefined;
            this.entregaConfirmada = false;
          }
        },
        error: () => {
          this.mensajeEntrega = 'No pudimos eliminar la dirección seleccionada.';
        }
      });
  }

  seleccionarDireccion(direccion: UsuarioDireccion): void {
    if (!direccion?.id) return;
    this.selectedDireccionId = direccion.id;
    this.checkoutEntregaService.setDireccion(direccion);
    // Resetear la opción de entrega seleccionada
    this.selectedEntregaOpcionId = null; // Deselect all Entrega o retiro options
    this.cotizacion = undefined;
    this.entregaConfirmada = false;
    this.entregaError = undefined;
    this.mostrarCtaOrigenEnvio = false;
    this.todasEntregaOpciones = [];
    this.entregaOpciones = [];
    this.cargarEntregaOpciones();
    // Cuando se cargan las opciones, no se debe preseleccionar ninguna
    // Si hay snapshot, solo seleccionar si la opción está disponible
    // Esto ya está controlado en cargarEntregaOpciones
  }

  cargarEntregaTipos(): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId) {
      this.entregaTipos = [];
      return;
    }
    this.logisticaService
      .getEntregaTipos(appId, { activo: true })
      .pipe(take(1))
      .subscribe({
        next: (tipos) => (this.entregaTipos = tipos ?? []),
        error: () => (this.entregaTipos = [])
      });
  }

  onFiltroTipoChange(tipoId: string): void {
    if (tipoId === 'todos' || tipoId === '') {
      this.selectedEntregaTipoId = null;
      this.selectedEntregaTipoCodigo = null;
      this.selectedEntregaTipoNombre = null;
    } else {
      const parsed = Number(tipoId);
      this.selectedEntregaTipoId = Number.isFinite(parsed) ? parsed : null;
      const tipoSeleccionado = this.entregaTipos.find((tipo) => tipo.id === this.selectedEntregaTipoId);
      this.selectedEntregaTipoCodigo = tipoSeleccionado?.codigo ? tipoSeleccionado.codigo.trim().toLowerCase() : null;
      this.selectedEntregaTipoNombre = tipoSeleccionado?.nombre ? tipoSeleccionado.nombre.trim().toLowerCase() : null;
    }
    this.selectedEntregaOpcionId = null; // Deselect all Entrega o retiro options
    this.cotizacion = undefined;
    this.entregaConfirmada = false;
    this.entregaError = undefined;
    this.mostrarCtaOrigenEnvio = false;
    this.entregaOpciones = this.filtrarEntregaOpciones(this.todasEntregaOpciones);
  }

  cargarEntregaOpciones(): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.selectedDireccionId) return;
    const direccion = this.direccionSeleccionada;
    const localidadDestinoId = Number(direccion?.localidadId ?? direccion?.localidad?.id);
    if (!direccion || !Number.isFinite(localidadDestinoId) || localidadDestinoId <= 0) {
      this.todasEntregaOpciones = [];
      this.entregaOpciones = [];
      this.entregaError = 'La dirección seleccionada no tiene localidad asociada.';
      return;
    }
    this.entregaLoading = true;
    this.entregaError = undefined;
    this.todasEntregaOpciones = [];
    this.entregaOpciones = [];
    const params: any = { localidadId: localidadDestinoId, habilitada: true };
    this.logisticaService
      .getEntregaOpciones(appId, params)
      .pipe(take(1))
      .subscribe({
        next: (opciones) => {
          this.todasEntregaOpciones = opciones ?? [];
          this.entregaOpciones = this.filtrarEntregaOpciones(this.todasEntregaOpciones);
          this.entregaLoading = false;
          const snapshot = this.checkoutEntregaService.snapshot.entregaOpcion;
          if (snapshot) {
            const encontrada = this.entregaOpciones.find((op) => op.id === snapshot.id);
            if (encontrada) {
              this.selectedEntregaOpcionId = encontrada.id;
              this.cotizacion = this.checkoutEntregaService.snapshot.cotizacion;
            } else {
              this.selectedEntregaOpcionId = null;
            }
          } else {
            this.selectedEntregaOpcionId = null;
          }
        },
        error: () => {
          this.entregaLoading = false;
          this.todasEntregaOpciones = [];
          this.entregaOpciones = [];
          this.entregaError = 'No pudimos cargar las opciones de entrega disponibles.';
        }
      });
  }

  private filtrarEntregaOpciones(opciones: EntregaOpcion[]): EntregaOpcion[] {
    if (!Array.isArray(opciones) || !opciones.length) {
      return [];
    }
    if (!this.selectedEntregaTipoId) {
      return [...opciones];
    }
    const tipoId = this.selectedEntregaTipoId;
    const codigoSeleccionado = this.selectedEntregaTipoCodigo;
    const nombreSeleccionado = this.selectedEntregaTipoNombre;
    return opciones.filter((opcion) => {
      const opcionTipoIdRaw =
        (opcion?.entregaTipo as any)?.id ??
        opcion?.entregaTipoId ??
        (opcion as any)?.entregaTipoID ??
        (opcion as any)?.tipoId ??
        (opcion as any)?.tipo?.id;
      const opcionTipoId = Number(opcionTipoIdRaw);
      if (Number.isFinite(opcionTipoId) && opcionTipoId === tipoId) {
        return true;
      }
      if (codigoSeleccionado) {
        const opcionCodigo = String(
          (opcion?.entregaTipo as any)?.codigo ??
            (opcion as any)?.entregaTipoCodigo ??
            (opcion as any)?.codigoTipo ??
            (opcion as any)?.tipoCodigo
        )
          .trim()
          .toLowerCase();
        if (opcionCodigo && opcionCodigo === codigoSeleccionado) {
          return true;
        }
      }
      if (nombreSeleccionado) {
        const opcionNombre = String(
          (opcion?.entregaTipo as any)?.nombre ??
            (opcion as any)?.entregaTipoNombre ??
            (opcion as any)?.nombreTipo ??
            (opcion as any)?.tipoNombre ??
            (opcion as any)?.descripcionTipo ??
            (opcion as any)?.entregaTipoDescripcion
        )
          .trim()
          .toLowerCase();
        if (opcionNombre && opcionNombre === nombreSeleccionado) {
          return true;
        }
      }
      return false;
    });
  }

  seleccionarEntregaOpcion(opcion: EntregaOpcion): void {
    if (!opcion?.id) return;
    this.selectedEntregaOpcionId = opcion.id;
    // Compatibilidad: algunos modelos traen 'entregaTipo', otros 'tipo'
    const codigo = (opcion.entregaTipo?.codigo ?? (opcion as any)?.tipo?.codigo ?? '').toString().trim().toLowerCase();
    this.selectedEntregaTipoCodigo = codigo || null;
    this.entregaConfirmada = false;
    this.cotizacion = undefined;
    this.mostrarCtaOrigenEnvio = false;
    // Si la opción permite programar, setear hora por defecto (actual)
    if (opcion.permiteProgramar) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const hora = pad(now.getHours()) + ':' + pad(now.getMinutes());
      this.horaVentanaDesde = hora;
      this.horaVentanaHasta = hora;
    }
    this.cotizarEntrega(opcion);
  }

  private cotizarEntrega(opcion: EntregaOpcion): void {
    const appId = this.obtenerAppIdOperativo();
    if (!appId || !this.selectedDireccionId) return;
    const direccion = this.direccionSeleccionada;
    if (!direccion) return;
    const payload: { usuarioDireccionId?: number; latitud?: number; longitud?: number } = {};
    if (Number.isFinite(direccion.id) && direccion.id > 0) {
      payload.usuarioDireccionId = direccion.id;
    } else if (typeof direccion.latitud === 'number' && typeof direccion.longitud === 'number') {
      payload.latitud = direccion.latitud;
      payload.longitud = direccion.longitud;
    } else {
      this.mensajeEntrega = 'No pudimos cotizar: la dirección no tiene datos válidos de destino.';
      return;
    }
    this.logisticaService
      .cotizarEntrega(appId, opcion.id, payload)
      .pipe(take(1))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion = cotizacion;
          this.entregaError = undefined;
          this.mostrarCtaOrigenEnvio = false;
          this.mensajeEntrega = undefined;
        },
        error: (error) => {
          if (this.esErrorOrigenNoConfigurado(error)) {
            this.entregaError = 'No se puede cotizar: falta origen de envío. Configuralo en la app.';
            this.mostrarCtaOrigenEnvio = this.esUsuarioStaff;
            this.mensajeEntrega = this.entregaError;
            return;
          }
          this.entregaError = undefined;
          this.mostrarCtaOrigenEnvio = false;
          this.mensajeEntrega = 'No pudimos calcular el costo de envío para esta opción.';
        }
      });
  }

  irAConfigOrigenEnvio(): void {
    this.router.navigate(['/dashboard']);
  }

  confirmarEntrega(): void {
    const direccion = this.direccionSeleccionada;
    const opcion = this.entregaOpcionSeleccionada;
    if (!direccion || !opcion || !this.cotizacion) {
      this.mensajeEntrega = 'Selecciona una dirección y un método de entrega con cotización válida.';
      return;
    }
    this.entregaConfirmada = true;
    this.checkoutEntregaService.setDireccion(direccion);
    this.checkoutEntregaService.setEntrega(opcion, this.cotizacion);
    this.mensajeEntrega = 'Datos de entrega guardados. Revisa el resumen antes de confirmar tu pedido.';
    this.pedidoCreado = undefined;
    this.pedidoEnvioRegistrado = undefined;
    this.errorPago = undefined;

  }

  cargarMercadoPagoWidget() {
    this.mercadoPagoMensaje = undefined;
    this.mercadoPagoResultado = null;
    if (this.mercadoPagoWidgetLoaded) return;
    const apiKey = this.formaPagoSeleccionada?.pasarelaPago?.apiKeyPublic;
    if (!apiKey) {
      this.mercadoPagoMensaje = 'No se encontró la clave pública de Mercado Pago. Usa la simulación de pago para continuar.';
      return;
    }
    // Cargar el script de Mercado Pago si no está cargado
    if (!this.mercadoPagoScriptLoaded) {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        this.mercadoPagoScriptLoaded = true;
        this.initMercadoPagoWidget(apiKey);
      };
      document.body.appendChild(script);
    } else {
      this.initMercadoPagoWidget(apiKey);
    }
  }

  initMercadoPagoWidget(apiKey: string) {
    if (!(window as any).MercadoPago) return;
    const preferenceId = this.mercadoPagoPreferenceId || 'test_preference_id';
    const mp = new (window as any).MercadoPago(apiKey);
    mp.checkout({
      preference: {
        id: preferenceId
      },
      render: {
        container: '#mercadoPagoEmbed',
        label: 'Pagar con Mercado Pago'
      },
      onSubmit: () => {
        this.mercadoPagoMensaje = 'Procesando el pago...';
      },
      onResult: (resultado: any) => this.onMercadoPagoResult(resultado)
    });
    this.mercadoPagoWidgetLoaded = true;
    // Iniciar polling cuando se muestra el modal de pago
    if (this.pedidoCreado?.id) {
      this.iniciarPedidoPolling(this.pedidoCreado.id);
    }
  }

  private onMercadoPagoResult(resultado: any) {
    if (!resultado) {
      this.mercadoPagoResultado = null;
      this.mercadoPagoMensaje = 'No se recibió respuesta de Mercado Pago.';
      return;
    }

    const status = String(resultado?.status || resultado?.estado || '').toLowerCase();
    if (status === 'approved' || status === 'aprobado' || resultado?.success === true) {
      this.mercadoPagoResultado = 'aprobado';
      this.mercadoPagoMensaje = resultado?.message || resultado?.mensaje || 'Pago aprobado.';
      if (this.pedidoCreado) {
        this.pedidoCreado.estado = 'pagado';
        this.notificaciones.push({ mensaje: 'Pago aprobado' });
        this.enviarPedidoALogisticaPreparacion();
      }
    } else if (status === 'rejected' || status === 'rechazado' || resultado?.success === false) {
      this.mercadoPagoResultado = 'rechazado';
      this.mercadoPagoMensaje = resultado?.message || resultado?.mensaje || 'Pago rechazado.';
    } else {
      this.mercadoPagoResultado = 'pendiente';
      this.mercadoPagoMensaje = resultado?.message || resultado?.mensaje || 'Pago pendiente.';
    }
  }
  
  simularResultadoMercadoPago(resultado: 'aprobado' | 'rechazado' | 'pendiente') {
    const pedidoId = this.mercadoPagoPedidoId ?? this.pedidoCreado?.id ?? null;
    const appIdOperativo = this.obtenerAppIdOperativo();
    if (!appIdOperativo || !pedidoId) {
      this.mercadoPagoMensaje = 'No se puede simular el pago porque no hay una app válida o un pedido creado.';
      return;
    }
    let status: 'approved' | 'rejected';
    let payment_id: string;
    let observacion: string;
    if (resultado === 'aprobado') {
      status = 'approved';
      payment_id = 'SIM-123456';
      observacion = 'Pago aprobado (simulación)';
    } else if (resultado === 'rechazado') {
      status = 'rejected';
      payment_id = 'SIM-999';
      observacion = 'Pago rechazado (simulación)';
    } else {
      // El backend solo acepta approved/rejected, para pendiente solo cambiamos el estado local
      this.mercadoPagoResultado = 'pendiente';
      this.mercadoPagoMensaje = 'Pago simulado en estado pendiente.';
      return;
    }
    this.mercadoPagoMensaje = 'Simulando pago...';
    
    this.apiService.simularPagoMercadoPago(appIdOperativo, pedidoId, status, payment_id, observacion)
      .pipe(take(1))
      .subscribe({
        next: (resp) => {
          if (status === 'approved') {
            this.mercadoPagoResultado = 'aprobado';
            this.mercadoPagoMensaje = 'Pago aprobado por simulación.';
            if (this.pedidoCreado) {
              this.pedidoCreado.estado = 'pagado';
              this.notificaciones.push({ mensaje: 'Pago aprobado por simulación' });
              if (this.pedidoCreado.id) {
                this.iniciarPedidoPolling(this.pedidoCreado.id);
              }
              this.enviarPedidoALogisticaPreparacion();
            }
          } else {
            this.mercadoPagoResultado = 'rechazado';
            this.mercadoPagoMensaje = 'Pago rechazado por simulación.';
          }
        },
        error: (err) => {
          this.mercadoPagoResultado = null;
          this.mercadoPagoMensaje = 'Error al simular el pago: ' + (err?.error?.message || err?.message || '');
        }
      });
  }

  private obtenerCodigoEstadoPreparacion(): Observable<string | null> {
    if (!this.appId) {
      return of(null);
    }
    return this.logisticaService.getEnvioEstados(this.appId, { activo: true }).pipe(
      map((estados: EnvioEstado[]) => {
        if (!Array.isArray(estados) || !estados.length) {
          return null;
        }
        const encontrado = estados.find((estado) => {
          const texto = `${estado.codigo ?? ''} ${estado.descripcion ?? ''}`.toLowerCase();
          return /preparaci[oó]n|preparacion|preparado|preparando/.test(texto);
        });
        if (encontrado?.codigo) {
          return encontrado.codigo;
        }
        const fallback = estados.find((estado) => {
          const texto = `${estado.codigo ?? ''} ${estado.descripcion ?? ''}`.toLowerCase();
          return /pendiente|pagado|enviado|entregado/.test(texto);
        });
        return fallback?.codigo ?? null;
      }),
      catchError(() => of(null))
    );
  }

  private crearPedidoEnvioSiNoExiste(): Observable<PedidoEnvio | null> {
    if (!this.appId || !this.pedidoCreado?.id) {
      return of(null);
    }
    const appId = this.appId;
    const pedidoId = this.pedidoCreado.id;

    if (this.pedidoEnvioRegistrado) {
      return of(this.pedidoEnvioRegistrado);
    }

    const direccion = this.direccionSeleccionada;
    const opcion = this.entregaOpcionSeleccionada;
    const cotizacion = this.cotizacion;
    if (!direccion || !opcion || !cotizacion) {
      return of(null);
    }

    const payload: PedidoEnvioPayload = {
      usuarioDireccionId: direccion.id,
      entregaOpcionId: opcion.id,
      costo: this.obtenerCostoCotizacion(cotizacion),
      distanciaKm: this.obtenerDistanciaCotizacion(cotizacion) ?? undefined,
      observaciones: direccion.referencia || undefined
    };

    return this.guardarYRefrescarPedidoEnvio(appId, pedidoId, payload).pipe(
      catchError(() => of(null))
    );
  }

  private enviarPedidoALogisticaPreparacion(): void {
    if (!this.appId || !this.pedidoCreado?.id) {
      return;
    }
    const appId = this.appId;
    const pedidoId = this.pedidoCreado.id;

    
  }

  cerrarModalPago(): void {
    this.mostrarModalPago = false;
    this.mercadoPagoResultado = null;
    this.mercadoPagoMensaje = undefined;
    this.mercadoPagoWidgetLoaded = false;
    this.mercadoPagoPedidoId = null;
  }

  confirmarPedido(): void {
    if (this.procesandoPedido) {
      return;
    }
    const direccion = this.direccionSeleccionada;
    const opcion = this.entregaOpcionSeleccionada;
    const cotizacion = this.cotizacion;
    const items = this.carritoService.items;
    const metodoPago = this.metodoPagoControl.value;
    const formaPago = this.formaPagoSeleccionada;

    if (!this.appIdOperativo || !this.usuarioId) {
      this.mensajeEntrega = 'Necesitas seleccionar una app y tener sesión activa para continuar.';
      return;
    }
    if (!items.length) {
      this.mensajeEntrega = 'Tu carrito está vacío.';
      return;
    }
    if (!direccion || !opcion || !cotizacion || !this.entregaConfirmada) {
      this.mensajeEntrega = 'Confirma dirección y método de entrega antes de continuar.';
      return;
    }
    // Si requiere programar y no hay fecha, mostrar mensaje y no continuar
    if (opcion.permiteProgramar && !this.fechaProgramada) {
      this.mensajeEntrega = 'Debes elegir una fecha de entrega para continuar.';
      return;
    }
    if (!metodoPago || !formaPago) {
      this.mensajeEntrega = 'Selecciona un medio de pago válido.';
      return;
    }

    let medioPagoReferencia: string | undefined;
    if (formaPago.requiereReferencia) {
      const referencia = (this.metodoPagoReferenciaControl.value ?? '').trim();
      this.metodoPagoReferenciaControl.setValue(referencia, { emitEvent: false });
      if (!referencia) {
        this.metodoPagoReferenciaControl.markAsTouched();
        this.mensajeEntrega = 'Ingresá la referencia solicitada por la forma de pago.';
        return;
      }
      medioPagoReferencia = referencia;
    }

    // Si es Mercado Pago, primero confirmar el pedido y luego obtener la preferencia
    this.statusCodeConfirmacion = undefined;
    // Armar array de items para el backend
    const itemsPayload = this.mapItemsToPayload(items);
    const appIdOperativo = this.obtenerAppIdOperativo();
    if (formaPago.codigo === 'mercadopago') {
      // Armar payload de pedido con datos de pago, entrega y todos los campos relevantes de la cotización
      const pedidoPayload: any = {
        metodoPago,
        tipoEntrega: opcion.entregaTipo?.codigo || opcion.entregaTipo?.nombre || 'domicilio',
        usuarioDireccionId: direccion.id,
        entregaOpcionId: opcion.id,
        medioPagoReferencia,
        tarjetaId: undefined,
        costoEnvio: this.obtenerCostoCotizacion(this.cotizacion),
        items: itemsPayload
      };
      
      // Agregar todos los campos relevantes de la cotización si existen
      if (cotizacion) {
        if (typeof cotizacion.distanciaKm !== 'undefined') pedidoPayload.distanciaKm = cotizacion.distanciaKm;
        if (typeof cotizacion.moneda !== 'undefined') pedidoPayload.moneda = cotizacion.moneda;
        if (typeof cotizacion.etaMinutos !== 'undefined') pedidoPayload.etaMinutos = cotizacion.etaMinutos;
        if (typeof cotizacion.etaMaxima !== 'undefined') pedidoPayload.etaMaxima = cotizacion.etaMaxima;
        if (typeof cotizacion.tiempoEstimadoHoras !== 'undefined') pedidoPayload.tiempoEstimadoHoras = cotizacion.tiempoEstimadoHoras;
        if (typeof cotizacion.horaVentanaDesde !== 'undefined') pedidoPayload.horaVentanaDesde = cotizacion.horaVentanaDesde;
        if (typeof cotizacion.horaVentanaHasta !== 'undefined') pedidoPayload.horaVentanaHasta = cotizacion.horaVentanaHasta;
        if (typeof cotizacion.fechaProgramada !== 'undefined') pedidoPayload.fechaProgramada = cotizacion.fechaProgramada;
        if (typeof cotizacion.metadata !== 'undefined') pedidoPayload.metadata = cotizacion.metadata;
      }
      // Sobrescribir con lo que el usuario seleccione manualmente si corresponde
      if (this.fechaProgramada) pedidoPayload.fechaProgramada = this.fechaProgramada;
      if (this.horaVentanaDesde) pedidoPayload.horaVentanaDesde = this.horaVentanaDesde;
      if (this.horaVentanaHasta) pedidoPayload.horaVentanaHasta = this.horaVentanaHasta;
      this.procesandoPedido = true;
      // El array de items va solo en el body (pedidoPayload.items)
      this.apiService.confirmarPedido([], [], [], pedidoPayload)
        .pipe(take(1))
        .subscribe({
          next: (pedido: any) => {
            const pedidoCreado = pedido?.pedido ? pedido.pedido : pedido;
            this.pedidoCreado = pedidoCreado;
            const pedidoId: number = Number(pedidoCreado?.id ?? 0);
            if (!Number.isFinite(pedidoId) || pedidoId <= 0) {
              this.mensajeEntrega = 'El pedido no tiene un ID válido.';
              this.procesandoPedido = false;
              return;
            }
            // Limpiar carrito y formularios al confirmar pedido exitosamente
            this.carritoService.limpiar();
            // NO limpiar metodoPagoControl ni formaPagoSeleccionada aquí, para mantener la pasarela seleccionada en el modal
            if (this.metodoPagoReferenciaControl) this.metodoPagoReferenciaControl.reset();
            // Solo limpiar campos editables, no asignar a readonly
            this.cotizacion = undefined;
            this.entregaConfirmada = false;
            this.mensajeEntrega = undefined;
            // ADVERTENCIA: Verificar si se generó PedidoEnvio
            if (!pedidoCreado.pedidoEnvio) {
              this.mensajeEntrega = 'Advertencia: El pedido fue confirmado pero no se generó el envío. Verifica que usuarioDireccionId, entregaOpcionId y el estado "pendiente" existan y sean válidos.';
            }
            this.apiService.getMercadoPagoPreference(
              pedidoId,
              Number(appIdOperativo ?? 0),
              formaPago.pasarelaPago?.alias || formaPago?.pasarelaPago?.alias || undefined
            )
              .pipe(take(1))
              .subscribe({
                next: (resp: any) => {
                  this.mercadoPagoPedidoId = pedidoId;
                  this.mercadoPagoPreferenceId = resp.preferenceId;
                  this.mostrarModalPago = true;
                  this.cargarMercadoPagoWidget();
                  this.procesandoPedido = false;
                  this.reiniciarOffcanvasCarritoSiVacio();
                },
                error: (error: any) => {
                  const backendMsg = error?.error?.error || error?.error?.message || error?.message || 'No se pudo obtener la preferencia de Mercado Pago.';
                  const details = error?.error?.details;
                  if (typeof details === 'string' && details.includes('At least one policy returned UNAUTHORIZED.')) {
                    this.mensajeEntrega = 'En estos momentos no podemos procesar el pago, intente nuevamente más tarde.';
                  } else {
                    this.mensajeEntrega = details ? `${backendMsg}: ${details}` : backendMsg;
                  }
                  this.statusCodeConfirmacion = error?.status;
                  this.procesandoPedido = false;
                }
              });
          },
          error: (error: any) => {
            const backendMsg = error?.error?.message || error?.message || 'No se pudo confirmar el pedido.';
            this.mensajeEntrega = backendMsg;
            this.statusCodeConfirmacion = error?.status;
            this.procesandoPedido = false;
          }
        });
      return;
    }
    // ...existing code...
    }

  private guardarYRefrescarPedidoEnvio(appId: number, pedidoId: number, payload: PedidoEnvioPayload) {
    return this.logisticaService.createPedidoEnvio(appId, pedidoId, payload).pipe(
      catchError((error) => {
        if (error?.status === 409) {
          return this.logisticaService.updatePedidoEnvio(appId, pedidoId, payload);
        }
        return throwError(() => error);
      }),
      switchMap(() => this.logisticaService.getPedidoEnvio(appId, pedidoId))
    );
  }

  private obtenerCostoCotizacion(cotizacion: CotizacionEntregaResponse | undefined): number {
    if (!cotizacion) {
      return 0;
    }
    const pricing = (cotizacion.metadata as { pricing?: PedidoEnvioPricingMetadata } | undefined)?.pricing;
    const candidates = [cotizacion.costoCliente, pricing?.costoAplicado, cotizacion.costo, pricing?.costoBase];
    for (const candidate of candidates) {
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        return candidate;
      }
    }
    return 0;
  }

  private obtenerDistanciaCotizacion(cotizacion: CotizacionEntregaResponse | undefined): number | null {
    if (!cotizacion) {
      return null;
    }
    const pricing = (cotizacion.metadata as { pricing?: PedidoEnvioPricingMetadata } | undefined)?.pricing;
    const distance = pricing?.distanciaKm ?? cotizacion.distanciaKm;
    return typeof distance === 'number' && Number.isFinite(distance) ? distance : null;
  }

  private esErrorOrigenNoConfigurado(error: any): boolean {
    if (error?.status !== 400) {
      return false;
    }
    const mensaje = this.extraerMensajeError(error).toLowerCase();
    return mensaje.includes('origen') && (mensaje.includes('config') || mensaje.includes('falt'));
  }

  private extraerMensajeError(error: any): string {
    const message = error?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
    if (typeof error?.error === 'string') {
      return error.error;
    }
    return typeof error?.message === 'string' ? error.message : '';
  }

  private mapItemsToPayload(items: CarritoItem[]): PedidoItemPayload[] {
    return items
      .map((item) => {
        const productoId = Number(item?.producto?.id);
        if (!Number.isFinite(productoId) || productoId <= 0) {
          return null;
        }
        return {
          productoId,
          cantidad: item.cantidad,
          precioFinal: this.carritoService.getPrecioAplicadoProducto(item.producto)
        };
      })
      .filter((payload): payload is any => !!payload);
  }

  constructor(
    private apiService: ApiService,
    private router: Router,
    public carritoService: CarritoService,
    private companyService: CompanyService,
    private logisticaService: LogisticaService,
    private authUserService: AuthUserService,
    private checkoutEntregaService: CheckoutEntregaService,
    private fb: FormBuilder,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.direccionForm = this.fb.group({
      alias: [''],
      receptorNombre: [''],
      receptorTelefono: [''],
      calle: ['', Validators.required],
      numero: [''],
      piso: [''],
      departamento: [''],
      entreCalles: [''],
      referencia: [''],
      codigoPostal: [''],
      localidadId: [null, Validators.required],
      latitud: [null],
      longitud: [null],
      precisionGeo: ['manual'],
      esPrincipal: [false],
      geocode: [true]
    });
  }

  ngOnInit(): void {

    // ── Inicialización SÍNCRONA desde caché ──────────────────────────────────
    // Asegura que logo y buscador funcionen en el primer render (ej: tras refresh)
    // sin esperar las llamadas HTTP de cargarEmpresa() o getUsuarioById()
    if (!this.empresa) {
      const empresaCached = this.companyService.getEmpresaValue();
      if (empresaCached) {
        this.empresa = empresaCached;
      }
    }
    if (!this.selectedAppId) {
      const appIdGuardado = Number(localStorage.getItem(this.selectedAppStorageKey));
      if (Number.isFinite(appIdGuardado) && appIdGuardado > 0) {
        this.selectedAppId = appIdGuardado;
      } else if (this.empresa?.apps?.length) {
        this.selectedAppId = this.empresa.apps[0].id;
      }
    }
    if (this.selectedAppId) {
      this.carritoService.setAppId(this.selectedAppId, { forceRefresh: true });
    }
    // Notificar al CarritoService: solo refrescar el carrito sin tocar appId$ ni metadata.
    // Esto garantiza que tras un browser refresh los items del carrito aparezcan
    // sin esperar las llamadas HTTP asíncronas de cargarEmpresa/getUsuarioById.
    this.carritoService.refreshCarrito();
    // ─────────────────────────────────────────────────────────────────────────

    // Solo limpiar usuario y localStorage al loguear, NO en ngOnInit
    this.adminPerms = [];
    this.esAdmin = false;

    try {
      // Leer usuario actual del servicio o localStorage
      let usuario = this.authUserService.getUsuario();
      
      if (!usuario) {
        const usuarioRaw = localStorage.getItem('usuario');
        if (usuarioRaw) {
          usuario = JSON.parse(usuarioRaw);
        }
      }
      if (usuario) {
        this.actualizarAdminPerms(usuario);
      }
    } catch {}
        // Cargar categorías para el menú del navbar
        this.apiService.getCategorias().pipe(take(1)).subscribe({
          next: (categorias) => {
            this.categorias = categorias || [];
          },
          error: (err) => {
            console.error('Error al cargar categorías:', err);
            this.categorias = [];
          }
        });
        this.metodoPagoReferenciaControl.disable({ emitEvent: false });
        // Inicializa usuario desde localStorage o token
        this.usuario = this.authUserService.getUsuario();
        const usuarioId = this.usuario?.id || this.authUserService.getUsuarioId();
        if (usuarioId) {
          this.apiService.getUsuarioById(usuarioId).pipe(take(1)).subscribe({
            next: (usuarioApi: Usuario) => {
              if (usuarioApi && usuarioApi.id) {
                this.usuario = usuarioApi;
                this.authUserService.setUsuario(usuarioApi);
                // Actualizar localStorage con el usuario completo (incluyendo rol y permisos)
                try {
                  localStorage.setItem('usuario', JSON.stringify(usuarioApi));
                } catch {}
                this.actualizarAdminPerms(usuarioApi);
                // Solo después de tener usuario actualizado, cargar empresa
                this.cargarEmpresa();
              } else {
                // Si no hay usuario válido, igual cargar empresa (usará empresa.apps)
                this.cargarEmpresa();
              }
            },
            error: () => {
              // Si falla, igual cargar empresa (usará empresa.apps)
              this.cargarEmpresa();
            }
          });
        } else {
          // Si no hay usuarioId, igual cargar empresa (usará empresa.apps)
          this.cargarEmpresa();
        }
        // usuarioId debe setearse ANTES de suscribirse a appId$ para que
        // la condición if (appId && this.usuarioId) sea correcta en la primera emisión
        this.usuarioId = usuarioId;
        if (this.usuarioId && this.obtenerAppIdOperativo()) {
          this.cargarDirecciones();
          this.cargarEntregaTipos();
        }
    const rol = (this.authUserService.getRol() ?? '').trim().toLowerCase();
    this.esUsuarioStaff = rol === 'staff' || rol === 'admin';
    this.inicializarLocalidadAutocomplete();

    const medioInicial = this.carritoService.medioPago;
    if (medioInicial) {
      this.metodoPagoControl.setValue(medioInicial, { emitEvent: false });
      this.actualizarFormaPagoSeleccionada(medioInicial);
    }

    this.metodoPagoControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((medio) => {
        this.carritoService.setMedioPago(medio);
        this.actualizarFormaPagoSeleccionada(medio);
      });

    this.carritoService.medioPago$
      .pipe(takeUntil(this.destroy$))
      .subscribe((codigo) => {
        if (codigo !== this.metodoPagoControl.value) {
          this.metodoPagoControl.setValue(codigo, { emitEvent: false });
        }
        this.actualizarFormaPagoSeleccionada(codigo);
      });
    
    this.carritoService.appId$
      .pipe(takeUntil(this.destroy$))
      .subscribe((appId) => {
        this.appId = appId;
        // Fallback: si this.usuarioId aún no fue asignado, leerlo directamente
        const uid = this.usuarioId ?? this.authUserService.getUsuarioId();
        if (appId && uid) {
          if (!this.usuarioId) this.usuarioId = uid;
          this.cargarDirecciones();
          this.cargarEntregaTipos();
          this.cargarFormasPago(true);
        } else {
          this.resetFlujoEntregaLocal();
        }
      });

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.resultadosBusqueda = [];
        this.actualizarBreadcrumb();
        this.cargarCantidadFavoritos();
      });

    // El resto de inicializaciones que no dependen de empresa/usuario
    this.cargarCantidadFavoritos();
    this.actualizarBreadcrumb();
    const idApp = Number(this.selectedAppId || localStorage.getItem('selectedAppId'));
    this.apiService.getModeloImputaciones({ appId: idApp, aplica: 'general' })
      .subscribe({
        next: (imps: any[] = []) => {
          this.modeloImputacionesFijas = imps || [];
          this.actualizarMisComprasCount();
        },
        error: (err: any) => {
          console.error('Error al obtener comisiones generales:', err);
        }
      });
    this.apiService.favoritosActualizados$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cargarCantidadFavoritos();
      });
    this.cargarFormasPago();
    // Si hay un pedido creado, iniciar polling en pantalla de espera/resumen
    if (this.pedidoCreado?.id) {
      this.iniciarPedidoPolling(this.pedidoCreado.id);
    }
  }

  
  private iniciarPedidoPolling(pedidoId: number) {
    this.detenerPedidoPolling();
    this.pedidoPollingInterval = setInterval(() => {
      this.apiService.getPedido(pedidoId).pipe(take(1)).subscribe({
        next: (pedido: any) => {
          const estado = pedido?.estado || pedido?.status || '';
          if (estado && estado !== this.ultimoEstadoPedido) {
            this.ultimoEstadoPedido = estado;
            // Notificar solo si cambia el estado relevante
            if (estado === 'pagado' && this.ultimoEstadoNotificado !== 'pagado') {
              this.notificaciones.push({ mensaje: 'Pago aprobado' });
              this.ultimoEstadoNotificado = 'pagado';
            }
            if (estado === 'en preparación' && this.ultimoEstadoNotificado !== 'en preparación') {
              this.notificaciones.push({ mensaje: 'Tu pedido está en preparación para el envío' });
              this.ultimoEstadoNotificado = 'en preparación';
            }
          }
        },
        error: () => {}
      });
    }, 5000); // 5 segundos
  }

  private detenerPedidoPolling() {
    if (this.pedidoPollingInterval) {
      clearInterval(this.pedidoPollingInterval);
      this.pedidoPollingInterval = null;
    }
  }

  
  cargarProductos(): void {
    this.apiService.getProductos().pipe(
      timeout(12000),
      catchError(() => of([] as any[]))
    ).subscribe((productos: any[] = []) => {
      this.productos = productos;
      this.actualizarConteosSubrubro();
      this.conteosCargados = true;
    });
  }

  asegurarConteosSubrubros(): void {
    if (this.conteosCargados) return;
    this.cargarProductos();
  }

  cargarEmpresa(): void {
    
    this.companyService.getEmpresa().pipe(
      timeout(10000),
      catchError(() => of(this.empresa))
    ).subscribe((empresa: Empresa | null) => {
      if (empresa) {
    
        this.empresa = empresa;
        // Si el usuario tiene apps, usarlas como fuente principal para el combo
        let apps: App[] = [];
        if (this.usuario && Array.isArray(this.usuario.apps) && this.usuario.apps.length) {
          apps = this.usuario.apps;
          this.empresa.apps = apps; // sincroniza para el resto del código
        } else {
          apps = empresa.apps || [];
        }
        if (apps.length) {
          const appIdGuardado = Number(localStorage.getItem(this.selectedAppStorageKey));
          if (Number.isFinite(appIdGuardado) && appIdGuardado > 0) {
            this.selectedAppId = appIdGuardado;
          }
          const appSeleccionadaExiste = apps.some((app: App) => app.id === this.selectedAppId);
          if (!appSeleccionadaExiste) {
            this.selectedAppId = apps[0].id;
          }
        } else {
          // Apps vacío: preservar el appId guardado en localStorage en lugar de borrarlo.
          // Esto evita que una respuesta sin apps (cache desactualizado o endpoint incompleto)
          // destruya un appId válido que ya tenía el usuario.
          const appIdGuardado = Number(localStorage.getItem(this.selectedAppStorageKey));
          if (Number.isFinite(appIdGuardado) && appIdGuardado > 0) {
            this.selectedAppId = appIdGuardado;
          } else {
            // Último fallback: usar el código de app del environment
            const defaultAppId = Number(environment.empresaCodigoWeb || environment.empresaCodigo);
            this.selectedAppId = (Number.isFinite(defaultAppId) && defaultAppId > 0) ? defaultAppId : null;
          }
        }
        this.aplicarTemaGlobal();
      }
    });
  }

  aplicarTemaGlobal(): void {
    const appSeleccionada = this.empresa?.apps?.find((item: App) => item.id === this.selectedAppId) as any;
    const empresaAny = this.empresa as any;

    const primary = this.normalizarColorHex(
      appSeleccionada?.colorPrimario ||
      appSeleccionada?.primaryColor ||
      appSeleccionada?.themeColor ||
      appSeleccionada?.color ||
      empresaAny?.colorPrimario ||
      empresaAny?.primaryColor ||
      empresaAny?.themeColor ||
      '#4f46e5'
    );

    const navbar = this.normalizarColorHex(
      appSeleccionada?.navbarColor ||
      appSeleccionada?.colorNavbar ||
      empresaAny?.navbarColor ||
      primary
    );

    const text = this.colorTextoContraste(navbar);
    const muted = text === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(17, 24, 39, 0.82)';

    const rootStyle = this.document.documentElement.style;
    rootStyle.setProperty('--app-primary', primary);
    rootStyle.setProperty('--app-navbar-bg', navbar);
    rootStyle.setProperty('--app-navbar-text', text);
    rootStyle.setProperty('--app-navbar-muted', muted);

    if (this.selectedAppId && Number.isFinite(this.selectedAppId)) {
      localStorage.setItem(this.selectedAppStorageKey, String(this.selectedAppId));
    }

    this.carritoService.setAppId(this.selectedAppId ?? null, { forceRefresh: true });
    this.cargarEntregaTipos();
    this.cargarFormasPago(true);
    this.cargarCantidadFavoritos();
  }

  private cargarCantidadFavoritos(): void {
    this.apiService.getFavoritos().pipe(
      timeout(10000),
      catchError(() => of([] as any[]))
    ).subscribe((response: any) => {
      this.favoritosCount = this.obtenerCantidadFavoritos(response);
    });
  }

  private obtenerCantidadFavoritos(response: any): number {
    const cantidadExplicita = Number(
      response?.cantidad ??
      response?.count ??
      response?.total ??
      response?.meta?.count ??
      response?.meta?.total
    );

    if (Number.isFinite(cantidadExplicita) && cantidadExplicita >= 0) {
      return cantidadExplicita;
    }

    const lista = this.extraerListaFavoritos(response);
    if (!lista.length) return 0;

    const ids = new Set<number>();
    for (const item of lista) {
      const id = Number(
        item?.productoId ??
        item?.producto_id ??
        item?.idProducto ??
        item?.id_producto ??
        item?.producto?.id ??
        item?.id
      );
      if (Number.isFinite(id) && id > 0) {
        ids.add(id);
      }
    }

    return ids.size || lista.length;
  }

  private extraerListaFavoritos(response: any): any[] {
    if (Array.isArray(response)) return response;

    const contenedores = [
      response,
      response?.data,
      response?.resultado,
      response?.result,
      response?.payload,
      response?.data?.data
    ];

    for (const c of contenedores) {
      if (!c) continue;
      if (Array.isArray(c)) return c;
      if (Array.isArray(c?.favoritos)) return c.favoritos;
      if (Array.isArray(c?.items)) return c.items;
      if (Array.isArray(c?.rows)) return c.rows;
      if (Array.isArray(c?.results)) return c.results;
      if (Array.isArray(c?.data)) return c.data;
    }

    return [];
  }

  private normalizarColorHex(color: string): string {
    if (!color) return '#4f46e5';
    const normalized = color.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) return normalized;
    if (/^#[0-9A-Fa-f]{3}$/.test(normalized)) {
      const r = normalized[1];
      const g = normalized[2];
      const b = normalized[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return '#4f46e5';
  }

  private colorTextoContraste(hexColor: string): string {
    const color = this.normalizarColorHex(hexColor).replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111827' : '#ffffff';
  }

  buscarProductos(): void {
    const nombre = this.busquedaNombre?.trim();
    const appId = this.selectedAppId;

    if (!nombre || !appId) {
      this.resultadosBusqueda = [];
      return;
    }

    const termino = nombre.toLowerCase();
    this.apiService.getProductos({ appId }).subscribe((productos: any[] = []) => {
      this.resultadosBusqueda = (productos || []).filter((producto) => {
        const nombreProducto = String(producto?.nombre ?? producto?.titulo ?? producto?.descripcion ?? '').toLowerCase();
        const marcaProducto = this.getMarcaNombre(producto).toLowerCase();
        return nombreProducto.includes(termino) || marcaProducto.includes(termino);
      });
    });
  }

  limpiarPanelBusqueda(): void {
    this.resultadosBusqueda = [];
    this.busquedaNombre = '';
  }

  onCategoriasMenuClick(): void {
    this.limpiarPanelBusqueda();
    this.asegurarConteosSubrubros();
  }

  onSubrubroClick(event: Event): void {
    event.stopPropagation();
    this.limpiarPanelBusqueda();
  }

  irAProducto(producto: any): void {
    this.limpiarPanelBusqueda();

    // Prefer navigation by producto.slug if present
    if (producto?.slug) {
      this.router.navigate(['/productos', producto.slug]);
      return;
    }

    // Fallback to previous logic if no slug
    const subrubroId = producto?.subrubro?.id;
    const rubroNombreDirecto = producto?.rubro?.nombre;
    const subrubroNombreDirecto = producto?.subrubro?.nombre;

    const nombresDesdeCatalogo = this.obtenerNombresRutaPorSubrubroId(subrubroId);
    const rubroNombre = rubroNombreDirecto || nombresDesdeCatalogo?.rubroNombre;
    const subrubroNombre = subrubroNombreDirecto || nombresDesdeCatalogo?.subrubroNombre;

    if (subrubroId && rubroNombre && subrubroNombre) {
      this.router.navigate(['/', this.slugify(rubroNombre), this.slugify(subrubroNombre)]);
      return;
    }

    if (subrubroId) {
      this.router.navigate(['/subrubros', subrubroId]);
      return;
    }

    this.router.navigate(['/dashboard']);
  }

  private obtenerNombresRutaPorSubrubroId(subrubroId: unknown): { rubroNombre: string; subrubroNombre: string } | null {
    const targetId = this.keyFromId(subrubroId);
    if (!targetId) return null;

    for (const rubro of this.rubros || []) {
      const subrubros = Array.isArray(rubro?.subrubros) ? rubro.subrubros : [];
      const subrubro = subrubros.find((item: any) => this.keyFromId(item?.id) === targetId);
      if (!subrubro) continue;

      const rubroNombre = String(rubro?.nombre || '').trim();
      const subrubroNombre = String(subrubro?.nombre || '').trim();
      if (rubroNombre && subrubroNombre) {
        return { rubroNombre, subrubroNombre };
      }
    }

    return null;
  }

  volverInicioDashboard(event: Event): void {
    event.preventDefault();
    this.limpiarPanelBusqueda();
    this.router.navigate(['/dashboard'], { queryParams: {}, fragment: undefined }).then(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  get appLogo(): string {
  // Si ya tienes el usuario cargado en this.usuario y la app seleccionada:
  const app = this.empresa?.apps?.find(a => a.id === this.selectedAppId)
    || this.empresa?.apps?.[0];

  if (app?.logo) {
    return 'assets/logos/apps/' + app.logo + '.png';
  }

  // Fallback: intentar desde localStorage
  try {
    const empresaStr = localStorage.getItem('empresa');
    if (empresaStr) {
      const empresa = JSON.parse(empresaStr);
      const appLS = empresa?.apps?.find((a: any) => a.id === this.selectedAppId) || empresa?.apps?.[0];
      if (appLS?.logo) {
        return 'assets/logos/apps/' + appLS.logo + '.png';
      }
      
    }
  } catch {}

  // Fallback final
  return 'assets/logos/apps/default.png';
}

  get appNombre(): string {
    if (this.empresa && this.empresa.apps && this.empresa.apps.length) {
      const app = this.empresa.apps.find((item: App) => item.id === this.selectedAppId);
      return app?.nombre || this.empresa.nombre;
    }

    return this.empresa?.nombre || 'SuperShopCart';
  }

  private actualizarAdminPerms(usuario: any): void {
    this.esAdmin = false;
    this.adminPerms = [];
    
    const alias = String(usuario?.rol?.alias ?? usuario?.rol?.nombre ?? '').trim().toLowerCase();
   
    this.esAdmin = alias === 'administrador' || alias === 'operador' || alias === 'admin' || alias === 'super_admin';
    
    const permisos = this.extraerPermisosUsuario(usuario);
    this.adminPerms = permisos
      .filter((perm: any) => perm && (perm.esMenu === 1 || perm.esMenu === '1'))
      .map((perm: any) => ({
        label: perm.nombre || perm.alias,
        route: perm.router,
        icon: perm.icono
      }));
  }

  private extraerPermisosUsuario(usuario: any): any[] {
    let permisos: any[] = [];
    if (Array.isArray(usuario?.permisos)) {
      permisos = usuario.permisos;
    } else if (usuario?.permisos && typeof usuario.permisos === 'object') {
      Object.values(usuario.permisos).forEach((permsArr: any) => {
        if (Array.isArray(permsArr)) {
          permisos = permisos.concat(permsArr);
        }
      });
    }

    return permisos;
  }

  cargarUsuario(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this.usuario = null;
      return;
    }

    let userId: number | null = null;
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(decoded);
      userId = data.id || data.userId || null;
    } catch {
      userId = null;
    }

    if (!userId) {
      this.usuario = null;
      return;
    }

    this.apiService.getUsuario(userId).pipe(
      timeout(10000),
      catchError(() => of(null))
    ).subscribe({
      next: (user: any) => {
        this.usuario = user;
        // Si el usuario tiene apps y no hay app seleccionada, seleccionar la primera
        if (user?.apps?.length && !this.selectedAppId) {
          this.selectedAppId = user.apps[0].id;
          localStorage.setItem(this.selectedAppStorageKey, String(this.selectedAppId));
          this.aplicarTemaGlobal();
        }
      },
      error: () => {
        this.usuario = null;
      }
    });
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('permisos');
    localStorage.removeItem('selectedAppId');
    localStorage.removeItem('empresa');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('permisos');
    sessionStorage.removeItem('selectedAppId');
    sessionStorage.removeItem('empresa');
    this.router.navigate(['/auth']);
  }

  eliminarItemCarrito(item: CarritoItem): void {
    const id = Number(item?.producto?.id);
    if (!Number.isFinite(id)) return;
    this.carritoService.quitar(id);
  }

  incrementarCantidad(item: CarritoItem): void {
    const cantidadActual = this.obtenerCantidadActual(item);
    this.actualizarCantidadItem(item, cantidadActual + 1);
  }

  decrementarCantidad(item: CarritoItem): void {
    const cantidadActual = this.obtenerCantidadActual(item);
    if (cantidadActual <= 1) {
      return;
    }
    this.actualizarCantidadItem(item, cantidadActual - 1);
  }

  public actualizarCantidadItem(item: CarritoItem, nuevaCantidad: number): void {
    const id = Number(item?.producto?.id);
    if (!Number.isFinite(id)) return;
    const cantidadNormalizada = Math.max(1, Math.floor(Number(nuevaCantidad) || 1));
    this.carritoService.actualizarCantidad(id, cantidadNormalizada, { permitirCero: false });
  }

  vaciarCarrito(): void {
    this.carritoService.limpiar();
    this.checkoutEntregaService.reset();
    this.resetFlujoEntregaLocal();
    this.metodoPagoControl.reset(null);
    this.metodoPagoReferenciaControl.reset('', { emitEvent: false });
    this.metodoPagoReferenciaControl.disable({ emitEvent: false });
    this.pedidoCreado = undefined;
    this.pedidoEnvioRegistrado = undefined;
    this.errorPago = undefined;
    this.mensajeEntrega = undefined;
    this.procesandoPedido = false;
    this.cuponCodigo = '';
    this.notaPedido = '';
  }

  private actualizarConteosSubrubro(): void {
    const conteo: Record<string, number> = {};

    for (const producto of this.productos) {
      const subrubroId = this.keyFromId(producto?.subrubro?.id);
      if (subrubroId) {
        conteo[subrubroId] = (conteo[subrubroId] || 0) + 1;
      }
    }

    this.conteoProductosPorSubrubro = conteo;
  }

  private keyFromId(id: unknown): string {
    return id === null || id === undefined ? '' : String(id);
  }

  getSubrubroRoute(rubro: any, subrubro: any): any[] {
    const rubroSlug = this.slugify(rubro?.nombre);
    const subrubroSlug = this.slugify(subrubro?.nombre);

    if (rubroSlug && subrubroSlug) {
      return ['/', rubroSlug, subrubroSlug];
    }

    return ['/subrubros', subrubro?.id];
  }

  getMarcaNombre(producto: any): string {
    const entidad = producto?.producto ?? producto ?? {};
    const marca = entidad?.marca ?? producto?.marca;

    const candidatos = [
      typeof marca === 'string' ? marca : '',
      marca?.nombre,
      marca?.name,
      marca?.denominacion,
      entidad?.marcaNombre,
      entidad?.marca_nombre,
      entidad?.nombreMarca,
      entidad?.nombre_marca,
      entidad?.brand,
      entidad?.brandName,
      entidad?.marcaDescripcion,
      entidad?.marca_descripcion,
      producto?.marcaNombre,
      producto?.marca_nombre,
      producto?.nombreMarca,
      producto?.nombre_marca,
      producto?.brand,
      producto?.brandName,
      producto?.marcaDescripcion,
      producto?.marca_descripcion
    ];

    for (const valor of candidatos) {
      const texto = String(valor ?? '').trim();
      if (texto) return texto;
    }

    return '';
  }

  getMarcaLogoPath(producto: any): string {
    const key = this.getMarcaLogoKey(producto);
    if (!key || this.logosMarcaConError.has(key)) return '';

    const candidatos = this.getMarcaLogoCandidates(producto);
    if (!candidatos.length) return '';

    const indice = this.logoMarcaIntento.get(key) ?? 0;
    return candidatos[indice] ?? candidatos[0];
  }

  onMarcaLogoError(producto: any, event?: Event): void {
    const key = this.getMarcaLogoKey(producto);
    if (!key) return;

    const candidatos = this.getMarcaLogoCandidates(producto);
    const indiceActual = this.logoMarcaIntento.get(key) ?? 0;
    const siguienteIndice = indiceActual + 1;

    if (siguienteIndice < candidatos.length) {
      this.logoMarcaIntento.set(key, siguienteIndice);
      const img = event?.target as HTMLImageElement | null;
      if (img) {
        img.src = candidatos[siguienteIndice];
      }
      return;
    }

    this.logosMarcaConError.add(key);

    const img = event?.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  private getMarcaLogoCandidates(producto: any): string[] {
    const entidadProducto = producto?.producto ?? producto ?? {};
    const entidadMarca = entidadProducto?.marca ?? producto?.marca ?? {};
    const marcaNombre = this.getMarcaNombre(producto);
    const slug = this.slugify(marcaNombre);

    const idRaw = entidadMarca?.id ?? entidadProducto?.marcaId ?? entidadProducto?.marca_id ?? entidadProducto?.idMarca ?? entidadProducto?.id_marca;
    const idNumero = Number(idRaw);
    const id5 = Number.isFinite(idNumero) && idNumero > 0 ? String(Math.trunc(idNumero)).padStart(5, '0') : '';

    const codigoRaw = entidadMarca?.codigo ?? entidadMarca?.code ?? entidadProducto?.marcaCodigo ?? entidadProducto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();

    const candidatos = new Set<string>();

    const logoDirecto = resolveMarcaLogo(entidadMarca || entidadProducto);
    if (logoDirecto) {
      if (/^https?:\/\//i.test(logoDirecto) || logoDirecto.startsWith('assets/')) {
        candidatos.add(logoDirecto);
      } else {
        candidatos.add(`assets/logos/marcas/${logoDirecto}`);
      }
    }

    if (id5) {
      candidatos.add(`assets/logos/marcas/${id5}-1.jpg`);
      candidatos.add(`assets/logos/marcas/${id5}-2.jpg`);
      candidatos.add(`assets/logos/marcas/${id5}.jpg`);
      candidatos.add(`assets/logos/marcas/${id5}.png`);
    }

    if (codigo) {
      candidatos.add(`assets/logos/marcas/${codigo}.jpg`);
      candidatos.add(`assets/logos/marcas/${codigo}.png`);
    }

    if (slug) {
      candidatos.add(`assets/logos/marcas/${slug}.png`);
      candidatos.add(`assets/logos/marcas/${slug}.jpg`);
      candidatos.add(`assets/logos/marcas/${slug}.jpeg`);
      candidatos.add(`assets/logos/marcas/${slug}.webp`);
      candidatos.add(`assets/logos/marcas/${slug}.svg`);
    }

    return Array.from(candidatos);
  }

  private getMarcaLogoKey(producto: any): string {
    const entidadProducto = producto?.producto ?? producto ?? {};
    const entidadMarca = entidadProducto?.marca ?? producto?.marca ?? {};
    const logoRaw = extractMarcaLogoValue(entidadMarca || entidadProducto);
    if (logoRaw) return `logo:${logoRaw.toLowerCase()}`;

    const idRaw = entidadMarca?.id ?? entidadProducto?.marcaId ?? entidadProducto?.marca_id ?? entidadProducto?.idMarca ?? entidadProducto?.id_marca;
    const id = String(idRaw ?? '').trim();
    if (id) return `id:${id}`;

    const codigoRaw = entidadMarca?.codigo ?? entidadMarca?.code ?? entidadProducto?.marcaCodigo ?? entidadProducto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();
    if (codigo) return `cod:${codigo}`;

    const nombre = this.slugify(this.getMarcaNombre(producto));
    if (nombre) return `nom:${nombre}`;

    return '';
  }
  public slugify(texto: unknown): string {
    const valor = String(texto || '').trim().toLowerCase();
    if (!valor) return '';

    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  get mostrarBreadcrumb(): boolean {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url !== '/dashboard' && this.breadcrumbItems.length > 0;
  }

  private actualizarBreadcrumb(): void {
    const path = this.router.url.split('?')[0].split('#')[0];
    const segmentos = path.split('/').filter(Boolean);

    if (!segmentos.length || (segmentos.length === 1 && segmentos[0] === 'dashboard')) {
      this.breadcrumbItems = [];
      return;
    }

    let acumulado = '';
    this.breadcrumbItems = segmentos.map((segmento: string) => {
      acumulado += `/${segmento}`;
      return {
        label: this.obtenerEtiquetaBreadcrumb(segmento),
        url: acumulado
      };
    });
  }

  private obtenerEtiquetaBreadcrumb(segmento: string): string {
    const mapaEtiquetas: Record<string, string> = {
      dashboard: 'Dashboard',
      empresas: 'Empresas',
      usuarios: 'Usuarios',
      productos: 'Productos',
      rubros: 'Rubros',
      subrubros: 'Subrubros',
      carrito: 'Carrito',
      pedidos: 'Pedidos',
      promociones: 'Promociones',
      tarjetas: 'Tarjetas',
      admin: 'Administración',
      'cuenta-corriente': 'Cuenta Corriente',
      'productos-en-oferta': 'Ofertas',
      favoritos: 'Favoritos',
      'todos-los-productos': 'Todos los productos',
      ofertas: 'Ofertas',
      auth: 'Autenticación',
      login: 'Login',
      register: 'Registro'
    };

    if (mapaEtiquetas[segmento]) {
      return mapaEtiquetas[segmento];
    }

    return segmento
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (caracter: string) => caracter.toUpperCase());
  }

 

  private resetFlujoEntregaLocal(resetDirecciones: boolean = true): void {
    if (resetDirecciones) {
      this.direcciones = [];
    }
    this.loadingDirecciones = false;
    this.direccionError = undefined;
    this.selectedDireccionId = null;
    this.selectedEntregaTipoId = null;
    this.selectedEntregaTipoCodigo = null;
    this.selectedEntregaTipoNombre = null;
    this.selectedEntregaOpcionId = null;
    this.entregaOpciones = [];
    this.todasEntregaOpciones = [];
    this.entregaError = undefined;
    this.cotizacion = undefined;
    this.entregaConfirmada = false;
    this.mensajeEntrega = undefined;
    this.mostrarFormularioDireccion = false;
    this.checkoutEntregaService.reset();
  }
  // --- Mis Compras Modal ---
  @ViewChild('modalMisCompras') modalMisCompras!: MisComprasModalComponent;
  // --- Mis Compras Modal ---
  abrirModalMisCompras() {
    console.log('Intentando abrir modal Mis Compras', this.modalMisCompras);
    this.actualizarMisComprasCount();
    if (this.modalMisCompras && typeof this.modalMisCompras.abrir === 'function') {
      this.modalMisCompras.abrir();
    } else {
      console.warn('modalMisCompras no está disponible o no tiene método abrir');
    }
  }
  cancelarCompra(): void {
    this.entregaConfirmada = false;
    this.mensajeEntrega = undefined;
    this.statusCodeConfirmacion = undefined;
    this.errorPago = undefined;
    // Opcional: resetear otros campos relacionados si es necesario
    // this.selectedEntregaOpcionId = null;
    // this.selectedDireccionId = null;
    // this.formaPagoSeleccionada = null;
    // this.metodoPagoControl.reset();
    // this.metodoPagoReferenciaControl.reset();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.detenerPedidoPolling();
  }

  private obtenerCantidadActual(item: CarritoItem): number {
    return Number(item?.cantidad ?? 1);
  }

    /**
   * Devuelve el total estimado sumando subtotal, impuestos generales, impuestos a productos y envío
   */
  getTotalEstimado(): number {
    const subtotal = this.carritoService.total;
    const impuestosGenerales = this.getImpuestosGeneralesSobreSubtotal(subtotal).reduce((acc, imp) => acc + (imp.importe || 0), 0);
    const impuestosProductos = this.getImputacionesResumen(this.carritoService.items).reduce((acc, imp) => acc + (imp.importe || 0), 0);
    const envio = this.cotizacion?.costo || 0;
    return subtotal + impuestosGenerales + impuestosProductos + envio;
  }
  
  /**
   * Devuelve true si el producto tiene impuestos cargados (modeloImputacion no vacío)
   */
  public productoTieneImpuestos(producto: any): boolean {
    if (!producto) return false;
    // Puede venir como modeloImputacion o modeloImputaciones
    const imps = producto.modeloImputacion || producto.modeloImputaciones;
    return Array.isArray(imps) && imps.length > 0;
  }

}

