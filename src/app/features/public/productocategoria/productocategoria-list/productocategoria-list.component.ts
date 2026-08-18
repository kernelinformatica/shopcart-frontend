import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../../api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-productocategoria-list',
  imports: [],
  templateUrl: './productocategoria-list.component.html',
  styleUrls: ['./productocategoria-list.component.scss']
})
export class ProductoCategoriaListComponent implements OnInit {
  categorias: any[] = [];
  loading = true;
  error = '';

  categoriasTree: any[] = [];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (categorias) => {
        this.categoriasTree = this.addCantidadProductosRecursivo(categorias);
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudieron cargar las categorías';
        this.loading = false;
      }
    });
  }

  // Suma productos recursivamente y agrega cantidadProductos
  addCantidadProductosRecursivo(categorias: any[]): any[] {
    return categorias.map(cat => {
      let cantidad = Array.isArray(cat.productos) ? cat.productos.length : (cat.cantidadProductos || 0);
      let hijos: any[] = [];
      if (Array.isArray(cat.children) && cat.children.length) {
        hijos = this.addCantidadProductosRecursivo(cat.children);
        cantidad += hijos.reduce((acc, h) => acc + (h.cantidadProductos || 0), 0);
      }
      return { ...cat, cantidadProductos: cantidad, children: hijos };
    });
  }

  // Solo permite navegar si la categoría (o algún hijo) tiene productos
  onCategoriaClick(cat: any, event: Event) {
    event.preventDefault();
    if (cat.cantidadProductos > 0 && (!cat.children || cat.children.length === 0)) {
      // Redirigir solo si es hoja y tiene productos
      this.router.navigate(['/categorias', cat.slug]);
    }
    // Si tiene hijos, no hace nada (expande/colapsa si implementas acordeón)
  }

  // Aplana el árbol de categorías y suma los productos de hijos
  flattenCategoriasWithCount(categorias: any[]): any[] {
    const result: any[] = [];
    function countProductos(cat: any): number {
      let count = Array.isArray(cat.productos) ? cat.productos.length : (cat.cantidadProductos || 0);
      if (Array.isArray(cat.children)) {
        for (const child of cat.children) {
          count += countProductos(child);
        }
      }
      return count;
    }
    function walk(catList: any[], parent: any = null) {
      for (const cat of catList) {
        const cantidad = countProductos(cat);
        result.push({ ...cat, cantidadProductos: cantidad, parent });
        if (Array.isArray(cat.children) && cat.children.length) {
          walk(cat.children, cat);
        }
      }
    }
    walk(categorias);
    return result;
  }
}
