import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompanyService } from '../../../company.service';
import { ApiService } from '../../../api.service';
import { environment } from '../../../../environments/environment';
import { Producto, Empresa, App } from '../../../models';
import { CarritoService } from '../../../carrito.service';
import { ProductoDetalleModalComponent } from '../../../shared/components/producto-detalle-modal/producto-detalle-modal.component';
import { ProductoItemComponent } from '../../../shared/components/producto-item/producto-item.component';
import { ProductoItemMiniComponent } from '../../../shared/components/producto-item-mini/producto-item-mini.component';
import { ProductoItemListaComponent } from '../../../shared/components/producto-item-lista/producto-item-lista.component';
import { ProductoVistaSelectorComponent } from '../../../shared/components/producto-vista-selector/producto-vista-selector.component';
import { filtrarProductosConPrecio, resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';
import { of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductoDetalleModalComponent, ProductoItemComponent, ProductoItemMiniComponent, ProductoItemListaComponent, ProductoVistaSelectorComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Selector de modo de vista para productos
  modoVistaProducto: 'grande' | 'compacta' | 'lista' = 'grande';
  loadingDashboard = true;
  private cargasInicialesPendientes = 0;

  setModoVistaProducto(modo: 'grande' | 'compacta' | 'lista') {
    this.modoVistaProducto = modo;
    try {
      localStorage.setItem('modoVistaProducto', modo);
    } catch {}
  }

  ngOnInit(): void {
    // Restaurar preferencia de vista
    const modoGuardado = localStorage.getItem('modoVistaProducto');
    if (modoGuardado === 'grande' || modoGuardado === 'compacta' || modoGuardado === 'lista') {
      this.modoVistaProducto = modoGuardado;
    }
    this.productosFiltrados = this.productos;
    this.cargarEmpresa();
    this.cargarFavoritos();
    this.cargarUsuario();
    this.cargarProductos();
    this.cargarPromociones();
   
    // this.cargarSubcategoriasPorRubro();
  }
  private readonly simularGaleriaImagenes = false;
  productosFiltrados: Producto[] = [];
  productosEnOferta: Producto[] = [];
  productosEnOfertaSlides: Producto[][] = [];
  productosMasVendidos: Producto[] = [];
  productosMasVendidosSlides: Producto[][] = [];
  beneficiosNegocio = [
    { icono: 'bi-truck', titulo: 'Envío', texto: 'Entregas rápidas y seguras en tu zona.' },
    { icono: 'bi-credit-card', titulo: 'Pagos', texto: 'Múltiples medios de pago disponibles.' },
    { icono: 'bi-shop', titulo: 'Retiro', texto: 'Retirá tu compra en sucursal sin costo.' },
    { icono: 'bi-headset', titulo: 'Atención', texto: 'Soporte y asesoramiento personalizado.' }
  ];
    agregarCarrito(eventOrProducto: Event | Producto, producto?: Producto) {
      // Si viene de producto-item (vista grande), el primer argumento es un Event y el segundo es Producto
      if (eventOrProducto && typeof (eventOrProducto as Event).stopPropagation === 'function' && producto) {
        (eventOrProducto as Event).stopPropagation();
        this.carritoService?.agregar(producto, producto.cantidad ?? 1);
      } else if (eventOrProducto && typeof (eventOrProducto as Object) === 'object' && 'id' in (eventOrProducto as Producto)) {
        // Si viene de mini o lista, el primer argumento es Producto
        this.carritoService?.agregar(eventOrProducto as Producto, (eventOrProducto as Producto).cantidad ?? 1);
      }
    }
   
  filtroCategoria: string = '';
  filtroTipo: 'rubro' | 'subcategoria' | '' = '';
  conteoProductosPorRubro: Record<string, number> = {};
  conteoProductosPorSubcategoria: Record<string, number> = {};

  filtrarPorRubro(rubro: any) {
    this.filtroCategoria = rubro.nombre;
    this.filtroTipo = 'rubro';
    this.productosFiltrados = this.productos.filter(p => p.rubro && p.rubro.id === rubro.id);
  }

  filtrarPorSubcategoria(subcategoria: any) {
    this.filtroCategoria = subcategoria.nombre;
    this.filtroTipo = 'subcategoria';
    this.productosFiltrados = this.productos.filter(p => p.subcategoria && p.subcategoria.id === subcategoria.id);
  }

  limpiarFiltro() {
    this.filtroCategoria = '';
    this.filtroTipo = '';
    this.productosFiltrados = this.productos;
  }
    errorCarrito: string = '';
  productos: Producto[] = [];
  promociones: any[] = [];
  promoSlides: any[] = [];
  promocionesVisuales: any[] = [];
  promocionesDescuentoSinImagen: any[] = [];
  promocionesDescuentoPaginaActual = 1;
  readonly promocionesDescuentoPorPagina = 5;
  promoProductosPaginaActual: Record<string, number> = {};
  readonly promoProductosPorPagina = 5;
  promocionesDestacadas: any[] = [];
  private imagenesProductoConError = new Set<string>();
  private imagenIntentoPorProducto = new Map<string, number>();
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();
  rubros: any[] = [];
  subcategorias: any[] = [];

 

    cargarSubcategoriasPorRubro(parentId: number) {
      this.iniciarCargaInicial();
      this.apiService.getSubcategoriasByCategoriaId(parentId).pipe(
        timeout(10000),
        catchError(() => of([] as any[]))
      ).subscribe((subcategorias: any[] = []) => {
        this.subcategorias = subcategorias;
      }).add(() => this.finalizarCargaInicial());
    }
  cargarProductos() {
    this.iniciarCargaInicial();
    this.imagenesProductoConError.clear();
    this.imagenIntentoPorProducto.clear();
    this.apiService.getProductos().pipe(
      timeout(12000),
      catchError(() => of([] as Producto[]))
    ).subscribe((productos: Producto[] = []) => {
      const productosNormalizados = (productos || []).map((producto: any) => ({
        ...producto,
        mejorPrecioPromoCalculado: this.getMejorPrecioPromo(producto)
      }));
      const productosConPrecio = filtrarProductosConPrecio(productosNormalizados);
      this.sincronizarFavoritosDesdeProductos(productosConPrecio as any[]);
      this.productos = productosConPrecio;
      this.productosFiltrados = productosConPrecio;
      // Inicializar ratingsGlobal para cada producto
      this.ratingsGlobal = {};
      for (const producto of productosConPrecio) {
        const id = producto.id;
        this.ratingsGlobal[id] = producto.rating?.global ?? null;
      }
      this.productosEnOferta = productosConPrecio.filter((producto: any) => {
        const precioLista = Number(producto?.precio ?? 0);
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
      });
      this.productosEnOfertaSlides = this.agruparProductos(this.productosEnOferta, 4);
      this.prepararSeccionesMvp(productosConPrecio);
      this.actualizarConteosCategorias();
    }).add(() => this.finalizarCargaInicial());
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

  private agruparProductos(productos: Producto[], tamanioGrupo: number): Producto[][] {
    const resultado: Producto[][] = [];
    const lista = [...(productos || [])];

    for (let i = 0; i < lista.length; i += tamanioGrupo) {
      resultado.push(lista.slice(i, i + tamanioGrupo));
    }

    return resultado;
  }

  private prepararSeccionesMvp(productos: Producto[]): void {
    const lista = [...(productos || [])];
    // Filtrar productos marcados como más vendidos
    let masVendidos = lista.filter(p => p.masVendido === true );

    // Si no hay suficientes, completar con los de mayor cantidadVentas
    if (masVendidos.length < 8) {
      const faltan = 8 - masVendidos.length;
      // Ordenar los que no están en masVendidos por cantidadVentas descendente
      const noMasVendidos = lista.filter(p => !(p.masVendido === true ));
      const porVentas = noMasVendidos
        .filter(p => typeof p.cantidadVentas === 'number' && p.cantidadVentas > 0)
        .sort((a, b) => (b.cantidadVentas || 0) - (a.cantidadVentas || 0))
        .slice(0, faltan);
      masVendidos = masVendidos.concat(porVentas);
    }

    // Si aún así hay menos de 8, completar con productos aleatorios restantes
    if (masVendidos.length < 8) {
      const idsIncluidos = new Set(masVendidos.map(p => p.id));
      const restantes = lista.filter(p => !idsIncluidos.has(p.id));
      const barajados = this.barajarProductos(restantes);
      masVendidos = masVendidos.concat(barajados.slice(0, 8 - masVendidos.length));
    }

    masVendidos = masVendidos.slice(0, 8);
    this.productosMasVendidos = masVendidos;
    this.productosMasVendidosSlides = this.agruparProductos(this.productosMasVendidos, 4);
  }

  private barajarProductos(productos: Producto[]): Producto[] {
    const copia = [...productos];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  private keyFromId(id: unknown): string {
    return id === null || id === undefined ? '' : String(id);
  }

  private actualizarConteosCategorias(): void {
    const conteoRubro: Record<string, number> = {};
    const conteoSubcategoria: Record<string, number> = {};

    for (const producto of this.productos) {
      const rubroId = this.keyFromId((producto as any)?.rubro?.id);
      const subcategoriaId = this.keyFromId((producto as any)?.subcategoria?.id);

      if (rubroId) {
        conteoRubro[rubroId] = (conteoRubro[rubroId] || 0) + 1;
      }
      if (subcategoriaId) {
        conteoSubcategoria[subcategoriaId] = (conteoSubcategoria[subcategoriaId] || 0) + 1;
      }
    }

    this.conteoProductosPorRubro = conteoRubro;
    this.conteoProductosPorSubcategoria = conteoSubcategoria;
  }

  cantidadProductosRubro(rubro: any): number {
    const rubroId = this.keyFromId(rubro?.id);
    return rubroId ? (this.conteoProductosPorRubro[rubroId] || 0) : 0;
  }

  cantidadProductosSubcategoria(subcategoria: any): number {
    const subcategoriaId = this.keyFromId(subcategoria?.id);
    return subcategoriaId ? (this.conteoProductosPorSubcategoria[subcategoriaId] || 0) : 0;
  }

  cargarPromociones() {
    this.iniciarCargaInicial();
    this.apiService.getPromociones().subscribe((promos: any[] = []) => {
      const promocionesNormalizadas = promos.map((p: any) => {
        const promoId = this.extraerPromoId(p);
        const imagenesSlide = this.normalizarImagenesSlidePromo(p);
        const slideMediaUrl = imagenesSlide[0]?.url || '';
        return {
          ...p,
          id: promoId,
          _promoId: promoId,
          slideMediaUrl,
          imagenesSlide
        };
      });

      this.promociones = this.seleccionarPromocionesSlide(promocionesNormalizadas);
      this.promoSlides = this.construirSlidesPromociones(this.promociones);
      this.promocionesVisuales = this.seleccionarPromocionesVisuales(promocionesNormalizadas);
      this.promocionesDescuentoSinImagen = this.seleccionarPromocionesDescuentoSinImagen(promocionesNormalizadas);
      this.promocionesDescuentoPaginaActual = 1;
      this.promoProductosPaginaActual = {};
      this.promocionesDestacadas = this.seleccionarPromocionesDestacadas(promocionesNormalizadas);
    }).add(() => this.finalizarCargaInicial());
  }

  private iniciarCargaInicial(): void {
    this.cargasInicialesPendientes += 1;
    this.loadingDashboard = true;
  }

  private finalizarCargaInicial(): void {
    this.cargasInicialesPendientes = Math.max(0, this.cargasInicialesPendientes - 1);
    if (this.cargasInicialesPendientes === 0) {
      this.loadingDashboard = false;
    }
  }

  private normalizarImagenesSlidePromo(promo: any): Array<{ id: number | string; url: string; orden: number; nombreOriginal?: string; alias?: string }> {
    const imagenes = Array.isArray(promo?.imagenesSlide) ? promo.imagenesSlide : [];
    const normalizadas = imagenes
      .map((item: any, index: number) => ({
        id: item?.id ?? `${index}`,
        url: this.getSlideMediaUrl(item),
        orden: Number(item?.orden ?? index + 1) || index + 1,
        nombreOriginal: item?.nombreOriginal ?? item?.nombre_original ?? '',
        alias: item?.alias ?? ''
      }))
      .filter((item: { url: string }) => !!item.url);

    if (normalizadas.length > 0) {
      return normalizadas;
    }

    const fallback = '';
    return fallback ? [{ id: 'fallback', url: fallback, orden: 1, nombreOriginal: '' }] : [];
  }

  private construirSlidesPromociones(promociones: any[]): Array<{ promo: any; imagen: any }> {
    const slides: Array<{ promo: any; imagen: any }> = [];

    for (const promo of promociones || []) {
      const imagenes = Array.isArray(promo?.imagenesSlide) ? promo.imagenesSlide : [];
      for (const imagen of imagenes) {
        if (!imagen?.url) continue;
        slides.push({ promo, imagen });
      }
    }

    return slides;
  }

  private getSlideMediaUrl(item: any): string {
    const alias = String(item?.alias ?? '').trim();
    if (alias) {
      console.log(`Resolviendo URL de media para alias: ${alias}`);
      return `${environment.apiUrlBackend}/media/${encodeURIComponent(alias)}`;
    }

    const url = String(item?.url ?? '').trim();
    if (url) {
      return resolveBackendMediaUrl(url);
    }

    return '';
  }

  private seleccionarPromocionesSlide(promociones: any[]): any[] {
    return (promociones || []).filter((promo: any) => {
      const enSlide = this.toBoolean(promo?.enSlide ?? promo?.en_slide);
      const tipoSlide = this.esTipoSlidePromo(promo);
      const tieneMedia = Array.isArray(promo?.imagenesSlide) ? promo.imagenesSlide.length > 0 : !!String(promo?.imagenSlide || '').trim();
      return (enSlide || tipoSlide) && tieneMedia;
    });
  }

  private seleccionarPromocionesDestacadas(promociones: any[]): any[] {
    const candidatas = (promociones || []).filter((promo: any) => {
      return (
        promo?.destacada === true ||
        promo?.esDestacada === true ||
        promo?.es_destacada === true ||
        promo?.mostrarEnDestacadas === true ||
        promo?.mostrar_en_destacadas === true ||
        (Array.isArray(promo?.productos) && promo.productos.length > 0)
      );
    });

    if (candidatas.length) {
      return candidatas;
    }

    return promociones || [];
  }

  private seleccionarPromocionesVisuales(promociones: any[]): any[] {
    return (promociones || []).filter((promo: any) => {
      const enSlide = this.toBoolean(promo?.enSlide ?? promo?.en_slide);
      const tipoSlide = this.esTipoSlidePromo(promo);
      const tieneImagen = Array.isArray(promo?.imagenesSlide)
        ? promo.imagenesSlide.length > 0
        : !!String(promo?.imagenSlide || '').trim();

      return !enSlide && tipoSlide && tieneImagen;
    });
  }

  private seleccionarPromocionesDescuentoSinImagen(promociones: any[]): any[] {
    return (promociones || []).filter((promo: any) => {
      const esDescuento = String(promo?.tipo || promo?.tipoPromocion || promo?.tipo_promocion || '').trim().toLowerCase() === 'descuento';
      const tieneImagen = Array.isArray(promo?.imagenesSlide)
        ? promo.imagenesSlide.length > 0
        : !!String(promo?.imagenSlide || '').trim();

      return esDescuento && !tieneImagen;
    });
  }

  get promocionesDescuentoTotalPaginas(): number {
    const total = this.promocionesDescuentoSinImagen?.length || 0;
    return Math.max(1, Math.ceil(total / this.promocionesDescuentoPorPagina));
  }

  get promocionesDescuentoPaginadas(): any[] {
    const lista = this.promocionesDescuentoSinImagen || [];
    const inicio = (this.promocionesDescuentoPaginaActual - 1) * this.promocionesDescuentoPorPagina;
    return lista.slice(inicio, inicio + this.promocionesDescuentoPorPagina);
  }

  get paginasPromocionesDescuento(): number[] {
    return Array.from({ length: this.promocionesDescuentoTotalPaginas }, (_, idx) => idx + 1);
  }

  cambiarPaginaPromocionesDescuento(pagina: number): void {
    const total = this.promocionesDescuentoTotalPaginas;
    if (!Number.isFinite(pagina)) return;
    if (pagina < 1 || pagina > total) return;
    this.promocionesDescuentoPaginaActual = pagina;
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
    if (img) {
      img.style.display = 'none';
    }
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
      const imgRetry = event?.target as HTMLImageElement | null;
      if (imgRetry) {
        imgRetry.src = candidatos[siguienteIndice];
        imgRetry.style.removeProperty('display');
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

  getProductosPromoPaginados(promo: any): any[] {
    const productos = Array.isArray(promo?.productos) ? promo.productos : [];
    const pagina = this.getPaginaActualProductosPromo(promo);
    const inicio = (pagina - 1) * this.promoProductosPorPagina;
    return productos.slice(inicio, inicio + this.promoProductosPorPagina);
  }

  getTotalPaginasProductosPromo(promo: any): number {
    const total = Array.isArray(promo?.productos) ? promo.productos.length : 0;
    return Math.max(1, Math.ceil(total / this.promoProductosPorPagina));
  }

  getPaginasProductosPromo(promo: any): number[] {
    return Array.from({ length: this.getTotalPaginasProductosPromo(promo) }, (_, idx) => idx + 1);
  }

  cambiarPaginaProductosPromo(promo: any, pagina: number, event?: Event): void {
    event?.stopPropagation();
    const total = this.getTotalPaginasProductosPromo(promo);
    if (!Number.isFinite(pagina) || pagina < 1 || pagina > total) return;
    this.promoProductosPaginaActual[this.getPromoKey(promo)] = pagina;
  }

  getPromoFechaInicio(promo: any): string | null {
    const value =
      promo?.fechainicio ??
      promo?.fecha_inicio ??
      promo?.fechaInicio ??
      promo?.fechaDesde ??
      promo?.vigenciaDesde ??
      null;

    return value ? String(value) : null;
  }

  getPromoFechaFin(promo: any): string | null {
    const value =
      promo?.fechafin ??
      promo?.fecha_fin ??
      promo?.fechaFin ??
      promo?.fechaHasta ??
      promo?.vigenciaHasta ??
      null;

    return value ? String(value) : null;
  }

  getPaginaActualProductosPromo(promo: any): number {
    const pagina = this.promoProductosPaginaActual[this.getPromoKey(promo)] || 1;
    const total = this.getTotalPaginasProductosPromo(promo);
    return Math.min(Math.max(pagina, 1), total);
  }

  private getPromoKey(promo: any): string {
    const id = this.extraerPromoId(promo);
    if (id > 0) return String(id);
    return this.obtenerSlugPromo(promo) || this.obtenerNombrePromo(promo) || 'promo';
  }

  irAOfertaVisual(promo: any): void {
    const promoId = this.extraerPromoId(promo);
    const slug = this.obtenerSlugPromo(promo);
    if (!promoId || !slug) return;
    this.router.navigate(['/promociones', `${slug}-${promoId}`]);
  }

  private extraerPromoId(promo: any): number {
    const idRaw =
      promo?.id ??
      promo?.promocionId ??
      promo?.promocion_id ??
      promo?.idPromocion ??
      promo?.id_promocion;

    const id = Number(idRaw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private obtenerNombrePromo(promo: any): string {
    return String(
      promo?.denominacion ??
      promo?.nombre ??
      promo?.titulo ??
      promo?.descripcion ??
      ''
    ).trim();
  }

  private obtenerSlugPromo(promo: any): string {
    const nombre = this.obtenerNombrePromo(promo);
    if (!nombre) return '';

    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private normalizarImagenPromo(rawImagen: unknown, index: number = 0, carpetaBase: 'slides' | 'promos' = 'slides'): string {
    const raw = String(rawImagen || '').trim();
    if (!raw) return '';

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    if (raw.startsWith('/assets/') || raw.startsWith('assets/')) {
      return raw.replace(/^\//, '');
    }

    const limpio = raw.split(/[\\/]/).pop()?.trim() || '';
    if (!limpio) return '';

    let nombre = limpio;
    if (!/\.[A-Za-z0-9]+$/.test(nombre)) {
      nombre = `${nombre}.jpg`;
    }

    nombre = nombre.replace(/\.(JPG|JPEG|PNG|WEBP)$/i, (ext) => ext.toLowerCase());

    const matchNumerico = nombre.match(/^(\d+)(\.[A-Za-z0-9]+)$/);
    if (matchNumerico) {
      const numero = matchNumerico[1].padStart(2, '0');
      const ext = matchNumerico[2];
      nombre = `${numero}${ext}`;
    }

    return `assets/${carpetaBase}/${nombre}`;
  }

  private generarCandidatasImagenPromo(rawImagen: unknown): string[] {
    const raw = String(rawImagen || '').trim();
    if (!raw) return [];

    if (/^https?:\/\//i.test(raw)) {
      return [raw];
    }

    const pareceRutaBackend = /^(?:\/)?(?:media|uploads?|files?)\//i.test(raw);
    const mediaBackend = pareceRutaBackend ? this.normalizarUrlSlide(raw) : '';
    if (mediaBackend && /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(mediaBackend)) {
      return [mediaBackend];
    }

    const candidatas = new Set<string>();

    if (raw.startsWith('/assets/') || raw.startsWith('assets/')) {
      const limpia = raw.replace(/^\//, '');
      candidatas.add(limpia);
      candidatas.add(limpia.replace('assets/promos/', 'assets/slides/'));
      candidatas.add(limpia.replace('assets/slides/', 'assets/promos/'));
      return Array.from(candidatas);
    }

    const limpio = raw.split(/[\\/]/).pop()?.trim() || '';
    if (!limpio) return [];

    let nombre = limpio;
    if (!/\.[A-Za-z0-9]+$/.test(nombre)) {
      nombre = `${nombre}.jpg`;
    }

    nombre = nombre.replace(/\.(JPG|JPEG|PNG|WEBP)$/i, (ext) => ext.toLowerCase());

    const variantesNombre = new Set<string>();
    variantesNombre.add(nombre);
    variantesNombre.add(nombre.replace(/-/g, '_'));
    variantesNombre.add(nombre.replace(/_/g, '-'));

    const match = nombre.match(/^(\d+)[-_](\d+)(\.[a-z0-9]+)$/i);
    if (match) {
      const n1Original = match[1];
      const n2 = match[2];
      const ext = match[3].toLowerCase();
      const n1SinCeros = n1Original.replace(/^0+/, '') || '0';
      const bases = Array.from(new Set([
        n1Original,
        n1SinCeros,
        n1SinCeros.padStart(5, '0'),
        n1SinCeros.padStart(6, '0')
      ]));
      for (const base of bases) {
        variantesNombre.add(`${base}_${n2}${ext}`);
        variantesNombre.add(`${base}-${n2}${ext}`);
      }
    }

    for (const v of variantesNombre) {
      candidatas.add(`assets/promos/${v}`);
      candidatas.add(`assets/slides/${v}`);
    }

    return Array.from(candidatas);
  }

  esPromoSlideVideo(slide: any): boolean {
    return this.getPromoSlideMediaKind(this.getPromoSlideMediaUrl(slide)) === 'video';
  }

  getPromoSlideMediaUrl(slide: any): string {
    const url = String(slide?.imagen?.url || slide?.imagen?.imagen || slide?.url || '').trim();
    if (url) {
      return url;
    }

    const imagenesSlide = Array.isArray(slide?.imagenesSlide) ? slide.imagenesSlide : Array.isArray(slide?.promo?.imagenesSlide) ? slide.promo.imagenesSlide : [];
    return String(imagenesSlide[0]?.url || '').trim();
  }

  onPromoImageError(event?: Event): void {
    const img = event?.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  private tieneSlideMedia(promo: any): boolean {
    return this.getPromoSlideMediaKind(this.getPromoSlideMediaUrl(promo)) !== 'none';
  }

  private esTipoSlidePromo(promo: any): boolean {
    const tipo = String(promo?.tipo ?? promo?.tipoPromocion ?? promo?.tipo_promocion ?? promo?.promocionTipo?.nombre ?? '').trim().toLowerCase();
    const slideFlags = [promo?.promocionTipo?.esSlide, promo?.promocionTipo?.tipoSlide, promo?.esSlide, promo?.tipoSlide];
    return slideFlags.some((flag) => this.toBoolean(flag)) || tipo.includes('slide') || tipo.includes('banner') || tipo.includes('carrusel') || tipo.includes('slider');
  }

  private getPromoSlideMediaKind(value: unknown): 'image' | 'video' | 'none' {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) {
      return 'none';
    }

    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(normalized)) {
      return 'video';
    }

    return 'image';
  }

  private normalizarUrlSlide(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    if (raw.startsWith('/assets/') || raw.startsWith('assets/')) {
      return raw.replace(/^\//, '');
    }

    return resolveBackendMediaUrl(raw);
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'sí';
    }
    return false;
  }


      cargarEmpresa() {
        this.companyService.getEmpresa().subscribe((empresa: Empresa | null) => {
          if (empresa) {
            this.empresa = empresa;
            if (empresa.apps && empresa.apps.length > 0) {
              this.selectedAppId = empresa.apps[0].id;
              this.carritoService.setAppId(this.selectedAppId);
              this.cargarFavoritos();
            }
          } else if (!this.empresa) {
            // Evitar logout prematuro en refresh mientras carga empresa
            this.empresa = null;
          }
        });
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
    errorBusqueda: string = '';
  servicioOffline = false;


  // --- PROPIEDADES ---
  notificaciones: { mensaje: string }[] = [];
  selectedProducto: Producto | null = null;
  selectedImagenModal: string = '';
  cantidadesRelacionados: Record<string, number> = {};
  productosRelacionadosModal: any[] = [];
  productoAgregado: boolean = false;
  cantidadAgregar: number = 1;
  resultadosBusqueda: Producto[] = [];
  busquedaNombre: string = '';
  selectedAppId: number | null = null;
  ratings: { [productoId: number]: number } = {};
  favoritos: { [productoId: number]: boolean } = {};
  empresa: Empresa | null = null;
  usuario: any = null;
  errorUsuario: string = '';
  router: Router;
  apiService: ApiService;
  carritoService: CarritoService;

  constructor(router: Router, apiService: ApiService, carritoService: CarritoService, private companyService: CompanyService) {
    this.router = router;
    this.apiService = apiService;
    this.carritoService = carritoService;
    this.empresa = null;
    this.usuario = null;
  }

  abrirDetalleProducto(producto: Producto) {
    if (!producto || !producto.nombre) return;
    const marca = (producto as any).marca?.nombre || (producto as any).marca || '';
    let base = producto.nombre;
    if (marca) base += '-' + marca;
    const slug = base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
    this.router.navigate(['/productos', slug]);
  }

  getProductosRelacionados(producto: any): any[] {
    const relacionados = producto?.productos_relacionados ?? producto?.productosRelacionados ?? [];
    if (!Array.isArray(relacionados) || !relacionados.length) return [];

    return relacionados.map((item: any) => ({
      ...item,
      nombre: item?.nombre ?? item?.denominacion ?? 'Producto',
      descripcion: item?.descripcion ?? item?.descripcion_larga ?? item?.descripcionlarga ?? '',
      imagen: item?.imagen ?? item?.imagenUrl ?? item?.imagenurl ?? '',
      codigo_barra: item?.codigo_barra ?? item?.codigobarra,
      codigo_qr: item?.codigo_qr ?? item?.codigoqr,
      unidad_medida: item?.unidad_medida ?? item?.unidadmedida,
      contenido_neto: item?.contenido_neto ?? item?.contenidoneto,
      precio: Number(item?.precio ?? 0)
    }));
  }

  getGaleriaModal(producto: any): Array<{ url: string }> {
    const galeriaBase = Array.isArray(producto?.imagenes)
      ? producto.imagenes
          .map((img: any) => ({ url: resolveBackendMediaUrl(img?.url ?? img) }))
          .filter((img: any) => !!img.url)
      : [];

    if (!this.simularGaleriaImagenes) {
      return galeriaBase;
    }

    const fallback = resolveBackendMediaUrl(producto?.imagen ?? producto?.imagenUrl ?? '');
    const fuente = galeriaBase.length
      ? galeriaBase
      : (fallback ? [{ url: fallback }] : []);

    if (!fuente.length) return [];
    if (fuente.length >= 10) return fuente;

    const simulada: Array<{ url: string }> = [];
    for (let i = 0; i < 10; i++) {
      simulada.push({ ...fuente[i % fuente.length] });
    }

    return simulada;
  }

  seleccionarProductoRelacionado(producto: any, event?: Event): void {
    event?.stopPropagation();
    if (!producto) return;
    this.selectedProducto = { ...producto };
    this.selectedImagenModal = String((this.selectedProducto as any)?.imagen ?? (this.selectedProducto as any)?.imagenUrl ?? '').trim();
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.cantidadAgregar = 1;
    this.productoAgregado = false;
  }

  getRelacionadoKey(producto: any): string {
    if (producto?.id != null) return String(producto.id);
    if (producto?.codigo_barra != null) return `cb-${String(producto.codigo_barra)}`;
    return String(producto?.nombre ?? 'rel');
  }

  getCantidadRelacionado(producto: any): number {
    const key = this.getRelacionadoKey(producto);
    const cantidadActual = Number(this.cantidadesRelacionados[key]);
    return Number.isFinite(cantidadActual) && cantidadActual > 0 ? cantidadActual : 1;
  }

  setCantidadRelacionado(producto: any, valor: number): void {
    const key = this.getRelacionadoKey(producto);
    const cantidadNormalizada = Math.max(1, Number(valor) || 1);
    this.cantidadesRelacionados[key] = cantidadNormalizada;
  }

  agregarRelacionadoAlCarrito(producto: any, event?: Event): void {
    event?.stopPropagation();
    if (!producto) return;
    const productoParaCarrito = { ...producto };
    productoParaCarrito.precio = this.getPrecioVisualProducto(productoParaCarrito);
    const cantidad = this.getCantidadRelacionado(productoParaCarrito);
    this.carritoService.agregar(productoParaCarrito, cantidad);
  }

  agregarRelacionadoAlCarritoDesdeModal(payload: { producto: any; cantidad: number }): void {
    if (!payload?.producto) return;
    const productoParaCarrito = { ...payload.producto };
    productoParaCarrito.precio = this.getPrecioVisualProducto(productoParaCarrito);
    if (!productoParaCarrito.precio || productoParaCarrito.precio <= 0) {
      this.errorCarrito = 'No se puede agregar un producto sin precio.';
      return;
    }
    const cantidad = Math.max(1, Number(payload.cantidad) || 1);
    this.carritoService.agregar(productoParaCarrito, cantidad);
    this.errorCarrito = '';
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

  getPrecioVisualProducto(producto: any): number {
    const precioLista = Number(producto?.precio ?? 0);
    const precioDescuento = Number(producto?.precioDescuento ?? Number.POSITIVE_INFINITY);
    const mejorPromo = Number(this.getMejorPrecioPromo(producto) ?? Number.POSITIVE_INFINITY);
    const mejor = Math.min(
      Number.isFinite(precioLista) ? precioLista : Number.POSITIVE_INFINITY,
      Number.isFinite(precioDescuento) ? precioDescuento : Number.POSITIVE_INFINITY,
      Number.isFinite(mejorPromo) ? mejorPromo : Number.POSITIVE_INFINITY
    );
    return Number.isFinite(mejor) ? mejor : 0;
  }

  cerrarDetalleProducto() {
    if (!this.productoAgregado && this.selectedProducto) {
      this.carritoService.quitar(this.selectedProducto.id);
    }
    this.productoAgregado = false;
    this.selectedImagenModal = '';
    this.productosRelacionadosModal = [];
  }

  agregarAlCarrito() {
    if (this.selectedProducto && this.cantidadAgregar > 0) {
      const productoParaCarrito = { ...this.selectedProducto };
      productoParaCarrito.precio = this.getPrecioVisualProducto(productoParaCarrito);
      this.carritoService.agregar(productoParaCarrito, this.cantidadAgregar);
      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // Bootstrap 5
        // @ts-ignore
        const bsModal = (window as any).bootstrap?.Modal?.getInstance(modal);
        if (bsModal) bsModal.hide();
      }
      this.cantidadAgregar = 1;
    }
  }

  // --- MÉTODOS DE NEGOCIO Y UTILIDAD ---
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

  getPromocionPrecio(prod: any, promo: any, tipo: 'original' | 'descuento'): number {
    const precioOriginal = prod.precioOriginal ?? prod.precio ?? prod.precio ?? 0;
    if (tipo === 'original') return precioOriginal;
    if (promo.tipo === 'porcentaje' && promo.valor) {
      return +(precioOriginal * (1 - promo.valor / 100)).toFixed(2);
    } else if (promo.tipo === 'monto' && promo.valor) {
      return +(precioOriginal - promo.valor).toFixed(2);
    }
    return precioOriginal;
  }

  agregarPromoAlCarrito(prod: any, promo: any, event?: Event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const producto = { ...prod };
    if (promo.tipo === 'porcentaje' && promo.valor) {
      producto.precio = producto.precioOriginal ? producto.precioOriginal * (1 - promo.valor / 100) : producto.precio * (1 - promo.valor / 100);
    } else if (promo.tipo === 'monto' && promo.valor) {
      producto.precio = (producto.precioOriginal || producto.precio) - promo.valor;
    } else if (producto.precioDescuento) {
      producto.precio = producto.precioDescuento;
    }
    this.selectedProducto = producto;
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.productoAgregado = false;
    setTimeout(() => {
      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // @ts-ignore
        window.bootstrap?.Modal?.getOrCreateInstance(modal)?.show();
      }
    }, 0);
  }

  ratingsGlobal: { [productoId: number]: number } = {};
  setRatingMini = (args: { producto: Producto, rating: number, event: Event }) => {
    // Llama a setRating con la firma correcta
    return this.setRating(args.producto, args.rating, args.event);
  }

  async setRating(producto: Producto, rating: number, event: Event) {
    event.stopPropagation();
    if (!producto || !producto.id) return;
    try {
      const token = localStorage.getItem('token');
      const appId = environment.empresaCodigoWeb || environment.empresaCodigo || 1;
      const res = await fetch(`${environment.apiUrl}/api/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ productoId: producto.id, rating, appId })
      });
      if (res.ok) {
        // Refrescar promedio global y rating usuario
        const getRes = await fetch(`${environment.apiUrl}/api/ratings/${producto.id}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (getRes.ok) {
          const data = await getRes.json();
          this.ratings = { ...this.ratings, [producto.id]: data.ratingUsuario ?? rating };
          this.ratingsGlobal = { ...this.ratingsGlobal, [producto.id]: data.promedioGlobal ?? this.ratingsGlobal[producto.id] };
        } else {
          this.ratings[producto.id] = rating;
        }
      }
    } catch {}
  }

  toggleFavorito(producto: Producto, event: Event) {
    event.stopPropagation();
    const productoId = Number((producto as any)?.id);
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

  buscarProductos() {
    const nombre = this.busquedaNombre?.trim();
    const appId = this.selectedAppId;
    if (!nombre || !appId) {
      this.resultadosBusqueda = [];
      return;
    }
    this.apiService.buscarProductosPorNombre(nombre, appId).subscribe((result: Producto[]) => {
      this.resultadosBusqueda = result;
    });
  }

  onCardClick(event: MouseEvent, producto: Producto) {
    const target = event.target as HTMLElement;
    if (!target || typeof target.closest !== 'function') {
      return;
    }
    if (
      target.closest('button[title="Marcar como favorito"]') ||
      target.classList.contains('bi-heart') ||
      target.classList.contains('bi-heart-fill')
    ) {
      event.stopPropagation();
      return;
    }
    let productoSeleccionado = { ...producto };
    const precioBase = productoSeleccionado.precio ?? 0;
    if (producto.promociones && producto.promociones.length && precioBase > 0) {
      let mejorPromo: any = null;
      let mejorPrecio = precioBase;
      for (const promo of producto.promociones) {
        let precioPromo = precioBase;
        if (promo['tipo'] === 'porcentaje' && promo['valor']) {
          precioPromo = +(precioBase * (1 - promo['valor'] / 100)).toFixed(2);
        } else if (promo['tipo'] === 'monto' && promo['valor']) {
          precioPromo = +(precioBase - promo['valor']).toFixed(2);
        }
        if (precioPromo < mejorPrecio) {
          mejorPrecio = precioPromo;
          mejorPromo = promo;
        }
      }
      if (mejorPromo && mejorPrecio < precioBase) {
        productoSeleccionado.precioDescuento = mejorPrecio;
        productoSeleccionado.promocionAplicada = this.normalizarPromocionAplicada(mejorPromo, mejorPrecio, precioBase);
      } else {
        productoSeleccionado.promocionAplicada = null;
      }
    }
    this.selectedProducto = productoSeleccionado;
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.productoAgregado = false;
    if (
      target.closest('button[title="Agregar al carrito"]') ||
      target.classList.contains('bi-cart-plus')
    ) {
      setTimeout(() => {
        const modal = document.getElementById('detalleProductoModal');
        if (modal) {
          // @ts-ignore
          window.bootstrap?.Modal?.getOrCreateInstance(modal)?.show();
        }
      }, 0);
    }
  }

  private normalizarPromocionAplicada(promo: any, precioDescuento: number, precioBase: number): any {
    const descripcion = String(
      promo?.descripcion ??
      promo?.promocionTipo?.descripcion ??
      promo?.nombre ??
      promo?.titulo ??
      ''
    ).trim();

    return {
      ...promo,
      descripcion,
      nombre: promo?.nombre ?? descripcion,
      tipo: promo?.tipo ?? promo?.promocionTipo?.alias ?? '',
      valor: promo?.valor ?? null,
      valorExtra: promo?.valorExtra ?? null,
      precioDescuento,
      precioBase,
      activa: true,
      aplicada: true,
      visible: true
    };
  }

  // --- MÉTODOS ÚNICOS (sin duplicados) ---
  cargarUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return;
    let userId: number | null = null;
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(decoded);
      userId = data.id || data.userId || null;
    } catch {}
    if (userId) {
      this.apiService.getUsuario(userId).subscribe({
        next: (user: any) => {
          this.usuario = user;
          // Guardar permisos en localStorage si existen
          if (user.permisos) {
            const permisosArray = user.permisos[Object.keys(user.permisos)[0]] || [];
            localStorage.setItem('permisos', JSON.stringify(permisosArray));
            console.log('Permisos seteados en localStorage:', permisosArray);
          }
        },
        error: () => {
          this.errorUsuario = 'No se pudo cargar la información del usuario.';
          // localStorage.removeItem('token'); // <-- Comentado para debug
          // setTimeout(() => this.router.navigate(['/auth']), 2000); // <-- Comentado para debug
        }
      });
    }
  }

  get appLogo(): string {
    // Usar el código web del environment para el logo
    const codigoLogo = environment.empresaCodigoWeb || 'default';
    return 'assets/logos/apps/' + codigoLogo + '.png';
  }

  get appNombre(): string {
    if (this.empresa && (this.empresa as any).apps && (this.empresa as any).apps.length) {
      const app = (this.empresa as any).apps.find((app: App) => app.id === this.selectedAppId);
      return app?.nombre || this.empresa.nombre;
    }
    return this.empresa?.nombre || '';
  }

  trackByProductoId(_index: number, producto: any): number | string {
    return producto?.id ?? _index;
  }

  // Eliminar lógica de dropdown de notificaciones
  // Si existía alguna función como toggleNotificacionesDropdown o notificacionesAbiertas, eliminarla
}
