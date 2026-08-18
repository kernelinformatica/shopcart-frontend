  

import { Component, Input, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

import { CommonModule } from '@angular/common';
import { PermisosService } from '../../../permisos.service';
import { resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';

@Component({
  selector: 'app-articulos-en-categoria',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './articulos-en-categoria.component.html',
  styleUrls: ['./articulos-en-categoria.component.scss']
})
export class ArticulosEnCategoriaComponent implements OnInit, OnChanges {
  @Input() categoriaId!: number;
  productos: any[] = [];
  loading = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    public permisosService: PermisosService
  ) {}


  ngOnInit() {
    if (this.categoriaId) {
      this.cargarProductos();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['categoriaId'] && !changes['categoriaId'].firstChange) {
      if (this.categoriaId) {
        this.cargarProductos();
      } else {
        this.productos = [];
      }
    }
  }
  get hayRelacionados(): boolean {
    return this.productos && this.productos.some(p => Array.isArray(p.productosRelacionados) && p.productosRelacionados.length > 0);
  }
  cargarProductos() {
    this.loading = true;
    this.error = null;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    const url = `${environment.apiUrlBackend}/api/categorias/${this.categoriaId}/productos`;
    this.http.get<any[]>(url, { headers })
      .subscribe({
        next: productos => {
          console.log('Productos recibidos:', productos);
          this.productos = (productos || []).map((producto) => this.normalizarProductoCategoria(producto));
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.error = 'Error al cargar productos';
          this.loading = false;
        }
      });
  }
    seleccionados: Set<number> = new Set();
// Selección masiva
  seleccionarTodos() {
    this.productos.forEach(p => this.seleccionados.add(p.id));
  }
  deseleccionarTodos() {
    this.seleccionados.clear();
  }
  toggleSeleccionTodos(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.seleccionarTodos();
    } else {
      this.deseleccionarTodos();
    }
  }
  get todosSeleccionados(): boolean {
    return this.productos.length > 0 && this.productos.every(p => this.seleccionados.has(p.id));
  }
  desvincularSeleccionados() {
    if (!this.categoriaId || this.seleccionados.size === 0) return;
    this.loading = true;
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    const url = `${environment.apiUrlBackend}/api/categorias/${this.categoriaId}/desvincular-productos`;
    const productos = Array.from(this.seleccionados);
    this.http.post(url, { productos }, { headers }).subscribe({
      next: () => {
        this.cargarProductos();
        this.deseleccionarTodos();
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        alert('Error al desvincular productos: ' + (err?.error?.message || err.message || err));
      }
    });
  }

  toggleSeleccion(id: number) {
    if (this.seleccionados.has(id)) {
      this.seleccionados.delete(id);
    } else {
      this.seleccionados.add(id);
    }
  }

  isSeleccionado(id: number): boolean {
    return this.seleccionados.has(id);
  }

  getImagenProducto(producto: any): string {
    return (
      producto?.imagenPrincipal ||
      producto?.imagen ||
      producto?.imagenUrl ||
      (Array.isArray(producto?.productoMedia) ? producto.productoMedia[0]?.url : '') ||
      ''
    );
  }

  private normalizarProductoCategoria(producto: any): any {
    const relacionados = Array.isArray(producto?.productosRelacionados)
      ? producto.productosRelacionados
      : Array.isArray(producto?.productos_relacionados)
        ? producto.productos_relacionados
        : [];

    return {
      ...producto,
      imagen: resolveBackendMediaUrl(producto?.imagen ?? producto?.imagenUrl ?? producto?.imagenurl ?? ''),
      imagenUrl: resolveBackendMediaUrl(producto?.imagenUrl ?? producto?.imagen ?? producto?.imagenurl ?? ''),
      imagenPrincipal: resolveBackendMediaUrl(producto?.imagenPrincipal ?? producto?.imagen_principal ?? producto?.imagen ?? producto?.imagenUrl ?? ''),
      productoMedia: Array.isArray(producto?.productoMedia)
        ? producto.productoMedia.map((media: any) => ({
            ...media,
            url: resolveBackendMediaUrl(typeof media === 'string' ? media : media?.url)
          }))
        : [],
      productosRelacionados: relacionados.map((rel: any) => this.normalizarProductoRelacionado(rel))
    };
  }

  private normalizarProductoRelacionado(producto: any): any {
    return this.normalizarProductoCategoria({
      ...producto,
      productosRelacionados: [],
      productos_relacionados: []
    });
  }
}
