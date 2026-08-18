import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-favorito-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './favorito-item.component.html',
  styleUrls: ['./favorito-item.component.scss']
})
export class FavoritoItemComponent {
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
    this.agregarCarrito.emit(producto);
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
    if (producto?.precio_lista != null) return producto.precio_lista;
    if (producto?.precioLista != null) return producto.precioLista;
    if (producto?.precio != null) return producto.precio;
    return null;
  }
}
