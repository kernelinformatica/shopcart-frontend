import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { PermisosService } from '../../../permisos.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ApiAdminService, MarcaAdminOption, ProductoAtributosMasivosItem, ProductosPaginadosResponse } from '../../../api-admin.service';
import { ListaPrecio, Producto } from '../../../models';

interface CategoriaFiltroOption {
  id: number;
  nombre: string;
  ruta: string;
}

interface ProductoActualizacionPendiente {
  productoId: number;
  marcaId: number | string | null;
  marca: string;
  activo:boolean | true | false | null;
  categoriaId: number | null;
  rubroId: number | null;
  subcategoriaId: number | null;
}

@Component({
  selector: 'app-articulos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './articulos-admin.component.html',
  styleUrl: './articulos-admin.component.scss'
})
export class ArticulosAdminComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);
  private readonly permisosService = inject(PermisosService);
  private readonly selectedAppStorageKey = 'selectedAppId';
  readonly pageSizeOptions = [10, 25, 50, 100];

  cargando = false; 
  eliminandoId: number | null = null;
  productoAEliminar: Producto | null = null;
  actualizandoMasivo = false;
  mensaje = '';
  error = '';
  productos: Producto[] = [];
  categorias: any[] = [];
  imagenAmpliadaUrl: string | null = null;
  imagenAmpliadaAlt = '';
  paginaActual = 1;
  productosPorPagina = 25;
  totalProductos = 0;
  appIdActual = this.getSelectedAppId();
  busquedaNombre = '';
  marcaSeleccionadaId: number | string | null = null;
  estadoSeleccionado: boolean | null | -1 = true;
  marcas: MarcaAdminOption[] = [];
  listasPrecios: ListaPrecio[] = [];
  categoriaBusqueda = '';
  categoriaSeleccionadaId: number | null = null;
  listaPrecioSeleccionadaId: number | null = null;
  categoriasFiltro: CategoriaFiltroOption[] = [];
  filtrosPlegados = false;
  productosSeleccionados = new Set<number>();
  actualizacionesPendientes: Record<number, ProductoActualizacionPendiente> = {};
estadoMasivo: boolean | null = null;
marcaMasiva: number | null = null;
categoriaMasiva: number | null = null;
  ngOnInit(): void {
    this.cargarDatos();
  }

  toggleFiltros(): void {
    this.filtrosPlegados = !this.filtrosPlegados;
  }

  async cargarDatos(): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.estadoMasivo = true;
    try {
      this.appIdActual = this.getSelectedAppId();
      const [productosResponse, categorias, marcas, listasPrecios] = await Promise.all([
        firstValueFrom(this.apiAdmin.getProductos(this.construirParamsConsulta())),
        firstValueFrom(this.apiAdmin.getCategorias()),
        firstValueFrom(this.apiAdmin.getMarcas(this.appIdActual)),
        firstValueFrom(this.apiAdmin.getListasPrecios(this.appIdActual))
      ]);
      this.categorias = categorias || [];
      this.marcas = (marcas || []).filter((marca) => marca?.activa !== false);
      this.listasPrecios = (listasPrecios || []).filter((lista) => !!lista?.id);
      if (this.marcaSeleccionadaId != null && !this.marcas.some((marca) => String(marca.id) === String(this.marcaSeleccionadaId))) {
        this.marcaSeleccionadaId = null;
      }
      if (this.listaPrecioSeleccionadaId != null && !this.listasPrecios.some((lista) => lista.id === this.listaPrecioSeleccionadaId)) {
        this.listaPrecioSeleccionadaId = null;
      }
      this.categoriasFiltro = this.aplanarCategorias(this.categorias);
      this.asignarProductosDesdeRespuesta(productosResponse);
      this.normalizarPaginaActual();
    } catch {
      this.productos = [];
      this.totalProductos = 0;
      this.categorias = [];
      this.marcas = [];
      this.listasPrecios = [];
      this.categoriasFiltro = [];
      this.productosSeleccionados.clear();
      this.actualizacionesPendientes = {};
      this.error = 'No pudimos cargar los artículos administrativos.';
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltros(): void {
    this.paginaActual = 1;
    void this.cargarDatos();
  }

  
  limpiarFiltros(): void {
    this.busquedaNombre = '';
    this.marcaSeleccionadaId = null;
    this.estadoSeleccionado = true;
    this.categoriaBusqueda = '';
    this.categoriaSeleccionadaId = null;
    this.listaPrecioSeleccionadaId = null;
    
    this.paginaActual = 1;
    void this.cargarDatos();
  }

  estaProductoSeleccionado(productoId: number | null | undefined): boolean {
    return !!productoId && this.productosSeleccionados.has(productoId);
  }

  toggleSeleccionProducto(producto: Producto, seleccionado: any): void {
    if (!producto?.id) {
      return;
    }

    const isSelected = !!seleccionado;

    if (isSelected) {
      this.productosSeleccionados.add(producto.id);
      this.actualizacionesPendientes[producto.id] = this.construirActualizacionPendiente(producto);
      return;
    }

    this.productosSeleccionados.delete(producto.id);
    delete this.actualizacionesPendientes[producto.id];
  }

  getCantidadSeleccionados(): number {
    return this.productosSeleccionados.size;
  }

  estanTodosSeleccionados(): boolean {
    const productosVisibles = this.getProductosPaginados().filter((producto) => !!producto?.id);
    return productosVisibles.length > 0 && productosVisibles.every((producto) => this.productosSeleccionados.has(producto.id));
  }

  toggleSeleccionTodos(seleccionado: any): void {
    const isSelected = !!seleccionado;
    for (const producto of this.getProductosPaginados()) {
       if (producto.baja) {
      continue;
    }
      this.toggleSeleccionProducto(producto, isSelected);
    }
  }

  getMarcaDraft(producto: Producto): number | string | null {
    if (!producto?.id) {
      return null;
    }
    return this.actualizacionesPendientes[producto.id]?.marcaId ?? this.getMarcaEditableId(producto);
  }

  getCategoriaDraft(producto: Producto): number | null {
    if (!producto?.id) {
      return null;
    }
    return this.actualizacionesPendientes[producto.id]?.categoriaId ?? this.getCategoriaEditableId(producto);
  }

  onCategoriaBusquedaChange(valor: string): void {
    const termino = valor.trim();
    if (!termino) {
      this.categoriaSeleccionadaId = null;
      return;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionada();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta !== valor) {
      this.categoriaSeleccionadaId = null;
    }
  }

  getCategoriasFiltradas(): CategoriaFiltroOption[] {
    const termino = this.normalizarTexto(this.categoriaBusqueda);
    if (!termino) {
      return this.categoriasFiltro.slice(0, 80);
    }
    return this.categoriasFiltro
      .filter((categoria) => this.normalizarTexto(categoria.ruta).includes(termino))
      .slice(0, 80);
  }

  onSeleccionarCategoria(valor: string): void {
    if (!valor) {
      this.categoriaSeleccionadaId = null;
      return;
    }
    const categoriaId = Number(valor);
    this.categoriaSeleccionadaId = Number.isFinite(categoriaId) && categoriaId > 0 ? categoriaId : null;
  }

  seleccionarCategoria(categoria: CategoriaFiltroOption): void {
    this.categoriaSeleccionadaId = categoria.id;
    this.categoriaBusqueda = categoria.ruta;
  }

  getMostrarSugerenciasCategoria(): boolean {
    const termino = this.categoriaBusqueda.trim();
    if (!termino) {
      return false;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionada();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta === termino) {
      return false;
    }

    return this.getCategoriasFiltradas().length > 0;
  }

  getSinResultadosCategoria(): boolean {
    const termino = this.categoriaBusqueda.trim();
    if (!termino) {
      return false;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionada();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta === termino) {
      return false;
    }

    return this.getCategoriasFiltradas().length === 0;
  }

  limpiarCategoriaSeleccionada(): void {
    this.categoriaSeleccionadaId = null;
    this.categoriaBusqueda = '';
  }

  getNombreCategoriaSeleccionada(): string {
    if (!this.categoriaSeleccionadaId) {
      return 'Todas las categorías';
    }
    return this.getCategoriaSeleccionada()?.ruta || 'Categoría seleccionada';
  }
  get puedeCrearArticulos(): boolean {
   return this.permisosService.tienePermiso('articulos')  && this.permisosService.tienePermiso('articulos_crear');
  }
  get puedeBorrarArticulos(): boolean {
   return this.permisosService.tienePermiso('articulos')  && this.permisosService.tienePermiso('articulos_borrar');
  }
  get puedeEditarArticulos(): boolean {
   return this.permisosService.tienePermiso('articulos')  && this.permisosService.tienePermiso('articulos_editar');
  }
  get puedeCargarMasivoArticulos(): boolean {
   return this.permisosService.tienePermiso('articulos')  && this.permisosService.tienePermiso('articulos_carga_masiva');
  }
get puedeConfigurarApiArticulos(): boolean {
    return this.permisosService.tienePermiso('articulos')  && this.permisosService.tienePermiso('articulos_configurar_api');
  }

  
  async eliminarProducto(producto: Producto): Promise<void> {
    if (!producto?.id) return;
    // set the producto to be deleted and open modal via data-bs attributes in template
    this.productoAEliminar = producto;
  }

  async onEliminarProductoConfirmed(): Promise<void> {
    if (!this.productoAEliminar) return;
    const producto = this.productoAEliminar;
    this.eliminandoId = producto.id;
    this.error = '';
    try {
      await firstValueFrom(this.apiAdmin.eliminarProducto(producto.id));
      this.mensaje = 'Artículo eliminado correctamente.';
      await this.cargarDatos();
      this.normalizarPaginaActual();
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos eliminar el artículo.';
    } finally {
      this.eliminandoId = null;
      this.productoAEliminar = null;
    }
  }

  onEliminarProductoCancelled(): void {
    this.productoAEliminar = null;
  }

  getMarcaEditableId(producto: Producto): number | string | null {
    const marcaId =
      (producto as any)?.marca?.id ??
      (producto as any)?.marcaId ??
      (producto as any)?.marca_id ??
      (producto as any)?.idMarca ??
      (producto as any)?.id_marca ??
      null;

    if (marcaId != null && String(marcaId).trim() !== '') {
      return this.buscarMarcaPorId(marcaId)?.id ?? marcaId;
    }

    const marcaNombre = this.getMarcaNombreProducto(producto);
    if (!marcaNombre) {
      return null;
    }

    return this.buscarMarcaPorNombre(marcaNombre)?.id ?? null;
  }

  getCategoriaEditableId(producto: Producto): number | null {
    const categoriaId =
      (producto as any)?.categoriaId ??
      (producto as any)?.rubroId ??
      (producto as any)?.subcategoriaId ??
      (producto as any)?.categoria?.id ??
      (producto as any)?.rubro?.id ??
      producto.subcategoria?.id ??
      null;

    if (Number.isFinite(Number(categoriaId)) && Number(categoriaId) > 0) {
      return this.buscarCategoriaPorId(Number(categoriaId))?.id ?? Number(categoriaId);
    }

    return this.buscarCategoriaProducto(producto)?.id ?? null;
  }

  actualizarMarcaProducto(producto: Producto, valor: unknown): void {
    if (!producto?.id) {
      return;
    }

    this.ensureActualizacionPendiente(producto);
    const marcaId = this.esValorVacio(valor) ? null : this.buscarMarcaPorId(valor)?.id ?? (valor as number | string);
    const marcaSeleccionada = this.buscarMarcaPorId(marcaId);
    this.actualizacionesPendientes[producto.id] = {
      ...this.actualizacionesPendientes[producto.id],
      productoId: producto.id,
      marcaId,
      marca: marcaSeleccionada?.nombre || '',
      categoriaId: this.actualizacionesPendientes[producto.id].categoriaId,
      rubroId: this.actualizacionesPendientes[producto.id].rubroId,
      subcategoriaId: this.actualizacionesPendientes[producto.id].subcategoriaId
    };
  }



actualizarEstadoProducto(producto: Producto, valor: boolean): void {
  
  if (!producto?.id) {
    return;
  }
  this.ensureActualizacionPendiente(producto);
 
  this.actualizacionesPendientes[producto.id] = {
    ...this.actualizacionesPendientes[producto.id],
    productoId: producto.id,
    // acá guardamos el nuevo estado
    marcaId: this.actualizacionesPendientes[producto.id].marcaId,
    marca: this.actualizacionesPendientes[producto.id].marca,
    activo: valor,
    categoriaId: this.actualizacionesPendientes[producto.id].categoriaId,
    rubroId: this.actualizacionesPendientes[producto.id].rubroId,
    subcategoriaId: this.actualizacionesPendientes[producto.id].subcategoriaId
  };
  
}


getEstadoEditable(producto: Producto): boolean | null {
  if (!producto?.id) {
    return null;
  }

  return this.actualizacionesPendientes[producto.id]?.activo
    ?? producto.activo
    ?? null;
}


  actualizarCategoriaProducto(producto: Producto, valor: unknown): void {
    if (!producto?.id) {
      return;
    }

    this.ensureActualizacionPendiente(producto);
    const categoriaId = this.esValorVacio(valor) ? null : Number(valor);
    this.actualizacionesPendientes[producto.id] = {
      ...this.actualizacionesPendientes[producto.id],
      productoId: producto.id,
      marcaId: this.actualizacionesPendientes[producto.id].marcaId,
      marca: this.actualizacionesPendientes[producto.id].marca,
      categoriaId,
      rubroId: categoriaId,
      subcategoriaId: categoriaId
    };
  }

  async actualizarProductosSeleccionados(): Promise<void> {
    const productosAActualizar = this.productos
      .filter((producto) => producto?.id && !producto.baja  && this.productosSeleccionados.has(producto.id))
      
      .map((producto) => this.construirPayloadActualizacionMasiva(producto))
      .filter((item): item is ProductoAtributosMasivosItem => !!item);

 console.log("Payload:", productosAActualizar);
    if (productosAActualizar.length === 0) {
      this.error = 'Seleccioná productos con cambios en marca, estado y/o categoría para la actualización masiva.';
      this.mensaje = '';
      return;
    }

    this.actualizandoMasivo = true;
    this.error = '';
    this.mensaje = '';

    try {
      await firstValueFrom(this.apiAdmin.actualizarAtributosProductos({ productos: productosAActualizar }));

      this.mensaje = 'Actualización masiva realizada correctamente.';
      this.productosSeleccionados.clear();
      this.actualizacionesPendientes = {};
      await this.cargarDatos();
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos ejecutar la actualización masiva.';
    } finally {
      this.actualizandoMasivo = false;
    }
  }

  getImagenPrincipal(producto: Producto): string | null {
    return producto.imagenPrincipal || producto.imagen || null;
  }

  ampliarImagen(producto: Producto): void {
    const imagenUrl = this.getImagenPrincipal(producto);
    if (!imagenUrl) {
      return;
    }
    this.imagenAmpliadaUrl = imagenUrl;
    this.imagenAmpliadaAlt = producto.nombre || 'Imagen de articulo';
  }

  cerrarImagenAmpliada(): void {
    this.imagenAmpliadaUrl = null;
    this.imagenAmpliadaAlt = '';
  }

  getProductosPaginados(): Producto[] {
    return this.productos;
  }

  getTotalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalProductos / this.productosPorPagina));
  }

  getPaginasVisibles(): number[] {
    const total = this.getTotalPaginas();
    const inicio = Math.max(1, this.paginaActual - 2);
    const fin = Math.min(total, inicio + 4);
    const paginas: number[] = [];
    for (let pagina = Math.max(1, fin - 4); pagina <= fin; pagina += 1) {
      paginas.push(pagina);
    }
    return paginas;
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.getTotalPaginas() || pagina === this.paginaActual) {
      return;
    }
    this.paginaActual = pagina;
    void this.cargarDatos();
  }

  cambiarProductosPorPagina(valor: string): void {
    const pageSize = Number(valor);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return;
    }
    this.productosPorPagina = pageSize;
    this.paginaActual = 1;
    void this.cargarDatos();
  }

  getRangoActual(): { desde: number; hasta: number } {
    if (this.totalProductos === 0) {
      return { desde: 0, hasta: 0 };
    }
    const desde = (this.paginaActual - 1) * this.productosPorPagina + 1;
    const hasta = Math.min(this.totalProductos, desde + this.productosPorPagina - 1);
    return { desde, hasta };
  }

  private normalizarPaginaActual(): void {
    this.paginaActual = Math.min(this.paginaActual, this.getTotalPaginas());
    this.paginaActual = Math.max(1, this.paginaActual);
  }

  private asignarProductosDesdeRespuesta(response: Producto[] | ProductosPaginadosResponse): void {
    if (Array.isArray(response)) {
      const productosFiltrados = this.filtrarProductosLocalmente(response);
      this.productos = productosFiltrados;
      this.totalProductos = productosFiltrados.length;
      return;
    }

    const productosRespuesta = response?.items || [];
    const productosFiltrados = this.filtrarProductosLocalmente(productosRespuesta);

    this.productos = productosFiltrados;
    this.totalProductos = productosFiltrados.length !== productosRespuesta.length
      ? productosFiltrados.length
      : Number(response?.total ?? productosFiltrados.length);
    this.paginaActual = Number(response?.page || this.paginaActual);
    this.productosPorPagina = Number(response?.pageSize || this.productosPorPagina);
  }

  private construirParamsConsulta(): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    page: this.paginaActual,
    pageSize: this.productosPorPagina
  };

  const nombre = this.busquedaNombre.trim();
  if (nombre) {
    params['search'] = nombre;
  }

  if (this.marcaSeleccionadaId != null) {
    params['marcaId'] = this.marcaSeleccionadaId;
  }

  if (this.categoriaSeleccionadaId) {
    params['categoriaId'] = this.categoriaSeleccionadaId;
  }

  if (this.listaPrecioSeleccionadaId) {
    params['listaPrecioId'] = this.listaPrecioSeleccionadaId;
  }

  if (this.estadoSeleccionado !== null) {
     params['estado'] = this.estadoSeleccionado === -1 ? 'baja' : this.estadoSeleccionado ? 'activo' : 'inactivo';
  }

  return params;
}

  private aplanarCategorias(categorias: any[], rutaPadre = ''): CategoriaFiltroOption[] {
    const resultado: CategoriaFiltroOption[] = [];
    for (const categoria of categorias || []) {
      if (!categoria?.id || !categoria?.nombre) {
        continue;
      }
      const ruta = rutaPadre ? `${rutaPadre} > ${categoria.nombre}` : categoria.nombre;
      resultado.push({ id: categoria.id, nombre: categoria.nombre, ruta });
      const subcategorias = this.obtenerSubcategorias(categoria);
      if (subcategorias.length > 0) {
        resultado.push(...this.aplanarCategorias(subcategorias, ruta));
      }
    }
    return resultado;
  }

  private obtenerSubcategorias(categoria: any): any[] {
    const colecciones = [
      categoria?.hijos,
      categoria?.children,
      categoria?.subcategorias,
      categoria?.subCategorias,
      categoria?.categorias
    ];

    for (const coleccion of colecciones) {
      if (Array.isArray(coleccion) && coleccion.length > 0) {
        return coleccion;
      }
    }

    return [];
  }

  private filtrarProductosLocalmente(productos: Producto[]): Producto[] {
    const terminoNombre = this.normalizarTexto(this.busquedaNombre);
    return (productos || []).filter((producto) => {
      const coincideNombre = !terminoNombre || this.normalizarTexto(`${producto.nombre || ''} ${producto.descripcion || ''}`).includes(terminoNombre);
      const coincideMarca = this.marcaSeleccionadaId == null || this.productoPerteneceAMarca(producto, this.marcaSeleccionadaId);
      const coincideCategoria = !this.categoriaSeleccionadaId || this.productoPerteneceACategoria(producto, this.categoriaSeleccionadaId);
      return coincideNombre && coincideMarca && coincideCategoria;
    });
  }

  private productoPerteneceAMarca(producto: Producto, marcaId: string | number): boolean {
    return [
      (producto as any)?.marca?.id,
      (producto as any)?.marcaId,
      (producto as any)?.marca_id,
      (producto as any)?.idMarca,
      (producto as any)?.id_marca
    ].some((id) => String(id ?? '') === String(marcaId));
  }

  private productoPerteneceACategoria(producto: Producto, categoriaId: number): boolean {
    return [
      (producto as any)?.categoria?.id,
      (producto as any)?.categoriaId,
      (producto as any)?.rubro?.id,
      (producto as any)?.rubroId,
      producto.subcategoria?.id,
      (producto as any)?.subcategoriaId
    ].some((id) => Number(id) === categoriaId);
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private getCategoriaSeleccionada(): CategoriaFiltroOption | undefined {
    return this.categoriasFiltro.find((categoria) => categoria.id === this.categoriaSeleccionadaId);
  }

  private getSelectedAppId(): number {
    try {
      const raw = localStorage.getItem(this.selectedAppStorageKey);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } catch {}

    return 1;
  }

  private esValorVacio(valor: unknown): boolean {
    return valor == null || (typeof valor === 'string' && valor.trim() === '');
  }

  private normalizarIdNumerico(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  private construirActualizacionPendiente(producto: Producto): ProductoActualizacionPendiente {
    const marcaId = this.getMarcaEditableId(producto);
    const marcaSeleccionada = this.buscarMarcaPorId(marcaId);
    const categoriaId = this.getCategoriaEditableId(producto);
    const estado = producto.estado === 'activo' ? true : producto.estado === 'inactivo' ? false : null;
    return {
      productoId: producto.id,
      marcaId,
      marca: marcaSeleccionada?.nombre || this.getMarcaNombreProducto(producto),
      activo:estado,
      categoriaId,
      rubroId: categoriaId,
      subcategoriaId: categoriaId
    };
  }

  private construirPayloadActualizacionMasiva(producto: Producto): ProductoAtributosMasivosItem | null {
    if (!producto?.id) {
      return null;
    }

    const cambios = this.actualizacionesPendientes[producto.id];
    if (!cambios) {
      return null;
    }

    const marcaOriginal = this.normalizarIdNumerico(this.getMarcaEditableId(producto));
    const marcaNueva = this.normalizarIdNumerico(cambios.marcaId);
    const categoriaOriginal = this.normalizarIdNumerico(this.getCategoriaEditableId(producto));
    const categoriaNueva = this.normalizarIdNumerico(cambios.categoriaId);
    const estadoOriginal = producto.activo === true ? true : producto.activo === false ? false : null;
    const estadoNuevo = cambios.activo === true ? true : cambios.activo === false ? false : null;
    const payload: ProductoAtributosMasivosItem = { id: producto.id };

    if (marcaNueva !== null && marcaNueva !== marcaOriginal) {
      payload.marcaId = marcaNueva;
    }

    if (categoriaNueva !== null && categoriaNueva !== categoriaOriginal) {
      payload.categoriaId = categoriaNueva;
    }
    if (estadoNuevo !== null && estadoNuevo !== estadoOriginal) {
      payload.activo = estadoNuevo;
    }
    

    return payload.marcaId != null || payload.categoriaId != null || payload.activo != null ? payload : null ;
  }

  private getMarcaNombreProducto(producto: Producto): string {
    return (
      (typeof producto.marca === 'string' ? producto.marca : '') ||
      (producto as any)?.marca?.nombre ||
      (producto as any)?.marcaNombre ||
      (producto as any)?.nombreMarca ||
      ''
    ).trim();
  }

  private buscarMarcaPorId(marcaId: unknown): MarcaAdminOption | undefined {
    if (marcaId == null || String(marcaId).trim() === '') {
      return undefined;
    }

    return this.marcas.find((marca) => String(marca.id) === String(marcaId));
  }

  private buscarMarcaPorNombre(nombre: string): MarcaAdminOption | undefined {
    const nombreNormalizado = this.normalizarTexto(nombre);
    if (!nombreNormalizado) {
      return undefined;
    }

    return this.marcas.find((marca) => this.normalizarTexto(marca.nombre || '') === nombreNormalizado);
  }

  private getCategoriaNombreProducto(producto: Producto): string {
    return (
      producto.subcategoria?.nombre ||
      (producto as any)?.rubro?.nombre ||
      (producto as any)?.categoria?.nombre ||
      (producto as any)?.categoriaNombre ||
      (producto as any)?.nombreCategoria ||
      (producto as any)?.subcategoriaNombre ||
      ''
    ).trim();
  }

  private buscarCategoriaPorId(categoriaId: number | null): CategoriaFiltroOption | undefined {
    if (!categoriaId) {
      return undefined;
    }

    return this.categoriasFiltro.find((categoria) => categoria.id === categoriaId);
  }

  private buscarCategoriaProducto(producto: Producto): CategoriaFiltroOption | undefined {
    const categoriaNombre = this.normalizarTexto(this.getCategoriaNombreProducto(producto));
    if (!categoriaNombre) {
      return undefined;
    }

    return this.categoriasFiltro.find((categoria) => {
      return this.normalizarTexto(categoria.ruta) === categoriaNombre || this.normalizarTexto(categoria.nombre) === categoriaNombre;
    });
  }

  private ensureActualizacionPendiente(producto: Producto): void {
    if (!producto?.id) {
      return;
    }

    if (!this.actualizacionesPendientes[producto.id]) {
      this.actualizacionesPendientes[producto.id] = this.construirActualizacionPendiente(producto);
    }
  }

  getNombreCategoria(producto: Producto): string {
    return (producto as any)?.rubro?.nombre || producto.subcategoria?.nombre || (producto as any)?.categoria?.nombre || 'Sin categoría';
  }

  getNombreListaPrecio(producto: Producto): string {
    return producto.listaPrecio?.nombre || (producto as any)?.listaPrecioNombre || 'Sin lista';
  }



aplicarEstadoMasivo(estado: any | null): void {
  if (this.productosSeleccionados.size === 0) {
    this.error = 'Seleccioná productos para aplicar el cambio de estado.';
    return;
    }else{
      this.error = '';
  }
 
  this.productos
    .filter(p => this.productosSeleccionados.has(p.id))
    .forEach(p => {
      this.actualizarEstadoProducto(p, estado);
      //p.activo = estado; // actualizar la UI
    });
}

aplicarMarcaMasiva(marcaId: any | null): void {
   if (this.productosSeleccionados.size === 0) {
    this.error = 'Seleccioná productos para aplicar el cambio de marca masiva.';
    return;
   }else{
      this.error = ''; 
  }
 
  this.productos
    .filter(p => this.productosSeleccionados.has(p.id))
    .forEach(p => {
      this.actualizarMarcaProducto(p, marcaId);
      //p.marca = marcaId;
    });
}

aplicarCategoriaMasiva(categoriaId: any | null): void {
   if (this.productosSeleccionados.size === 0) {
    this.error = 'Seleccioná productos para aplicar el cambio de categoría masiva.';
    return;
    }else{
      this.error = '';
  }
 
  this.productos
    .filter(p => this.productosSeleccionados.has(p.id))
    .forEach(p => {
      this.actualizarCategoriaProducto(p, categoriaId);
      //p.subcategoria = categoriaId;
    });
}




}