import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ImportePipe } from '../../../shared/pipes/importe.pipe';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService } from '../../../api-admin.service';
import { resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';
import { ListaPrecio, PrecioProducto, Producto, Canal } from '../../../models';
import { PermisosService } from '../../../permisos.service';

interface CategoriaFiltroOption {
  id: number;
  nombre: string;
  ruta: string;
}

@Component({
  selector: 'app-listas-precios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, ConfirmDialogComponent, ImportePipe],
  templateUrl: './listas-precios-admin.component.html',
  styleUrls: ['./listas-precios-admin.component.scss']
})
export class ListasPreciosAdminComponent implements OnInit {
  private readonly api = inject(ApiAdminService);
  private readonly permisosService = inject(PermisosService);
  private readonly router = inject(Router);

  listas: ListaPrecio[] = [];
  precios: PrecioProducto[] = [];
  // marcas para filtro
  marcas: any[] = [];
  monedas: any[] = [];
  categorias: any[] = [];
  categoriasFiltro: CategoriaFiltroOption[] = [];
  categoriasSugeridasPrecios: CategoriaFiltroOption[] = [];
  categoriasSugeridasMasivo: CategoriaFiltroOption[] = [];
  canales: Canal[] = [];
  cargandoListas = false;
  cargandoPrecios = false;
  error = '';
  appId: number | null = null;
  listaSeleccionada: ListaPrecio | null = null;
  filtroMarcaId: any | null = null;
  categoriaBusquedaPrecios = '';
  categoriaBusquedaMasivo = '';
  filtroCategoria: string = '';
  // permisos
  puedeGestionarListas = false;
  puedeGestionarPrecios = false;
  puedeGestionarArticulos = false;
  puedeEliminarListas = false;

  // route helper
  rutas = {
    importPrecios: '/admin/listas-precios/import-txt'
  };

  // panel collapse state (false = abierto)
  listasPlegadas = false;
  preciosPlegados = false;
  masivoPlegado = false;

  // formulario simple para crear/editar listas
  editarModo = false;
  editarLista: any = {};

  constructor() {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    const apps = Array.isArray(usuario?.apps) ? usuario.apps : [];
    this.appId = apps[0]?.id ?? null;
    this.puedeGestionarListas = this.permisosService.tienePermiso('lista_precios') || this.permisosService.tienePermiso('precios_editar');
    this.puedeGestionarPrecios = this.permisosService.tienePermiso('lista_precios') || this.permisosService.tienePermiso('lista_precios_crear');
    this.puedeGestionarArticulos = this.permisosService.tienePermiso('articulos') || this.permisosService.tienePermiso('articulos_editar');
    this.puedeEliminarListas = this.permisosService.tienePermiso('lista_precios_borrar') || this.permisosService.tienePermiso('lista_precios');
    void this.cargarCanales();
    void this.cargarMarcas();
    void this.cargarCategorias();
    void this.cargarMonedas();
    void this.cargarListas();
    void this.cargarEstadosProductos();
  }

  estadosProductoOptions: Array<{ value: any; label: string }> = [];

  async cargarEstadosProductos(): Promise<void> {
    // Use the same static options as /admin/articulos search panel
    this.estadosProductoOptions = [
      { value: '', label: 'Todos' },
      { value: true, label: 'Activo' },
      { value: false, label: 'Inactivo' },
      { value: -1, label: 'Bajas' }
    ];
  }

  async cargarMonedas(): Promise<void> {
    try {
      this.monedas = await firstValueFrom(this.api.getMonedas(this.appId ?? 0));
    } catch (e) {
      console.error('No se pudieron cargar las monedas', e);
      this.monedas = [];
    }
  }

  async cargarCanales(): Promise<void> {
    try {
      this.canales = await firstValueFrom(this.api.getCanales(this.appId ?? 0));
      // If editing a lista and canal is an id, try to pre-select the object
      if (this.editarModo && this.editarLista && (this.editarLista as any).canal) {
        const canalId = (this.editarLista as any).canal?.id ?? (this.editarLista as any).canal;
        if (canalId) {
          const found = this.canales.find(c => c.id === canalId);
          if (found) (this.editarLista as any).canal = found;
        }
      }
    } catch {
      this.canales = [];
    }
  }

  async cargarMarcas(): Promise<void> {
    try {
      this.marcas = await firstValueFrom(this.api.getMarcas(this.appId ?? 0));
    } catch {
      this.marcas = [];
    }
  }

  async cargarCategorias(): Promise<void> {
    try {
      // Assume API provides getCategorias; call without args if required
      try {
        this.categorias = await firstValueFrom(this.api.getCategorias());
        this.categoriasFiltro = this.aplanarCategorias(this.categorias);
        this.actualizarSugerenciasCategoriasPrecios();
        this.actualizarSugerenciasCategoriasMasivo();
      } catch (e) {
        console.warn('getCategorias API not available or failed', e);
        this.categorias = [];
        this.categoriasFiltro = [];
        this.categoriasSugeridasPrecios = [];
        this.categoriasSugeridasMasivo = [];
      }
    } catch (e) {
      console.warn('No se pudieron cargar categorías', e);
      this.categorias = [];
      this.categoriasFiltro = [];
      this.categoriasSugeridasPrecios = [];
      this.categoriasSugeridasMasivo = [];
    }
  }

  private normalizarTexto(valor: string): string {
    return (valor || '').toString().trim().toLowerCase();
  }

  private getCategoriaNombre(categoria: any): string {
    return String(categoria?.nombre || categoria?.name || categoria?.descripcion || '').trim();
  }

  private getCategoriaRuta(categoria: any): string {
    return String(categoria?.ruta || this.getCategoriaNombre(categoria)).trim();
  }

  private aplanarCategorias(categorias: any[], prefijo = ''): CategoriaFiltroOption[] {
    const resultado: CategoriaFiltroOption[] = [];
    for (const categoria of categorias || []) {
      if (!categoria) continue;
      const id = Number(categoria.id);
      const nombre = this.getCategoriaNombre(categoria);
      const rutaActual = prefijo ? `${prefijo} / ${nombre}` : nombre;
      if (Number.isFinite(id) && id > 0 && nombre) {
        resultado.push({ id, nombre, ruta: rutaActual });
      }
      const hijos = Array.isArray(categoria.hijos) ? categoria.hijos : Array.isArray(categoria.children) ? categoria.children : [];
      if (hijos.length) {
        resultado.push(...this.aplanarCategorias(hijos, rutaActual));
      }
    }
    return resultado;
  }

  actualizarSugerenciasCategoriasPrecios(): void {
    const term = this.normalizarTexto(this.categoriaBusquedaPrecios);
    if (!term) {
      this.categoriasSugeridasPrecios = this.categoriasFiltro.slice(0, 8);
      return;
    }
    this.categoriasSugeridasPrecios = this.categoriasFiltro.filter(c => this.normalizarTexto(c.ruta).includes(term)).slice(0, 8);
  }

  actualizarSugerenciasCategoriasMasivo(): void {
    const term = this.normalizarTexto(this.categoriaBusquedaMasivo);
    if (!term) {
      this.categoriasSugeridasMasivo = this.categoriasFiltro.slice(0, 8);
      return;
    }
    this.categoriasSugeridasMasivo = this.categoriasFiltro.filter(c => this.normalizarTexto(c.ruta).includes(term)).slice(0, 8);
  }

  onCategoriaFilterInputPrecios(value: string): void {
    this.categoriaBusquedaPrecios = value || '';
    this.filtroCategoria = this.categoriaBusquedaPrecios;
    this.actualizarSugerenciasCategoriasPrecios();
    this.onFiltroPreciosChange();
  }

  onCategoriaFilterInputMasivo(value: string): void {
    this.categoriaBusquedaMasivo = value || '';
    this.filtroCategoria = this.categoriaBusquedaMasivo;
    this.actualizarSugerenciasCategoriasMasivo();
    this.onFiltroMasivoChange();
  }

  seleccionarCategoriaSugeridaPrecios(categoria: any): void {
    this.categoriaBusquedaPrecios = this.getCategoriaRuta(categoria);
    this.filtroCategoria = this.categoriaBusquedaPrecios;
    this.categoriasSugeridasPrecios = [];
    this.onFiltroPreciosChange();
  }

  seleccionarCategoriaSugeridaMasivo(categoria: any): void {
    this.categoriaBusquedaMasivo = this.getCategoriaRuta(categoria);
    this.filtroCategoria = this.categoriaBusquedaMasivo;
    this.categoriasSugeridasMasivo = [];
    this.onFiltroMasivoChange();
  }

  getMostrarSugerenciasCategoriaPrecios(): boolean {
    const termino = this.categoriaBusquedaPrecios.trim();
    if (!termino) return false;
    return this.categoriasSugeridasPrecios.length > 0;
  }

  getMostrarSugerenciasCategoriaMasivo(): boolean {
    const termino = this.categoriaBusquedaMasivo.trim();
    if (!termino) return false;
    return this.categoriasSugeridasMasivo.length > 0;
  }

  getSinResultadosCategoriaPrecios(): boolean {
    const termino = this.categoriaBusquedaPrecios.trim();
    return !!termino && this.categoriasSugeridasPrecios.length === 0;
  }

  getSinResultadosCategoriaMasivo(): boolean {
    const termino = this.categoriaBusquedaMasivo.trim();
    return !!termino && this.categoriasSugeridasMasivo.length === 0;
  }

  // Producto autocomplete
  productosSugeridos: Producto[] = [];
  buscandoProductos = false;
  // autocomplete keyboard
  productoHighlightedIndex = -1;
  // debounce timer for product search
  private productoSearchTimer: any = null;

  async buscarProductos(term: string): Promise<void> {
    term = (term || '').trim();
    if (term.length < 2) {
      this.productosSugeridos = [];
      return;
    }

    this.buscandoProductos = true;
    try {
      const resp: any = await firstValueFrom(this.api.getProductos({ appId: this.appId, nombre: term, pageSize: 10 }));
      if (Array.isArray(resp)) {
        this.productosSugeridos = resp as Producto[];
      } else if (resp && Array.isArray(resp.items)) {
        this.productosSugeridos = resp.items as Producto[];
      } else {
        this.productosSugeridos = [];
      }
    } catch (e) {
      console.error(e);
      this.productosSugeridos = [];
    } finally {
      this.buscandoProductos = false;
    }
  }

  // --- Asignación masiva ---
  busquedaMasivaTerm = '';
  productosMasivos: Producto[] = [];
  busquedaMasivaCargando = false;
  seleccionadosMasivos: Set<number> = new Set<number>();
  targetListaId: number | null = null;
  asignandoMasivo = false;
  // bulk options and results
  bulkAtomic = false;
  bulkFailed: Array<any> = [];
  mostrarErrores = false;
  // filtered view for masivo search results
  productosMasivosFiltrados: Producto[] = [];
  // paginated view state for masivo panel
  productosMasivosMostrados: Producto[] = [];
  productosMasivosPage = 1;
  productosMasivosPageSize = 50; // default page size per user request
  productosMasivosTotal = 0;
  // advanced filters visibility for masivo panel
  showAdvancedFiltersMasivo = false;
  filtroMarcaMasivo = '';
  filtroEstadoMasivo: any = '';
  filtroPrecioMinMasivo: number | null = null;
  filtroPrecioMaxMasivo: number | null = null;
  filtroStockMinMasivo: number | null = null;
  filtroStockMaxMasivo: number | null = null;
  filtroSinPrecioMasivo: boolean | null = null;
  filtroTieneImagenMasivo: boolean | null = null;
  filtroSkuMasivo: string = '';
  // map of productoId -> PrecioProducto for the selected target lista (used in masivo panel)
  productosMasivosPrecioMap: Map<number, PrecioProducto> = new Map<number, PrecioProducto>();

  getPrecioMasivo(productoId: number): PrecioProducto | null {
    try {
      const fromMap = (this.productosMasivosPrecioMap && this.productosMasivosPrecioMap.get(productoId)) || null;
      if (fromMap) return fromMap;
      // fallback: some API responses embed precio fields on the Producto itself
      const prodAny: any = (this.productosMasivos || []).find((p: any) => Number(p.id) === Number(productoId));
      if (prodAny) {
        const synthetic: any = {
          producto: prodAny,
          productoId: prodAny.id,
          precio: prodAny.precio ?? prodAny.precioLista ?? null,
          preciocompra: prodAny.precioCompra ?? prodAny.precio_compra ?? null,
          margen: prodAny.margen ?? null,
          moneda: prodAny.moneda ?? prodAny.monedaId ?? null
        } as unknown as PrecioProducto;
        return synthetic as unknown as PrecioProducto;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  getPrecioMonedaCodigo(productoId: number): string {
    try {
      const p = this.getPrecioMasivo(productoId);
      if (!p || !p.moneda) return '-';
      const m: any = p.moneda;
      if (typeof m === 'object') return m.codigoISO || m.codigo || m.id || '-';
      return String(m || '-');
    } catch (e) {
      return '-';
    }
  }
  
  // header select-all state
  get allMasivosSelected(): boolean {
    return !!(this.productosMasivos && this.productosMasivos.length > 0 && this.seleccionadosMasivos.size === this.productosMasivos.length);
  }

  toggleSeleccionarTodosHeader(): void {
    if (this.allMasivosSelected) this.deseleccionarTodosMasivo();
    else this.seleccionarTodosMasivo();
  }

  async buscarMasivo(): Promise<void> {
    const term = (this.busquedaMasivaTerm || '').trim();
    if (!term || term.length < 2) {
      this.productosMasivos = [];
      return;
    }
    this.busquedaMasivaCargando = true;
    try {
      const resp: any = await firstValueFrom(this.api.getProductos({ appId: this.appId, nombre: term, pageSize: 50 }));
      if (Array.isArray(resp)) this.productosMasivos = resp as Producto[];
      else if (resp && Array.isArray(resp.items)) this.productosMasivos = resp.items as Producto[];
      else this.productosMasivos = [];
      // reset selection for new results
      this.seleccionadosMasivos.clear();
      // initialize filtered view
      this.productosMasivosFiltrados = Array.isArray(this.productosMasivos) ? [...this.productosMasivos] : [];
      if (this.targetListaId) await this.cargarPreciosListaParaMasivo(this.targetListaId);
      this.prepararFiltradoMasivo();
    } catch (e) {
      console.error('Error buscando productos masivo', e);
      this.productosMasivos = [];
    } finally {
      this.busquedaMasivaCargando = false;
    }
  }

  async cargarTodosProductosMasivos(): Promise<void> {
    this.busquedaMasivaCargando = true;
    try {
      // Request a large page size to retrieve many productos; adjust as needed
      const resp: any = await firstValueFrom(this.api.getProductos({ appId: this.appId, pageSize: 10000 }));
      if (Array.isArray(resp)) this.productosMasivos = resp as Producto[];
      else if (resp && Array.isArray(resp.items)) this.productosMasivos = resp.items as Producto[];
      else this.productosMasivos = [];
      // reset selection for new results
      this.seleccionadosMasivos.clear();
      this.busquedaMasivaTerm = '';
      this.productosMasivosFiltrados = Array.isArray(this.productosMasivos) ? [...this.productosMasivos] : [];
      if (this.targetListaId) await this.cargarPreciosListaParaMasivo(this.targetListaId);
      this.prepararFiltradoMasivo();
    } catch (e) {
      console.error('Error cargando todos los productos', e);
      this.productosMasivos = [];
      this.error = 'No se pudieron cargar los productos.';
    } finally {
      this.busquedaMasivaCargando = false;
    }
  }

  toggleSeleccionMasiva(prod: Producto): void {
    if (!prod || !prod.id) return;
    if (this.seleccionadosMasivos.has(prod.id)) this.seleccionadosMasivos.delete(prod.id);
    else this.seleccionadosMasivos.add(prod.id);
  }

  async onTargetListaChange(): Promise<void> {
    if (!this.targetListaId) {
      this.productosMasivosPrecioMap.clear();
      this.prepararFiltradoMasivo();
      return;
    }
    await this.cargarPreciosListaParaMasivo(this.targetListaId);
    this.prepararFiltradoMasivo();
  }

  async cargarPreciosListaParaMasivo(listaId: number): Promise<void> {
    try {
      this.productosMasivosPrecioMap.clear();
      if (!listaId) return;
      const precios: any = await firstValueFrom(this.api.getPreciosPorLista(this.appId ?? 0, listaId));
      if (!precios) return;
      const arr = Array.isArray(precios) ? precios : (precios.items && Array.isArray(precios.items) ? precios.items : []);
      for (const p of arr) {
        const prodId = (p as any)?.producto?.id ?? (p as any).productoId ?? null;
        if (prodId != null) this.productosMasivosPrecioMap.set(Number(prodId), p as PrecioProducto);
      }
    } catch (e) {
      console.error('Error cargando precios para panel masivo', e);
      this.productosMasivosPrecioMap.clear();
    }
  }

  seleccionarTodosMasivo(): void {
    for (const p of this.productosMasivos) if (p && p.id) this.seleccionadosMasivos.add(p.id);
  }

  deseleccionarTodosMasivo(): void {
    this.seleccionadosMasivos.clear();
  }

  async asignarMasivo(): Promise<void> {
    if (!this.targetListaId) return;
    if (this.seleccionadosMasivos.size === 0) return;
    this.asignandoMasivo = true;
    const ids = Array.from(this.seleccionadosMasivos.values());
    try {
      // Ensure listaPrecioId is a number (API expects number, not null)
      const listaId = Number(this.targetListaId);
      if (!Number.isFinite(listaId) || listaId <= 0) {
        this.error = 'Lista de destino inválida.';
        this.asignandoMasivo = false;
        return;
      }
      // Use backend bulk-assign endpoint to create/update precios in one request
      const monedaDefault = this.monedas && this.monedas.length ? Number(this.monedas[0].id) : undefined;
      const items = ids.map(id => ({ productoId: id, precio: 0, preciocompra: 0, margen: 0, monedaId: monedaDefault }));
      const payload = {
        listaPrecioId: listaId,
        monedaId: monedaDefault,
        items,
        options: { onConflict: 'upsert', atomic: !!this.bulkAtomic }
      };
      const resp: any = await firstValueFrom(this.api.bulkAssignPrecios(payload));
      this.bulkFailed = Array.isArray(resp?.failed) ? resp.failed : [];
      const successCount = ids.length - this.bulkFailed.length;
      if (this.bulkFailed.length) {
        this.error = `Fallaron ${this.bulkFailed.length} asignaciones.`;
      } else {
        this.error = '';
      }
      // Update lista.productosCount locally to reflect assignments (avoid extra reload)
      try {
        const listaObj = this.listas.find(l => l.id === listaId);
        if (listaObj && successCount > 0) {
          const current = Number(listaObj.productosCount) || 0;
          listaObj.productosCount = current + successCount;
        }
      } catch (e) {
        // ignore
      }
      // if user assigned to currently selected lista, reload precios
      if (this.listaSeleccionada && this.listaSeleccionada.id === listaId) {
        await this.cargarPrecios(listaId);
      }

      // If bulk succeeded (no failed entries), open edit modal for the first assigned product
      if (!this.bulkFailed.length && ids.length) {
        const firstId = ids[0];
        const prod = this.productosMasivos.find(p => p.id === firstId) as Producto | undefined;
        // ensure listaSeleccionada references the target lista so guardarPrecio uses it
        if (!this.listaSeleccionada) {
          const l = this.listas.find(x => x.id === listaId);
          if (l) this.listaSeleccionada = l;
        }
        if (prod) {
          this.editarPrecioModo = true;
          this.editarPrecio = {
            producto: prod,
            productoId: prod.id,
            productoNombre: prod.nombre,
            precio: 0,
            preciocompra: 0,
            margen: 0,
            moneda: monedaDefault ?? (this.monedas && this.monedas.length ? this.monedas[0].id : null),
            vigenciadesde: '',
            vigenciahasta: '',
            observaciones: ''
          };
          this.recalcularMargen();
        }
      }

      // clear selection and UI
      this.seleccionadosMasivos.clear();
      this.productosMasivos = [];
      this.busquedaMasivaTerm = '';
      // clear price map as results are cleared
      this.productosMasivosPrecioMap.clear();
    } catch (e) {
      console.error('Error en asignación masiva', e);
      this.error = 'Error al asignar artículos a la lista.';
    } finally {
      this.asignandoMasivo = false;
    }
  }

  seleccionarProducto(p: Producto): void {
    this.editarPrecio.producto = p;
    this.editarPrecio.productoId = p.id;
    this.editarPrecio.productoNombre = p.nombre;
    this.productosSugeridos = [];
    this.productoHighlightedIndex = -1;
  }

  onProductoInput(value: string): void {
    this.editarPrecio.productoNombre = value;
    if (this.productoSearchTimer) clearTimeout(this.productoSearchTimer);
    const term = (value || '').trim();
    this.productoSearchTimer = setTimeout(() => {
      void this.buscarProductos(term);
    }, 300);
  }

  onProductoKeydown(ev: KeyboardEvent): void {
    if (!this.productosSugeridos || this.productosSugeridos.length === 0) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.productoHighlightedIndex = Math.min(this.productoHighlightedIndex + 1, this.productosSugeridos.length - 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.productoHighlightedIndex = Math.max(this.productoHighlightedIndex - 1, 0);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const p = this.productosSugeridos[this.productoHighlightedIndex >= 0 ? this.productoHighlightedIndex : 0];
      if (p) this.seleccionarProducto(p);
    } else if (ev.key === 'Escape') {
      this.productosSugeridos = [];
      this.productoHighlightedIndex = -1;
    }
  }

  async cargarListas(): Promise<void> {
    this.cargandoListas = true;
    this.error = '';
    try {
      this.listas = await firstValueFrom(this.api.getListasPrecios(this.appId ?? 0));
    } catch (e) {
      console.error(e);
      this.error = 'No se pudieron cargar las listas de precios.';
    } finally {
      this.cargandoListas = false;
    }
  }

  async seleccionarLista(lista: ListaPrecio): Promise<void> {
    // Reset any active local filters so the list opens showing all its precios
    this.filtroMarcaId = null;
    this.filtroNombre = '';
    this.preciosPage = 1;
    this.listaSeleccionada = lista;
    await this.cargarPrecios(lista.id);
  }

  async cargarPrecios(listaPrecioId: number): Promise<void> {
    this.cargandoPrecios = true;
    this.error = '';
    try {
      this.precios = await firstValueFrom(this.api.getPreciosPorLista(this.appId ?? 0, listaPrecioId));
      // If some precios don't include full producto object, fetch missing productos
      const missingIds = new Set<number>();
      for (const p of this.precios || []) {
        const prod = (p as any)?.producto;
        const prodId = prod && prod.id ? prod.id : ((p as any)?.productoId ?? (p as any)?.producto_id ?? null);
        if (!prod || (prod && prod.estado === undefined && prod.activo === undefined)) {
          if (Number.isFinite(Number(prodId))) missingIds.add(Number(prodId));
        }
      }
      if (missingIds.size > 0) {
        try {
          const promises: Promise<any>[] = [];
          for (const id of Array.from(missingIds)) {
            promises.push(firstValueFrom(this.api.getProducto(id)).then(res => ({ id, res })).catch(() => null));
          }
          const results = await Promise.all(promises);
          const byId = new Map<number, any>();
          for (const r of results) if (r && r.id) byId.set(r.id, r.res);
          // assign back to precios
          for (const p of this.precios) {
            const prod = (p as any)?.producto;
            const prodId = prod && prod.id ? prod.id : ((p as any)?.productoId ?? (p as any)?.producto_id ?? null);
            if ((!prod || (prod && prod.estado === undefined && prod.activo === undefined)) && Number.isFinite(Number(prodId))) {
              const fetched = byId.get(Number(prodId));
              if (fetched) (p as any).producto = fetched;
            }
          }
        } catch (e) {
          // ignore failing detail fetches
        }
      }

      // If backend did not provide estados list, derive from precios
      if (!this.estadosProductoOptions || this.estadosProductoOptions.length === 0) {
        this.estadosProductoOptions = this.deriveEstadosFromPrecios(this.precios || []);
      }

      this.prepararPaginacionPrecios();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudieron cargar los precios de la lista seleccionada.';
    } finally {
      this.cargandoPrecios = false;
    }
  }

  nuevo(): void {
    this.editarModo = true;
    this.editarLista = { nombre: '', observaciones: '', prioridad: 0, estado: 'activa', canal: null };
  }

  editar(lista: ListaPrecio): void {
    this.editarModo = true;
    this.editarLista = { ...lista };
    // Ensure observaciones/prioridad fields are populated even if backend uses alternate keys
    (this.editarLista as any).observaciones = (lista as any).observaciones ?? (lista as any).descripcion ?? '';
    (this.editarLista as any).prioridad = (lista as any).prioridad ?? (lista as any).orden ?? (this.editarLista as any).prioridad ?? 0;
    // Try to pre-select canal object if canales already loaded
    const canalId = (lista as any)?.canal?.id ?? (lista as any)?.canal;
    if (canalId && this.canales && this.canales.length) {
      const found = this.canales.find(c => c.id === canalId);
      if (found) (this.editarLista as any).canal = found;
      else (this.editarLista as any).canal = canalId;
    } else {
      // keep whatever the backend provided (object or id)
      (this.editarLista as any).canal = canalId ?? (lista as any).canal ?? null;
    }
  }

  cancelarEdicion(): void {
    this.editarModo = false;
    this.editarLista = {};
  }

  async guardarLista(): Promise<void> {
    if (!this.editarLista || !(this.editarLista as any).nombre) {
      this.error = 'El nombre es requerido.';
      return;
    }

    try {
      // Normalize payload: send canalId and explicit fields expected by API
      const payload: any = {
        nombre: (this.editarLista as any).nombre,
        observaciones: (this.editarLista as any).observaciones,
        prioridad: (this.editarLista as any).prioridad,
        estado: (this.editarLista as any).estado,
        canalId: (this.editarLista as any).canal && typeof (this.editarLista as any).canal === 'object' ? (this.editarLista as any).canal.id : (this.editarLista as any).canal,
        appId: this.appId
      };
      if (this.editarLista && (this.editarLista as any).id) {
        const id = (this.editarLista as any).id;
        await firstValueFrom(this.api.editarListaPrecio(id, payload));
      } else {
        await firstValueFrom(this.api.crearListaPrecio(payload));
      }
      this.editarModo = false;
      await this.cargarListas();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo guardar la lista de precios.';
    }
  }

  async desactivarLista(lista: ListaPrecio): Promise<void> {
    // open reusable confirmation modal
    this.listaAConfirmar = lista;
    try {
      const el = document.getElementById('deleteListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      // fallback
      if (!confirm('¿Desactivar lista de precios ' + (lista?.nombre || '') + '?')) return;
      await this._doDesactivarLista(lista.id);
    }
  }

  // soft-desactivar (marca inactiva)
  async desactivarListaSoft(lista: ListaPrecio): Promise<void> {
    this.listaADesactivar = lista;
    try {
      const el = document.getElementById('deactivateListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      if (!confirm('¿Desactivar la lista de precios ' + (lista?.nombre || '') + '?')) return;
      await this._doSoftDesactivarLista(lista.id);
    }
  }

  async activarLista(lista: ListaPrecio): Promise<void> {
    this.listaAActivar = lista;
    try {
      const el = document.getElementById('activateListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      if (!confirm('¿Activar la lista de precios ' + (lista?.nombre || '') + '?')) return;
      await this._doActivarLista(lista.id);
    }
  }
  // confirmation state for lista
  listaAConfirmar: ListaPrecio | null = null;
  confirmListaLoading = false;
  // vaciar lista state
  listaAVaciar: ListaPrecio | null = null;
  confirmVaciarLoading = false;
  // soft-desactivar state
  listaADesactivar: ListaPrecio | null = null;
  confirmDesactivarSoftLoading = false;
  // activar state
  listaAActivar: ListaPrecio | null = null;
  confirmActivarLoading = false;

  async onDesactivarListaConfirmed(): Promise<void> {
    if (!this.listaAConfirmar) return;
    this.confirmListaLoading = true;
    try {
      await this._doDesactivarLista(this.listaAConfirmar.id);
      const el = document.getElementById('deleteListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modalInst = (window as any).bootstrap.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
        modalInst.hide();
      }
    } finally {
      this.confirmListaLoading = false;
      this.listaAConfirmar = null;
    }
  }

  onDesactivarListaCancelled(): void {
    this.listaAConfirmar = null;
  }

  private async _doDesactivarLista(id: number) {
    if (!id) return;
    try {
      await firstValueFrom(this.api.desactivarListaPrecio(id));
      await this.cargarListas();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo desactivar la lista.';
    }
  }

  // Vaciar lista (borrar todos los precios)
  async vaciarLista(lista: ListaPrecio): Promise<void> {
    this.listaAVaciar = lista;
    try {
      const el = document.getElementById('vaciarListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      if (!confirm('¿Vaciar lista de precios ' + (lista?.nombre || '') + ' (esta acción eliminará todos los precios)?')) return;
      await this._doVaciarLista(lista.id);
    }
  }

  async onVaciarConfirmed(): Promise<void> {
    if (!this.listaAVaciar) return;
    this.confirmVaciarLoading = true;
    try {
      await this._doVaciarLista(this.listaAVaciar.id);
      const el = document.getElementById('vaciarListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modalInst = (window as any).bootstrap.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
        modalInst.hide();
      }
    } finally {
      this.confirmVaciarLoading = false;
      this.listaAVaciar = null;
    }
  }

  onVaciarCancelled(): void {
    this.listaAVaciar = null;
  }

  private async _doVaciarLista(id: number) {
    if (!id) return;
    try {
      await firstValueFrom(this.api.vaciarListaPrecios(id));
      // update local counts and UI
      try {
        const listaObj = this.listas.find(l => l.id === id);
        if (listaObj) listaObj.productosCount = 0;
      } catch (e) {}
      if (this.listaSeleccionada && this.listaSeleccionada.id === id) {
        this.precios = [];
        this.prepararPaginacionPrecios();
      }
      await this.cargarListas();
    } catch (e) {
      console.error('Error vaciando lista', e);
      this.error = 'No se pudo vaciar la lista de precios.';
    }
  }

  private async _doSoftDesactivarLista(id: number) {
    if (!id) return;
    try {
      const payload = { estado: 'inactiva', appId: this.appId };
      await firstValueFrom(this.api.editarListaPrecio(id, payload));
      await this.cargarListas();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo desactivar la lista.';
    }
  }

  async onDesactivarSoftConfirmed(): Promise<void> {
    if (!this.listaADesactivar) return;
    this.confirmDesactivarSoftLoading = true;
    try {
      await this._doSoftDesactivarLista(this.listaADesactivar.id);
      const el = document.getElementById('deactivateListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modalInst = (window as any).bootstrap.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
        modalInst.hide();
      }
    } finally {
      this.confirmDesactivarSoftLoading = false;
      this.listaADesactivar = null;
    }
  }

  onDesactivarSoftCancelled(): void {
    this.listaADesactivar = null;
  }

  private async _doActivarLista(id: number) {
    if (!id) return;
    try {
      const payload = { estado: 'activa', appId: this.appId };
      await firstValueFrom(this.api.editarListaPrecio(id, payload));
      await this.cargarListas();
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo activar la lista.';
    }
  }

  async onActivarConfirmed(): Promise<void> {
    if (!this.listaAActivar) return;
    this.confirmActivarLoading = true;
    try {
      await this._doActivarLista(this.listaAActivar.id);
      const el = document.getElementById('activateListaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modalInst = (window as any).bootstrap.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
        modalInst.hide();
      }
    } finally {
      this.confirmActivarLoading = false;
      this.listaAActivar = null;
    }
  }

  onActivarCancelled(): void {
    this.listaAActivar = null;
  }

  // precios: agregar/editar/eliminar
  async eliminarPrecio(precio: PrecioProducto): Promise<void> {
    this.precioAConfirmar = precio;
    // show reusable confirm dialog
    try {
      const el = document.getElementById('deletePrecioModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      // fallback
      if (!confirm('¿Eliminar precio para el producto ' + (precio?.producto?.nombre || ('#' + precio?.producto?.id)) + '?')) return;
      await this._doEliminarPrecio(precio.id as number);
    }
  }

  // Selección múltiple de precios para quitar de la lista
  seleccionadosPrecios: Set<number> = new Set<number>();
  removingPrecios = false;

  get allPreciosSelected(): boolean {
    return !!(this.preciosMostrados && this.preciosMostrados.length > 0 && this.seleccionadosPrecios.size === this.preciosMostrados.length);
  }

  toggleSeleccionarTodosPrecios(): void {
    if (this.allPreciosSelected) this.seleccionadosPrecios.clear();
    else {
      for (const p of this.preciosMostrados) if (p && p.id) this.seleccionadosPrecios.add(p.id as number);
    }
  }

  toggleSeleccionPrecio(p: PrecioProducto): void {
    if (!p || !p.id) return;
    if (this.seleccionadosPrecios.has(p.id)) this.seleccionadosPrecios.delete(p.id);
    else this.seleccionadosPrecios.add(p.id);
  }

  async eliminarSeleccionados(): Promise<void> {
    if (this.seleccionadosPrecios.size === 0) return;
    if (!confirm(`¿Eliminar ${this.seleccionadosPrecios.size} precios seleccionados de la lista '${this.listaSeleccionada?.nombre || ''}'?`)) return;
    this.removingPrecios = true;
    const ids = Array.from(this.seleccionadosPrecios.values());
    try {
      for (const id of ids) {
        try {
          await firstValueFrom(this.api.eliminarPrecioProducto(id, this.appId ?? undefined));
        } catch (e) {
          console.error('Error eliminando precio', id, e);
        }
      }
      // reload precios for the selected lista
      if (this.listaSeleccionada) await this.cargarPrecios(this.listaSeleccionada.id);
      this.seleccionadosPrecios.clear();
    } catch (e) {
      console.error('Error eliminando precios seleccionados', e);
      this.error = 'Error al eliminar algunos precios.';
    } finally {
      this.removingPrecios = false;
    }
  }

  // filtrado y paginado local de precios
  preciosFiltrados: PrecioProducto[] = [];
  preciosMostrados: PrecioProducto[] = [];
  preciosPage = 1;
  preciosPageSize = 10;
  preciosTotal = 0;
  filtroNombre = '';
  filtroMarcaPrecios = '';
  filtroEstadoPrecios: any = '';
  // ordenamiento general
  sortBy: '' | 'nombre' | 'precio' | 'preciocompra' | 'stock' | 'margen' | 'actualizado' | 'productoId' = '';
  sortDir: '' | 'asc' | 'desc' = '';
  // advanced filters
  showAdvancedFiltersPrecios = false;
  filtroPrecioMinPrecios: number | null = null;
  filtroPrecioMaxPrecios: number | null = null;
  filtroStockMinPrecios: number | null = null;
  filtroStockMaxPrecios: number | null = null;
  filtroSinPrecioPrecios: boolean | null = null;
  filtroTieneImagenPrecios: boolean | null = null;
  filtroSkuPrecios: string = '';

  // confirmation state for precio
  precioAConfirmar: PrecioProducto | null = null;

  confirmPrecioLoading = false;

  async onEliminarPrecioConfirmed(): Promise<void> {
    if (!this.precioAConfirmar) return;
    this.confirmPrecioLoading = true;
    try {
      await this._doEliminarPrecio(this.precioAConfirmar.id as number);
      const el = document.getElementById('deletePrecioModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modalInst = (window as any).bootstrap.Modal.getInstance(el) || new (window as any).bootstrap.Modal(el);
        modalInst.hide();
      }
    } finally {
      this.confirmPrecioLoading = false;
      this.precioAConfirmar = null;
    }
  }

  onEliminarPrecioCancelled(): void {
    this.precioAConfirmar = null;
  }

  private async _doEliminarPrecio(precioId: number) {
    try {
      await firstValueFrom(this.api.eliminarPrecioProducto(precioId, this.appId ?? undefined));
      // update local contador de productos para la lista seleccionada si aplica
      try {
        if (this.listaSeleccionada) {
          const listaObj = this.listas.find(l => l.id === this.listaSeleccionada?.id);
          if (listaObj) {
            const current = Number(listaObj.productosCount) || 0;
            listaObj.productosCount = Math.max(0, current - 1);
          }
        }
      } catch (e) {
        // ignore
      }
      if (this.listaSeleccionada) await this.cargarPrecios(this.listaSeleccionada.id);
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo eliminar el precio.';
    }
  }

  // --- Formulario para agregar/editar precio ---
  editarPrecioModo = false;
  procesandoPrecio = false;
  editarPrecio: any = {};
  erroresPrecio: string[] = [];

  abrirAgregarPrecio(): void {
    this.editarPrecioModo = true;
    this.editarPrecio = { precio: 0, preciocompra: 0, margen: 0, moneda: undefined, producto: undefined, vigenciadesde: '', vigenciahasta: '', observaciones: '' };
    // preselect first moneda id if available
    this.editarPrecio.moneda = this.monedas && this.monedas.length ? this.monedas[0].id : null;
    this.recalcularMargen();
    this.erroresPrecio = [];
  }
  abrirEditarProducto(producto?: Producto): void {
    if (!producto || !producto.id) {
      this.error = 'Producto inválido.';
      return;
    }
    // Navigate to admin product manual edit route
    try {
      this.router.navigate(['/admin/articulos/manual', producto.id]);
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo abrir el editor de producto.';
    }
  }


  abrirEditarPrecio(precio: PrecioProducto): void {
    this.editarPrecioModo = true;
    this.editarPrecio = { ...precio };
    // ensure product name is present for the product input
    this.editarPrecio.producto = (precio as any)?.producto ?? undefined;
    this.editarPrecio.productoId = (precio as any)?.productoId ?? (precio as any)?.producto?.id ?? this.editarPrecio.productoId;
    this.editarPrecio.productoNombre = (precio as any)?.producto?.nombre ?? (precio as any)?.productoNombre ?? (this.editarPrecio.productoId ? ('#' + this.editarPrecio.productoId) : '');
    // clear suggestions and any highlighted index
    this.productosSugeridos = [];
    this.productoHighlightedIndex = -1;
    // close image modal if open (prevent overlay blocking clicks)
    this.imageModalOpen = false;
    // compute margin from provided precio/preciocompra
    this.recalcularMargen();
    // ensure moneda is normalized to an id so the select shows the current value
    try {
      const monedaObj = (precio as any)?.moneda;
      const monedaId = monedaObj && typeof monedaObj === 'object' ? monedaObj.id : ((precio as any)?.monedaId ?? monedaObj ?? null);
      this.editarPrecio.moneda = monedaId;
    } catch (e) {
      // ignore
    }
    this.erroresPrecio = [];
  }

  recalcularMargen(): void {
    try {
      const p = this.editarPrecio || {};
      const precio = p.precio !== undefined && p.precio !== null ? Number(p.precio) : null;
      const preciocompra = p.preciocompra !== undefined && p.preciocompra !== null ? Number(p.preciocompra) : null;
      if (precio === null || isNaN(precio) || preciocompra === null || isNaN(preciocompra)) {
        p.margen = null;
        try { this.erroresPrecio = this.validarFormularioPrecio(); } catch (e) {}
        return;
      }
      // margen as importe (precio - precio compra)
      const margen = (precio - preciocompra);
      // keep two decimals
      p.margen = Math.round(margen * 100) / 100;
      try { this.erroresPrecio = this.validarFormularioPrecio(); } catch (e) {}
    } catch (e) {
      // leave margen as-is on error
    }
  }

  cerrarPrecioForm(): void {
    this.editarPrecioModo = false;
    this.editarPrecio = {};
  }

  async guardarPrecio(): Promise<void> {
    if (!this.listaSeleccionada) {
      this.error = 'No hay lista seleccionada.';
      return;
    }
    this.erroresPrecio = this.validarFormularioPrecio();
    if (this.erroresPrecio.length) return;

    this.procesandoPrecio = true;
    this.error = '';
    try {
      const payload: any = {
        productoId: (this.editarPrecio.producto as any)?.id ?? (this.editarPrecio as any).productoId ?? (this.editarPrecio as any).productoId,
        listaPrecioId: this.listaSeleccionada.id,
        precio: this.editarPrecio.precio ?? 0,
        preciocompra: this.editarPrecio.preciocompra ?? (this.editarPrecio as any).precioCompra,
        margen: this.editarPrecio.margen,
        moneda: (this.editarPrecio as any)?.moneda && typeof (this.editarPrecio as any).moneda === 'object' ? (this.editarPrecio as any).moneda.id : (this.editarPrecio as any).moneda,
        vigenciadesde: this.editarPrecio.vigenciadesde ?? (this.editarPrecio as any).vigenciaDesde,
        vigenciahasta: this.editarPrecio.vigenciahasta ?? (this.editarPrecio as any).vigenciaHasta,
        observaciones: this.editarPrecio.observaciones,
        appId: this.appId
      };

      if (this.editarPrecio && (this.editarPrecio as any).id) {
        const id = (this.editarPrecio as any).id;
        await firstValueFrom(this.api.actualizarPrecioProducto(id, payload));
      } else {
        await firstValueFrom(this.api.crearPrecioProducto(payload));
        // actualizar contador local de la lista seleccionada
        try {
          if (this.listaSeleccionada) {
            const listaObj = this.listas.find(l => l.id === this.listaSeleccionada?.id);
            if (listaObj) {
              const current = Number(listaObj.productosCount) || 0;
              listaObj.productosCount = current + 1;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      this.cerrarPrecioForm();
      if (this.listaSeleccionada) await this.cargarPrecios(this.listaSeleccionada.id);
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo guardar el precio.';
    } finally {
      this.procesandoPrecio = false;
    }
  }

  prepararPaginacionPrecios(): void {
    const term = (this.filtroNombre || '').trim().toLowerCase();
    const marcaFilter = (this.filtroMarcaPrecios || '').trim().toLowerCase();
    const estadoFilterRaw = this.filtroEstadoPrecios;
    this.preciosFiltrados = (this.precios || []).filter(p => {
      const nombre = (p.producto && (p.producto.nombre || '') || '').toString().toLowerCase();
      const marcaNombre = (p.producto && (p.producto.marca && (p.producto.marca.nombre || p.producto.marca) || '') || '').toString().toLowerCase();
      const matchNombre = !term || nombre.includes(term);
      const matchMarca = !marcaFilter || (marcaNombre && marcaNombre.includes(marcaFilter));
      // determine producto estado as normalized key string to compare with filtro
      // Match using the same semantics as articulos: filtro true => activo, false => inactivo, -1 => baja
      let matchEstado = true;
      if (estadoFilterRaw !== '' && estadoFilterRaw !== null && estadoFilterRaw !== undefined) {
        const prod: any = p.producto || {};
        const estadoRaw = (prod as any).estado;
        const bajaFlag = prod.baja === true || prod.baja === 1 || prod.baja === '1' || String(prod.baja).toLowerCase() === 'true';
        // determine activo flag across shapes
        let activoFlag: boolean | null = null;
        if (typeof prod.activo === 'boolean') activoFlag = prod.activo;
        else if (prod.activo === 1 || prod.activo === '1' || String(prod.activo).toLowerCase() === 'true') activoFlag = true;
        else if (prod.activo === 0 || prod.activo === '0' || String(prod.activo).toLowerCase() === 'false') activoFlag = false;
        else if (estadoRaw !== undefined && estadoRaw !== null) {
          const s = String(estadoRaw).toLowerCase();
          if (s === 'activo' || s === '1' || s === 'true') activoFlag = true;
          else if (s === 'inactivo' || s === '0' || s === 'false') activoFlag = false;
        }

        if (estadoFilterRaw === true) {
          matchEstado = activoFlag === true;
        } else if (estadoFilterRaw === false) {
          matchEstado = activoFlag === false && !bajaFlag;
        } else if (Number(estadoFilterRaw) === -1) {
          matchEstado = bajaFlag || String(estadoRaw).toLowerCase() === 'baja';
        } else {
          const productoEstadoKey = this.normalizeProductoEstadoKey(p);
          matchEstado = (productoEstadoKey !== null && String(productoEstadoKey) === String(estadoFilterRaw));
        }
      }
      return matchNombre && matchMarca && matchEstado;
    });
    // apply advanced filters
    if (this.filtroSkuPrecios && String(this.filtroSkuPrecios).trim() !== '') {
      const skuQ = String(this.filtroSkuPrecios).trim().toLowerCase();
      this.preciosFiltrados = this.preciosFiltrados.filter(p => {
        const prod = (p as any).producto || {};
        const idMatch = prod.id !== undefined && prod.id !== null && String(prod.id).toLowerCase() === skuQ;
        const skuMatch = (prod.sku && String(prod.sku).toLowerCase() === skuQ) || false;
        const codigoMatch = (prod.codigo && String(prod.codigo).toLowerCase() === skuQ) || false;
        const codigoInternoMatch = (prod.codigoInterno && String(prod.codigoInterno).toLowerCase() === skuQ) || false;
        const codigoBarraMatch = (prod.codigoBarra && String(prod.codigoBarra).toLowerCase() === skuQ) || false;
        const barcodeMatch = (prod.barcode && String(prod.barcode).toLowerCase() === skuQ) || false;
        const eanMatch = (prod.ean && String(prod.ean).toLowerCase() === skuQ) || false;
        return idMatch || skuMatch || codigoMatch || codigoInternoMatch || codigoBarraMatch || barcodeMatch || eanMatch;
      });
    }
    // category filter
    const categoriaTerm = this.normalizarTexto(this.categoriaBusquedaPrecios || this.filtroCategoria);
    if (categoriaTerm) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => {
        const prod: any = (p as any).producto || {};
        const catNombre = this.normalizarTexto(prod.categoria?.ruta || prod.categoria?.nombre || prod.categoria?.name || prod.categoria?.descripcion || prod.categoriaNombre || prod.categoria || '');
        const catId = prod.categoriaId ?? (prod.categoria && (prod.categoria.id ?? prod.categoria)) ?? null;
        return (catNombre && catNombre.includes(categoriaTerm)) || (catId != null && String(catId).toLowerCase().includes(categoriaTerm));
      });
    }
    if (this.filtroSinPrecioPrecios === true) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => p.precio === 0 || p.precio === null || p.precio === undefined);
    } else if (this.filtroSinPrecioPrecios === false) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => !(p.precio === 0 || p.precio === null || p.precio === undefined));
    }
    if (this.filtroTieneImagenPrecios === true) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => !!this.getProductoImagenUrl((p as any).producto));
    } else if (this.filtroTieneImagenPrecios === false) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => !this.getProductoImagenUrl((p as any).producto));
    }
    if (this.filtroPrecioMinPrecios !== null && this.filtroPrecioMinPrecios !== undefined) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => Number(p.precio) >= Number(this.filtroPrecioMinPrecios));
    }
    if (this.filtroPrecioMaxPrecios !== null && this.filtroPrecioMaxPrecios !== undefined) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => Number(p.precio) <= Number(this.filtroPrecioMaxPrecios));
    }
    if (this.filtroStockMinPrecios !== null && this.filtroStockMinPrecios !== undefined) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => {
        const s = (p.producto && p.producto.stock != null) ? Number(p.producto.stock) : null;
        return s !== null && s >= Number(this.filtroStockMinPrecios);
      });
    }
    if (this.filtroStockMaxPrecios !== null && this.filtroStockMaxPrecios !== undefined) {
      this.preciosFiltrados = this.preciosFiltrados.filter(p => {
        const s = (p.producto && p.producto.stock != null) ? Number(p.producto.stock) : null;
        return s !== null && s <= Number(this.filtroStockMaxPrecios);
      });
    }

    // apply sorting
    const sortField = this.sortBy;
    const sortDir = this.sortDir === 'asc' ? 1 : (this.sortDir === 'desc' ? -1 : 0);
    if (sortField && sortDir !== 0) {
      this.preciosFiltrados.sort((a, b) => {
        let va: any = null;
        let vb: any = null;
        switch (sortField) {
          case 'nombre':
            va = (a && a.producto && (a.producto.nombre || '')) || '';
            vb = (b && b.producto && (b.producto.nombre || '')) || '';
            try { return sortDir * String(va).toLowerCase().localeCompare(String(vb).toLowerCase()); } catch { return 0; }
          case 'precio':
            va = Number(a.precio) || 0; vb = Number(b.precio) || 0; return sortDir * (va - vb);
          case 'preciocompra':
            va = Number(a.preciocompra) || 0; vb = Number(b.preciocompra) || 0; return sortDir * (va - vb);
          case 'stock':
            va = (a.producto && a.producto.stock != null) ? Number(a.producto.stock) : -Infinity;
            vb = (b.producto && b.producto.stock != null) ? Number(b.producto.stock) : -Infinity;
            return sortDir * (va - vb);
          case 'margen':
            va = Number(a.margen) || 0; vb = Number(b.margen) || 0; return sortDir * (va - vb);
          case 'productoId':
            va = (a.producto && a.producto.id) ? Number(a.producto.id) : 0; vb = (b.producto && b.producto.id) ? Number(b.producto.id) : 0; return sortDir * (va - vb);
          default:
            return 0;
        }
      });
    }
    this.preciosTotal = this.preciosFiltrados.length;
    const maxPages = Math.max(1, Math.ceil(this.preciosTotal / this.preciosPageSize));
    if (this.preciosPage > maxPages) this.preciosPage = maxPages;
    const start = (this.preciosPage - 1) * this.preciosPageSize;
    this.preciosMostrados = this.preciosFiltrados.slice(start, start + this.preciosPageSize);
  }

  cambiarPaginaPrecios(n: number): void {
    const maxPages = Math.max(1, Math.ceil(this.preciosTotal / this.preciosPageSize));
    if (n < 1 || n > maxPages) return;
    this.preciosPage = n;
    this.prepararPaginacionPrecios();
  }

  onFiltroPreciosChange(): void {
    this.preciosPage = 1;
    this.prepararPaginacionPrecios();
  }

  onFiltroPreciosAdvancedChange(): void {
    this.onFiltroPreciosChange();
  }

  onFiltroMasivoChange(): void {
    // reset to first page on filter change
    this.productosMasivosPage = 1;
    this.prepararFiltradoMasivo();
  }

  onFiltroMasivoAdvancedChange(): void {
    this.onFiltroMasivoChange();
  }

  prepararFiltradoMasivo(): void {
    try {
      const term = (this.busquedaMasivaTerm || '').trim().toLowerCase();
      const marcaFilter = (this.filtroMarcaMasivo || '').toString().toLowerCase();
      const estadoFilterRaw = this.filtroEstadoMasivo;
      const skuQ = (this.filtroSkuMasivo || '').toString().trim().toLowerCase();

      let list = Array.isArray(this.productosMasivos) ? [...this.productosMasivos] : [];

      list = list.filter(prod => {
        const pAny: any = prod as any;
        const nombre = (pAny.nombre || '').toString().toLowerCase();
        const marcaNombre = (pAny.marca && (pAny.marca.nombre || pAny.marca) || '').toString().toLowerCase();
        const matchTerm = !term || nombre.includes(term) || marcaNombre.includes(term) || String(prod.id || '').toLowerCase() === term;

        if (!matchTerm) return false;

        if (marcaFilter) {
          if (!marcaNombre || !marcaNombre.includes(marcaFilter)) return false;
        }

        // category filter for masivo
        const categoriaTerm = this.normalizarTexto(this.categoriaBusquedaMasivo || this.filtroCategoria);
        if (categoriaTerm) {
          const catId = pAny.categoriaId ?? (pAny.categoria && (pAny.categoria.id ?? pAny.categoria)) ?? null;
          const catNombre = this.normalizarTexto(pAny.categoria?.ruta || pAny.categoria?.nombre || pAny.categoria?.name || pAny.categoria?.descripcion || pAny.categoriaNombre || pAny.categoria || '');
          if (!((catNombre && catNombre.includes(categoriaTerm)) || (catId != null && String(catId).toLowerCase().includes(categoriaTerm)))) return false;
        }

        // estado filter (reuse normalizers expecting a PrecioProducto-like object)
        if (estadoFilterRaw !== '' && estadoFilterRaw !== null && estadoFilterRaw !== undefined) {
          const fakePrecio: any = { producto: prod };
          const bajaFlag = pAny.baja === true || pAny.baja === 1 || pAny.baja === '1' || String(pAny.baja).toLowerCase() === 'true';
          let activoFlag: boolean | null = null;
          if (typeof pAny.activo === 'boolean') activoFlag = pAny.activo;
          else if (pAny.activo === 1 || pAny.activo === '1' || String(pAny.activo).toLowerCase() === 'true') activoFlag = true;
          else if (pAny.activo === 0 || pAny.activo === '0' || String(pAny.activo).toLowerCase() === 'false') activoFlag = false;
          else if (pAny.estado !== undefined && pAny.estado !== null) {
            const s = String(pAny.estado).toLowerCase();
            if (s === 'activo' || s === '1' || s === 'true') activoFlag = true;
            else if (s === 'inactivo' || s === '0' || s === 'false') activoFlag = false;
          }
          if (estadoFilterRaw === true) {
            if (activoFlag !== true) return false;
          } else if (estadoFilterRaw === false) {
            if (activoFlag !== false || bajaFlag) return false;
          } else if (Number(estadoFilterRaw) === -1) {
            if (!bajaFlag && String(pAny.estado).toLowerCase() !== 'baja') return false;
          } else {
            const key = this.normalizeProductoEstadoKey(fakePrecio as any);
            if (key === null || String(key) !== String(estadoFilterRaw)) return false;
          }
        }

        // SKU exact-match
        if (skuQ) {
          const idMatch = pAny.id !== undefined && pAny.id !== null && String(pAny.id).toLowerCase() === skuQ;
          const skuMatch = (pAny.sku && String(pAny.sku).toLowerCase() === skuQ) || false;
          const codigoMatch = (pAny.codigo && String(pAny.codigo).toLowerCase() === skuQ) || false;
          const codigoInternoMatch = (pAny.codigoInterno && String(pAny.codigoInterno).toLowerCase() === skuQ) || false;
          const codigoBarraMatch = (pAny.codigoBarra && String(pAny.codigoBarra).toLowerCase() === skuQ) || false;
          const barcodeMatch = (pAny.barcode && String(pAny.barcode).toLowerCase() === skuQ) || false;
          const eanMatch = (pAny.ean && String(pAny.ean).toLowerCase() === skuQ) || false;
          if (!(idMatch || skuMatch || codigoMatch || codigoInternoMatch || codigoBarraMatch || barcodeMatch || eanMatch)) return false;
        }

        // imagen filter
        if (this.filtroTieneImagenMasivo === true) {
          if (!this.getProductoImagenUrl(prod)) return false;
        } else if (this.filtroTieneImagenMasivo === false) {
          if (this.getProductoImagenUrl(prod)) return false;
        }

        // stock filters
        if (this.filtroStockMinMasivo !== null && this.filtroStockMinMasivo !== undefined) {
          const s = prod && prod.stock != null ? Number(prod.stock) : null;
          if (s === null || s < Number(this.filtroStockMinMasivo)) return false;
        }
        if (this.filtroStockMaxMasivo !== null && this.filtroStockMaxMasivo !== undefined) {
          const s = prod && prod.stock != null ? Number(prod.stock) : null;
          if (s === null || s > Number(this.filtroStockMaxMasivo)) return false;
        }

        // price filters using precio map
        const precioObj: any = this.productosMasivosPrecioMap.get(pAny.id) || null;
        const precioVal = precioObj ? (Number(precioObj.precio) || 0) : null;
        if (this.filtroPrecioMinMasivo !== null && this.filtroPrecioMinMasivo !== undefined) {
          if (precioVal === null || precioVal < Number(this.filtroPrecioMinMasivo)) return false;
        }
        if (this.filtroPrecioMaxMasivo !== null && this.filtroPrecioMaxMasivo !== undefined) {
          if (precioVal === null || precioVal > Number(this.filtroPrecioMaxMasivo)) return false;
        }
        if (this.filtroSinPrecioMasivo === true) {
          if (precioVal !== null && precioVal !== 0) return false;
        } else if (this.filtroSinPrecioMasivo === false) {
          if (precioVal === null || precioVal === 0) return false;
        }

        return true;
      });

      this.productosMasivosFiltrados = list;
      // apply sorting if requested (supporting nombre, stock, precio and margen)
      const sortField = this.sortBy;
      const sortDir = this.sortDir === 'asc' ? 1 : (this.sortDir === 'desc' ? -1 : 0);
      if (sortField && sortDir !== 0) {
        try {
          this.productosMasivosFiltrados.sort((a: any, b: any) => {
            switch (sortField) {
              case 'nombre':
                try { return sortDir * String((a.nombre || '')).toLowerCase().localeCompare(String((b.nombre || '')).toLowerCase()); } catch { return 0; }
              case 'stock':
                const sa = a.stock != null ? Number(a.stock) : -Infinity;
                const sb = b.stock != null ? Number(b.stock) : -Infinity;
                return sortDir * (sa - sb);
              case 'precio':
                const paObj = this.getPrecioMasivo(a.id);
                const pbObj = this.getPrecioMasivo(b.id);
                const paVal = paObj && paObj.precio != null ? Number(paObj.precio) : -Infinity;
                const pbVal = pbObj && pbObj.precio != null ? Number(pbObj.precio) : -Infinity;
                return sortDir * (paVal - pbVal);
              case 'preciocompra':
                const pcaObj = this.getPrecioMasivo(a.id);
                const pcbObj = this.getPrecioMasivo(b.id);
                const pcaVal = pcaObj && pcaObj.preciocompra != null ? Number(pcaObj.preciocompra) : -Infinity;
                const pcbVal = pcbObj && pcbObj.preciocompra != null ? Number(pcbObj.preciocompra) : -Infinity;
                return sortDir * (pcaVal - pcbVal);
              case 'margen':
                const maObj = this.getPrecioMasivo(a.id);
                const mbObj = this.getPrecioMasivo(b.id);
                const maVal = maObj && maObj.margen != null ? Number(maObj.margen) : -Infinity;
                const mbVal = mbObj && mbObj.margen != null ? Number(mbObj.margen) : -Infinity;
                return sortDir * (maVal - mbVal);
              case 'productoId':
                const ia = a.id != null ? Number(a.id) : 0;
                const ib = b.id != null ? Number(b.id) : 0;
                return sortDir * (ia - ib);
              default:
                return 0;
            }
          });
        } catch (e) {
          // ignore sorting errors
        }
      }

      // pagination for masivo
      this.productosMasivosTotal = this.productosMasivosFiltrados.length;
      const maxPages = Math.max(1, Math.ceil(this.productosMasivosTotal / this.productosMasivosPageSize));
      if (this.productosMasivosPage > maxPages) this.productosMasivosPage = maxPages;
      const start = (this.productosMasivosPage - 1) * this.productosMasivosPageSize;
      this.productosMasivosMostrados = this.productosMasivosFiltrados.slice(start, start + this.productosMasivosPageSize);
    } catch (e) {
      console.error('Error filtrando productos masivos', e);
      this.productosMasivosFiltrados = Array.isArray(this.productosMasivos) ? [...this.productosMasivos] : [];
    }
  }

  cambiarPaginaMasivo(n: number): void {
    const maxPages = Math.max(1, Math.ceil(this.productosMasivosTotal / this.productosMasivosPageSize));
    if (n < 1 || n > maxPages) return;
    this.productosMasivosPage = n;
    this.prepararFiltradoMasivo();
  }

  onPageSizeChangeMasivo(size: number): void {
    this.productosMasivosPageSize = Number(size) || 50;
    this.productosMasivosPage = 1;
    this.prepararFiltradoMasivo();
  }

  get productosMasivosMaxPages(): number {
    return Math.max(1, Math.ceil((this.productosMasivosTotal || 0) / (this.productosMasivosPageSize || 1)));
  }

  setOrdenNombre(dir: '' | 'asc' | 'desc'): void {
    // compatibility helper: map to generic sort
    if (dir === '') {
      this.sortBy = '';
      this.sortDir = '';
    } else {
      this.sortBy = 'nombre';
      this.sortDir = dir;
    }
    this.preciosPage = 1;
    this.prepararPaginacionPrecios();
    // also re-filter masivo view
    this.prepararFiltradoMasivo();
  }

  setSort(field: '' | 'nombre' | 'precio' | 'preciocompra' | 'stock' | 'margen' | 'productoId'): void {
    if (this.sortBy === field) {
      // toggle asc -> desc -> none
      if (this.sortDir === 'asc') this.sortDir = 'desc';
      else if (this.sortDir === 'desc') { this.sortBy = ''; this.sortDir = ''; }
      else this.sortDir = 'asc';
    } else {
      this.sortBy = field;
      this.sortDir = 'asc';
    }
    this.preciosPage = 1;
    this.prepararPaginacionPrecios();
    // also update masivo filtered/ordered list if present
    this.prepararFiltradoMasivo();
  }

  get preciosMaxPages(): number {
    return Math.max(1, Math.ceil((this.preciosTotal || 0) / (this.preciosPageSize || 1)));
  }

  onPageSizeChangePrecios(size: number): void {
    this.preciosPageSize = Number(size) || 10;
    this.preciosPage = 1;
    this.prepararPaginacionPrecios();
  }

  validarFormularioPrecio(): string[] {
    const errs: string[] = [];
    const p = this.editarPrecio || {};
    const productoId = (p.producto && p.producto.id) || p.productoId;
    if (!productoId) errs.push('Producto es requerido.');
    const precio = Number(p.precio);
    if (isNaN(precio) || precio <= 0) errs.push('Precio debe ser mayor a 0.');
    if (!p.moneda) errs.push('Moneda es requerida.');
    const desde = p.vigenciadesde ? new Date(p.vigenciadesde) : null;
    const hasta = p.vigenciahasta ? new Date(p.vigenciahasta) : null;
    if (desde && hasta && desde > hasta) errs.push('Vigencia desde debe ser anterior a vigencia hasta.');
    return errs;
  }

  getProductoImagenUrl(producto: any): string {
    if (!producto) return '';
    // Priorizar siempre la propiedad `imagen` que devuelve el backend (ej: "/media/..")
    const imagen = producto.imagen;
    if (imagen) return resolveBackendMediaUrl(imagen);

    const candidates = [producto.imagenPrincipal, producto.imagenUrl, (producto.imagenes && producto.imagenes.length ? (typeof producto.imagenes[0] === 'string' ? producto.imagenes[0] : producto.imagenes[0].url) : null)];
    for (const c of candidates) {
      if (c) return resolveBackendMediaUrl(c);
    }
    return '';
  }

  getMarcaNombre(producto: any): string {
    if (!producto) return '-';
    const m = producto.marca;
    if (!m) return '-';
    if (typeof m === 'object') return (m.nombre || m.denominacion || m.name || '-') as string;
    return String(m || '-');
  }

  getCategoriaProductoNombre(producto: any): string {
    if (!producto) return '-';
    const categoria = producto.categoria;
    if (categoria) {
      if (typeof categoria === 'object') {
        return String(categoria.ruta || categoria.nombre || categoria.name || categoria.descripcion || '-');
      }
      return String(categoria);
    }
    return String(producto.categoriaNombre || producto.categoria_name || producto.categoriaDescripcion || '-');
  }

  isProductoInactivo(p: PrecioProducto | null | undefined): boolean {
    try {
      if (!p || !p.producto) return false;
      const prod: any = p.producto;
      const rawEstado = prod.estado;
      const bajaFlag = prod.baja === true || prod.baja === 1 || prod.baja === '1' || String(prod.baja).toLowerCase() === 'true';
      if (bajaFlag) return true;
      // activo can be boolean, number (1/0/-1) or string
      if (typeof prod.activo === 'boolean') return !prod.activo;
      if (prod.activo === 0 || prod.activo === '0' || String(prod.activo).toLowerCase() === 'false') return true;
      if (prod.activo === 1 || prod.activo === '1' || String(prod.activo).toLowerCase() === 'true') return false;
      // fallback to estado field
      if (rawEstado !== undefined && rawEstado !== null) {
        const s = String(rawEstado).toLowerCase();
        if (s === 'inactivo' || s === '0' || s === 'false') return true;
        if (s === 'activo' || s === '1' || s === 'true') return false;
        if (s === 'baja' || s === '-1') return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // Normalize producto estado into a comparable string key
  normalizeProductoEstadoKey(p: PrecioProducto | null | undefined): string | null {
    try {
      if (!p || !p.producto) return null;
      const prod: any = p.producto;
      if (typeof prod.activo === 'boolean') return prod.activo ? '1' : '0';
      const raw = prod.estado;
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'boolean') return raw ? '1' : '0';
      const s = String(raw).toLowerCase();
      if (s === 'activo' || s === '1' || s === 'true') return '1';
      if (s === 'inactivo' || s === '0' || s === 'false') return '0';
      if (s === 'baja' || s === '-1') return 'baja';
      // fallback to raw string
      return String(raw);
    } catch (e) {
      return null;
    }
  }

  // Derive distinct estados from precios payload
  deriveEstadosFromPrecios(precios: PrecioProducto[]): Array<{ value: any; label: string }> {
    const seen = new Map<string, { value: any; label: string }>();
    for (const p of precios || []) {
      try {
        const key = this.normalizeProductoEstadoKey(p);
        if (key === null) continue;
        if (seen.has(key)) continue;
        let label = '';
        if (key === '1') label = 'Activo';
        else if (key === '0') label = 'Inactivo';
        else if (key === 'baja') label = 'Baja';
        else label = String(key);
        seen.set(key, { value: key, label });
      } catch (e) {
        // ignore
      }
    }
    // ensure common ordering: Todos, Activo, Inactivo, Baja, others
    const ordered: Array<{ value: any; label: string }> = [];
    if (seen.has('1')) ordered.push(seen.get('1')!);
    if (seen.has('0')) ordered.push(seen.get('0')!);
    if (seen.has('baja')) ordered.push(seen.get('baja')!);
    for (const [k, v] of seen) {
      if (k !== '1' && k !== '0' && k !== 'baja') ordered.push(v);
    }
    return ordered;
  }

  // Image modal state
  imageModalOpen = false;
  imageModalUrl = '';

  // Import TXT panel state (removed)

  openImageModal(url: string): void {
    if (!url) return;
    this.imageModalUrl = url;
    this.imageModalOpen = true;
  }

  onImportFileChange(ev: any): void {
    // removed import handler
    return;
  }

  abrirEditarProductoPorId(productoId: number): void {
    try {
      this.router.navigate(['/admin/articulos/manual', productoId]);
    } catch (e) {
      console.error(e);
      this.error = 'No se pudo abrir el editor de producto.';
    }
  }

  async importarDesdeTxt(): Promise<void> {
    // import functionality removed for this module
    return;
  }

  closeImageModal(): void {
    this.imageModalOpen = false;
    this.imageModalUrl = '';
  }
}
