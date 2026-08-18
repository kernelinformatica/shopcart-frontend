  import { productoTieneImpuestos } from '../../utils/producto.utils';
  

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Producto } from '../../../models';
import { Router } from '@angular/router';

@Component({
  selector: 'app-producto-item-mini',
  templateUrl: './producto-item-mini.component.html',
  styleUrls: ['./producto-item-mini.component.scss'],
  standalone: true,
  imports: [DecimalPipe, CommonModule]
})

export class ProductoItemMiniComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  @Input() producto!: Producto;
  @Input() favoritos: Record<number, boolean> = {};
  @Input() ratingsGlobal: Record<number, number> = {};
  @Input() ratings: Record<number, number> = {};
  @Input() setRating?: (args: { producto: Producto, rating: number, event: Event }) => void;
  @Output() agregar = new EventEmitter<Producto>();
  @Output() toggleFavorito = new EventEmitter<{ event: Event, producto: Producto }>();
  constructor(private router: Router) {}

  onAgregar() {
    this.agregar.emit(this.producto);
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

  // Para mostrar estrellas de ranking global
  get rankingArray(): number[] {
    return [1, 2, 3, 4, 5];
  }

  getSlug(nombre: string, marca?: string): string {
    let base = nombre;
    if (marca) base += '-' + marca;
    return base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  verProducto(producto: Producto, event?: Event) {
    if (event) event.stopPropagation();
    if (!producto || !producto.nombre) return;
    const marca = (producto as any).marca?.nombre || (producto as any).marca || '';
    const slug = this.getSlug(producto.nombre, marca);
    this.router.navigate(['/productos', slug]);
  }

  get tienePromoXPorY(): boolean {
    if (!this.producto || !Array.isArray(this.producto.promociones)) return false;
    return this.producto.promociones.some(
      p => (p['tipo'] === 'x_por_y' || (p as any).promocionTipo?.alias === 'x_por_y')
    );
  }
  onSetRatingMini(star: number, event: Event) {
    event.stopPropagation();
    if (this.setRating) {
      this.setRating({ producto: this.producto, rating: star, event });
    }
  }
  get promoXPorYDescripcion(): string | undefined {
    if (!this.producto || !Array.isArray(this.producto.promociones)) return undefined;
    const desc = this.producto.promociones.find(
      p => (p.nombre === 'x_por_y' || (p as any).promocionTipo?.alias === 'x_por_y')
    )?.descripcion;
    return desc ?? undefined;
  }


  // --- Marca: lógica igual que en producto-item grande ---
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
    // Devuelve el rating del usuario para el producto (igual que la vista grande)
    getUserRating(producto: Producto): number {
      return this.ratings?.[producto.id] ?? (producto as any)?.rating?.usuario ?? 0;
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
    const slug = (marcaNombre || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');

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
      marca?.imagen ??
      producto?.logoMarca ??
      producto?.logo_marca ??
      ''
    ).trim();
    const nombre = this.getMarcaNombre(producto);
    return `${nombre}|${logoRaw}`;
  }
/**
   * Devuelve el precio visual a mostrar en la vista mini, igual que la lógica de la vista grande
   */
  getPrecioVisualMini(producto: Producto): number | null {
    if (!producto) return null;
    if (typeof producto.precioDescuento === 'number' && producto.precioDescuento > 0) {
      return producto.precioDescuento;
    }
    if (typeof producto.precio === 'number' && producto.precio > 0) {
      return producto.precio;
    }
    if (typeof (producto as any).precioLista === 'number' && (producto as any).precioLista > 0) {
      return (producto as any).precioLista;
    }
    if (typeof (producto as any).precioFinal === 'number' && (producto as any).precioFinal > 0) {
      return (producto as any).precioFinal;
    }
    return null;
  }

}
