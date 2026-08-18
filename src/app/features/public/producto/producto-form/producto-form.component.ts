import { Component } from '@angular/core';
import { ApiService } from '../../../../api.service';
import { productoForm } from '../../../../forms';
import { Producto } from '../../../../models';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-producto-form',
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './producto-form.component.html',
  styleUrl: './producto-form.component.scss'
})
export class ProductoFormComponent {
  form = productoForm();
  loading = false;
  error = '';

  constructor(private api: ApiService) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const raw = this.form.value;
      const producto: Producto = {
      id: 0,
      nombre: raw.nombre ?? '',
      descripcion: raw.descripcion ?? '',
      precio: Number(raw.precio ?? 0),
      stock: Number(raw.stock ?? 0),
      mejorPrecioPromoCalculado: 0,
      estado: true,
      promociones: []
    };
    this.api.createProducto(producto).subscribe({
      next: () => {
        this.form.reset();
        this.loading = false;
        this.error = '';
      },
      error: err => {
        this.error = 'Error al guardar producto';
        this.loading = false;
      }
    });
  }
}
