

import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ApiService } from '../../../api.service';
import { environment } from '../../../../environments/environment';
import { CarritoService } from '../../../carrito.service';
import { ProductoDetalleModalComponent } from '../../../shared/components/producto-detalle-modal/producto-detalle-modal.component';
import { ProductoItemComponent } from '../../../shared/components/producto-item/producto-item.component';
import { filtrarProductosConPrecio, resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';
import { ProductoVistaSelectorComponent } from '../../../shared/components/producto-vista-selector/producto-vista-selector.component';
import { ProductoItemMiniComponent } from '../../../shared/components/producto-item-mini/producto-item-mini.component';
import { ProductoItemListaComponent } from '../../../shared/components/producto-item-lista/producto-item-lista.component';

@Component({
  selector: 'app-ofertas',
  standalone: true,
  imports: [CommonModule, ProductoDetalleModalComponent, ProductoItemComponent, ProductoVistaSelectorComponent, ProductoItemMiniComponent, ProductoItemListaComponent],
  templateUrl: './ofertas.component.html',
  styleUrls: ['./ofertas.component.scss']
})
export class OfertasComponent implements OnInit {
  setRatingMini(args: { producto: any, rating: number, event: Event }): Promise<void> | undefined {
    if (typeof this.setRating === 'function') {
      return this.setRating(args.producto, args.rating, args.event);
    }
    return Promise.resolve();
  }
  modoVistaProducto: 'grande' | 'compacta' | 'lista' = 'grande';

  setModoVistaProducto(modo: 'grande' | 'compacta' | 'lista') {
    this.modoVistaProducto = modo;
    try {
      localStorage.setItem('modoVistaProducto', modo);
    } catch {}
  }
  
  productosEnOferta: any[] = [];
  productosFiltradosEnOferta: any[] = [];
  loading = true;
  error = '';
  ratings: Record<number, number> = {};
  ratingsGlobal: Record<number, number> = {};
  favoritos: Record<number, boolean> = {};
  marcasDisponibles: string[] = [];
  rubrosDisponibles: string[] = [];
  marcasSeleccionadas: Record<string, boolean> = {};
  rubrosSeleccionados: Record<string, boolean> = {};
  precioMinFiltro: number | null = null;
  precioMaxFiltro: number | null = null;
  filtrosColapsados = false;
  selectedProducto: any = null;
  cantidadAgregar = 1;
  selectedImagenModal = '';
  productosRelacionadosModal: any[] = [];
  errorCarrito = '';
  private imagenesProductoConError = new Set<string>();
  private imagenIntentoPorProducto = new Map<string, number>();
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();

  constructor(
    private apiService: ApiService,
    private carritoService: CarritoService
  ) {}

  ngOnInit(): void {
    this.cargarProductosEnOferta();
    this.cargarFavoritos();
  }
async setRating(producto: any, rating: number, event: Event) {
  event.stopPropagation();
  if (!producto || !producto.id) return;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${environment.apiUrl}/api/ratings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ productoId: producto.id, rating })
    });
    if (res.ok) {
      // Refrescar el producto con los nuevos ratings si la API lo devuelve
      const data = await res.json();
      producto.rating = {
        usuario: data.ratingUsuario ?? rating,
        global: data.promedioGlobal ?? producto.rating?.global ?? null
      };
      this.ratings[producto.id] = producto.rating.usuario;
      if (this.ratingsGlobal) this.ratingsGlobal[producto.id] = producto.rating.global;
    }
  } catch {}
}
  private cargarFavoritos(): void {
    this.apiService.getFavoritos().pipe(
      catchError(() => of([] as any[]))
    ).subscribe((response: any) => {
      const lista = this.extraerListaFavoritos(response);
      const mapa: Record<number, boolean> = {};
      for (const item of lista) {
        const productoId = this.extraerProductoIdFavorito(item);
        if (productoId > 0) mapa[productoId] = true;
      }
      this.favoritos = mapa;
    });
  }

  private cargarProductosEnOferta(): void {
    this.loading = true;
    this.error = '';
    this.imagenesProductoConError.clear();
    this.imagenIntentoPorProducto.clear();

    this.apiService.getProductos().pipe(
      timeout(12000),
      catchError(() => {
        this.error = 'No se pudieron cargar las ofertas.';
        this.loading = false;
        return of([] as any[]);
      })
    ).subscribe((productos: any[] = []) => {
      const listaNormalizada = (productos || []).map((producto: any) => ({
        ...producto,
        mejorPrecioPromoCalculado: this.getMejorPrecioPromo(producto)
      }));
      const listaConPrecio = filtrarProductosConPrecio(listaNormalizada);

      this.sincronizarFavoritosDesdeProductos(listaConPrecio);

      this.productosEnOferta = listaConPrecio.filter((producto: any) => this.tieneOferta(producto));
      this.prepararOpcionesFiltro();
      this.aplicarFiltros();
      this.loading = false;
    });
  }

  private sincronizarFavoritosDesdeProductos(productos: any[]): void {
    const mapa = { ...this.favoritos };
    for (const producto of productos || []) {
      const productoId = Number(producto?.id);
      if (!Number.isFinite(productoId) || productoId <= 0) continue;
      if (this.esProductoFavorito(producto)) {
        mapa[productoId] = true;
      }
    }
    this.favoritos = mapa;
  }

  private esProductoFavorito(producto: any): boolean {
    const marca =
      producto?.favorito ??
      producto?.esFavorito ??
      producto?.isFavorito ??
      producto?.isFavorite ??
      producto?.enFavoritos;

    if (typeof marca === 'boolean') return marca;
    if (typeof marca === 'number') return marca === 1;
    if (typeof marca === 'string') {
      const normalizada = marca.trim().toLowerCase();
      return normalizada === '1' || normalizada === 'true' || normalizada === 'si' || normalizada === 'sí';
    }

    return false;
  }

  actualizarPrecioMin(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const valor = Number(input.value);
    this.precioMinFiltro = input.value === '' || Number.isNaN(valor) ? null : valor;
    this.aplicarFiltros();
  }

  actualizarPrecioMax(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const valor = Number(input.value);
    this.precioMaxFiltro = input.value === '' || Number.isNaN(valor) ? null : valor;
    this.aplicarFiltros();
  }

  toggleMarca(marca: string, checked: any): void {
    this.marcasSeleccionadas[marca] = !!checked;
    this.aplicarFiltros();
  }

  toggleRubro(rubro: string, checked: any): void {
    this.rubrosSeleccionados[rubro] = !!checked;
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.precioMinFiltro = null;
    this.precioMaxFiltro = null;
    this.marcasSeleccionadas = {};
    this.rubrosSeleccionados = {};
    this.aplicarFiltros();
  }

  toggleFiltrosColapsados(): void {
    this.filtrosColapsados = !this.filtrosColapsados;
  }

  get hayFiltrosActivos(): boolean {
    return this.precioMinFiltro !== null ||
      this.precioMaxFiltro !== null ||
      this.marcasDisponibles.some((marca: string) => this.marcasSeleccionadas[marca]) ||
      this.rubrosDisponibles.some((rubro: string) => this.rubrosSeleccionados[rubro]);
  }

  private tieneOferta(producto: any): boolean {
    const precioLista = Number(producto?.precio_lista ?? 0);
    const mejorPromo = producto?.mejorPrecioPromoCalculado;
    const precioDescuento = producto?.precioDescuento;
    const tienePromoLista = Array.isArray(producto?.promociones) && producto.promociones.length > 0;

    const tieneMejorPrecio =
      mejorPromo !== null &&
      mejorPromo !== undefined &&
      precioLista > 0 &&
      Number(mejorPromo) < precioLista;

    const tienePrecioDescuento =
      precioDescuento !== null &&
      precioDescuento !== undefined &&
      precioLista > 0 &&
      Number(precioDescuento) < precioLista;

    return tienePromoLista || tieneMejorPrecio || tienePrecioDescuento;
  }

  getMejorPrecioPromo(producto: any): number | null {
    if (!producto || !producto.promociones || !producto.promociones.length) return null;
    let mejor = null;
    for (const promo of producto.promociones) {
      if (promo && promo.precio_descuento != null && (mejor == null || promo.precio_descuento < mejor)) {
        mejor = promo.precio_descuento;
      }
    }
    return mejor;
  }

  

  toggleFavorito(producto: any, event: Event): void {
    event.stopPropagation();
    const productoId = Number(producto?.id);
    if (!Number.isFinite(productoId) || productoId <= 0) return;

    const marcado = !this.favoritos[productoId];
    this.favoritos[productoId] = marcado;

    const request$ = marcado
      ? this.apiService.crearFavorito({
          productoId,
          notificarOfertas: true,
          notificarNovedades: false
        })
      : this.apiService.eliminarFavorito({ productoId });

    request$.pipe(
      catchError(() => {
        this.favoritos[productoId] = !marcado;
        return of(null);
      })
    ).subscribe((res) => {
      if (res !== null) {
        this.apiService.notificarFavoritosActualizados();
      }
    });
  }

  private extraerListaFavoritos(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.favoritos)) return response.favoritos;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  }

  private extraerProductoIdFavorito(item: any): number {
    const id = Number(
      item?.productoId ??
      item?.producto_id ??
      item?.idProducto ??
      item?.id_producto ??
      item?.producto?.id
    );
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  agregarAlCarrito(producto: any, event?: MouseEvent, cantidad: number = 1): void {
    event?.stopPropagation();
    const productoParaCarrito = { ...producto };
    const mejorPrecioPromo = this.getMejorPrecioPromo(productoParaCarrito);

    if (
      mejorPrecioPromo !== null && mejorPrecioPromo !== undefined &&
      productoParaCarrito.precio_lista != null && mejorPrecioPromo < productoParaCarrito.precio_lista
    ) {
      productoParaCarrito.precio_lista = mejorPrecioPromo;
    } else if (
      productoParaCarrito.precioDescuento != null &&
      productoParaCarrito.precio_lista != null &&
      productoParaCarrito.precioDescuento < productoParaCarrito.precio_lista
    ) {
      productoParaCarrito.precio_lista = productoParaCarrito.precioDescuento;
    }

    const cantidadNormalizada = Math.max(1, Math.floor(Number(cantidad) || 1));
    this.carritoService.agregar(productoParaCarrito, cantidadNormalizada);
  }

  abrirDetalleProducto(producto: any, event?: MouseEvent): void {
    event?.stopPropagation();
    this.selectedProducto = { ...producto };
    this.selectedImagenModal = String(this.selectedProducto?.imagen ?? this.selectedProducto?.imagenUrl ?? '').trim();
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.cantidadAgregar = 1;
    this.errorCarrito = '';

    setTimeout(() => {
      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // @ts-ignore
        window.bootstrap?.Modal?.getOrCreateInstance(modal)?.show();
      }
    }, 0);
  }

  getGaleriaModal(producto: any): Array<{ url: string }> {
    if (!Array.isArray(producto?.imagenes)) return [];
    return producto.imagenes
      .map((img: any) => ({ url: resolveBackendMediaUrl(img?.url ?? img) }))
      .filter((img: any) => !!img.url);
  }

  seleccionarImagenModal(url: string): void {
    const normalizada = String(url ?? '').trim();
    if (!normalizada) return;
    this.selectedImagenModal = normalizada;
  }

  getImagenPrincipalModal(producto: any): string {
    const seleccionada = String(this.selectedImagenModal ?? '').trim();
    if (seleccionada) return resolveBackendMediaUrl(seleccionada);
    const principal = resolveBackendMediaUrl(producto?.imagen ?? producto?.imagenUrl ?? '');
    return principal || 'https://via.placeholder.com/300x300?text=Producto';
  }

  seleccionarProductoRelacionado(producto: any, event?: Event): void {
    event?.stopPropagation();
    if (!producto) return;
    this.selectedProducto = { ...producto };
    this.selectedImagenModal = String(this.selectedProducto?.imagen ?? this.selectedProducto?.imagenUrl ?? '').trim();
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.cantidadAgregar = 1;
  }

  agregarRelacionadoDesdeModal(payload: { producto: any; cantidad: number }): void {
    if (!payload?.producto) return;
    const cantidad = Math.max(1, Number(payload.cantidad) || 1);
    this.agregarAlCarrito(payload.producto, undefined, cantidad);
  }

  agregarAlCarritoDesdeModal(): void {
    if (!this.selectedProducto || this.cantidadAgregar <= 0) return;
    const cantidad = Math.max(1, Number(this.cantidadAgregar) || 1);
    this.agregarAlCarrito(this.selectedProducto, undefined, cantidad);

    const modal = document.getElementById('detalleProductoModal');
    if (modal) {
      // @ts-ignore
      window.bootstrap?.Modal?.getInstance(modal)?.hide();
    }
    this.cerrarDetalleProducto();
  }

  cerrarDetalleProducto(): void {
    this.selectedProducto = null;
    this.selectedImagenModal = '';
    this.productosRelacionadosModal = [];
    this.cantidadAgregar = 1;
    this.errorCarrito = '';
  }

  getProductosRelacionados(producto: any): any[] {
    const relacionados = producto?.productos_relacionados ?? producto?.productosRelacionados ?? [];
    if (!Array.isArray(relacionados) || !relacionados.length) return [];

    return relacionados.map((item: any) => ({
      ...item,
      nombre: item?.nombre ?? item?.denominacion ?? 'Producto',
      descripcion: item?.descripcion ?? item?.descripcion_larga ?? item?.descripcionlarga ?? '',
      imagen: item?.imagen ?? item?.imagenUrl ?? item?.imagenurl ?? '',
      precio_lista: Number(item?.precio_lista ?? item?.precio ?? 0)
    }));
  }

  getPrecioVisualProducto(producto: any): number {
    const precioLista = Number(producto?.precio_lista ?? producto?.precio ?? 0);
    const precioDescuento = Number(producto?.precioDescuento ?? Number.POSITIVE_INFINITY);
    const mejorPromo = Number(this.getMejorPrecioPromo(producto) ?? Number.POSITIVE_INFINITY);
    const mejor = Math.min(
      Number.isFinite(precioLista) ? precioLista : Number.POSITIVE_INFINITY,
      Number.isFinite(precioDescuento) ? precioDescuento : Number.POSITIVE_INFINITY,
      Number.isFinite(mejorPromo) ? mejorPromo : Number.POSITIVE_INFINITY
    );
    return Number.isFinite(mejor) ? mejor : 0;
  }

  agregarRelacionadoAlCarrito(producto: any, event: MouseEvent): void {
    this.agregarAlCarrito(producto, event);
  }

  getProductoImagen(producto: any): string {
    const key = this.getProductoKey(producto);
    if (!key || this.imagenesProductoConError.has(key)) return '';

    const candidatos = this.getProductoImageCandidates(producto);
    if (!candidatos.length) return '';

    const indice = this.imagenIntentoPorProducto.get(key) ?? 0;
    return candidatos[indice] ?? candidatos[0];
  }

  tieneImagenProducto(producto: any): boolean {
    return !!this.getProductoImagen(producto);
  }

  onProductoImageError(producto: any, event?: Event): void {
    const key = this.getProductoKey(producto);
    if (!key) return;

    const candidatos = this.getProductoImageCandidates(producto);
    const indiceActual = this.imagenIntentoPorProducto.get(key) ?? 0;
    const siguienteIndice = indiceActual + 1;

    if (siguienteIndice < candidatos.length) {
      this.imagenIntentoPorProducto.set(key, siguienteIndice);
      const imgRetry = event?.target as HTMLImageElement | null;
      if (imgRetry) {
        imgRetry.src = candidatos[siguienteIndice];
        imgRetry.style.removeProperty('display');
      }
      return;
    }

    this.imagenesProductoConError.add(key);
    const img = event?.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  private getProductoImageCandidates(producto: any): string[] {
    const bases = [producto?.imagen, producto?.imagenUrl, producto?.path, producto?.url]
      .map((item: any) => String(item ?? '').trim())
      .filter((item: string) => !!item);

    const candidatos = new Set<string>();
    const extensiones = ['.png', '.jpg', '.jpeg', '.webp'];

    for (const base of bases) {
      const match = base.match(/^(.*?)(\.[a-zA-Z0-9]+)?(\?.*)?$/);
      if (!match) {
        candidatos.add(base);
        continue;
      }

      const prefijo = match[1] || base;
      const extOriginal = (match[2] || '').toLowerCase();
      const query = match[3] || '';

      candidatos.add(base);

      if (extOriginal) {
        for (const ext of extensiones) {
          if (ext === extOriginal) continue;
          candidatos.add(`${prefijo}${ext}${query}`);
        }
      } else {
        for (const ext of extensiones) {
          candidatos.add(`${prefijo}${ext}${query}`);
        }
      }
    }

    return Array.from(candidatos);
  }

  private getProductoKey(producto: any): string {
    return String(producto?.id ?? producto?.codigo_barra ?? producto?.nombre ?? '').trim();
  }

  trackByProductoId(index: number, producto: any): number | string {
    return producto?.id ?? index;
  }

  private prepararOpcionesFiltro(): void {
    const marcas = new Set<string>();
    const rubros = new Set<string>();

    for (const producto of this.productosEnOferta) {
      const marca = this.getMarcaNombre(producto);
      const rubro = String(producto?.rubro?.nombre ?? '').trim();

      if (marca) marcas.add(marca);
      if (rubro) rubros.add(rubro);
    }

    this.marcasDisponibles = Array.from(marcas).sort((a, b) => a.localeCompare(b, 'es'));
    this.rubrosDisponibles = Array.from(rubros).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private aplicarFiltros(): void {
    const marcasActivas = this.marcasDisponibles.filter((marca: string) => this.marcasSeleccionadas[marca]);
    const rubrosActivos = this.rubrosDisponibles.filter((rubro: string) => this.rubrosSeleccionados[rubro]);

    this.productosFiltradosEnOferta = this.productosEnOferta.filter((producto: any) => {
      const precio = this.getPrecioVigente(producto);
      if (this.precioMinFiltro !== null && precio < this.precioMinFiltro) return false;
      if (this.precioMaxFiltro !== null && precio > this.precioMaxFiltro) return false;

      if (marcasActivas.length > 0) {
        const marcaProducto = this.getMarcaNombre(producto);
        if (!marcasActivas.includes(marcaProducto)) return false;
      }

      if (rubrosActivos.length > 0) {
        const rubroProducto = String(producto?.rubro?.nombre ?? '').trim();
        if (!rubrosActivos.includes(rubroProducto)) return false;
      }

      return true;
    });
  }

  private getPrecioVigente(producto: any): number {
    const precioLista = Number(producto?.precio_lista ?? 0);
    const precioDescuento = Number(producto?.precioDescuento ?? Number.POSITIVE_INFINITY);
    const mejorPromo = Number(producto?.mejorPrecioPromoCalculado ?? Number.POSITIVE_INFINITY);
    const mejorPrecio = Math.min(precioLista || Number.POSITIVE_INFINITY, precioDescuento, mejorPromo);

    if (!Number.isFinite(mejorPrecio)) return 0;
    return mejorPrecio;
  }

  getMarcaNombre(producto: any): string {
    const marca = producto?.marca;

    const candidatos = [
      typeof marca === 'string' ? marca : '',
      marca?.nombre,
      marca?.name,
      marca?.denominacion,
      producto?.marcaNombre,
      producto?.marca_nombre,
      producto?.nombreMarca,
      producto?.nombre_marca,
      producto?.brand,
      producto?.brandName
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
    const entidad = producto?.marca ?? {};
    const marcaNombre = this.getMarcaNombre(producto);
    const slug = this.slugifyMarca(marcaNombre);

    const idRaw = entidad?.id ?? producto?.marcaId ?? producto?.marca_id ?? producto?.idMarca ?? producto?.id_marca;
    const idNumero = Number(idRaw);
    const id5 = Number.isFinite(idNumero) && idNumero > 0 ? String(Math.trunc(idNumero)).padStart(5, '0') : '';

    const codigoRaw = entidad?.codigo ?? entidad?.code ?? producto?.marcaCodigo ?? producto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();

    const candidatos = new Set<string>();

    const logoDirecto = String(
      entidad?.logo ??
      entidad?.logoUrl ??
      entidad?.logo_url ??
      entidad?.imagen ??
      entidad?.imagenLogo ??
      entidad?.imagen_logo ??
      entidad?.logoMarca ??
      entidad?.logo_marca ??
      producto?.logoMarca ??
      producto?.logo_marca ??
      producto?.marcaLogo ??
      producto?.marca_logo ??
      ''
    ).trim();
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
    const marca = producto?.marca ?? {};
    const logoRaw = String(
      marca?.logo ??
      marca?.logoUrl ??
      marca?.logo_url ??
      marca?.imagenLogo ??
      marca?.imagen_logo ??
      producto?.logoMarca ??
      producto?.logo_marca ??
      producto?.marcaLogo ??
      producto?.marca_logo ??
      ''
    ).trim();
    if (logoRaw) return `logo:${logoRaw.toLowerCase()}`;

    const idRaw = marca?.id ?? producto?.marcaId ?? producto?.marca_id ?? producto?.idMarca ?? producto?.id_marca;
    const id = String(idRaw ?? '').trim();
    if (id) return `id:${id}`;

    const codigoRaw = marca?.codigo ?? marca?.code ?? producto?.marcaCodigo ?? producto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();
    if (codigo) return `cod:${codigo}`;

    const nombre = this.slugifyMarca(this.getMarcaNombre(producto));
    if (nombre) return `nom:${nombre}`;

    return '';
  }

  private slugifyMarca(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getProductoImageKey(producto: any, src: string): string {
    const id = producto?.id ?? producto?.codigo_barra ?? producto?.nombre ?? 'sin-id';
    return `${id}::${src}`;
  }
}
