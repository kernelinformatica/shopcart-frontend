import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-producto-detalle-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producto-detalle-modal.component.html',
  styleUrls: ['./producto-detalle-modal.component.scss']
})
export class ProductoDetalleModalComponent {
  @Input() selectedProducto: any = null;
  @Input() mainImageUrl: string = '';
  @Input() galeriaModal: Array<{ url: string }> = [];
  @Input() productosRelacionados: any[] = [];
  @Input() cantidadAgregar = 1;
  @Input() errorCarrito = '';

  @Output() cantidadAgregarChange = new EventEmitter<number>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() agregarPrincipal = new EventEmitter<void>();
  @Output() seleccionarImagen = new EventEmitter<string>();
  @Output() seleccionarRelacionado = new EventEmitter<any>();
  @Output() agregarRelacionado = new EventEmitter<{ producto: any; cantidad: number }>();

  private cantidadesRelacionados: Record<string, number> = {};
  private logosMarcaConError = new Set<string>();
  private logoMarcaIntento = new Map<string, number>();
img: any;

  // --- PROMO HELPERS (copied/adapted from producto-item) ---
  /** Devuelve el descuento aplicado (si hay), buscando acción o campos directos */
  getDescuentoPromocion(): number | null {
    const producto = this.selectedProducto;
    if (!Array.isArray(producto?.promociones)) return null;
    for (const promo of producto.promociones) {
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

  getPrecioConDescuento(): number {
    const producto = this.selectedProducto;
    const precioBase = producto?.precio ?? producto?.precioLista ?? 0;
    const descuento = this.getDescuentoPromocion() ?? 0;
    if (descuento > 0) {
      return Math.round((precioBase * (1 - descuento / 100)) * 100) / 100;
    }
    return precioBase;
  }

  getCuotasPromocion(): number | null {
    const producto = this.selectedProducto;
    if (!Array.isArray(producto?.promociones)) return null;
    for (const promo of producto.promociones) {
      if (Array.isArray(promo.acciones)) {
        const accion = promo.acciones.find((a: any) => a.tipoAccion === 'cuotas') ||  promo.acciones.find((a: any) => a.tipoAccion === 'cuotas_sin_interes');
        if (accion && accion.valor) return accion.valor;
      }
    }
    return null;
  }

  getBancosPromocion(): string[] {
    const producto = this.selectedProducto;
    const bancos: string[] = [];
    if (!Array.isArray(producto?.promociones)) return bancos;
    for (const promo of producto.promociones) {
      if (Array.isArray(promo.condiciones)) {
        promo.condiciones.forEach((c: any) => {
          if (c.tipoCondicion === 'banco' && c.valor) bancos.push(c.valor);
        });
      }
    }
    return bancos;
  }

  getTarjetasPromocion(): string[] {
    const producto = this.selectedProducto;
    const tarjetas: string[] = [];
    if (!Array.isArray(producto?.promociones)) return tarjetas;
    for (const promo of producto.promociones) {
      if (Array.isArray(promo.condiciones)) {
        promo.condiciones.forEach((c: any) => {
          if (c.tipoCondicion === 'tarjeta' && c.valor) tarjetas.push(c.valor);
        });
      }
    }
    return tarjetas;
  }

  /** Devuelve promociones distintas a cuotas sin interés */
  get otrasPromociones(): any[] {
    const producto = this.selectedProducto;
    return Array.isArray(producto?.promociones)
      ? producto.promociones.filter((p: any) => p.promocionTipo?.alias !== 'cuotas')
      : [];
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

  getImagenPrincipal(): string {
    const src = String(this.mainImageUrl ?? '').trim();
    return src || 'https://via.placeholder.com/300x300?text=Producto';
  }

  onCantidadPrincipalChange(valor: number): void {
    const normalizada = Math.max(1, Number(valor) || 1);
    this.cantidadAgregar = normalizada;
    this.cantidadAgregarChange.emit(normalizada);
  }

  getMarcaNombre(producto: any): string {
    const marca = producto?.marcaObj ?? producto?.marca ?? null;
    if (!marca) {
      return String(producto?.marcanombre ?? producto?.marca_nombre ?? '').trim();
    }
    if (typeof marca === 'string') return marca.trim();
    return String(marca?.nombre ?? marca?.denominacion ?? '').trim();
  }

  getMarcaLogoPath(producto: any): string {
    const key = this.getMarcaLogoKey(producto);
    if (!key || this.logosMarcaConError.has(key)) return '';

    const candidatos = this.getMarcaLogoCandidates(producto);
    if (!candidatos.length) return '';

    const indice = this.logoMarcaIntento.get(key) ?? 0;
    return candidatos[indice] ?? candidatos[0];
  }
   /**
   * Devuelve la promoción aplicada al precio visual del producto relacionado, si corresponde.
   */
  getPromoAplicada(producto: any): any | null {
    const precioVisual = this.getPrecioVisualProducto(producto);
    if (!producto?.promociones?.length) return null;
    // Buscar la promo cuyo precio_descuento sea igual al precio visual
    return producto.promociones.find((promo: any) => Number(promo?.precio_descuento) === precioVisual) || null;
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

  getMejorPrecioPromo(producto: any): number | null {
    if (!producto || !Array.isArray(producto.promociones) || !producto.promociones.length) return null;
    let mejor: number | null = null;
    for (const promo of producto.promociones) {
      const precio = Number(promo?.precio_descuento);
      if (!Number.isFinite(precio)) continue;
      if (mejor === null || precio < mejor) mejor = precio;
    }
    return mejor;
  }

  getPrecioVisualProducto(producto: any): number {
    
    const precioFinal = Number(producto?.precioFinal ?? producto?.precio ?? 0);
    const mejorPromo = this.getMejorPrecioPromo(producto);
    if (mejorPromo !== null && mejorPromo < precioFinal) {
      return mejorPromo;
    }
    return precioFinal;
  }

  onSeleccionarImagen(url: string): void {
    const normalizada = String(url ?? '').trim();
    if (!normalizada) return;
    this.seleccionarImagen.emit(normalizada);
  }

  onSeleccionarRelacionado(producto: any, event?: Event): void {
    event?.stopPropagation();
    if (!producto) return;
    
    this.seleccionarRelacionado.emit(producto);
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

  onAgregarRelacionado(producto: any, event?: Event): void {
    alert('Producto agregado al carrito con éxito');
    event?.stopPropagation();
    if (!producto) return;
    this.agregarRelacionado.emit({
      producto,
      cantidad: this.getCantidadRelacionado(producto)
    });
  }

  onAgregarPrincipal(): void {
    this.agregarPrincipal.emit();
  }

  onCerrar(): void {
    this.cerrar.emit();
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

  // --- X_POR_Y PROMO DETECTION ---
  getPromoXPorY(): {valor: number, valorExtra: number, detalle: string} | null {
    const producto = this.selectedProducto;
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
}
