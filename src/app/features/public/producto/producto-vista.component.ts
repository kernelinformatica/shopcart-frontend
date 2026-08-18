import { productoTieneImpuestos, resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';
 
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe, CommonModule } from '@angular/common';
import { ApiService } from '../../../api.service';
import { CarritoService } from '../../../carrito.service';

@Component({
  selector: 'app-producto-vista',
  standalone: true,
  templateUrl: './producto-vista.component.html',
  styleUrls: ['./producto-vista.component.scss'],
  imports: [DecimalPipe, CommonModule]
})
export class ProductoVistaComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  producto: any = {};
  error: string = '';
  loadingDetalle = true;
  imagenSeleccionada: string = '';
  formasPago: any[] = [];
  zoomImagenActivo = false;
  zoomOrigin = '50% 50%';

  tieneCuotasSinInteres(): boolean {
    return Array.isArray(this.producto?.promociones) && this.producto.promociones.some((p: any) => p.tipo === 'cuotas_sin_interes');
  }

  // Helpers de promociones (adaptados de producto-item)
  // Mejorado: Devuelve el descuento aplicado (si hay), buscando acción o campos directos
  getDescuentoPromocion(): number | null {
    if (!Array.isArray(this.producto?.promociones)) return null;
    for (const promo of this.producto.promociones) {
      // 1. Buscar acción explícita
      if (Array.isArray(promo.acciones)) {
        const accion = promo.acciones.find((a: any) => a.tipoAccion === 'descuento');
        if (accion && accion.valor) return accion.valor;
      }
      // 2. Si no hay acción, buscar alias y campos directos
      if (promo.promocionTipo?.alias === 'descuento') {
        if (promo.descuentoPorcentaje) return promo.descuentoPorcentaje;
        if (promo.valor) return promo.valor;
      }
    }
    return null;
  }

  getCuotasPromocion(): number | null {
    if (!Array.isArray(this.producto?.promociones)) return null;
    for (const promo of this.producto.promociones) {
      if (Array.isArray(promo.acciones)) {
        const accion = promo.acciones.find((a: any) => a.tipoAccion === 'cuotas');
        if (accion && accion.valor) return accion.valor;
      }
    }
    return null;
  }
 setUserRating(star: number) {
    if (!this.producto || !this.producto.id) return;
    // Si el usuario hace click en la misma estrella, quita el voto
    if (this.producto.rating?.usuario === star) {
      this.api.removeProductoRating(this.producto.id).subscribe({
        next: () => {
          this.producto.rating.usuario = null;
        },
        error: () => {
          // Manejo simple de error
          this.error = 'No se pudo quitar el voto.';
        }
      });
    } else {
      this.api.setProductoRating(this.producto.id, star).subscribe({
        next: () => {
          this.producto.rating.usuario = star;
        },
        error: () => {
          this.error = 'No se pudo registrar el voto.';
        }
      });
    }
  }
  getBancosPromocion(): string[] {
    const bancos: string[] = [];
    if (!Array.isArray(this.producto?.promociones)) return bancos;
    for (const promo of this.producto.promociones) {
      if (Array.isArray(promo.condiciones)) {
        promo.condiciones.forEach((c: any) => {
          if (c.tipoCondicion === 'banco' && c.valor) bancos.push(c.valor);
        });
      }
    }
    return bancos;
  }

  getTarjetasPromocion(): string[] {
    const tarjetas: string[] = [];
    if (!Array.isArray(this.producto?.promociones)) return tarjetas;
    for (const promo of this.producto.promociones) {
      if (Array.isArray(promo.condiciones)) {
        promo.condiciones.forEach((c: any) => {
          if (c.tipoCondicion === 'tarjeta' && c.valor) tarjetas.push(c.valor);
        });
      }
    }
    return tarjetas;
  }

  // --- X_POR_Y PROMO DETECTION ---
  getPromoXPorY(): {valor: number, valorExtra: number, detalle: string} | null {
    const producto = this.producto;
    if (!producto || !Array.isArray(producto.promociones)) return null;
    for (const promo of producto.promociones) {
      // Caso 1: Buscar acción tipo x_por_y o promo_cantidad
      if (promo && Array.isArray(promo.acciones)) {
        const accion = promo.acciones.find((a: any) => a.tipoAccion === 'x_por_y' || a.tipoAccion === 'promo_cantidad');
        if (accion && (accion.valor || promo.valor) && (accion.valorExtra || accion.valorExtra === 0 || promo.valorExtra || promo.valorExtra === 0)) {
          const valor = Number(accion.valor ?? promo.valor);
          const valorExtra = Number(accion.valorExtra ?? promo.valorExtra);
          return {
            valor,
            valorExtra,
            detalle: accion.detalle || promo.descripcion || `Llevá ${valor}, pagá ${valorExtra}`
          };
        }
      }
      // Caso 2: Si el alias de la promo es x_por_y, aunque no haya acción
      if (promo?.promocionTipo?.alias === 'x_por_y' && (promo.valor || promo.valorExtra)) {
        const valor = Number(promo.valor);
        const valorExtra = Number(promo.valorExtra);
        return {
          valor,
          valorExtra,
          detalle: promo.descripcion || `Llevá ${valor}, pagá ${valorExtra}, precio por unidad.`
        };
      }
    }
    return null;
  }

  constructor(private route: ActivatedRoute, private api: ApiService, private carritoService: CarritoService, private router: Router) {}
  irAProductoRelacionado(producto: any) {
    if (producto && producto.slug) {
      this.router.navigate(['/productos', producto.slug]);
    }
  }

  agregarAlCarrito() {
    if (this.producto && this.producto.id) {
      // Buscar el nombre/detalle de la acción de promoción principal (x_por_y o descuento)
      let promoActionDetail = '';
      if (Array.isArray(this.producto.promociones)) {
        // Prioridad: x_por_y, luego descuento
        for (const promo of this.producto.promociones) {
          if (promo && Array.isArray(promo.acciones)) {
            const accionXPorY = promo.acciones.find((a: any) => a.tipoAccion === 'x_por_y' || a.tipoAccion === 'promo_cantidad');
            if (accionXPorY) {
              promoActionDetail = accionXPorY.detalle || promo.descripcion || promo.nombre || '';
              break;
            }
            const accionDescuento = promo.acciones.find((a: any) => a.tipoAccion === 'descuento');
            if (accionDescuento) {
              promoActionDetail = accionDescuento.detalle || promo.descripcion || promo.nombre || '';
              break;
            }
          }
        }
      }
      this.carritoService.agregar(this.producto, 1, promoActionDetail);
    }
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadingDetalle = true;
        this.error = '';
        this.api.getProductoPorSlug(slug).subscribe({
          next: (productoCompleto) => {
            this.producto = this.normalizarProductoDetalle(productoCompleto);
            this.error = '';
            this.imagenSeleccionada = this.getImagenPrincipalProducto(this.producto);
            this.loadingDetalle = false;
          },
          error: () => {
            this.error = 'Producto no encontrado.';
            this.producto = null;
            this.loadingDetalle = false;
          }
        });
      }
    });
    // Cargar formas de pago
    this.api.getFormasPago().subscribe(fp => {
      this.formasPago = fp;
    });
  }

  getSlug(nombre: string, marca?: string): string {
    let base = nombre;
    if (marca) base += '-' + marca;
    return base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

 agregarAlCarritoRelacionado(producto: any) {
    if (producto && producto.id) {
      this.carritoService.agregar(producto, 1);
    }
  }
  getImagenes(): string[] {
    return this.getGaleriaProducto(this.producto);
  }

  seleccionarImagen(img: string) {
    this.imagenSeleccionada = this.normalizarImagenProducto(img);
    this.resetZoomImagen();
  }

  toggleZoomImagenPrincipal(): void {
    if (!this.getImagenVistaPrincipal()) {
      return;
    }
    this.zoomImagenActivo = !this.zoomImagenActivo;
    if (!this.zoomImagenActivo) {
      this.zoomOrigin = '50% 50%';
    }
  }

  onZoomImagenMove(event: MouseEvent): void {
    if (!this.zoomImagenActivo) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const originX = Math.min(100, Math.max(0, x));
    const originY = Math.min(100, Math.max(0, y));
    this.zoomOrigin = `${originX}% ${originY}%`;
  }

  resetZoomImagen(): void {
    this.zoomImagenActivo = false;
    this.zoomOrigin = '50% 50%';
  }

  getImagenVistaPrincipal(): string {
    return this.imagenSeleccionada || this.getImagenPrincipalProducto(this.producto);
  }

  getImagenProducto(producto: any): string {
    return this.getImagenPrincipalProducto(producto);
  }

  private getImagenPrincipalProducto(producto: any): string {
    const [principal = ''] = this.getGaleriaProducto(producto);
    return principal;
  }

  private getGaleriaProducto(producto: any): string[] {
    const candidatos = new Set<string>();

    this.agregarImagenProducto(candidatos, producto?.imagenPrincipal);
    this.agregarImagenProducto(candidatos, producto?.imagen);
    this.agregarImagenProducto(candidatos, producto?.imagenUrl);
    this.agregarImagenProducto(candidatos, producto?.imagenurl);

    if (Array.isArray(producto?.productoMedia)) {
      for (const media of producto.productoMedia) {
        this.agregarImagenProducto(candidatos, media?.url);
      }
    }

    if (Array.isArray(producto?.imagenesRelacionadas)) {
      for (const imagen of producto.imagenesRelacionadas) {
        this.agregarImagenProducto(candidatos, imagen);
      }
    }

    if (Array.isArray(producto?.imagenes)) {
      for (const imagen of producto.imagenes) {
        this.agregarImagenProducto(candidatos, typeof imagen === 'string' ? imagen : imagen?.url);
      }
    }

    return Array.from(candidatos);
  }

  private agregarImagenProducto(target: Set<string>, imagen: unknown): void {
    const normalizada = this.normalizarImagenProducto(imagen);
    if (normalizada) {
      target.add(normalizada);
    }
  }

  private normalizarImagenProducto(imagen: unknown): string {
    return resolveBackendMediaUrl(imagen);
  }

  private normalizarProductoDetalle(producto: any): any {
    if (!producto || typeof producto !== 'object') {
      return producto;
    }

    const relacionados = Array.isArray(producto?.productosRelacionados)
      ? producto.productosRelacionados
      : Array.isArray(producto?.productos_relacionados)
        ? producto.productos_relacionados
        : [];

    return {
      ...producto,
      productosRelacionados: relacionados.map((item: any) => this.normalizarProductoRelacionado(item))
    };
  }

  private normalizarProductoRelacionado(item: any): any {
    const mediaItems = Array.isArray(item?.productoMedia)
      ? item.productoMedia
      : Array.isArray(item?.imagenes)
        ? item.imagenes
        : [];

    return {
      ...item,
      nombre: item?.nombre ?? item?.denominacion ?? 'Producto',
      descripcion: item?.descripcion ?? item?.descripcion_larga ?? item?.descripcionlarga ?? '',
      imagen: this.normalizarImagenProducto(item?.imagen ?? item?.imagenUrl ?? item?.imagenurl ?? item?.imagen_url ?? ''),
      imagenPrincipal: this.normalizarImagenProducto(item?.imagenPrincipal ?? item?.imagen_principal ?? item?.imagen ?? item?.imagenUrl ?? item?.imagenurl ?? item?.imagen_url ?? ''),
      productoMedia: mediaItems.map((media: any) => ({
        ...media,
        url: this.normalizarImagenProducto(typeof media === 'string' ? media : media?.url)
      }))
    };
  }

  // Lógica robusta de logo de marca (igual que producto-item)
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();

  getMarcaNombre(producto: any): string {
    const marca = producto?.marcaObj ?? producto?.marca ?? null;
    if (!marca) {
      return String(producto?.marcanombre ?? producto?.marca_nombre ?? '').trim();
    }
    if (typeof marca === 'string') return marca.trim();
    return String(marca?.nombre ?? marca?.denominacion ?? '').trim();
  }

  slugify(texto: unknown): string {
    const valor = String(texto || '').trim().toLowerCase();
    return valor
      .normalize('NFD')
      .replace(/[ --\u009F]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
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
    const entidad = producto?.marca ?? producto?.marcaObj ?? {};
    const marcaNombre = this.getMarcaNombre(producto);
    const slug = this.slugify(marcaNombre);

    const idRaw = entidad?.id ?? producto?.marcaId ?? producto?.marca_id ?? producto?.idMarca ?? producto?.id_marca;
    const idNumero = Number(idRaw);
    const id5 = Number.isFinite(idNumero) && idNumero > 0 ? String(Math.trunc(idNumero)).padStart(5, '0') : '';

    const codigoRaw = entidad?.codigo ?? entidad?.code ?? producto?.marcaCodigo ?? producto?.marca_codigo;
    const codigo = String(codigoRaw ?? '').trim();

    const candidatos = new Set<string>();

    const logoDirecto = String(
      entidad?.logo ??
      entidad?.logoUrl ??
      entidad?.imagen ??
      producto?.logoMarca ??
      producto?.logo_marca ??
      ''
    ).trim();

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

  private getMarcaLogoKey(producto: any): string {
    const marca = producto?.marca ?? producto?.marcaObj ?? {};
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

    const nombre = this.getMarcaNombre(producto);
    if (nombre) return `nombre:${nombre.toLowerCase()}`;

    return '';
  }
}
