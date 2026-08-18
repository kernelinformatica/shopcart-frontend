  

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../api.service';
import { CarritoService } from '../../../carrito.service';
import { ProductoItemComponent } from '../../../shared/components/producto-item/producto-item.component';
import { ProductoVistaSelectorComponent } from '../../../shared/components/producto-vista-selector/producto-vista-selector.component';
import { ProductoItemMiniComponent } from '../../../shared/components/producto-item-mini/producto-item-mini.component';
import { ProductoItemListaComponent } from '../../../shared/components/producto-item-lista/producto-item-lista.component';
import { FiltrosPanelComponent } from '../../../shared/components/filtros-panel/filtros-panel.component';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil, timeout } from 'rxjs/operators';
import { filtrarProductosConPrecio } from '../../../shared/utils/producto.utils';

@Component({
  selector: 'app-productocategoria-productos',
  templateUrl: './productocategoria-productos.component.html',
  styleUrls: ['./productocategoria-productos.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ProductoItemComponent,  ProductoVistaSelectorComponent, ProductoItemMiniComponent, ProductoItemListaComponent, FiltrosPanelComponent]
})
export class ProductoCategoriaProductosComponent implements OnInit, OnDestroy {
  categoriaBreadcrumb: string[] = [];
  filtroNombre: string = '';
  // Selector de vista
  modoVistaProducto: 'grande' | 'compacta' | 'lista' = 'grande';

  setModoVistaProducto(modo: 'grande' | 'compacta' | 'lista') {
    this.modoVistaProducto = modo;
    localStorage.setItem('modoVistaProductoCategoria', modo);
  }
  productos: any[] = [];
  productosFiltrados: any[] = [];
  productosPaginados: any[] = [];
  productoCategoriaId: string | null = null;
  productoCategoriaNombre: string = '';
  mostrarTodos = false;
  mostrarSoloFavoritos = false;
  loading = true;
  error = '';
  ratings: { [productoId: number]: number } = {};
  ratingsGlobal: { [productoId: number]: number } = {};
  favoritos: { [productoId: number]: boolean } = {};
  marcasDisponibles: string[] = [];
  categoriasDisponibles: string[] = [];
  marcasSeleccionadas: Record<string, boolean> = {};
  categoriasSeleccionadas: Record<string, boolean> = {};
  precioMinFiltro: number | null = null;
  precioMaxFiltro: number | null = null;
  filtrosColapsados = false;
  paginaActual = 1;
  itemsPorPagina = 12;
  totalPaginas = 1;
  selectedProducto: any = null;
  cantidadAgregar = 1;
  selectedImagenModal = '';
  productosRelacionadosModal: any[] = [];
  errorCarrito = '';
  private imagenesProductoConError = new Set<string>();
  private imagenIntentoPorProducto = new Map<string, number>();
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private router: Router,
    private carritoService: CarritoService
  ) {}

  ngOnInit(): void {
    //this.cargarFavoritos();

    this.route.paramMap
      .pipe(
        switchMap(params => {
          this.mostrarTodos = !!this.route.snapshot.data['mostrarTodos'];
          this.mostrarSoloFavoritos = !!this.route.snapshot.data['soloFavoritos'];
          const categoriaSlug = params.get('categoriaSlug');

          this.error = '';
          this.productos = [];
          this.productoCategoriaNombre = '';
          if (!categoriaSlug) {
            this.loading = false;
            this.error = 'Categoría no especificada.';
            return of([]);
          }
          this.loading = true;
          // Buscar la categoría por slug usando el campo 'slug' del backend
          return this.api.getCategorias().pipe(
            map((categorias: any[]) => {
              // DEBUG: Mostrar todos los slugs recibidos y el slug buscado
              const allSlugs: string[] = [];
              function findCategoriaBySlug(cats: any[], slug: string): any | null {
                for (const cat of cats) {
                  allSlugs.push(cat.slug);
                  if (cat.slug === slug) return cat;
                  if (Array.isArray(cat.children) && cat.children.length) {
                    const found = findCategoriaBySlug(cat.children, slug);
                    if (found) return found;
                  }
                }
                return null;
              }
              const categoria = findCategoriaBySlug(categorias, categoriaSlug);
              console.log('[Categorias] Slugs recibidos:', allSlugs);
              console.log('[Categorias] Slug buscado:', categoriaSlug);
              if (!categoria) {
                this.loading = false;
                this.error = 'Categoría no encontrada.';
                return [];
              }
              this.productoCategoriaNombre = categoria.nombre;
              // Construir breadcrumb de categorías
              this.categoriaBreadcrumb = [];
              let current = categoria;
              while (current) {
                this.categoriaBreadcrumb.unshift(current.nombre);
                current = current.parent;
              }
              // Buscar productos por categoría
              return { categoria };
            }),
            switchMap((result: any) => {
              if (!result.categoria) return of([]);
              return this.api.getProductosPorCategoria(result.categoria.id).pipe(
                catchError(() => {
                  this.loading = false;
                  this.error = 'No se pudieron cargar los productos de la categoría.';
                  return of([]);
                }),
                map((productos: any[]) => {
                  this.loading = false;
                  this.productos = productos || [];
                  this.prepararOpcionesFiltro();
                  this.aplicarFiltros();
                  debugger
                  return productos;
                })
              );
            })
          );
        })
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  agregarCarrito(eventOrProducto: any, productoArg?: any) {
    let producto: any;
    // Si se llama como (producto) => eventOrProducto es el producto
    // Si se llama como (event, producto) => eventOrProducto es el evento, productoArg es el producto
    if (productoArg) {
      if (eventOrProducto && eventOrProducto.stopPropagation) eventOrProducto.stopPropagation();
      producto = productoArg;
    } else {
      producto = eventOrProducto;
    }
    if (this.carritoService && producto) {
      this.carritoService.agregar({ ...producto, cantidad: 1 });
    }
  }

  // Handler para favorito
  toggleFavorito(event: { event: Event, producto: any }) {
    const producto = event.producto;
    const productoId = producto?.id;
    if (!productoId) return;
    const esFavorito = this.favoritos[productoId] === true;
    if (esFavorito) {
      this.api.eliminarFavorito({ productoId }).subscribe({
        next: () => {
          this.favoritos = { ...this.favoritos, [productoId]: false };
          this.api.notificarFavoritosActualizados();
          this.productosFiltrados = [...this.productosFiltrados];
        },
        error: (err) => {
          console.error('Error al quitar favorito', err);
        }
      });
    } else {
      this.api.crearFavorito({ productoId }).subscribe({
        next: () => {
          this.favoritos = { ...this.favoritos, [productoId]: true };
          this.api.notificarFavoritosActualizados();
          this.productosFiltrados = [...this.productosFiltrados];
        },
        error: (err) => {
          console.error('Error al agregar favorito', err);
        }
      });
    }
  }

  // Handler para rating
  setRating(event: { producto: any, rating: number, event: Event }) {
    // Aquí deberías llamar a tu servicio de ratings o lógica correspondiente
    // Por ahora solo log
    console.log('Set rating', event.producto, event.rating);
  }
   volverAlCatalogo(): void {
    this.router.navigate(['/dashboard']);
  }
  irADetalleProducto(producto: any) {
    if (producto && producto.slug) {
      this.router.navigate(['/productos', producto.slug]);
    }
  }
  private prepararOpcionesFiltro(): void {
    // Llenar marcas y categorías a partir de los productos
    const marcas = new Set<string>();
    const categorias = new Set<string>();

    for (const producto of this.productos) {
      // Marca
      const marca = this.getMarcaNombre(producto);
      if (marca) marcas.add(marca);

      // Categoría
      // Usar producto.categoria.nombre si existe, si no, fallback a rubro
      const categoria = producto?.categoria?.nombre ?? producto?.rubro?.nombre;
      if (categoria) categorias.add(String(categoria).trim());
    }

    this.marcasDisponibles = Array.from(marcas).sort((a, b) => a.localeCompare(b, 'es'));
    this.categoriasDisponibles = Array.from(categorias).sort((a, b) => a.localeCompare(b, 'es'));
  }

  aplicarFiltros(): void {
    const marcasActivas = this.marcasDisponibles.filter((marca: string) => this.marcasSeleccionadas[marca]);
    const categoriasActivas = this.categoriasDisponibles.filter((rubro: string) => this.categoriasSeleccionadas[rubro]);

    this.productosFiltrados = this.productos.filter((producto: any) => {
      if (this.mostrarSoloFavoritos && !this.esProductoFavorito(producto)) return false;

      // Filtro por nombre o descripción
      if (this.filtroNombre && !(
        (producto?.nombre ?? '').toLowerCase().includes(this.filtroNombre.toLowerCase()) ||
        (producto?.descripcion ?? '').toLowerCase().includes(this.filtroNombre.toLowerCase())
      )) {
        return false;
      }

      const precio = this.getPrecioVigente(producto);
      // Si hay filtro de precio y el producto no tiene precio válido, no mostrarlo
      if ((this.precioMinFiltro !== null || this.precioMaxFiltro !== null) && precio === null) return false;
      if (this.precioMinFiltro !== null && (precio === null || precio < this.precioMinFiltro)) return false;
      if (this.precioMaxFiltro !== null && (precio === null || precio > this.precioMaxFiltro)) return false;

      if (marcasActivas.length > 0) {
        const marcaProducto = this.getMarcaNombre(producto);
        if (!marcasActivas.includes(marcaProducto)) return false;
      }

      if (categoriasActivas.length > 0) {
        const rubroProducto = String(producto?.rubro?.nombre ?? '').trim();
        if (!categoriasActivas.includes(rubroProducto)) return false;
      }

      return true;
    });

    this.paginaActual = 1;
    this.actualizarPaginacion();
  }

  private actualizarPaginacion(): void {
    if (!this.mostrarTodos) {
      this.productosPaginados = this.productosFiltrados;
      this.totalPaginas = 1;
      return;
    }

    const totalItems = this.productosFiltrados.length;
    this.totalPaginas = Math.max(1, Math.ceil(totalItems / this.itemsPorPagina));

    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = this.totalPaginas;
    }

    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    this.productosPaginados = this.productosFiltrados.slice(inicio, fin);
  }

  private getPrecioVigente(producto: any): number | null {
    // Considerar solo precios mayores a 0
    const precios = [
      Number(producto?.precio_lista),
      Number(producto?.precioDescuento),
      Number(producto?.mejorPrecioPromoCalculado)
    ].filter(p => Number.isFinite(p) && p > 0);
    if (!precios.length) return null;
    return Math.min(...precios);
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
    const slug = this.slugify(marcaNombre);

    const idRaw = entidad?.id ?? producto?.marcaId ?? producto?.marca_id ?? producto?.idMarca ?? producto?.id_marca;
    const idNumero = Number(idRaw);
    const id5 = Number.isFinite(idNumero) && idNumero > 0 ? String(Math.trunc(idNumero)).padStart(5, '0') : '';

    const codigoRaw = entidad?.codigo ?? entidad?.code ?? producto?.marcaCodigo ?? producto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();

    const candidatos = new Set<string>();

    const logoDirecto = String(entidad?.logo ?? entidad?.logoUrl ?? entidad?.imagen ?? producto?.logoMarca ?? '').trim();

    // Si la marca es 'Sin Marca' o el logo está vacío, usar la imagen del producto como logo de marca
    if ((marcaNombre?.toLowerCase() === 'sin marca' || !logoDirecto) && producto?.imagen) {
      candidatos.add(producto.imagen);
    }

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
private slugify(texto: unknown): string {
    const valor = String(texto || '').trim().toLowerCase();
    if (!valor) return '';

    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  // Métodos actualizarPrecioMin/Max eliminados: ahora el filtro usa outputs y el binding es directo
  toggleFiltrosColapsados(): void {
    this.filtrosColapsados = !this.filtrosColapsados;
  }
  get hayFiltrosActivos(): boolean {
    return this.precioMinFiltro !== null ||
      this.precioMaxFiltro !== null ||
      this.marcasDisponibles.some((marca: string) => this.marcasSeleccionadas[marca]) ||
      this.categoriasDisponibles.some((rubro: string) => this.categoriasSeleccionadas[rubro]);
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

    const nombre = this.slugify(this.getMarcaNombre(producto));
    if (nombre) return `nom:${nombre}`;

    return '';
  }

  private getProductoImageKey(producto: any, src: string): string {
    const id = producto?.id ?? producto?.codigo_barra ?? producto?.nombre ?? 'sin-id';
    return `${id}::${src}`;
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
   limpiarFiltros(): void {
    this.precioMinFiltro = null;
    this.precioMaxFiltro = null;
    this.marcasSeleccionadas = {};
    this.categoriasSeleccionadas = {};
    this.aplicarFiltros();
  }
private cargarFavoritos(): void {
    this.api.getFavoritos().pipe(
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

}
