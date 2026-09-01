  
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { catchError, map, switchMap, take, takeUntil } from 'rxjs/operators';
import { CarritoItem, CarritoService } from '../../../carrito.service';
import { LogisticaService } from '../../../logistica.service';
import { AuthUserService } from '../../../auth-user.service';
import { CheckoutEntregaService } from '../../../checkout-entrega.service';
import { ApiService } from '../../../api.service';
import {
  CotizacionEntregaResponse,
  CrearUsuarioDireccionPayload,
  EntregaOpcion,
  EntregaTipo,
  FormaPago,
  Pedido,
  PedidoEnvio,
  PedidoEnvioPricingMetadata,
  PedidoEnvioPayload,
  PedidoItemPayload,
  PrecisionGeo,
  UsuarioDireccion
} from '../../../models';
declare var MercadoPago: any;


@Component({
  selector: 'app-carrito',
  standalone: false,
  templateUrl: './carrito.component.html',
  styleUrl: './carrito.component.scss'
})



export class CarritoComponent implements OnInit, OnDestroy {
  // Modal de pago
  modalPagoVisible = false;
  modalPagoEstado: 'esperando' | 'widget' | 'resultado' = 'esperando';
  modalPagoExito = false;
  modalPagoMensaje = '';
  modalPagoDetalle = '';
  // Abrir modal de pago y preparar widget
  abrirModalPago(preferenciaId: string) {
    this.modalPagoVisible = true;
    this.modalPagoEstado = 'esperando';
    this.modalPagoExito = false;
    this.modalPagoMensaje = '';
    this.modalPagoDetalle = '';
    setTimeout(() => {
      this.mostrarWidgetMercadoPago(preferenciaId);
    }, 500);
  }

  mostrarWidgetMercadoPago(preferenciaId: string) {
    this.modalPagoEstado = 'widget';
    // Limpia el contenedor
    const widgetDiv = document.getElementById('widget-mercadopago');
    if (widgetDiv) widgetDiv.innerHTML = '';
    // Carga el widget de Mercado Pago
    if ((window as any).MercadoPago) {
      const mp = new (window as any).MercadoPago('PUBLIC_KEY', { locale: 'es-AR' });
      mp.checkout({
        preference: { id: preferenciaId },
        render: { container: '#widget-mercadopago', label: 'Pagar' },
        theme: { elementsColor: '#0d6efd', headerColor: '#fff' }
      });
    }
  }

  mostrarResultadoPago(exito: boolean, mensaje: string, detalle?: string) {
    this.modalPagoEstado = 'resultado';
    this.modalPagoExito = exito;
    this.modalPagoMensaje = mensaje;
    this.modalPagoDetalle = detalle || '';
  }

  cerrarModalPago() {
    this.modalPagoVisible = false;
    this.modalPagoEstado = 'esperando';
    this.modalPagoExito = false;
    this.modalPagoMensaje = '';
    this.modalPagoDetalle = '';
  }

  // Devuelve todas las promos de cuotas sin interés
  getCuotasPromos(producto: any): any[] {
    return Array.isArray(producto?.promociones)
      ? producto.promociones.filter((p: any) => p.promocionTipo?.alias === 'cuotas')
      : [];
  }

  // Devuelve todas las promos que NO son cuotas
  getOtrasPromos(producto: any): any[] {
    return Array.isArray(producto?.promociones)
      ? producto.promociones.filter((p: any) => p.promocionTipo?.alias !== 'cuotas')
      : [];
  }

  // Devuelve el texto para el tooltip de la promo
  getPromoTooltip(promo: any): string {
    if (!promo) return '';
    let detalle = '';
    if (promo.descripcion) detalle += promo.descripcion + ' ';
    const alias = promo.promocionTipo?.alias;
    if (alias === 'descuento') {
      detalle += `Descuento: ${promo.descuentoPorcentaje || promo.valor || ''}`;
      if (promo.descuentoPorcentaje) detalle += '%';
    } else if (alias === 'oferta') {
      detalle += 'Oferta especial';
    } else if (alias === 'cuotas') {
      detalle += `${promo.cuotas} cuotas sin interés`;
      if (promo.banco) detalle += ` con ${promo.banco}`;
    }
    return detalle.trim();
  }

  // Calcula el precio final con descuentos (sin cuotas)
  getPrecioFinalConDescuentos(item: CarritoItem | null | undefined): number {
    if (!item) return 0;
    // Usa la lógica de getPrecioUnitario pero sin forzar precio regular por infoCuotas
    return this.carritoService.getPrecioAplicadoProducto(item.producto);
  }

  // Si tiene cuotas, calcula el valor de cada cuota sobre el precio final con descuentos
  getCuotaValor(item: CarritoItem | null | undefined, promoCuota: any): number {
    const precioFinal = this.getPrecioFinalConDescuentos(item);
    return promoCuota && promoCuota.cuotas ? precioFinal / promoCuota.cuotas : precioFinal;
  }

  private readonly carritoService = inject(CarritoService);
  private readonly logisticaService = inject(LogisticaService);
  private readonly authUserService = inject(AuthUserService);
  private readonly fb = inject(FormBuilder);
  private readonly checkoutEntregaService = inject(CheckoutEntregaService);
  private readonly apiService = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  private readonly selectedAppStorageKey = 'selectedAppId';
  readonly precisionGeoOptions: PrecisionGeo[] = ['manual', 'exacta', 'aproximada'];
  metodoPagoControl = new FormControl<string | null>(null, { validators: [Validators.required] });
  metodoPagoReferenciaControl = new FormControl<string>('');

  items$ = this.carritoService.items$;
  total$ = this.items$.pipe(
    map((items: CarritoItem[]) =>
      items.reduce(
        (sum, item) => sum + this.carritoService.getPrecioAplicadoProducto(item.producto) * item.cantidad,
        0
      )
    )
  );
  appId: number | null = null;
  usuarioId: number | null = null;

  direcciones: UsuarioDireccion[] = [];
  loadingDirecciones = false;
  direccionError?: string;
  mostrarFormularioDireccion = false;

  formasPago: FormaPago[] = [];
  formasPagoLoading = false;
  formasPagoError?: string;
  formaPagoSeleccionada?: FormaPago;
  
    // Evento para notificar cuando el pedido está confirmado
    pedidoConfirmadoCallback?: (pedidoId: number) => void;

  direccionForm = this.fb.group({
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
    provinciaId: [null],
    latitud: [null],
    longitud: [null],
    precisionGeo: ['manual'],
    esPrincipal: [false],
    geocode: [true]
  });

  entregaTipos: EntregaTipo[] = [];
  entregaOpciones: EntregaOpcion[] = [];
  entregaLoading = false;
  entregaError?: string;
  mostrarCtaOrigenEnvio = false;
  esUsuarioStaff = false;
  selectedDireccionId: number | null = null;
  selectedEntregaTipoId: number | null = null;
  selectedEntregaOpcionId: number | null = null;
  cotizacion?: CotizacionEntregaResponse;
  entregaConfirmada = false;
  mensajeEntrega?: string;
  procesandoPedido = false;
  pedidoCreado?: Pedido;
  pedidoEnvioRegistrado?: PedidoEnvio;
  errorPago?: string;

  ngOnInit(): void {
    // Cargar Mercado Pago SDK si no está presente
    if (!(window as any).MercadoPago) {
      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {};
      document.body.appendChild(script);
    }
    this.metodoPagoReferenciaControl.disable({ emitEvent: false });
    const rol = (this.authUserService.getRol() ?? '').trim().toLowerCase();
    this.esUsuarioStaff = rol === 'staff' || rol === 'admin';
    const medioInicial = this.carritoService.medioPago;
    if (medioInicial) {
      this.metodoPagoControl.setValue(medioInicial);
      this.actualizarFormaPagoSeleccionada(medioInicial);
    }
    this.metodoPagoControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((medio) => {
        this.carritoService.setMedioPago(medio);
        this.actualizarFormaPagoSeleccionada(medio);
      });

    this.appId = this.obtenerAppId();
    this.carritoService.setAppId(this.appId);
    this.usuarioId = this.authUserService.getUsuarioId();
    if (!this.appId || !this.usuarioId) {
      this.direccionError = 'Necesitas seleccionar una app y estar autenticado para configurar la entrega.';
      return;
    }
    this.cargarFormasPago();
    this.cargarDirecciones();
    this.cargarEntregaTipos();
  }

  get direccionSeleccionada(): UsuarioDireccion | undefined {
    return this.direcciones.find((dir) => dir.id === this.selectedDireccionId);
  }

  get entregaOpcionSeleccionada(): EntregaOpcion | undefined {
    return this.entregaOpciones.find((op) => op.id === this.selectedEntregaOpcionId);
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

  get formasPagoDisponibles(): FormaPago[] {
    return this.formasPago?.filter((fp) => fp.activo) ?? [];
  }

  eliminarProducto(item: CarritoItem): void {
    const id = Number(item?.producto?.id);
    if (!Number.isFinite(id)) return;
    this.carritoService.quitar(id);
  }

  incrementarCantidad(item: CarritoItem): void {
    const id = Number(item?.producto?.id);
    if (!Number.isFinite(id)) return;
    this.carritoService.actualizarCantidad(id, item.cantidad + 1);
  }

  decrementarCantidad(item: CarritoItem): void {
    const id = Number(item?.producto?.id);
    if (!Number.isFinite(id)) return;
    this.carritoService.actualizarCantidad(id, item.cantidad - 1);
  }

  vaciarCarrito(): void {
    this.carritoService.limpiar();
    this.checkoutEntregaService.reset();
    this.entregaConfirmada = false;
    this.cotizacion = undefined;
    this.pedidoCreado = undefined;
    this.pedidoEnvioRegistrado = undefined;
    this.errorPago = undefined;
    this.actualizarFormaPagoSeleccionada(this.metodoPagoControl.value);
  }

  getAhorroTotal(items: CarritoItem[]): number {
    if (!items?.length) return 0;
    return items.reduce((ahorro, item) => ahorro + this.getAhorroSubtotal(item), 0);
  }

  getAhorroUnitario(item: CarritoItem | null | undefined): number {
    if (!item) {
      return 0;
    }
    const precioFinal = this.carritoService.getPrecioAplicadoProducto(item.producto);
    const precioReferencia = this.carritoService.getPrecioReferenciaProducto(item.producto);
    if (precioReferencia !== null && precioReferencia > precioFinal) {
      return precioReferencia - precioFinal;
    }
    return 0;
  }

  getAhorroSubtotal(item: CarritoItem | null | undefined): number {
    if (!item) {
      return 0;
    }
    const cantidad = item.cantidad ?? 1;
    return this.getAhorroUnitario(item) * cantidad;
  }

  getPrecioUnitario(item: CarritoItem | null | undefined): number {
    if (!item) {
      return 0;
    }
    // Si el producto tiene infoCuotas, mostrar siempre el precio regular (sin descuento)
    if (item.producto.infoCuotas) {
      // El precio regular es producto.precio o producto.precioLista
      return item.producto.precio ?? item.producto.precioLista ?? this.carritoService.getPrecioAplicadoProducto(item.producto);
    }
    return this.carritoService.getPrecioAplicadoProducto(item.producto);
  }

  getPrecioOriginal(item: CarritoItem | null | undefined): number | null {
    if (!item) {
      return null;
    }
    const final = this.getPrecioUnitario(item);
    const original = this.carritoService.getPrecioReferenciaProducto(item.producto);
    return original !== null && original > final ? original : null;
  }

  getModeloImputaciones(item: CarritoItem | null | undefined): any[] {
    const producto = item?.producto;
    if (!producto) {
      return [];
    }
    if (!producto.modeloImputacion && Array.isArray((producto as any)?.modeloImputaciones)) {
      producto.modeloImputacion = (producto as any).modeloImputaciones;
    }
    return Array.isArray(producto.modeloImputacion) ? producto.modeloImputacion : [];
  }

  getImputacionMonto(item: CarritoItem | null | undefined, imp: any): number {
    if (!item || !imp) {
      return 0;
    }
    const cantidad = +(item.cantidad ?? 1);
    const valor = +(imp?.valor ?? 0);
    // Usar siempre el precio final con descuentos como base imponible
    const precioBase = this.getPrecioFinalConDescuentos(item);
    if (imp?.aplica === 'items') {
      if (imp?.tipo === 'porcentaje') {
        return precioBase * cantidad * (valor / 100);
      }
      if (imp?.tipo === 'fijo' || imp?.tipo === 'monto') {
        return valor * cantidad;
      }
    }
    return 0;
  }

  toggleFormularioDireccion(): void {
    this.mostrarFormularioDireccion = !this.mostrarFormularioDireccion;
    if (!this.mostrarFormularioDireccion) {
      this.direccionForm.reset({ precisionGeo: 'manual', esPrincipal: false, geocode: true });
    }
  }

  cargarDirecciones(): void {
    if (!this.appId || !this.usuarioId) return;
    this.loadingDirecciones = true;
    this.direccionError = undefined;
    this.logisticaService
      .getUsuarioDirecciones(this.appId, this.usuarioId)
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
          this.direccionError = 'No pudimos cargar tus direcciones. Intentalo nuevamente.';
        }
      });
  }

  guardarDireccion(): void {
    if (!this.appId || !this.usuarioId) return;
    if (this.direccionForm.invalid) {
      this.direccionForm.markAllAsTouched();
      return;
    }
    const raw = this.direccionForm.value;
    const localidadId = Number(raw.localidadId);
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
      provinciaId: raw.provinciaId ? Number(raw.provinciaId) : undefined,
      latitud: raw.latitud ? Number(raw.latitud) : undefined,
      longitud: raw.longitud ? Number(raw.longitud) : undefined,
      precisionGeo: (raw.precisionGeo as PrecisionGeo) || 'manual',
      esPrincipal: !!raw.esPrincipal,
      geocode: true
    };

    this.logisticaService
      .createUsuarioDireccion(this.appId, this.usuarioId, payload)
      .pipe(take(1))
      .subscribe({
        next: (direccion) => {
          this.mostrarFormularioDireccion = false;
          this.direccionForm.reset({ precisionGeo: 'manual', esPrincipal: false, geocode: true });
          this.direcciones = [...this.direcciones.filter((d) => d.id !== direccion.id), direccion];
          this.selectedDireccionId = direccion.id;
          this.checkoutEntregaService.setDireccion(direccion);
          this.cargarEntregaOpciones();
          this.mensajeEntrega = 'Dirección guardada correctamente.';
        },
        error: () => {
          this.mensajeEntrega = 'No pudimos guardar la dirección. Verifica los datos e intenta nuevamente.';
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
    if (!this.appId || !this.usuarioId || !direccion?.id) return;
    this.logisticaService
      .setDireccionPrincipal(this.appId, this.usuarioId, direccion.id)
      .pipe(take(1))
      .subscribe({
        next: () => this.cargarDirecciones(),
        error: () => {
          this.mensajeEntrega = 'No pudimos actualizar la dirección principal.';
        }
      });
  }

  eliminarDireccion(direccion: UsuarioDireccion): void {
    if (!this.appId || !this.usuarioId || !direccion?.id) return;
    this.logisticaService
      .deleteUsuarioDireccion(this.appId, this.usuarioId, direccion.id)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.direcciones = this.direcciones.filter((dir) => dir.id !== direccion.id);
          if (this.selectedDireccionId === direccion.id) {
            this.selectedDireccionId = null;
            this.checkoutEntregaService.reset();
            this.entregaOpciones = [];
            this.cotizacion = undefined;
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
    this.selectedEntregaOpcionId = null;
    this.cotizacion = undefined;
    this.entregaConfirmada = false;
    this.entregaError = undefined;
    this.mostrarCtaOrigenEnvio = false;
    this.cargarEntregaOpciones();
  }

  cargarEntregaTipos(): void {
    if (!this.appId) return;
    this.logisticaService
      .getEntregaTipos(this.appId, { activo: true })
      .pipe(take(1))
      .subscribe({
        next: (tipos) => (this.entregaTipos = tipos ?? []),
        error: () => (this.entregaTipos = [])
      });
  }

  cargarFormasPago(forceRefresh = false): void {
    if (!this.appId) {
      this.formasPago = [];
      this.formasPagoError = 'Selecciona una app para ver las formas de pago.';
      this.metodoPagoControl.reset(null, { emitEvent: false });
      this.actualizarFormaPagoSeleccionada(null);
      return;
    }
    if (this.formasPago.length && !forceRefresh) {
      const preferida = this.resolverFormaPagoPreferida();
      if (preferida && preferida !== this.metodoPagoControl.value) {
        this.metodoPagoControl.setValue(preferida);
      } else {
        this.actualizarFormaPagoSeleccionada(this.metodoPagoControl.value);
      }
      return;
    }
    this.formasPagoLoading = true;
    this.formasPagoError = undefined;
    this.apiService
      .getFormasPago(this.appId)
      .pipe(take(1))
      .subscribe({
        next: (formas) => {
          this.formasPagoLoading = false;
          this.formasPago = [...(formas ?? [])].sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));
          const preferida = this.resolverFormaPagoPreferida();
          if (preferida) {
            this.metodoPagoControl.setValue(preferida);
          } else {
            this.metodoPagoControl.reset(null);
          }
          this.actualizarFormaPagoSeleccionada(preferida ?? null);
        },
        error: () => {
          this.formasPagoLoading = false;
          this.formasPagoError = 'No pudimos cargar las formas de pago disponibles.';
          this.metodoPagoControl.reset(null);
          this.actualizarFormaPagoSeleccionada(null);
        }
      });
  }

  private resolverFormaPagoPreferida(): string | null {
    if (!this.formasPago?.length) {
      return null;
    }
    const candidatos = [this.metodoPagoControl.value, this.carritoService.medioPago];
    for (const candidato of candidatos) {
      if (candidato && this.formasPago.some((fp) => fp.codigo === candidato && fp.activo)) {
        return candidato;
      }
    }
    const activa = this.formasPago.find((fp) => fp.activo);
    return activa?.codigo ?? this.formasPago[0]?.codigo ?? null;
  }

  private actualizarFormaPagoSeleccionada(codigo: string | null | undefined): void {
    if (!codigo) {
      this.formaPagoSeleccionada = undefined;
      this.metodoPagoReferenciaControl.reset('', { emitEvent: false });
      this.metodoPagoReferenciaControl.disable({ emitEvent: false });
      this.metodoPagoReferenciaControl.clearValidators();
      this.metodoPagoReferenciaControl.updateValueAndValidity({ emitEvent: false });
      return;
    }
    const encontrada = this.formasPago.find((fp) => fp.codigo === codigo);
    this.formaPagoSeleccionada = encontrada;
    if (encontrada?.requiereReferencia) {
      this.metodoPagoReferenciaControl.setValidators([Validators.required]);
      this.metodoPagoReferenciaControl.enable({ emitEvent: false });
    } else {
      this.metodoPagoReferenciaControl.clearValidators();
      this.metodoPagoReferenciaControl.reset('', { emitEvent: false });
      this.metodoPagoReferenciaControl.disable({ emitEvent: false });
    }
    this.metodoPagoReferenciaControl.updateValueAndValidity({ emitEvent: false });
  }

  onFiltroTipoChange(tipoId: string): void {
    if (tipoId === 'todos' || tipoId === '') {
      this.selectedEntregaTipoId = null;
    } else {
      const parsed = Number(tipoId);
      this.selectedEntregaTipoId = Number.isFinite(parsed) ? parsed : null;
    }
    this.selectedEntregaOpcionId = null;
    this.cotizacion = undefined;
    this.entregaConfirmada = false;
    this.mostrarCtaOrigenEnvio = false;
    this.cargarEntregaOpciones();
  }

  cargarEntregaOpciones(): void {
    if (!this.appId || !this.selectedDireccionId) return;
    const direccion = this.direccionSeleccionada;
    if (!direccion?.localidadId) {
      this.entregaOpciones = [];
      this.entregaError = 'La dirección seleccionada no tiene localidad asociada.';
      return;
    }
    this.entregaLoading = true;
    this.entregaError = undefined;
    const params: any = { localidadId: direccion.localidadId, habilitada: true };
    if (this.selectedEntregaTipoId) {
      params.entregaTipoId = this.selectedEntregaTipoId;
    }
    this.logisticaService
      .getEntregaOpciones(this.appId, params)
      .pipe(take(1))
      .subscribe({
        next: (opciones) => {
          this.entregaOpciones = opciones ?? [];
          this.entregaLoading = false;
          const snapshot = this.checkoutEntregaService.snapshot.entregaOpcion;
          if (snapshot) {
            const encontrada = this.entregaOpciones.find((op) => op.id === snapshot.id);
            if (encontrada) {
              this.selectedEntregaOpcionId = encontrada.id;
              this.cotizacion = this.checkoutEntregaService.snapshot.cotizacion;
            }
          }
        },
        error: () => {
          this.entregaLoading = false;
          this.entregaOpciones = [];
          this.entregaError = 'No pudimos cargar las opciones de entrega disponibles.';
        }
      });
  }

  seleccionarEntregaOpcion(opcion: EntregaOpcion): void {
    if (!opcion?.id) return;
    this.selectedEntregaOpcionId = opcion.id;
    this.entregaConfirmada = false;
    this.cotizacion = undefined;
    this.mostrarCtaOrigenEnvio = false;
    this.cotizarEntrega(opcion);
  }

  private cotizarEntrega(opcion: EntregaOpcion): void {
    if (!this.appId || !this.selectedDireccionId) return;
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
      .cotizarEntrega(this.appId, opcion.id, payload)
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
    this.mensajeEntrega = 'Datos de entrega guardados. Puedes continuar al pago cuando estés listo.';
    this.pedidoCreado = undefined;
    this.pedidoEnvioRegistrado = undefined;
    this.errorPago = undefined;
  }

  continuarHaciaPago(): void {
    if (this.procesandoPedido) {
      return;
    }
    const direccion = this.direccionSeleccionada;
    const opcion = this.entregaOpcionSeleccionada;
    const cotizacion = this.cotizacion;
    const items = this.carritoService.items;
    const metodoPago = this.metodoPagoControl.value;
    const formaPagoSeleccionada = this.formaPagoSeleccionada;

    if (!this.appId || !this.usuarioId) {
      this.mensajeEntrega = 'Necesitas seleccionar una app y tener sesión activa para continuar.';
      return;
    }
    if (!items.length) {
      this.mensajeEntrega = 'Tu carrito está vacío.';
      return;
    }
    if (!direccion || !opcion || !cotizacion || !this.entregaConfirmada) {
      this.mensajeEntrega = 'Confirma tu dirección y método de entrega antes de continuar.';
      return;
    }
    if (!metodoPago || !formaPagoSeleccionada) {
      this.mensajeEntrega = 'Selecciona un medio de pago válido.';
      return;
    }

    let medioPagoReferencia: string | undefined;
    if (formaPagoSeleccionada.requiereReferencia) {
      const referencia = (this.metodoPagoReferenciaControl.value ?? '').trim();
      this.metodoPagoReferenciaControl.setValue(referencia, { emitEvent: false });
      if (!referencia) {
        this.metodoPagoReferenciaControl.markAsTouched();
        this.mensajeEntrega = 'Ingresá la referencia solicitada por la forma de pago.';
        return;
      }
      medioPagoReferencia = referencia;
    }

    const pedidoItems = this.mapItemsToPayload(items);
    if (!pedidoItems.length) {
      this.mensajeEntrega = 'No pudimos preparar los productos del pedido.';
      return;
    }

    const costoEnvioCotizado = this.obtenerCostoCotizacion(cotizacion);
    const distanciaCotizada = this.obtenerDistanciaCotizacion(cotizacion) ?? undefined;

    const pedidoPayload: Pedido = {
      id: 0,
      usuarioId: this.usuarioId,
      items,
      estado: 'pendiente',
      total: this.carritoService.total + costoEnvioCotizado,
      promocionesAplicadas: undefined,
      metodoPago,
      medioPagoReferencia,
      tarjetaId: undefined,
      repartidorId: undefined,
      ubicacionActual: undefined,
      tipoEntrega: opcion.entregaTipo?.codigo || opcion.entregaTipo?.nombre || 'domicilio',
      costoEnvio: costoEnvioCotizado,
      usuarioDireccionId: direccion.id,
      entregaOpcionId: opcion.id,
      pedidoEnvio: undefined
    };

    const pedidoEnvioPayload: PedidoEnvioPayload = {
      usuarioDireccionId: direccion.id,
      entregaOpcionId: opcion.id,
      costo: costoEnvioCotizado,
      distanciaKm: distanciaCotizada,
      fechaProgramada: undefined,
      horaVentanaDesde: undefined,
      horaVentanaHasta: undefined,
      observaciones: direccion.referencia || undefined
    };

    // Armar productos, impuestos y cargos para cumplir con la firma
    const productos = items.map(item => ({
      title: item.producto.nombre,
      quantity: item.cantidad,
      unit_price: this.getPrecioUnitario(item)
    }));
      // El cálculo de impuestos se realiza en StoreLayoutComponent
      const impuestos: { nombre: string; valor: number }[] = [];
    const cargos = [];
    if (costoEnvioCotizado) {
      cargos.push({ nombre: 'Envío', valor: costoEnvioCotizado });
    }

    this.apiService
      .confirmarPedido(productos, impuestos, cargos, pedidoPayload)
      .pipe(
        switchMap((pedido) => {
          const appId = this.appId;
          if (!appId) {
            throw new Error('appId no disponible para registrar el envío.');
          }
          return this.guardarYRefrescarPedidoEnvio(appId, pedido.id, pedidoEnvioPayload).pipe(
            map((pedidoEnvio) => ({ pedido, pedidoEnvio }))
          );
        }),
        take(1)
      )
      .subscribe({
        next: ({ pedido, pedidoEnvio }) => {
          this.procesandoPedido = false;
          this.pedidoCreado = pedido;
          this.pedidoEnvioRegistrado = pedidoEnvio;
          // Lógica para abrir el modal de pago con el widget de Mercado Pago
          if (pedido?.preferenceId) {
            this.abrirModalPago(pedido.preferenceId);
          } else {
            this.mostrarResultadoPago(false, 'No se pudo obtener la preferencia de pago.', 'Intenta nuevamente o contacta soporte.');
          }
        },
        error: (error) => {
          this.procesandoPedido = false;
          if (error?.status === 400 || error?.status === 404) {
            this.errorPago = 'La forma de pago seleccionada cambió. Actualizamos el catálogo para que elijas otra opción.';
            this.cargarFormasPago(true);
          } else {
            this.errorPago = 'No pudimos generar el pedido. Inténtalo nuevamente.';
          }
        }
      });
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

  private obtenerAppId(): number | null {
    const raw = localStorage.getItem(this.selectedAppStorageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
        } as PedidoItemPayload;
      })
      .filter((payload): payload is PedidoItemPayload => !!payload);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  // Agrupa y suma los impuestos por nombre para mostrar en el resumen
  getImpuestosAgrupados(items: CarritoItem[]): { nombre: string, valor: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      for (const imp of this.getModeloImputaciones(item)) {
        const nombre = imp?.nombre || imp?.tipo || 'Impuesto';
        const monto = this.getImputacionMonto(item, imp);
        if (!map.has(nombre)) map.set(nombre, 0);
        map.set(nombre, map.get(nombre)! + monto);
      }
    }
    return Array.from(map.entries()).map(([nombre, valor]) => ({ nombre, valor }));
  }
}
