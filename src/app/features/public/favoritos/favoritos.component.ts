

import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { Component, Inject, OnInit } from '@angular/core';
import { SocketService } from '../../../socket.service';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../api.service';
import { CarritoService } from '../../../carrito.service';
import { ProductoDetalleModalComponent } from '../../../shared/components/producto-detalle-modal/producto-detalle-modal.component';
import { FavoritoItemComponent } from '../../../shared/components/favorito-item/favorito-item.component';
import { resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';

@Component({
  selector: 'app-favoritos',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductoDetalleModalComponent, FavoritoItemComponent],
  templateUrl: './favoritos.component.html',
  styleUrls: ['./favoritos.component.scss']
})

export class FavoritosComponent implements OnInit {
  loading = true;
  error = '';
  favoritos: any[] = [];

    ratings: any = {};
    ratingsGlobal: any = {};


  selectedProducto: any = null;
  cantidadAgregar = 1;
  selectedImagenModal = '';
  productosRelacionadosModal: any[] = [];
  errorCarrito = '';
 
  constructor(
    private apiService: ApiService,
    private carritoService: CarritoService,
    @Inject(SocketService) private socketService: SocketService
  ) {
    this.socketService.onRatingUpdated().subscribe(({ productoId, global }: { productoId: number, global: number }) => {
      for (const fav of this.favoritos) {
        if (fav.producto?.id === productoId) {
          if (!fav.producto.rating) fav.producto.rating = {};
          fav.producto.rating.global = global;
        }
      }
    });
  }

    // ratings y ratingsGlobal ahora se obtienen directamente del modelo de producto

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
            global: data.ratingGlobal ?? producto.rating?.global ?? null
          };
          // Actualizar ratingsGlobal para el producto
          if (producto.id) {
            this.ratingsGlobal[producto.id] = producto.rating.global;
          }
        }
      } catch (e) {
        // Manejo de error opcional
      }
    }

  abrirDetalleProducto(producto: any, event?: Event): void {
    event?.stopPropagation();
    this.selectedProducto = { ...producto };
    this.selectedImagenModal = String(this.selectedProducto?.imagen ?? this.selectedProducto?.imagenUrl ?? '').trim();
    this.productosRelacionadosModal = Array.isArray(this.selectedProducto?.productos_relacionados)
      ? this.selectedProducto.productos_relacionados : [];
    this.cantidadAgregar = 1;
    this.errorCarrito = '';
    setTimeout(() => {
      const modal = document.getElementById('detalleProductoModal');
      if (modal) {
        // @ts-ignore
        window.bootstrap?.Modal?.getOrCreateInstance(modal)?.show();
      }
    }, 0);
  }

  cerrarDetalleProducto(): void {
    this.selectedProducto = null;
    this.selectedImagenModal = '';
    this.productosRelacionadosModal = [];
    this.cantidadAgregar = 1;
    this.errorCarrito = '';
  }
  quitarFavorito(favorito: any, event?: Event): void {
    event?.stopPropagation();
    const productoId = Number(favorito?.producto?.id);
    if (!Number.isFinite(productoId) || productoId <= 0) return;

    this.apiService.eliminarFavorito({ productoId: productoId }).pipe(
      catchError(() => of(null))
    ).subscribe((res: any) => {
      if (res === null) return;
      if (this.favoritos) {
        this.favoritos = this.favoritos.filter((item: any) => Number(item?.producto?.id) !== productoId);
      }
      if (this.apiService) {
        this.apiService.notificarFavoritosActualizados();
      }
      
    });
  }

  agregarAlCarritoDesdeModal(): void {
    if (this.selectedProducto && this.cantidadAgregar > 0) {
      const productoParaCarrito = { ...this.selectedProducto };
      const precioVisual = this.calcularPrecioVisual(productoParaCarrito);
      if (precioVisual != null) {
        productoParaCarrito.precio = precioVisual;
      }
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

  seleccionarImagenModal(url: string): void {
    this.selectedImagenModal = url;
  }

  agregarRelacionadoDesdeModal(payload: { producto: any; cantidad: number }): void {
    const productoRelacionado = payload?.producto;
    if (!productoRelacionado) return;
    const cantidad = Math.max(1, Number(payload?.cantidad) || 1);

    const productoParaCarrito = { ...productoRelacionado };
    const precioVisual = this.calcularPrecioVisual(productoParaCarrito);
    if (precioVisual != null) {
      productoParaCarrito.precio = precioVisual;
    }

    this.carritoService.agregar(productoParaCarrito, cantidad);
  }

  getGaleriaModal(producto: any): Array<{ url: string }> {
    const galeriaBase = Array.isArray(producto?.imagenes)
      ? producto.imagenes
          .map((img: any) => ({ url: resolveBackendMediaUrl(img?.url ?? img) }))
          .filter((img: any) => !!img.url)
      : [];
    const imagenPrincipal = resolveBackendMediaUrl(producto?.imagen ?? producto?.imagenUrl ?? '');
    if (galeriaBase.length > 0) {
      return galeriaBase;
    } else if (imagenPrincipal) {
      return [{ url: imagenPrincipal }];
    } else {
      return [];
    }
  }

  ngOnInit(): void {
    this.cargarFavoritos();
  }


  cargarFavoritos(): void {
    this.loading = true;
    this.error = '';

    this.apiService.getFavoritos().pipe(
      catchError(() => {
        this.error = 'No se pudieron cargar los favoritos.';
        this.loading = false;
        return of([] as any[]);
      })
    ).subscribe(async (response: any) => {
      const lista = Array.isArray(response) ? response : [];
      // Clonar producto y asegurar precio_lista como número
      this.favoritos = lista
        .filter(fav => fav?.producto && fav.producto.id)
        .map(fav => {
          const producto = { ...fav.producto };
          // Normalizar precio_lista
          if (producto.precio_lista == null && producto.precioLista != null) {
            producto.precio_lista = Number(producto.precioLista);
          } else if (producto.precio_lista != null) {
            producto.precio_lista = Number(producto.precio_lista);
          }
          return { ...fav, producto };
        });
      // Inicializar ratingsGlobal para cada producto favorito
      this.ratingsGlobal = {};
      for (const fav of this.favoritos) {
        const id = fav.producto.id;
        this.ratingsGlobal[id] = fav.producto.rating?.global ?? null;
      }
      this.loading = false;
    });
  }

  private calcularPrecioVisual(producto: any): number | null {
    if (!producto) return null;

    const precioLista = producto?.precioLista ?? producto?.precio_lista ?? null;
    const tienePrecioBase = producto?.precio != null || precioLista != null;
    const precioBase = producto?.precio ?? precioLista;

    if (
      producto?.promocionAplicada &&
      producto?.precioDescuento != null &&
      tienePrecioBase &&
      precioBase != null &&
      producto.precioDescuento < precioBase
    ) {
      return producto.precioDescuento;
    }

    if (
      producto?.mejorPrecioPromoCalculado !== undefined &&
      producto?.mejorPrecioPromoCalculado !== null &&
      tienePrecioBase &&
      precioBase != null &&
      producto.mejorPrecioPromoCalculado < precioBase
    ) {
      return producto.mejorPrecioPromoCalculado;
    }

    if (producto?.precio != null) {
      return producto.precio;
    }

    if (precioLista != null) {
      return precioLista;
    }

    return null;
  }
}
