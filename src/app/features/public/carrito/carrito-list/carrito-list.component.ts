import { Component, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../../../api.service';
import { Carrito, CarritoItem, Producto, Promocion } from '../../../../models';

@Component({
  selector: 'app-carrito-list',
  imports: [DecimalPipe],
  templateUrl: './carrito-list.component.html',
  styleUrl: './carrito-list.component.scss'
})
export class CarritoListComponent implements OnInit {
  
    /** Detecta y devuelve la promo x_por_y (3x2, 2x1, etc) si existe, por tipoAccion o alias */
    getPromoXPorY(producto: Producto): {valor: number, valorExtra: number, detalle: string} | null {
      if (!producto || !Array.isArray(producto.promociones)) return null;
      for (const promo of producto.promociones) {
        // Caso 1: Buscar acción tipo x_por_y o promo_cantidad
        if (promo && Array.isArray(promo.acciones)) {
          const accion = promo.acciones.find((a: any) => a.tipoAccion === 'x_por_y' || a.tipoAccion === 'promo_cantidad');
          if (accion && (accion['valor'] || promo['valor']) && (accion['valorExtra'] || accion['valorExtra'] === 0 || promo['valorExtra'] || promo['valorExtra'] === 0)) {
            const valor = Number(accion['valor'] ?? promo['valor']);
            const valorExtra = Number(accion['valorExtra'] ?? promo['valorExtra']);
            return {
              valor,
              valorExtra,
              detalle: accion.detalle || promo.descripcion || `Llevá ${valor}, pagá ${valorExtra}`
            };
          }
        }
        // Caso 2: Si el alias de la promo es x_por_y, aunque no haya acción
        if (promo?.['promocionTipo']?.alias === 'x_por_y' && (promo['valor'] || promo['valorExtra'])) {
          const valor = Number(promo['valor']);
          const valorExtra = Number(promo['valorExtra']);
          return {
            valor,
            valorExtra,
            detalle: promo.descripcion || `Llevá ${valor}, pagá ${valorExtra}`
          };
        }
      }
      return null;
    }

    /** Devuelve el precio unitario a mostrar en el carrito, considerando cantidad y promo x_por_y */
    getPrecioVisual(item: CarritoItem): number {
      const producto = item.producto;
      const promoXPorY = this.getPromoXPorY(producto);
      if (promoXPorY && producto.precioDescuento != null) {
        // Solo aplicar precio con descuento si la cantidad alcanza la promo
        if (item.cantidad >= promoXPorY.valor) {
          return producto.precioDescuento;
        } else {
          return producto.precio ?? producto.precioLista ?? 0;
        }
      }
      // Si hay promo con descuento (no x_por_y), mostrar precioDescuento
      if (producto.promocionAplicada && producto.precioDescuento != null) {
        return producto.precioDescuento;
      }
      // Si no, mostrar precio normal
      if (producto.precio != null) {
        return producto.precio;
      }
      if (producto.precioLista != null) {
        return producto.precioLista;
      }
      return 0;
    }

    /** Devuelve el subtotal correcto para el item, considerando promo x_por_y */
    getSubtotal(item: CarritoItem): number {
      const producto = item.producto;
      const promoXPorY = this.getPromoXPorY(producto);
      if (promoXPorY && producto.precioDescuento != null && item.cantidad >= promoXPorY.valor) {
        // Calcular packs y resto
        const packs = Math.floor(item.cantidad / promoXPorY.valor);
        const resto = item.cantidad % promoXPorY.valor;
        // Cada pack paga solo valorExtra unidades
        return (packs * promoXPorY['valorExtra'] * producto.precioDescuento) + (resto * (producto.precio ?? producto.precioLista ?? producto.precioDescuento));
      }
      // Si hay promo con descuento (no x_por_y)
      if (producto.promocionAplicada && producto.precioDescuento != null) {
        return item.cantidad * producto.precioDescuento;
      }
      // Si no, precio normal
      return item.cantidad * (producto.precio ?? producto.precioLista ?? 0);
    }
  carrito: Carrito | null = null;
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarCarrito();
  }

  cargarCarrito() {
    
    this.loading = true;
    this.api.getCarrito().subscribe({
      next: (carrito) => {
        this.carrito = carrito;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo cargar el carrito';
        this.loading = false;
      }
    });
  }

  aumentar(item: CarritoItem) {
    if (!this.carrito) return;
    item.cantidad++;
    this.actualizarCarrito();
  }

  disminuir(item: CarritoItem) {
    if (!this.carrito) return;
    if (item.cantidad > 1) {
      item.cantidad--;
      this.actualizarCarrito();
    }
  }

  eliminar(item: CarritoItem) {
    
    if (!this.carrito) return;
    this.carrito.items = this.carrito.items.filter(i => i !== item);
    this.actualizarCarrito();
  }

  actualizarCarrito() {
    if (!this.carrito) return;
    this.loading = true;
    this.api.updateCarrito(this.carrito).subscribe({
      next: (carrito) => {
        this.carrito = carrito;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo actualizar el carrito';
        this.loading = false;
      }
    });
  }
}
