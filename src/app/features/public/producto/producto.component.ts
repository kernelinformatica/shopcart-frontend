import { Component } from '@angular/core';
import { ProductoVistaComponent } from './producto-vista.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-producto',
  standalone: true,
  imports: [],
  templateUrl: './producto.component.html',
  styleUrl: './producto.component.scss'
})
export class ProductoComponent {
  producto = {
    imagenPrincipal: 'https://http2.mlstatic.com/D_NQ_NP_2X_825032-MLA53151118_022023-F.webp',
    imagenesRelacionadas: [
      'https://http2.mlstatic.com/D_NQ_NP_2X_825032-MLA53151118_022023-F.webp',
      'https://http2.mlstatic.com/D_NQ_NP_2X_825032-MLA53151118_022023-F.webp',
      'https://http2.mlstatic.com/D_NQ_NP_2X_825032-MLA53151118_022023-F.webp'
    ]
  };

  constructor(private router: Router) {}

  irAVistaProducto() {
    this.router.navigate(['/producto/vista'], {
      state: { producto: this.producto }
    });
  }

}
