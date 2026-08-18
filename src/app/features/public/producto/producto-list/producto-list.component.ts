

import { Component } from '@angular/core';
import { productoTieneImpuestos } from '../../../../shared/utils/producto.utils';
import { CarritoService } from '../../../../carrito.service';
import { ApiService } from '../../../../api.service';
import { Producto, Usuario } from '../../../../models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductoItemListaComponent } from '../../../../shared/components/producto-item-lista/producto-item-lista.component';
import { ProductoItemMiniComponent } from '../../../../shared/components/producto-item-mini/producto-item-mini.component';
import { ProductoItemComponent } from '../../../../shared/components/producto-item/producto-item.component';
import { FiltrosPanelComponent } from '../../../../shared/components/filtros-panel/filtros-panel.component';
import { Router, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-producto-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductoItemListaComponent, ProductoItemMiniComponent, ProductoItemComponent, FiltrosPanelComponent],
  templateUrl: './producto-list.component.html',
  styleUrl: './producto-list.component.scss'
})
export class ProductoListComponent {
  productoTieneImpuestos = productoTieneImpuestos;
  loading = true;
  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  marcasDisponibles: string[] = [];
  marcasSeleccionadas: Record<string, boolean> = {};
  filtroNombre: string = '';
  precioMinFiltro: number | null = null;
  precioMaxFiltro: number | null = null;
  filtrosColapsados = false;

  get hayFiltrosActivos(): boolean {
    return this.filtroNombre.trim() !== '' ||
      this.precioMinFiltro != null ||
      this.precioMaxFiltro != null ||
      this.marcasDisponibles.some(m => this.marcasSeleccionadas[m]);
  }

  toggleFiltrosColapsados() {
    this.filtrosColapsados = !this.filtrosColapsados;
  }
  modoVista: 'grande' | 'compacta' | 'lista' = 'grande';
  usuario: Usuario | null = null;
  errorUsuario: string | null = null;
  favoritos: Record<number, boolean> = {};
  private logosMarcaConError = new Set<string>();
  ratings: Record<number, number> = {};
  constructor(private api: ApiService, private router: Router, private route: ActivatedRoute, private carritoService: CarritoService) {}

  agregarAlCarrito(producto: Producto) {
    const precioConIVA = producto.precioFinal ?? producto.precio;
    const productoParaCarrito = { ...producto, precio: precioConIVA };
    this.carritoService.agregar(productoParaCarrito, 1);
  }

  ngOnInit() {
    // Leer query params para filtrar por marcaId o marca (desde admin)
    this.route.queryParamMap.subscribe(q => {
      const marcaId = q.get('marcaId');
      const marca = q.get('marca');
      // Si hay params, pedir productos y aplicar filtro cliente
      this.loading = true;
      this.api.getProductos().subscribe(productos => {
      this.productos = productos;
      this.marcasDisponibles = this.obtenerMarcasDisponibles(productos);
      // Inicializar marcasSeleccionadas
      this.marcasSeleccionadas = {};
      for (const marca of this.marcasDisponibles) {
        this.marcasSeleccionadas[marca] = false;
      }
        this.productosFiltrados = productos;
        // Aplicar filtro inicial si viene marcaId o marca
        if (marcaId) {
          this.filtroNombre = '';
          // filtrar por productos cuya marca tenga id igual a marcaId
          this.productosFiltrados = productos.filter(p => {
            const anyP: any = p as any;
            const idRaw = (anyP?.marca && (anyP.marca.id || anyP.marca.marcaId)) ?? anyP?.marcaId ?? anyP?.marca_id ?? anyP?.idMarca ?? anyP?.id_marca ?? null;
            return String(idRaw) === String(marcaId);
          });
        } else if (marca) {
          this.filtroNombre = '';
          const marcaLower = marca.toLowerCase();
          this.productosFiltrados = productos.filter(p => this.getMarcaNombre(p).toLowerCase().includes(marcaLower));
        }
        this.aplicarFiltro();
        this.loading = false;
      }, () => {
        this.loading = false;
      });
    });
    this.cargarUsuario();
    this.cargarFavoritos();
  }

  setModoVista(modo: 'grande' | 'compacta' | 'lista') {
    this.modoVista = modo;
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.precioMinFiltro = null;
    this.precioMaxFiltro = null;
    for (const marca of this.marcasDisponibles) {
      this.marcasSeleccionadas[marca] = false;
    }
    this.aplicarFiltro();
  }

  aplicarFiltro() {
    let filtrados = this.productos;
    // Filtro por nombre o descripción
    const f = this.filtroNombre.trim().toLowerCase();
    if (f) {
      filtrados = filtrados.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(f)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(f))
      );
    }
    // Filtro por marcas seleccionadas (multiselección)
    const marcasActivas = this.marcasDisponibles.filter(m => this.marcasSeleccionadas[m]);
    if (marcasActivas.length > 0) {
      filtrados = filtrados.filter(p => marcasActivas.includes(this.getMarcaNombre(p)));
    }
    // Filtro por precio mínimo
    if (this.precioMinFiltro != null) {
      const min = Number(this.precioMinFiltro);
      filtrados = filtrados.filter(p => {
        const precio = Number(p.precio);
        return !isNaN(precio) && precio >= min;
      });
    }
    // Filtro por precio máximo
    if (this.precioMaxFiltro != null) {
      const max = Number(this.precioMaxFiltro);
      filtrados = filtrados.filter(p => {
        const precio = Number(p.precio);
        return !isNaN(precio) && precio <= max;
      });
    }
    this.productosFiltrados = filtrados;
  }

  obtenerMarcasDisponibles(productos: Producto[]): string[] {
    const marcas = new Set<string>();
    for (const p of productos) {
      const marca = this.getMarcaNombre(p);
      if (marca) marcas.add(marca);
    }
    return Array.from(marcas).sort((a, b) => a.localeCompare(b, 'es'));
  }
getSlug(nombre: string, marca?: string): string {
  let base = nombre;
  if (marca) base += '-' + marca;
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

verProducto(producto: Producto) {
  // Usar el slug del backend si está presente
  const slug = (producto as any).slug || this.getSlug(producto.nombre || '', producto.marca?.nombre || producto.marca || '');
  this.router.navigate(['/productos', slug]);
}
  cargarUsuario() {
   
    const token = localStorage.getItem('token');
    if (!token) return;
    let userId: number | null = null;
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const data = JSON.parse(decoded);
      userId = data.id || data.userId || null;
    } catch {}
    if (userId) {
      this.api.getUsuario(userId).subscribe({
        next: user => this.usuario = user,
        error: () => {
          this.errorUsuario = 'No se pudo cargar la información del usuario. Redirigiendo a login...';
          localStorage.removeItem('token');
          setTimeout(() => this.router.navigate(['/auth']), 2000);
        }
      });
    }
  }

  cargarFavoritos() {
    this.api.getFavoritos().pipe(
      catchError(() => of([] as any[]))
    ).subscribe((response: any) => {
      const lista = Array.isArray(response) ? response : (Array.isArray(response?.favoritos) ? response.favoritos : (Array.isArray(response?.items) ? response.items : []));
      const mapa: Record<number, boolean> = {};
      for (const item of lista) {
        const productoId = Number(
          item?.productoId ??
          item?.producto_id ??
          item?.idProducto ??
          item?.id_producto ??
          item?.producto?.id
        );
        if (Number.isFinite(productoId) && productoId > 0) mapa[productoId] = true;
      }
      this.favoritos = mapa;
    });
  }

  toggleFavorito(event: { event: Event, producto: any }) {
    if (event?.event && typeof event.event.stopPropagation === 'function') event.event.stopPropagation();
    const producto = event?.producto;
    const productoId = Number(producto?.id);
    if (!Number.isFinite(productoId) || productoId <= 0) return;

    const marcado = !this.favoritos[productoId];
    this.favoritos = { ...this.favoritos, [productoId]: marcado };

    const request$ = marcado
      ? this.api.crearFavorito({ productoId, notificarOfertas: true, notificarNovedades: false })
      : this.api.eliminarFavorito({ productoId });

    request$.pipe(
      catchError(() => {
        this.favoritos = { ...this.favoritos, [productoId]: !marcado };
        return of(null);
      })
    ).subscribe(res => {
      if (res !== null) {
        this.api.notificarFavoritosActualizados();
      }
    });
  }

  getMarcaNombre(producto: any): string {
    const marca = producto?.marca;

    const candidatos = [
      typeof marca === 'string' ? marca : '',
      marca?.nombre,
      marca?.name,
      marca?.denominacion,
      producto?.marcaNombre,
      producto?.marca_nombre,
      producto?.nombreMarca,
      producto?.nombre_marca,
      producto?.brand,
      producto?.brandName
    ];

    for (const valor of candidatos) {
      const texto = String(valor ?? '').trim();
      if (texto) return texto;
    }

    return '';
  }

  getMarcaLogoPath(producto: any): string {
    const marcaNombre = this.getMarcaNombre(producto);
    if (!marcaNombre) return '';

    const key = this.slugify(marcaNombre);
    if (!key || this.logosMarcaConError.has(key)) return '';

    return `assets/logos/marcas/${key}.png`;
  }

  onMarcaLogoError(producto: any, event?: Event): void {
    const key = this.slugify(this.getMarcaNombre(producto));
    if (key) this.logosMarcaConError.add(key);

    const img = event?.target as HTMLImageElement | null;
    if (img) img.style.display = 'none';
  }

  private slugify(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
