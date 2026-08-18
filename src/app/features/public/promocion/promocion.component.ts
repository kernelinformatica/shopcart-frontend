import { environment } from '../../../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProductoItemComponent } from '../../../shared/components/producto-item/producto-item.component';
import { ProductoDetalleModalComponent } from '../../../shared/components/producto-detalle-modal/producto-detalle-modal.component';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../api.service';
import { CarritoService } from '../../../carrito.service';
import { of } from 'rxjs';
import { catchError, switchMap, timeout } from 'rxjs/operators';
import { filtrarProductosConPrecio, resolveMarcaLogo, extractMarcaLogoValue, resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';

@Component({
  selector: 'app-promocion',
  templateUrl: './promocion.component.html',
  styleUrl: './promocion.component.scss',
  standalone: true,
  imports: [CommonModule, DatePipe, ProductoItemComponent, ProductoDetalleModalComponent]
})
export class PromocionComponent implements OnInit {
  async setRating(producto: any, rating: number, event?: Event) {
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
        this.ratingsGlobal[producto.id] = producto.rating.global;
      }
    } catch {}
  }
onCardClick($event: Event,_t56: any) {
throw new Error('Method not implemented.');
}
  promo: any = null;
  productosPromo: any[] = [];
  selectedProducto: any = null;
  selectedImagenModal = '';
  productosRelacionadosModal: any[] = [];
  cantidadAgregar = 1;
  loading = true;
  error = '';
  private promoIdRuta = 0;
  private promoSlugRuta = '';
  ratings: Record<number, number> = {};
  ratingsGlobal: Record<number, number> = {};
  favoritos: Record<number, boolean> = {};
  private promoImagenConError = false;
  private imagenesProductoConError = new Set<string>();
  private imagenIntentoPorProducto = new Map<string, number>();
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private carritoService: CarritoService
  ) {}

  ngOnInit(): void {
    this.cargarFavoritos();
    this.route.paramMap.pipe(
      switchMap((params) => {
        const slug = String(params.get('slug') || '').trim();
        const promoId = this.extraerPromoIdDesdeSlug(slug);
        this.promoSlugRuta = slug;
        this.promoIdRuta = promoId;

        if (!slug) {
          this.loading = false;
          this.error = 'Promoción inválida.';
          return of(null);
        }

        if (!promoId) {
          this.loading = false;
          this.error = 'Promoción inválida. Falta id en la URL.';
          return of(null);
        }

        this.loading = true;
        this.error = '';
        this.promo = null;
        this.productosPromo = [];
        this.promoImagenConError = false;
        this.imagenesProductoConError.clear();
        this.imagenIntentoPorProducto.clear();
        this.logosMarcaConError.clear();
        this.logoMarcaIntento.clear();
        return this.apiService.getPromocion(promoId).pipe(
          timeout(12000),
          catchError(() => {
            this.error = 'No se pudo cargar la promoción.';
            this.loading = false;
            return of(null);
          })
        );
      })
    ).subscribe((promoResponse: any) => {
      if (!promoResponse) return;

      const promo = this.normalizarPromocionRespuesta(promoResponse);
      if (!promo) {
        this.error = 'No se encontró la promoción solicitada.';
        this.loading = false;
        return;
      }

      this.promo = promo;
      this.cargarProductosPromo(promo);
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

  private cargarProductosPromo(promo: any): void {
    const productosDesdePromo = this.normalizarProductosDesdePromo(
      promo?.productos ?? promo?.items ?? promo?.detalles ?? promo?.productosPromocion ?? promo?.productos_promocion
    );

    const productosNormalizados = productosDesdePromo.map((item: any) => this.normalizarProducto(item));
    this.productosPromo = filtrarProductosConPrecio(productosNormalizados);
    this.sincronizarFavoritosDesdeProductos(this.productosPromo);
    this.loading = false;
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

  private normalizarPromocionRespuesta(raw: any): any | null {
    if (!raw) return null;

    const promoCandidata = this.extraerPromocionCandidata(raw);
    if (!promoCandidata) return null;

    const idPromo = this.extraerPromoId(promoCandidata);
    if (this.promoIdRuta > 0 && idPromo !== this.promoIdRuta) {
      return null;
    }

    const slugPromo = this.slugify(this.obtenerNombrePromo(promoCandidata));
    const slugRutaSinId = this.slugify(this.promoSlugRuta.replace(/-\d+$/, ''));
    if (slugRutaSinId && slugPromo && slugRutaSinId !== slugPromo && this.promoIdRuta <= 0) {
      return null;
    }

    return promoCandidata;
  }

  private extraerPromocionCandidata(raw: any): any | null {
    if (Array.isArray(raw)) {
      if (!raw.length) return null;
      if (this.promoIdRuta > 0) {
        const porId = raw.find((item: any) => this.extraerPromoId(item) === this.promoIdRuta);
        if (porId) return porId;
      }

      const slugRutaSinId = this.slugify(this.promoSlugRuta.replace(/-\d+$/, ''));
      if (slugRutaSinId) {
        const porSlug = raw.find((item: any) => this.slugify(this.obtenerNombrePromo(item)) === slugRutaSinId);
        if (porSlug) return porSlug;
      }

      return raw[0] ?? null;
    }

    const base = raw?.promocion && typeof raw.promocion === 'object' ? raw.promocion : raw;
    if (!base || typeof base !== 'object') return null;

    return {
      ...base,
      productos:
        base?.productos ??
        raw?.productos ??
        base?.items ??
        raw?.items ??
        base?.detalles ??
        raw?.detalles ??
        base?.productosPromocion ??
        raw?.productosPromocion ??
        base?.productos_promocion ??
        raw?.productos_promocion ??
        []
    };
  }

  agregarDesdeCard(producto: any, event?: Event): void {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    if (!producto) return;
    this.selectedProducto = { ...producto };
    this.selectedImagenModal = this.getImagenPrincipalProducto(this.selectedProducto);
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.cantidadAgregar = 1;
    setTimeout(() => {
      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // @ts-ignore
        window.bootstrap?.Modal?.getOrCreateInstance(modal)?.show();
      }
    }, 0);
  }

  getProductosRelacionados(producto: any): any[] {
    const relacionados = producto?.productos_relacionados ?? producto?.productosRelacionados ?? [];
    if (!Array.isArray(relacionados) || !relacionados.length) return [];
    return relacionados
      .map((item: any) => this.normalizarProductoRelacionado(item))
      .filter((item: any) => !!item);
  }

  seleccionarProductoRelacionado(producto: any, event?: Event): void {
    event?.stopPropagation();
    if (!producto) return;
    this.selectedProducto = this.normalizarProductoRelacionado(producto);
    this.selectedImagenModal = this.getImagenPrincipalProducto(this.selectedProducto);
    this.productosRelacionadosModal = this.getProductosRelacionados(this.selectedProducto);
    this.cantidadAgregar = 1;
  }

  agregarRelacionadoDesdeModal(payload: { producto: any; cantidad: number }): void {
    if (!payload?.producto) return;
    const cantidad = Math.max(1, Number(payload.cantidad) || 1);
    const productoParaCarrito = this.prepararProductoParaCarrito(payload.producto);
    this.carritoService.agregar(productoParaCarrito, cantidad);
  }

  getGaleriaModal(producto: any): Array<{ url: string }> {
    if (!Array.isArray(producto?.imagenes)) return [];
    return producto.imagenes
      .map((img: any) => ({ url: String(img?.url ?? img ?? '').trim() }))
      .filter((img: any) => !!img.url);
  }

  seleccionarImagenModal(url: string): void {
    const normalizada = String(url ?? '').trim();
    if (!normalizada) return;
    this.selectedImagenModal = normalizada;
  }

  getImagenPrincipalProducto(producto: any): string {
    const seleccionada = String(this.selectedImagenModal ?? '').trim();
    if (seleccionada) return seleccionada;

    const src = String(this.getProductoImagen(producto) ?? producto?.imagen ?? producto?.imagenurl ?? '').trim();
    return src || 'https://via.placeholder.com/300x300?text=Producto';
  }

  agregarAlCarrito(): void {
    if (this.selectedProducto && this.cantidadAgregar > 0) {
      const cantidad = Number.isFinite(this.cantidadAgregar) && this.cantidadAgregar > 0
        ? Math.floor(this.cantidadAgregar)
        : 1;

      const productoParaCarrito = this.prepararProductoParaCarrito(this.selectedProducto);
      this.carritoService.agregar(productoParaCarrito, cantidad);

      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // @ts-ignore
        const bsModal = window.bootstrap?.Modal?.getInstance(modal);
        if (bsModal) bsModal.hide();
      }

      this.cantidadAgregar = 1;
      this.selectedProducto = null;
    }
  }

  cerrarDetalleProducto(): void {
    this.selectedProducto = null;
    this.selectedImagenModal = '';
    this.productosRelacionadosModal = [];
    this.cantidadAgregar = 1;
  }

  getImagenPromocion(): string {
    const imagenesSlide = this.getImagenesPromocion();
    return String(imagenesSlide[0]?.url || this.promo?.imagenSlide || '').trim();
  }

  getImagenesPromocion(): Array<{ id: number | string; url: string; orden?: number; nombreOriginal?: string; alias?: string }> {
    const imagenes = Array.isArray(this.promo?.imagenesSlide) ? this.promo.imagenesSlide : [];
    return imagenes
      .map((item: any, index: number) => ({
        id: item?.id ?? `${index}`,
        url: this.getSlideMediaUrl(item),
        orden: Number(item?.orden ?? index + 1) || index + 1,
        nombreOriginal: item?.nombreOriginal ?? item?.nombre_original ?? '',
        alias: item?.alias ?? ''
      }))
      .filter((item: { url: string }) => !!item.url);
  }

  private getSlideMediaUrl(item: any): string {
    const alias = String(item?.alias ?? '').trim();
    if (alias) {
      return `${environment.apiUrlBackend}/media/${encodeURIComponent(alias)}`;
    }

    return String(item?.url ?? '').trim();
  }

  tieneImagenPromocion(): boolean {
    return !!this.getImagenPromocion() && !this.promoImagenConError;
  }

  onPromoImagenError(event?: Event): void {
    this.promoImagenConError = true;
    const img = event?.target as HTMLImageElement | null;
    if (img) {
      img.style.display = 'none';
    }
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
      .map((item: any) => resolveBackendMediaUrl(item))
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
    const marcaObj = producto?.marcaObj;

    const candidatos = [
      typeof marca === 'string' ? marca : '',
      marca?.nombre,
      marca?.name,
      marca?.denominacion,
      marcaObj?.nombre,
      marcaObj?.name,
      marcaObj?.denominacion,
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
    const entidad = (typeof producto?.marca === 'object' ? producto?.marca : null) ?? producto?.marcaObj ?? {};
    const marcaNombre = this.getMarcaNombre(producto);
    const slug = this.slugify(marcaNombre);

    const idRaw = entidad?.id ?? producto?.marcaId ?? producto?.marca_id ?? producto?.idMarca ?? producto?.id_marca;
    const idNumero = Number(idRaw);
    const id5 = Number.isFinite(idNumero) && idNumero > 0 ? String(Math.trunc(idNumero)).padStart(5, '0') : '';

    const codigoRaw = entidad?.codigo ?? entidad?.code ?? producto?.marcaCodigo ?? producto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();

    const candidatos = new Set<string>();

    const logoDirecto = resolveMarcaLogo(entidad);

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
    const marca = (typeof producto?.marca === 'object' ? producto?.marca : null) ?? producto?.marcaObj ?? {};
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

  volver(): void {
    this.router.navigate(['/dashboard']);
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

  private extraerProductoIds(promo: any): number[] {
    const ids = new Set<number>();
    const agregarId = (raw: any) => {
      const id = this.extraerIdProducto(raw);
      if (id > 0) ids.add(id);
    };

    const listasCandidatas = [
      promo?.productoIds,
      promo?.producto_ids,
      promo?.productosIds,
      promo?.productos_ids,
      promo?.productos,
      promo?.items,
      promo?.detalles,
      promo?.productosPromocion,
      promo?.productos_promocion
    ];

    for (const lista of listasCandidatas) {
      if (!Array.isArray(lista)) continue;
      for (const item of lista) {
        agregarId(item);
      }
    }

    return Array.from(ids);
  }

  private normalizarProductosDesdePromo(productosRaw: any): any[] {
    if (!Array.isArray(productosRaw)) return [];

    const normalizados = productosRaw
      .map((item: any) => {
        if (!item) return null;

        if (item?.producto && typeof item.producto === 'object') {
          const producto = item.producto;
          return {
            ...producto,
            precio_lista: item?.precio_lista ?? item?.precioLista ?? producto?.precio_lista ?? producto?.precioLista,
            precio: item?.precio ?? producto?.precio,
            precioVenta: item?.precioVenta ?? item?.precio_venta ?? producto?.precioVenta ?? producto?.precio_venta,
            precioDescuento: item?.precioDescuento ?? item?.precio_descuento ?? producto?.precioDescuento ?? producto?.precio_descuento,
            promociones: Array.isArray(producto?.promociones)
              ? producto.promociones
              : (Array.isArray(item?.promociones) ? item.promociones : []),
            rubro: producto?.rubro ?? item?.rubro,
            subrubro: producto?.subrubro ?? item?.subrubro,
            marca: producto?.marca ?? item?.marca
          };
        }

        if (typeof item === 'object' && (item?.nombre || item?.denominacion || item?.precio || item?.precio_lista || item?.precioVenta)) {
          return item;
        }

        return null;
      })
      .filter((item: any) => !!item);

    return normalizados;
  }

  private normalizarProducto(producto: any): any {
    const precioDesdePrecios = this.extraerPrecioDesdeColeccion(
      producto?.precios,
      ['precio', 'precio_lista', 'precioLista', 'precioVenta', 'precio_venta', 'valor']
    );
    const precioDesdePreciosAnidado = this.extraerPrecioDesdeColeccion(
      producto?.producto?.precios,
      ['precio', 'precio_lista', 'precioLista', 'precioVenta', 'precio_venta', 'valor']
    );

    const precioLista = this.toNumber(
      producto?.precio_lista,
      producto?.precioLista,
      producto?.precioVenta,
      producto?.precio_venta,
      producto?.precioUnitario,
      producto?.precio_unitario,
      producto?.precio,
      precioDesdePrecios,
      producto?.listaPrecio?.precio,
      producto?.listaPrecio?.valor,
      producto?.producto?.precio_lista,
      producto?.producto?.precioLista,
      producto?.producto?.precioVenta,
      producto?.producto?.precio_venta,
      producto?.producto?.precioUnitario,
      producto?.producto?.precio_unitario,
      producto?.producto?.precio,
      precioDesdePreciosAnidado
    );

    const precioDescuento = this.toNumber(
      producto?.precioDescuento,
      producto?.precio_descuento,
      producto?.precioPromocion,
      producto?.precio_promocion,
      producto?.descuento,
      producto?.promocion?.precio_descuento,
      producto?.producto?.precioDescuento,
      producto?.producto?.precio_descuento,
      producto?.producto?.precioPromocion,
      producto?.producto?.precio_promocion
    );

    const productoNormalizado = {
      ...producto,
      nombre: producto?.nombre ?? producto?.denominacion ?? 'Producto',
      descripcion: producto?.descripcion ?? producto?.descripcion_larga ?? '',
      imagen: producto?.imagen ?? producto?.imagenUrl ?? producto?.path ?? '',
      precio_lista: precioLista,
      precioDescuento: precioDescuento > 0 ? precioDescuento : null,
      precio_descuento: precioDescuento > 0 ? precioDescuento : null,
      promociones: this.filtrarPromocionesDePromoActual(Array.isArray(producto?.promociones) ? producto.promociones : []),
      productos_relacionados: this.getProductosRelacionados(producto)
    };

    const mejorPrecioPromo = this.getMejorPrecioPromo(productoNormalizado);
    const precioBaseVisual = this.toNumber(
      productoNormalizado?.precio_lista,
      producto?.precio,
      producto?.precioVenta,
      producto?.precio_venta,
      producto?.precioUnitario,
      producto?.precio_unitario,
      productoNormalizado?.precioDescuento,
      mejorPrecioPromo
    );

    const precioPromoCandidato = this.toNumber(
      productoNormalizado?.precioDescuento,
      mejorPrecioPromo
    );

    const precioPromoVisual =
      precioPromoCandidato > 0 && precioBaseVisual > 0 && precioPromoCandidato < precioBaseVisual
        ? precioPromoCandidato
        : null;

    const precioListaVisual = precioBaseVisual > 0
      ? precioBaseVisual
      : (precioPromoCandidato > 0 ? precioPromoCandidato : 0);

    return {
      ...productoNormalizado,
      mejorPrecioPromoCalculado: mejorPrecioPromo,
      precioListaVisual,
      precioPromoVisual
    };
  }

  private getMejorPrecioPromo(producto: any): number | null {
    if (!producto || !producto.promociones || !producto.promociones.length) return null;

    let mejor: number | null = null;
    for (const promo of producto.promociones) {
      const precioPromo = Number(promo?.precio_descuento);
      if (Number.isFinite(precioPromo) && (mejor == null || precioPromo < mejor)) {
        mejor = precioPromo;
      }
    }

    return mejor;
  }

  private prepararProductoParaCarrito(producto: any): any {
    const productoCarrito = { ...producto };
    const precioLista = Number(productoCarrito?.precio_lista ?? 0);
    const mejorPromo = this.getMejorPrecioPromo(productoCarrito);

    if (mejorPromo !== null && precioLista > 0 && mejorPromo < precioLista) {
      productoCarrito.precio_lista = mejorPromo;
      return productoCarrito;
    }

    const precioDescuento = Number(productoCarrito?.precioDescuento);
    if (Number.isFinite(precioDescuento) && precioLista > 0 && precioDescuento < precioLista) {
      productoCarrito.precio_lista = precioDescuento;
    }

    return productoCarrito;
  }

  private extraerIdProducto(raw: any): number {
    if (raw === null || raw === undefined) return 0;

    if (typeof raw === 'number' || typeof raw === 'string') {
      const directo = Number(raw);
      return Number.isFinite(directo) && directo > 0 ? directo : 0;
    }

    const idRaw =
      raw?.id ??
      raw?.productoId ??
      raw?.producto_id ??
      raw?.idProducto ??
      raw?.id_producto ??
      raw?.producto?.id ??
      raw?.producto?.productoId ??
      raw?.producto?.idProducto;

    const id = Number(idRaw);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private toNumber(...values: any[]): number {
    for (const value of values) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      const texto = String(value).trim();
      if (!texto) continue;

      const limpio = texto.replace(/[^0-9,.-]/g, '');
      if (!limpio) continue;

      const tieneComa = limpio.includes(',');
      const tienePunto = limpio.includes('.');

      let normalizado = limpio;
      if (tieneComa && tienePunto) {
        normalizado = limpio.replace(/\./g, '').replace(',', '.');
      } else if (tieneComa) {
        normalizado = limpio.replace(',', '.');
      }

      const parsed = Number(normalizado);
      if (Number.isFinite(parsed)) return parsed;
    }

    return 0;
  }

  private extraerPrecioDesdeColeccion(collection: any, keys: string[]): number {
    if (!Array.isArray(collection) || !collection.length) return 0;

    for (const item of collection) {
      if (!item || typeof item !== 'object') continue;
      const candidatos = keys.map((key) => item?.[key]);
      const valor = this.toNumber(...candidatos);
      if (valor > 0) return valor;
    }

    return 0;
  }

  private getProductoImageKey(producto: any, src: string): string {
    const id = producto?.id ?? producto?.codigo_barra ?? producto?.nombre ?? 'sin-id';
    return `${id}::${src}`;
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

  private slugify(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  private extraerPromoIdDesdeSlug(slug: string): number {
    const limpio = String(slug || '').trim();
    if (!limpio) return 0;

    if (/^\d+$/.test(limpio)) {
      const idDirecto = Number(limpio);
      return Number.isFinite(idDirecto) && idDirecto > 0 ? idDirecto : 0;
    }

    const match = limpio.match(/-(\d+)$/);
    if (!match) return 0;

    const id = Number(match[1]);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  private filtrarPromocionesDePromoActual(promociones: any[]): any[] {
    if (!Array.isArray(promociones) || !promociones.length) return [];
    if (this.promoIdRuta <= 0) return promociones;

    const filtradas = promociones.filter((item: any) => this.extraerPromoId(item) === this.promoIdRuta);
    return filtradas;
  }

  private normalizarProductoRelacionado(producto: any): any {
    if (!producto || typeof producto !== 'object') return null;

    const precioLista = this.toNumber(
      producto?.precio_lista,
      producto?.precioLista,
      producto?.precioVenta,
      producto?.precio_venta,
      producto?.precioUnitario,
      producto?.precio_unitario,
      producto?.precio,
      producto?.listaPrecio?.precio,
      producto?.listaPrecio?.valor
    );

    const precioDescuento = this.toNumber(
      producto?.precioDescuento,
      producto?.precio_descuento,
      producto?.precioPromocion,
      producto?.precio_promocion
    );

    const promociones = this.filtrarPromocionesDePromoActual(Array.isArray(producto?.promociones) ? producto.promociones : []);
    const mejorPrecioPromo = this.getMejorPrecioPromo({ promociones });

    const precioBaseVisual = this.toNumber(precioLista, producto?.precio, precioDescuento, mejorPrecioPromo);
    const precioPromoCandidato = this.toNumber(precioDescuento, mejorPrecioPromo);
    const precioPromoVisual =
      precioPromoCandidato > 0 && precioBaseVisual > 0 && precioPromoCandidato < precioBaseVisual
        ? precioPromoCandidato
        : null;

    return {
      ...producto,
      nombre: producto?.nombre ?? producto?.denominacion ?? 'Producto',
      descripcion: producto?.descripcion ?? producto?.descripcion_larga ?? producto?.descripcionlarga ?? '',
      imagen: producto?.imagen ?? producto?.imagenUrl ?? producto?.imagenurl ?? producto?.path ?? '',
      codigo_barra: producto?.codigo_barra ?? producto?.codigobarra,
      codigo_qr: producto?.codigo_qr ?? producto?.codigoqr,
      unidad_medida: producto?.unidad_medida ?? producto?.unidadmedida,
      contenido_neto: producto?.contenido_neto ?? producto?.contenidoneto,
      promociones,
      precio_lista: precioBaseVisual > 0 ? precioBaseVisual : 0,
      precioListaVisual: precioBaseVisual > 0 ? precioBaseVisual : 0,
      precioDescuento: precioPromoVisual,
      precioPromoVisual,
      productos_relacionados: []
    };
  }

  getFechaInicioPromo(): Date | null {
    return this.parseFechaPromo(this.promo?.fechaDesde ?? this.promo?.fechainicio ?? null, false);
  }

  getFechaFinPromo(): Date | null {
    return this.parseFechaPromo(this.promo?.fechaHasta ?? this.promo?.fechafin ?? null, true);
  }

  getMensajeVencimiento(): string {
    const fechaFin = this.getFechaFinPromo();
    if (!fechaFin) return '';

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const diffMs = fin.getTime() - hoy.getTime();
    const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (dias > 1) return `Todavía faltan ${dias} días para el vencimiento.`;
    if (dias === 1) return 'Todavía falta 1 día para el vencimiento.';
    if (dias === 0) return 'Vence hoy.';
    return 'La promoción ya venció.';
  }

  private parseFechaPromo(value: any, endOfDay: boolean): Date | null {
    if (!value) return null;

    const texto = String(value).trim();
    if (!texto) return null;

    let fecha: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      fecha = new Date(`${texto}T00:00:00`);
    } else {
      fecha = new Date(texto);
    }

    if (Number.isNaN(fecha.getTime())) return null;

    if (endOfDay) {
      fecha.setHours(23, 59, 59, 999);
    } else {
      fecha.setHours(0, 0, 0, 0);
    }

    return fecha;
  }

}
