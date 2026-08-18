
import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrackingTimelineWrapperComponent } from '../../../../shared/components/tracking-timeline/tracking-timeline-wrapper.component';
import { ApiService } from '../../../../api.service';
import { FormaPago } from '../../../../models';

@Component({
  selector: 'app-mis-compras-modal',
  templateUrl: './mis-compras-modal.component.html',
  styleUrls: ['./mis-compras-modal.component.scss', './modal-backdrop-custom.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, TrackingTimelineWrapperComponent]
})
export class MisComprasModalComponent implements AfterViewInit, OnInit, OnChanges {


  @Input() usuarioId: number | null = null;
  @Input() appId: number | null = null;
  @Output() cerrarModal = new EventEmitter<void>();
  @ViewChild('modalEl', { static: false }) modalRef!: ElementRef<HTMLDivElement>;
  filtroMisComprasEstado: string = '';
  compras: any[] = [];
  cargando = false; // legacy, no usar
  error: string | null = null; // legacy, no usar
  private backdropEl: HTMLElement | null = null;
  trackingLoading: { [id: number]: boolean } = {};
  formasPago: FormaPago[] = [];
    ngOnInit(): void {
      this.cargarFormasPago();
    }

    ngOnChanges(changes: SimpleChanges): void {
      if (changes['appId'] && !changes['appId'].firstChange) {
        this.cargarFormasPago();
        if (this.modalRef?.nativeElement?.classList.contains('show')) {
          this.cargarCompras();
        }
      }
    }

    cargarFormasPago() {
      if (typeof this.appId !== 'number' || !Number.isFinite(this.appId) || this.appId <= 0) return;
      this.api.getFormasPago(this.appId).subscribe({
        next: (formas: FormaPago[]) => {
          this.formasPago = (formas || []).filter(f => f.activo);
          this.cdr.markForCheck();
        },
        error: () => {
          this.formasPago = [];
          this.cdr.markForCheck();
        }
      });
    }
  constructor(private api: ApiService, private cdr: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    // No auto-load aquí, solo al abrir el modal
  }
  onCerrarMisCompras(): void {
    this.cerrar();
  }

  // Paginado
  paginaActual: number = 1;
  itemsPorPagina: number = 5;
  get comprasPaginadas() {
    const start = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.misComprasFiltradas.slice(start, start + this.itemsPorPagina);
  }
  get totalPaginas() {
    return Math.max(1, Math.ceil(this.misComprasFiltradas.length / this.itemsPorPagina));
  }
  abrir(): void {
    this.cargandoMisCompras = true;
    this.errorMisCompras = null;
    this.mostrarCustomBackdrop();
    this.cargarCompras();
    if (this.modalRef && this.modalRef.nativeElement) {
      this.modalRef.nativeElement.style.display = 'block';
      setTimeout(() => this.modalRef.nativeElement.classList.add('show'), 10);
    } else {
      console.warn('modalRef no está disponible');
    }
  }
  refrescar(): void {
    this.cargarCompras();
  }

  cerrar(): void {
    this.ocultarCustomBackdrop();
    this.modalRef.nativeElement.classList.remove('show');
    setTimeout(() => this.modalRef.nativeElement.style.display = 'none', 200);
    this.cerrarModal.emit();
  }



  // Cambia la pestaña activa a 'pagar' al hacer click en Editar/Pagar
  
  cargarCompras(): void {
    if (!this.usuarioId || typeof this.appId !== 'number' || !Number.isFinite(this.appId) || this.appId <= 0) {
      this.compras = [];
      this.misComprasFiltradas = [];
      this.cargandoMisCompras = false;
      return;
    }
    this.cargandoMisCompras = true;
    this.errorMisCompras = null;
    this.api.getMisCompras(this.appId).subscribe({
      next: (compras: any[]) => {
        this.compras = compras || [];
        // Consultar tracking automáticamente para cada compra con trackingCodigo
        for (const compra of this.compras) {
          if (compra?.pedidoEnvio?.trackingCodigo) {
            this.api.getTracking(compra.pedidoEnvio.trackingCodigo).subscribe({
              next: (tracking: any) => {
                compra._trackingEstado = tracking?.estado || null;
                compra._trackingHistorial = tracking?.historial || null;
              }
            });
          }
        }
        this.estadosPedidoSelect = [{ value: '', label: 'Todos' }];
        this.generarEstadosPedidoSelect();
        this.limpiarFiltrosMisCompras(); // Mostrar todas las compras después de cargar
        this.cargandoMisCompras = false;
        this.errorMisCompras = null;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
        this.errorMisCompras = 'No se pudieron cargar las compras.';
        this.cargandoMisCompras = false;
        this.misComprasFiltradas = [];
      }
    });
  }

  mostrarCustomBackdrop(): void {
    if (this.backdropEl) return;
    const el = document.createElement('div');
    el.className = 'modal-backdrop-custom';
    document.body.appendChild(el);
    this.backdropEl = el;
  }

  ocultarCustomBackdrop(): void {
    if (this.backdropEl) {
      document.body.removeChild(this.backdropEl);
      this.backdropEl = null;
    }
  }

  cargandoMisCompras = false;
  errorMisCompras: string | null = null;
  misComprasFiltradas: any[] = [];
  estadosPedidoSelect: { value: string, label: string }[] = [
    { value: '', label: 'Todos' }
  ];

  private generarEstadosPedidoSelect(): void {
    // Extraer todos los estados únicos de las compras, sin agrupar variantes
    const estadosSet = new Set<string>();
    this.estadosPedidoSelect = [{ value: '', label: 'Todos' }];
    debugger;
    for (const c of this.compras) {
      if (c.pedidoEnvio && c.pedidoEnvio.envioEstado && typeof c.pedidoEnvio.envioEstado === 'object' && c.pedidoEnvio.envioEstado.codigo) {
        const envioCodigo = String(c.pedidoEnvio.envioEstado.codigo).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const envioNombre = c.pedidoEnvio.envioEstado.nombre || c.pedidoEnvio.envioEstado.descripcion || envioCodigo;
        if (envioCodigo && !estadosSet.has(envioCodigo)) {
          estadosSet.add(envioCodigo);
          this.estadosPedidoSelect.push({ value: envioCodigo, label: envioNombre });
        }
      }
    }
  }

  aplicarFiltrosMisCompras(): void {
    this.paginaActual = 1;
    // Filtrar solo por estado de envío (envioEstado.codigo)
    const filtroEstado = (this.filtroMisComprasEstado || '').toLowerCase().replace(/\s+/g, '_');
    this.misComprasFiltradas = this.compras.filter(c => {
      let match = true;
      let envioCodigo = '';
      if (c.pedidoEnvio && c.pedidoEnvio.envioEstado && c.pedidoEnvio.envioEstado.codigo) {
        envioCodigo = String(c.pedidoEnvio.envioEstado.codigo).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
      if (filtroEstado) {
        match = match && envioCodigo === filtroEstado;
      }
      if (this.filtroMisComprasDesde) {
        match = match && new Date(c.createdAt) >= new Date(this.filtroMisComprasDesde);
      }
      if (this.filtroMisComprasHasta) {
        // Para incluir todo el día 'hasta', sumamos 1 día
        const hasta = new Date(this.filtroMisComprasHasta);
        hasta.setDate(hasta.getDate() + 1);
        match = match && new Date(c.createdAt) < hasta;
      }
      if (this.filtroMisComprasBusqueda) {
        match = match && String(c.id).includes(this.filtroMisComprasBusqueda);
      }
      return match;
    });
  }

  limpiarFiltrosMisCompras(): void {
    this.paginaActual = 1;
    this.filtroMisComprasEstado = '';
    this.filtroMisComprasDesde = '';
    this.filtroMisComprasHasta = '';
    this.filtroMisComprasBusqueda = '';
    this.misComprasFiltradas = [...this.compras];
  }

  // --- Métodos y helpers usados en el template ---
  expandidoIds = new Set<number>();

  esPedidoDemorado(compra: any): boolean {
    // Ejemplo: si tiene un flag o estado "demorado" o si la fecha de entrega está vencida
    return compra?.demorado === true || compra?.estado === 'demorado';
  }

  totalItemsPedido(compra: any): number {
    if (!compra?.items) return 0;
    return compra.items.length;
  }

  badgeEstadoPedido(estado: string): string {
    switch (estado) {
      case 'pagado': return 'bg-success';
      case 'pendiente': return 'bg-warning text-dark';
      case 'cancelado': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  badgeEstadoEnvio(estado: string): string {
    if (!estado) return 'bg-secondary';
    if (/(entregado|completado|recibido)/i.test(estado)) return 'bg-success';
    if (/(en camino|despachado|enviado)/i.test(estado)) return 'bg-info';
    if (/(demorado|problema|retrasado)/i.test(estado)) return 'bg-danger';
    return 'bg-secondary';
  }

  togglePedidoExpandido(id: number): void {
    if (this.expandidoIds.has(id)) {
      this.expandidoIds.delete(id);
    } else {
      this.expandidoIds.add(id);
    }
  }

  estaExpandido(id: number): boolean {
    return this.expandidoIds.has(id);
  }

  subtotalItem(it: any): number {
    return (it?.cantidad || 0) * (it?.precioUnitario || 0);
  }

  subtotalCompra(compra: any): number {
    if (!compra?.items || !Array.isArray(compra.items)) {
      return 0;
    }
    return compra.items.reduce((acc: number, it: any) => acc + this.subtotalItem(it), 0);
  }

  costoEnvioCompra(compra: any): number {
    const costo = compra?.pedidoEnvio?.costo;
    return typeof costo === 'number' && Number.isFinite(costo) ? costo : 0;
  }

  totalFinalCompra(compra: any): number {
    return this.subtotalCompra(compra) + this.costoEnvioCompra(compra);
  }
  // Propiedades y métodos para compatibilidad con el template
  /**
    * Devuelve el trackingCodigo de la compra, consultando el pedido si es necesario.
    */
  getTrackingCodigo(compra: any): string | null {
    if (compra?.pedidoEnvio?.trackingCodigo) {
      return compra.pedidoEnvio.trackingCodigo;
    }
    // Si no viene pedidoEnvio, intentar buscarlo por id (sincrónico: devuelve null y el timeline wrapper puede mostrar mensaje)
    if (compra?.id && !compra._trackingCodigoBuscado) {
      compra._trackingCodigoBuscado = true;
      this.api.getPedido(compra.id).subscribe({
        next: (pedido: any) => {
          if (pedido?.pedidoEnvio?.trackingCodigo) {
            compra.pedidoEnvio = pedido.pedidoEnvio;
          }
        }
      });
    }
    return compra?.pedidoEnvio?.trackingCodigo || null;
  }


  refrescarTracking(compra: any): void {
    if (compra?.id) {
      this.trackingLoading[compra.id] = true;
      this.api.getPedido(compra.id).subscribe({
        next: (pedido: any) => {
          if (pedido?.pedidoEnvio?.trackingCodigo) {
            // Forzar cambio de referencia para que Angular recree el tracking-timeline-wrapper
            compra.pedidoEnvio = { ...pedido.pedidoEnvio };
            // También cambiar una propiedad dummy para forzar el *ngIf key
            compra._trackingKey = (Math.random() + 1).toString(36).substring(2);
          }
        },
        error: () => {
          this.trackingLoading[compra.id] = false;
        },
        complete: () => {
          this.trackingLoading[compra.id] = false;
        }
      });
    }
  }

  // Badge color para estado de envío (cabecera y timeline)
  badgeColorTracking(estado: string): string {
    if (!estado) return 'bg-secondary';
    const e = estado.toLowerCase();
    if (e.includes('demorado')) return 'bg-danger';
    if (e.includes('preparacion')) return 'bg-warning text-dark';
    if (e.includes('ruta')) return 'bg-orange';
    if (e.includes('entregado') || e.includes('confirmado')) return 'bg-success';
    return 'bg-info';
  }

  filtroMisComprasDesde: string = '';
  filtroMisComprasHasta: string = '';
  filtroMisComprasBusqueda: string = '';

  // Acción para editar o reintentar pago
  editarPago(compra: any) {
    compra._tabPago = 'pagar';
    compra._pasarelaSeleccionada = '';
    this.cdr.markForCheck();
  }

  // Lógica MercadoPago real (igual barra derecha: reconfirmar pedido y abrir widget)

  simularPagoMercadoPago(compra: any) {
    compra._simulandoPago = true;
    compra._resultadoSimulado = null;
  }

  setResultadoSimulado(compra: any, resultado: 'aprobado' | 'rechazado' | 'pendiente') {
    compra._resultadoSimulado = resultado;
    if (!this.appId || !compra.id) return;
    let status: 'approved' | 'rejected' | 'pending' | 'cancelled';
    let payment_id: string;
    if (resultado === 'aprobado') {
      status = 'approved';
      payment_id = 'SIM-123456';
    } else if (resultado === 'rechazado') {
      status = 'rejected';
      payment_id = 'SIM-999';
    } else if (resultado === 'pendiente') {
      status = 'pending';
      payment_id = 'SIM-000';
    } else {
      status = 'cancelled';
      payment_id = 'SIM-888';
    }
    const observacion = `Pago ${resultado} (simulación)`;
    this.api.simularPagoMercadoPago(this.appId, compra.id, status, payment_id, observacion).subscribe({
      next: () => {
        if (resultado === 'aprobado') {
          compra.estado = 'pagado';
        } else if (resultado === 'rechazado') {
          compra.estado = 'rechazado';
        } else if (resultado === 'pendiente') {
          compra.estado = 'pendiente';
        } else if (resultado === 'cancelado') {
          compra.estado = 'cancelado';
        }
        // Refrescar compras para todos los casos
        this.cargarCompras();
        this.cdr.markForCheck();
      },
      error: () => {
        // Manejo de error opcional
      }
    });
  }

  mostrarMercadoPagoWidget(preferenceId: string, apiKeyPublic: string) {
    // Busca o crea el contenedor del modal
    let modal = document.getElementById('mp-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mp-modal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.5)';
      modal.style.zIndex = '9999';
      modal.innerHTML = `<div id='mp-modal-content' style='background:#fff;max-width:420px;margin:5vh auto;padding:2em;border-radius:8px;position:relative'><button id='mp-modal-close' style='position:absolute;top:8px;right:8px;font-size:1.5em'>&times;</button><div id='mp-widget'></div></div>`;
      document.body.appendChild(modal);
      document.getElementById('mp-modal-close')?.addEventListener('click', () => {
        modal?.remove();
      });
    } else {
      modal.style.display = 'block';
    }
    // Cargar el widget
    if (!document.getElementById('mp-script')) {
      const script = document.createElement('script');
      script.id = 'mp-script';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        this.renderMercadoPagoCheckout(preferenceId, apiKeyPublic);
      };
      document.body.appendChild(script);
    } else {
      this.renderMercadoPagoCheckout(preferenceId, apiKeyPublic);
    }
  }

  renderMercadoPagoCheckout(preferenceId: string, apiKeyPublic: string) {
    // @ts-ignore
    if (window.MercadoPago) {
      // @ts-ignore
      const mp = new window.MercadoPago(apiKeyPublic);
      mp.checkout({
        preference: { id: preferenceId },
        render: {
          container: '#mp-widget',
          label: 'Pagar con Mercado Pago'
        }
      });
    }
  }



}
