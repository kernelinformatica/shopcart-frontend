import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ApiAdminService } from '../../../api-admin.service';
import { Producto } from '../../../models';

@Component({
  selector: 'app-articulos-manual',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
<section class="container py-3 articulos-manual">
  <div class="card shadow-sm">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <p class="eyebrow mb-1">Administración de artículos</p>
        <h4 class="mb-0">{{ editandoId ? 'Editar artículo' : 'Carga manual de artículo' }}</h4>
      </div>
      <div class="d-flex gap-2">
        <a class="btn btn-outline-secondary" routerLink="/admin/articulos">Volver al listado</a>
        <button class="btn btn-outline-primary" type="button" (click)="limpiar()">Limpiar</button>
      </div>
    </div>
    <div class="card-body">
      <div *ngIf="cargando" class="text-muted py-3">Cargando formulario...</div>
      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
      <div *ngIf="mensaje" class="alert alert-success">{{ mensaje }}</div>

      <form [formGroup]="formulario" (ngSubmit)="guardar()" class="row g-3" *ngIf="!cargando">
        <div class="col-12 col-md-6">
          <label class="form-label">Nombre</label>
          <input class="form-control" formControlName="nombre" />
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Marca</label>
          <input class="form-control" formControlName="marca" />
        </div>
        <div class="col-12">
          <label class="form-label">Descripción</label>
          <textarea class="form-control" rows="4" formControlName="descripcion"></textarea>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Código de barra</label>
          <input class="form-control" formControlName="codigoBarra" />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Código interno</label>
          <input class="form-control" formControlName="codigoInterno" />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Stock</label>
          <input type="number" class="form-control" formControlName="stock" />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Categoría</label>
          <select class="form-select" formControlName="categoriaId">
            <option [ngValue]="null">Sin categoría</option>
            <option *ngFor="let categoria of categorias" [ngValue]="categoria.id">{{ categoria.nombre }}</option>
          </select>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Lista de precios</label>
          <input type="number" class="form-control" formControlName="listaPrecioId" placeholder="ID de lista" />
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Precio</label>
          <input type="number" class="form-control" formControlName="precio" />
        </div>
        <div class="col-12 d-flex justify-content-end gap-2 pt-2">
          <button class="btn btn-outline-secondary" type="button" (click)="cancelar()">Cancelar</button>

        
          <button class="btn btn-primary" type="submit" [disabled]="guardando">
            {{ guardando ? 'Guardando...' : (editandoId ? 'Actualizar artículo' : 'Guardar artículo') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</section>
  `,
  styles: [
    `
.articulos-manual .eyebrow {
	text-transform: uppercase;
	letter-spacing: 0.14em;
	font-size: 0.72rem;
	font-weight: 700;
	color: #64748b;
}
    `
  ]
})
export class ArticulosManualComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apiAdmin = inject(ApiAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  categorias: any[] = [];
  monedas: any[] = [];
  editandoId: number | null = null;

  formulario = this.fb.group({
    nombre: ['', [Validators.required]],
    descripcion: [''],
    codigoBarra: [''],
    codigoInterno: [''],
    marca: [''],
    stock: [0, [Validators.required, Validators.min(0)]],
    categoriaId: [null as number | null],
    listaPrecioId: [null as number | null],
    precio: [null as number | null]
  });

  async ngOnInit(): Promise<void> {
    this.cargando = true;
    try {
      const categorias = await firstValueFrom(this.apiAdmin.getCategorias());
      this.categorias = categorias || [];

      const monedas = await firstValueFrom(this.apiAdmin.getMonedas(0));
      this.monedas = monedas || [];
      debugger;
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (Number.isFinite(id) && id > 0) {
        this.editandoId = id;
        const producto = await firstValueFrom(this.apiAdmin.getProducto(id));
        this.cargarProductoEnFormulario(producto);
      }
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos cargar la pantalla de carga manual.';
    } finally {
      this.cargando = false;
    }
  }

  cancelar(): void {
    void this.router.navigate(['/admin/articulos']);
  }

  limpiar(): void {
    this.editandoId = null;
    this.formulario.reset({
      nombre: '',
      descripcion: '',
      codigoBarra: '',
      codigoInterno: '',
      marca: '',
      stock: 0,
      categoriaId: null,
      listaPrecioId: null,
      precio: null
    });
  }

  async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const raw = this.formulario.value;
    const payload = {
      nombre: raw.nombre ?? '',
      descripcion: raw.descripcion ?? '',
      codigoBarra: raw.codigoBarra ?? '',
      codigoInterno: raw.codigoInterno ?? '',
      codigo_barra: raw.codigoBarra ?? '',
      codigo_interno: raw.codigoInterno ?? '',
      marca: raw.marca ?? '',
      stock: Number(raw.stock ?? 0),
      categoriaId: raw.categoriaId ?? null,
      rubroId: raw.categoriaId ?? null,
      subcategoriaId: raw.categoriaId ?? null,
      listaPrecioId: raw.listaPrecioId ?? null,
      precio: raw.precio ?? null,
      estado: 'activo'
    };

    this.guardando = true;
    this.error = '';
    this.mensaje = '';

    try {
      if (this.editandoId) {
        await firstValueFrom(this.apiAdmin.editarProducto(this.editandoId, payload));
        this.mensaje = 'Artículo actualizado correctamente.';
      } else {
        await firstValueFrom(this.apiAdmin.crearProducto(payload));
        this.mensaje = 'Artículo creado correctamente.';
      }

      this.formulario.markAsPristine();
      this.formulario.markAsUntouched();
      setTimeout(() => void this.router.navigate(['/admin/articulos']), 500);
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos guardar el artículo.';
    } finally {
      this.guardando = false;
    }
  }

  private cargarProductoEnFormulario(producto: Producto): void {
    this.formulario.patchValue({
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      codigoBarra: (producto as any).codigoBarra ?? producto.codigo_barra ?? '',
      codigoInterno: (producto as any).codigoInterno ?? (producto as any).codigo_interno ?? '',
      marca: typeof producto.marca === 'string' ? producto.marca : (producto.marca?.nombre ?? ''),
      stock: Number(producto.stock ?? 0),
      categoriaId: (producto as any).categoriaId ?? producto.subcategoria?.id ?? null,
      listaPrecioId: (producto as any).listaPrecioId ?? producto.listaPrecio?.id ?? null,
      precio: Number(producto.precio ?? producto.precioLista ?? 0)
    });
  }
}