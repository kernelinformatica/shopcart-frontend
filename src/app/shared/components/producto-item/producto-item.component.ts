  

 
   
  
  // ...existing code...
  /** Si es true, muestra el corazón roto para quitar de favoritos */
 
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { productoTieneImpuestos, resolveMarcaLogo, extractMarcaLogoValue } from '../../utils/producto.utils';
import { CommonModule } from '@angular/common'; 
import {PermisosService} from '../../../permisos.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-producto-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './producto-item.component.html',
  styleUrls: ['./producto-item.component.scss']
})

export class ProductoItemComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  esAdmin = "";

  get puedeEditarArticulos(): boolean {
    return this.permisosService.tienePermiso('articulos') && this.permisosService.tienePermiso('articulos_editar');
  }
 

    // Nuevo: Detecta si alguna promo tiene acción de cuotas
    tieneCuotasSinInteres(): boolean {
      return Array.isArray(this.producto?.promociones) && this.producto.promociones.some((p: any) =>
        Array.isArray(p.acciones) && p.acciones.some((a: any) => a.tipoAccion === 'cuotas')
      );
    }

    // Nuevo: Devuelve la cantidad de cuotas (si hay)
    getCuotasPromocion(): number | null {
      if (!Array.isArray(this.producto?.promociones)) return null;
      for (const promo of this.producto.promociones) {
        if (Array.isArray(promo.acciones)) {
          const accion = promo.acciones.find((a: any) => a.tipoAccion === 'cuotas') ||  promo.acciones.find((a: any) => a.tipoAccion === 'cuotas_sin_interes')  ;
          if (accion && accion.valor) return accion.valor;
        }
      }
      return null;
    }
  /** Detecta y devuelve la promo x_por_y (3x2, 2x1, etc) si existe, por tipoAccion o alias */
  getPromoXPorY(): {valor: number, valorExtra: number, detalle: string} | null {
    if (!this.producto || !Array.isArray(this.producto.promociones)) return null;
    for (const promo of this.producto.promociones) {
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
    // Nuevo: Devuelve bancos asociados a la promo (si hay)
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

    // Nuevo: Devuelve tarjetas asociadas a la promo (si hay)
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
  @Input() ratingGlobal: number | null = null;
  @Input() producto: any;
  @Input() favoritos: Record<number, boolean> = {};
  @Input() ratings: Record<number, number> = {};
  @Output() cardClick = new EventEmitter<any>();
  @Output() toggleFavorito = new EventEmitter<{ event: Event, producto: any }>();
  @Output() agregarCarrito = new EventEmitter<any>();
  @Output() setRating = new EventEmitter<{producto: any, rating: number, event: Event}>();
  @Input() modoDesvincularFavorito = false;
  constructor(
    private router: Router,
    private permisosService: PermisosService
  ) {}
  tieneImagenProducto(producto: any): boolean {
    return !!(producto?.imagen || producto?.imagenUrl);
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

    /** Devuelve promociones distintas a cuotas sin interés */
get otrasPromociones(): any[] {
      return Array.isArray(this.producto?.promociones)
        ? this.producto.promociones.filter((p: any) => p.promocionTipo?.alias !== 'cuotas')
        : [];
    }

  get productosRelacionados(): any[] {
    const relacionados = this.producto?.productosRelacionados ?? this.producto?.productos_relacionados ?? [];
    if (!Array.isArray(relacionados)) return [];
    return relacionados.filter((rel: any) => !!rel);
  }


     /** Devuelve el texto para el tooltip de la promo */
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
      return detalle.trim() || (promo.nombre || 'Promoción');
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

verProducto(producto: any, event?: Event) {
  if (event) event.stopPropagation();
  if (!producto || !producto.nombre) return;
  const marca = producto.marca?.nombre || producto.marca || '';
  const slug = this.getSlug(producto.nombre, marca);
  this.router.navigate(['/productos', slug]);
}

  editarArticulo(producto: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!this.puedeEditarArticulos || !producto?.id) {
      return;
    }
    this.router.navigate(['/dashboard']);
  }
  getStockLabel(producto: any): string {
    const stock = producto?.stock;
    if (stock === null || stock === undefined || stock === '') {
      return 'Sin dato';
    }
    return String(stock);
  }

  private puedeAgregarAlCarrito(producto: any): boolean {
    return !this.esStockAgotado(producto?.stock);
  }
  getProductoImagen(producto: any): string {
    const imagenDirecta =
      producto?.imagen ||
      producto?.imagenUrl ||
      producto?.imagenPrincipal ||
      producto?.productoMedia?.find((media: any) => media?.url)?.url ||
      producto?.imagenes?.find((media: any) => (typeof media === 'string' ? media : media?.url));

    return typeof imagenDirecta === 'string' && imagenDirecta.trim()
      ? imagenDirecta
      : 'assets/bg/no-image.png';
  }
  getMarcaNombre(producto: any): string {
    const marca = producto?.marcaObj ?? producto?.marca ?? null;
    if (!marca) {
      return String(producto?.marcanombre ?? producto?.marca_nombre ?? '').trim();
    }
    if (typeof marca === 'string') return marca.trim();
    return String(marca?.nombre ?? marca?.denominacion ?? '').trim();
  }
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();

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

    const logoDirecto = resolveMarcaLogo(entidad);

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
    const logoRaw = extractMarcaLogoValue(marca);
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

  private slugify(texto: unknown): string {
    const valor = String(texto || '').trim().toLowerCase();
    if (!valor) return '';

    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  onCardClick(event: Event, producto: any) {
    event.stopPropagation();
    this.cardClick.emit(producto);
  }
  onToggleFavorito(event: Event, producto: any) {
    event.stopPropagation();
    this.toggleFavorito.emit({ event, producto });
  }
  onAgregarCarrito(event: Event, producto: any) {
    event.stopPropagation();
    if (!this.puedeAgregarAlCarrito(producto)) {
      return;
    }
    // Enviar el objeto producto completo y fiel al backend, sin sobrescribir ni recortar campos
    this.agregarCarrito.emit({ ...producto, cantidad: 1 });
  }
  onSetRating(producto: any, star: number, event: Event) {
    event.stopPropagation();
    // Pintar inmediatamente las estrellas según la selección del usuario
    if (producto && producto.rating) {
      producto.rating.usuario = star;
    } else if (producto) {
      producto.rating = { usuario: star };
    }
    this.setRating.emit({producto, rating: star, event});
  }

  trackByRelacionado(_index: number, item: any): string | number {
    return item?.id ?? item?.productoId ?? item?.relacionadoId ?? _index;
  }

  onRelacionadoClick(productoRelacionado: any, event: Event): void {
    event.stopPropagation();
    if (!productoRelacionado?.nombre) {
      return;
    }

    const marca = productoRelacionado?.marca?.nombre || productoRelacionado?.marca || '';
    const slugBase = productoRelacionado?.slug || this.getSlug(productoRelacionado.nombre, marca);
    const slug = String(slugBase || '').trim();

    if (!slug) {
      return;
    }

    this.router.navigate(['/productos', slug]);
  }

  onProductoImageError(producto: any, event: Event) {
    // Opcional: lógica para fallback de imagen
    (event.target as HTMLImageElement).src = 'assets/bg/no-image.png';
  }
}
