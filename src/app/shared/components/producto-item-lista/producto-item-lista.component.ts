
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Producto } from '../../../models';
import { Router } from '@angular/router';
import { productoTieneImpuestos } from '../../utils/producto.utils';

@Component({
  selector: 'app-producto-item-lista',
  templateUrl: './producto-item-lista.component.html',
  styleUrls: ['./producto-item-lista.component.scss'],
  standalone: true,
  imports: [DecimalPipe, CommonModule]
})
export class ProductoItemListaComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  @Input() producto!: Producto;
  @Input() modo: 'grande' | 'compacta' | 'lista' = 'grande';
  @Output() agregar = new EventEmitter<Producto>();
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
    if (!producto) return;
    // Usar el slug del backend si está presente
    const slug = (producto as any).slug || this.getSlug(producto.nombre, (producto as any).marca?.nombre || (producto as any).marca || '');
    this.router.navigate(['/productos', slug]);
  }
   

}
