  
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { productoTieneImpuestos } from '../../utils/producto.utils';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-favorito-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './favorito-item.component.html',
  styleUrls: ['./favorito-item.component.scss']
})
export class FavoritoItemComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  @Input() producto: any;
  @Input() ratingGlobal: number | null = null;
  @Input() ratings: Record<number, number> = {};
  @Output() setRating = new EventEmitter<{producto: any, rating: number, event: Event}>();
  @Output() toggleFavorito = new EventEmitter<{ event: Event, producto: any }>();
  @Output() cardClick = new EventEmitter<any>();
  @Output() agregarCarrito = new EventEmitter<any>();

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
    const precioLista = producto?.precioLista ?? producto?.precio_lista ?? null;
    const tienePrecioBase = producto?.precio != null || precioLista != null;
    const precioBase = producto?.precio ?? precioLista;
    let precioVisual = producto?.precio ?? precioLista;

    // Si hay promociones, usar el mismo criterio que la UI
    if (
      producto?.promocionAplicada &&
      producto?.precioDescuento != null &&
      tienePrecioBase &&
      producto.precioDescuento < precioBase
    ) {
      precioVisual = producto.precioDescuento;
    } else if (
      producto?.mejorPrecioPromoCalculado !== undefined &&
      producto?.mejorPrecioPromoCalculado !== null &&
      tienePrecioBase &&
      producto.mejorPrecioPromoCalculado < precioBase
    ) {
      precioVisual = producto.mejorPrecioPromoCalculado;
    } else if (producto?.precio != null) {
      precioVisual = producto.precio;
    } else if (precioLista != null) {
      precioVisual = precioLista;
    }
    const productoCarrito = { ...producto, precio: precioVisual };
    this.agregarCarrito.emit(productoCarrito);
  }
  
  onSetRating(producto: any, star: number, event: Event) {
    event.stopPropagation();
    if (producto && producto.rating) {
      producto.rating.usuario = star;
    } else if (producto) {
      producto.rating = { usuario: star };
    }
    this.setRating.emit({producto, rating: star, event});
  }

  getPrecioFavorito(producto: any): number | null {
    if (producto?.precio != null) return producto.precio;
    if (producto?.precioLista != null) return producto.precioLista;
    return null;
  }

  tieneImagenProducto(producto: any): boolean {
    return !!(producto?.imagen || producto?.imagenUrl);
  }
  getProductoImagen(producto: any): string {
    return producto?.imagen || producto?.imagenUrl || 'assets/bg/no-image.png';
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

    const logoDirecto = String(
      entidad?.logo ??
      entidad?.logoUrl ??
      entidad?.imagen ??
      producto?.logoMarca ??
      producto?.logo_marca ??
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

  onProductoImageError(producto: any, event: Event) {
    (event.target as HTMLImageElement).src = 'assets/bg/no-image.png';
  }
}
