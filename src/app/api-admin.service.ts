import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { Canal, ListaPrecio, Monedas, PrecioProducto, Producto, ProductoMedia } from './models';
import { normalizarMultimediaProducto } from './shared/utils/producto.utils';

export interface ProductosPaginadosResponse {
  items: Producto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MarcaAdminOption {
  id: number | string;
  nombre: string;
  descripcion?: string;
  logo?: string;
  media?: any;
  appId?: number;
  activa?: boolean;
}

export interface ProductoAtributosMasivosItem {
  id: number;
  marcaId?: number;
  categoriaId?: number;
  activo?: boolean;
}

export interface ProductoAtributosMasivosPayload {
  productos: ProductoAtributosMasivosItem[];
}

export interface RolAdmin {
  id: number;
  alias?: string;
  nombre: string;
  descripcion?: string;
}

export interface LocalidadAdmin {
  id: number;
  nombre: string;
  codigopostal?: string;
  codigoprovincia?: string;
  provincia?: string;
}

export interface AppAdmin {
  id: number;
  nombre: string;
  empresa?: {
    id: number;
    nombre: string;
  };
}

export interface PermisoAdmin {
  id: number;
  nombre: string;
  alias?: string;
  modulo?: string;
  grupo?: string;
}

export interface PermisoCatalogoAdmin extends PermisoAdmin {
  grupo?: string;
  descripcion?: string;
  esMenu?: boolean;
  icono?: string;
  router?: string;
  estado?: number;
  appId?: number;
  app?: AppAdmin & { descripcion?: string; logo?: string };
  asignado?: boolean;
  rolPermiso?: { id: number; estado?: number; orden?: number } | null;
}

export interface UsuarioAdmin {
  id: number;
  email: string;
  nombre?: string;
  apellido?: string;
  direccion?: string;
  telefono?: string;
  codigopostal?: string;
  nrocuentacorriente?: string;
  nrocuentacorrienteConfirmada?: number;
  saldocuentacorriente?: number;
  rol?: RolAdmin;
  empresa?: { id: number; nombre: string };
  localidad?: LocalidadAdmin;
  apps?: AppAdmin[];
  cuentas?: any[];
  permisos?: PermisoAdmin[];
}

export interface UsuarioAdminPayload {
  email: string;
  password?: string;
  nombre: string;
  apellido: string;
  direccion?: string;
  telefono?: string;
  codigopostal?: string;
  localidadId?: number | null;
  empresaId?: number | null;
  rolId?: number | null;
  appIds?: number[];
  nrocuentacorriente?: string;
  nrocuentacorrienteConfirmada?: number;
  saldocuentacorriente?: number;
}

export interface ProductoCaracteristicaAdminItem {
  id?: number;
  nombre: string;
  valor: string;
  orden?: number;
}

export interface ProductoCaracteristicasMasivoPayload {
  caracteristicas: ProductoCaracteristicaAdminItem[];
}

export interface ModeloImputacionAdminOption {
  id?: number;
  modeloImputacionId?: number;
  nombre: string;
  tipo?: string | null;
}

export interface ProductoImputacionesPayload {
  imputaciones: number[];
}

export interface PrecioProductoAdminPayload {
  productoId: number;
  listaPrecioId: number;
  producto?: { id: number };
  listaPrecio?: { id: number };
  producto_id?: number;
  lista_precio_id?: number;
  precio: number;
  precioCompra?: number;
  margen?: number;
  moneda: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  observaciones?: string;
  canal?: string;
}

export interface UploadPrincipalResponse {
  status: string;
  id: number;
  imagen: string;
  fileName: string;
}

export interface MediaSearchItem {
  title: string;
  source: string;
  pageUrl?: string | null;
  imageUrl: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  contentType?: string | null;
  license?: string | null;
}

export type MediaSearchMode = 'logo' | 'product';
export type MediaSearchProvider = 'brandfetch' | 'pexels';

export interface MediaSearchResponse {
  items: MediaSearchItem[];
  provider?: string;
  mode?: MediaSearchMode;
}

export interface ProductoMediaImportResponse {
  status: string;
  item: ProductoMedia;
}

export interface ProductoMediaPayload {
  url?: string | null;
  descripcion?: string | null;
  orden?: number | null;
  mediaId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class ApiAdminService {
  constructor(private http: HttpClient) {}

  private getAdminHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private getAuthOptions() {
    return { headers: this.getAdminHeaders() };
  }

  private getMultipartAuthOptions() {
    const token = localStorage.getItem('token');
    return {
      headers: new HttpHeaders({
        'Authorization': token ? `Bearer ${token}` : ''
      })
    };
  }

  getCategorias(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrlBackend}/api/categorias`, this.getAuthOptions());
  }

  getListasPrecios(appId: number): Observable<ListaPrecio[]> {
    return this.http.get<ListaPrecio[]>(`${environment.apiUrlBackend}/api/listas-precios`, {
      ...this.getAuthOptions(),
      params: { appId }
    });
  }

  getPreciosPorLista(appId: number, listaPrecioId: number): Observable<PrecioProducto[]> {
    return this.http.get<PrecioProducto[]>(`${environment.apiUrlBackend}/api/precios-productos`, {
      ...this.getAuthOptions(),
      params: { listaPrecioId, appId }
    });
  }

  crearListaPrecio(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/listas-precios`, data, this.getAuthOptions());
  }

  editarListaPrecio(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/listas-precios/${id}`, data, this.getAuthOptions());
  }

  desactivarListaPrecio(id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/listas-precios/${id}`, this.getAuthOptions());
  }

 getPrecioProducto(appId: number, listaPrecioId: number, productoId: number): Observable<PrecioProducto> {
  return this.http.get<PrecioProducto>(
    `${environment.apiUrlBackend}/api/precios-productos/precios`,
    {
      ...this.getAuthOptions(),
      params: { appId, listaPrecioId, productoId }
    }
  );
}
getPreciosProducto(appId: number, productoId: number): Observable<any> {


  return this.http.get<any>(
    `${environment.apiUrlBackend}/api/precios-productos/precios-por-producto/${productoId}`,
    {
      ...this.getAuthOptions(),
      //params: { appId }
    }
  );
}

   getMonedas(appId: number): Observable<Monedas[]> {
    return this.http.get<Monedas[]>(`${environment.apiUrlBackend}/api/monedas`, this.getAuthOptions());
  }

  getCanales(appId: number): Observable<Canal[]> {
    return this.http.get<Canal[]>(`${environment.apiUrlBackend}/api/canales`, {
      ...this.getAuthOptions(),
      params: { appId }
    });
  }


  getMarcas(appIdOrParams?: number | { appId?: number; nombre?: string; activa?: boolean }): Observable<MarcaAdminOption[]> {
    let params: any = {};
    if (typeof appIdOrParams === 'number') {
      params.appId = appIdOrParams;
    } else if (typeof appIdOrParams === 'object' && appIdOrParams != null) {
      params = { ...appIdOrParams };
    }

    return this.http.get<MarcaAdminOption[]>(`${environment.apiUrlBackend}/api/marcas`, {
      ...this.getAuthOptions(),
      params: Object.keys(params).length ? params : undefined
    });
  }

  // Crear marca
  crearMarca(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/marcas`, data, this.getAuthOptions());
  }

  // Editar marca
  editarMarca(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/marcas/${id}`, data, this.getAuthOptions());
  }

  // Eliminar marca
  eliminarMarca(id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/marcas/${id}`, this.getAuthOptions());
  }

  // Subir logo/imagen para marca (multipart)
  uploadMarcaLogo(marcaId: number, file: File): Observable<UploadPrincipalResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadPrincipalResponse>(
      `${environment.apiUrlBackend}/api/marcas/${marcaId}/logo/upload`,
      formData,
      this.getMultipartAuthOptions()
    );
  }

  // Crear marca multipart (soporta campo 'image')
  crearMarcaMultipart(formData: FormData): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/marcas`, formData, this.getMultipartAuthOptions());
  }

  // Editar marca multipart (soporta campo 'image')
  editarMarcaMultipart(id: number, formData: FormData): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/marcas/${id}`, formData, this.getMultipartAuthOptions());
  }

  // Obtener estados posibles para productos (proviene de backend)
  getProductoEstados(appId?: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrlBackend}/api/productos/estados`, {
      ...this.getAuthOptions(),
      params: appId ? { appId } : undefined
    });
  }

  getProductos(params?: any): Observable<Producto[] | ProductosPaginadosResponse> {
    return this.http
      .get<Producto[] | ProductosPaginadosResponse>(`${environment.apiUrlBackend}/api/productos`, {
        ...this.getAuthOptions(),
        params
      })
      .pipe(map((response) => this.normalizarRespuestaProductos(response)));
  }

  getProducto(id: number): Observable<Producto> {
    return this.http
      .get<Producto>(`${environment.apiUrlBackend}/api/productos/${id}`, this.getAuthOptions())
      .pipe(map((response) => this.normalizarRespuestaProductos(response)));
  }

  crearCategoria(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/categorias`, data, this.getAuthOptions());
  }

  editarCategoria(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/categorias/${id}`, data, this.getAuthOptions());
  }

  eliminarCategoria(id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/categorias/${id}`, this.getAuthOptions());
  }

  crearProducto(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/productos`, data, this.getAuthOptions());
  }

  editarProducto(id: number, data: any): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/productos/${id}`, data, this.getAuthOptions());
  }

  getProductoCaracteristicas(productoId: number): Observable<ProductoCaracteristicaAdminItem[]> {
    return this.http.get<ProductoCaracteristicaAdminItem[]>(`${environment.apiUrlBackend}/api/productos/${productoId}/caracteristicas`, this.getAuthOptions());
  }

  getModeloImputaciones(params?: any): Observable<ModeloImputacionAdminOption[]> {
    return this.http.get<ModeloImputacionAdminOption[]>(`${environment.apiUrlBackend}/api/modeloimputacion`, {
      ...this.getAuthOptions(),
      params
    });
  }

  getProductoImputaciones(productoId: number): Observable<ModeloImputacionAdminOption[]> {
    return this.http.get<ModeloImputacionAdminOption[]>(`${environment.apiUrlBackend}/api/productos/${productoId}/imputaciones`, this.getAuthOptions());
  }

  guardarProductoImputaciones(productoId: number, imputaciones: number[]): Observable<any> {
    return this.http.put(
      `${environment.apiUrlBackend}/api/productos/${productoId}/imputaciones`,
      { imputaciones },
      this.getAuthOptions()
    );
  }

  crearProductoCaracteristica(productoId: number, data: ProductoCaracteristicaAdminItem): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/productos/${productoId}/caracteristicas`, data, this.getAuthOptions());
  }

  actualizarProductoCaracteristica(productoId: number, id: number, data: ProductoCaracteristicaAdminItem): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/productos/${productoId}/caracteristicas/${id}`, data, this.getAuthOptions());
  }

  eliminarProductoCaracteristica(productoId: number, id: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/productos/${productoId}/caracteristicas/${id}`, this.getAuthOptions());
  }

  guardarProductoCaracteristicas(productoId: number, payload: ProductoCaracteristicasMasivoPayload): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/productos/${productoId}/caracteristicas`, payload, this.getAuthOptions());
  }

  uploadImagenPrincipal(productoId: number, file: File): Observable<UploadPrincipalResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadPrincipalResponse>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/imagen-principal/upload`,
      formData,
      this.getMultipartAuthOptions()
    );
  }

  setImagenPrincipal(productoId: number, imagen: string | null): Observable<any> {
    return this.http.put(
      `${environment.apiUrlBackend}/api/productos/${productoId}/imagen-principal`,
      { imagen },
      this.getAuthOptions()
    );
  }

  createProductoMedia(productoId: number, payload: ProductoMediaPayload): Observable<ProductoMedia> {
    return this.http.post<ProductoMedia>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/media`,
      payload,
      this.getAuthOptions()
    );
  }

  uploadProductoMedia(
    productoId: number,
    file: File,
    mediaId: number,
    descripcion?: string,
    orden?: number
  ): Observable<ProductoMedia> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mediaId', String(mediaId));
    if (descripcion?.trim()) {
      formData.append('descripcion', descripcion.trim());
    }
    if (Number.isFinite(orden)) {
      formData.append('orden', String(orden));
    }

    return this.http.post<ProductoMedia>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/media/upload`,
      formData,
      this.getMultipartAuthOptions()
    );
  }

  /**
   * Importar productos desde archivo TSV/TSV con cabecera (multipart/form-data)
   * Endpoint: POST /api/productos/import-txt
   */
  importProductosTxt(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${environment.apiUrlBackend}/api/productos/import-txt`, formData, this.getMultipartAuthOptions());
  }

  /**
   * Importar precios desde archivo TSV (multipart/form-data)
   * Endpoint: POST /api/precios-productos/import-txt or
   * POST /api/precios-productos/import-txt/:selectedListaId when a lista is selected
   * The selectedListaId must be sent as a path parameter (not inside the TSV).
   */
  importPreciosTxt(file: File, listaPrecioId?: number): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    const options: any = { ...this.getMultipartAuthOptions() };
    const url = typeof listaPrecioId !== 'undefined' && listaPrecioId !== null
      ? `${environment.apiUrlBackend}/api/precios-productos/import-txt/${listaPrecioId}`
      : `${environment.apiUrlBackend}/api/precios-productos/import-txt`;
    return this.http.post(url, formData, options);
  }

  updateProductoMedia(productoId: number, mediaItemId: number, payload: ProductoMediaPayload): Observable<ProductoMedia> {
    return this.http.put<ProductoMedia>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/media/${mediaItemId}`,
      payload,
      this.getAuthOptions()
    );
  }

  deleteProductoMedia(productoId: number, mediaItemId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/productos/${productoId}/media/${mediaItemId}`, this.getAuthOptions());
  }

  searchMedia(
    query: string,
    mode: MediaSearchMode,
    limit = 12,
    provider?: MediaSearchProvider
  ): Observable<MediaSearchResponse> {
    return this.http.get<MediaSearchResponse>(`${environment.apiUrlBackend}/api/productos/media-search`, {
      ...this.getAuthOptions(),
      params: {
        query,
        mode,
        limit,
        ...(provider ? { provider } : {})
      }
    });
  }

  searchProductoMediaWeb(
    query: string,
    mode: MediaSearchMode,
    limit = 12,
    provider?: MediaSearchProvider
  ): Observable<MediaSearchResponse> {
    return this.searchMedia(query, mode, limit, provider);
  }

  importMainImageFromUrl(productoId: number, imageUrl: string): Observable<UploadPrincipalResponse> {
    return this.http.post<UploadPrincipalResponse>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/imagen-principal/import-from-url`,
      { imageUrl },
      this.getAuthOptions()
    );
  }

  importImagenPrincipalFromUrl(productoId: number, imageUrl: string): Observable<UploadPrincipalResponse> {
    return this.importMainImageFromUrl(productoId, imageUrl);
  }

  importGalleryImageFromUrl(
    productoId: number,
    payload: { imageUrl: string; mediaId: number; descripcion?: string; orden?: number }
  ): Observable<ProductoMediaImportResponse> {
    return this.http.post<ProductoMediaImportResponse>(
      `${environment.apiUrlBackend}/api/productos/${productoId}/media/import-from-url`,
      payload,
      this.getAuthOptions()
    );
  }

  importProductoMediaFromUrl(
    productoId: number,
    payload: { imageUrl: string; mediaId: number; descripcion?: string; orden?: number }
  ): Observable<ProductoMediaImportResponse> {
    return this.importGalleryImageFromUrl(productoId, payload);
  }

  actualizarAtributosProductos(data: ProductoAtributosMasivosPayload): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/productos/actualizar-atributos`, data, this.getAuthOptions());
  }

  crearPrecioProducto(data: PrecioProductoAdminPayload): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/precios-productos`, data, this.getAuthOptions());
  }

  /**
   * Bulk assign multiple productos to a lista de precios.
   * Payload expected: { listaPrecioId, monedaId?, items: [{ productoId, precio?, preciocompra?, margen?, monedaId? }], options?: { onConflict, atomic } }
   */
  bulkAssignPrecios(data: any): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/precios-productos/bulk-assign`, data, this.getAuthOptions());
  }

  /**
   * Vaciar (borrar masivamente) todos los precios de una lista de precios.
   * Endpoint: DELETE /api/precios-productos/lista/:listaId
   * Requiere autorización y middleware de admin en backend.
   * Respuesta esperada: { status: 'ok', deleted: N }
   */
  vaciarListaPrecios(listaPrecioId: number): Observable<any> {
    return this.http.delete(`${environment.apiUrlBackend}/api/precios-productos/lista/${listaPrecioId}`, this.getAuthOptions());
  }

  actualizarPrecioProducto(precioProductoId: number, data: PrecioProductoAdminPayload): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/precios-productos/${precioProductoId}`, data, this.getAuthOptions());
  }

  eliminarProducto(id: number): Observable<any> {
    debugger
    return this.http.delete(`${environment.apiUrlBackend}/api/productos/${id}`, this.getAuthOptions());
  }

  eliminarPrecioProducto(precioProductoId: number, appId?: number): Observable<any> {
    const options: any = { ...this.getAuthOptions() };
    if (typeof appId !== 'undefined' && appId !== null) options.params = { appId };
    return this.http.delete(`${environment.apiUrlBackend}/api/precios-productos/${precioProductoId}`, options);
  }

  getProductosRelacionados(productoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrlBackend}/api/productos/${productoId}/relacionados`, this.getAuthOptions());
  }

  syncProductosRelacionados(productoId: number, relacionados: number[]): Observable<any> {
    return this.http.put(`${environment.apiUrlBackend}/api/productos/${productoId}/relacionados`, { relacionados }, this.getAuthOptions());
  }



  actualizarOrdenCategoria(payload: { ordenes: { id: number, orden: number }[] }): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/categorias/actualizar-orden`, payload, this.getAuthOptions());
  }

  // ── Usuarios ──────────────────────────────────────────────────────────────
  getUsuarios(params?: any): Observable<UsuarioAdmin[]> {
    return this.http.get<UsuarioAdmin[]>(`${environment.apiUrlBackend}/api/usuarios`, {
      ...this.getAuthOptions(),
      params
    });
  }

  getUsuario(id: number): Observable<UsuarioAdmin> {
    return this.http.get<UsuarioAdmin>(`${environment.apiUrlBackend}/api/usuarios/${id}`, this.getAuthOptions());
  }

  crearUsuario(data: UsuarioAdminPayload): Observable<UsuarioAdmin> {
    return this.http.post<UsuarioAdmin>(`${environment.apiUrlBackend}/api/usuarios`, data, this.getAuthOptions());
  }

  editarUsuario(id: number, data: Partial<UsuarioAdminPayload>): Observable<UsuarioAdmin> {
    return this.http.put<UsuarioAdmin>(`${environment.apiUrlBackend}/api/usuarios/${id}`, data, this.getAuthOptions());
  }

  eliminarUsuario(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrlBackend}/api/usuarios/${id}`, this.getAuthOptions());
  }

  getRoles(): Observable<RolAdmin[]> {
    return this.http.get<RolAdmin[]>(`${environment.apiUrlBackend}/api/roles`, this.getAuthOptions());
  }

  getLocalidades(query = ''): Observable<LocalidadAdmin[]> {
    return this.http.get<LocalidadAdmin[]>(`${environment.apiUrlBackend}/api/localidades`, {
      ...this.getAuthOptions(),
      params: query ? { query } : undefined
    });
  }

  getApps(empresaId?: number | null): Observable<AppAdmin[]> {
    return this.http.get<AppAdmin[]>(`${environment.apiUrlBackend}/api/apps`, {
      ...this.getAuthOptions(),
      params: empresaId ? { empresaId } : undefined
    });
  }

  getPermisos(): Observable<PermisoCatalogoAdmin[]> {
    return this.http.get<PermisoCatalogoAdmin[]>(`${environment.apiUrlBackend}/api/permisos`, this.getAuthOptions());
  }

  getPermisosCatalogo(rolId: number, appId: number): Observable<PermisoCatalogoAdmin[]> {
    return this.http.get<PermisoCatalogoAdmin[]>(`${environment.apiUrlBackend}/api/permisos/catalogo`, {
      ...this.getAuthOptions(),
      params: { rolId, appId }
    });
  }

  asignarPermisos(payload: { rolId: number; appId: number; permisoIds: number[] }): Observable<any> {
    return this.http.post(`${environment.apiUrlBackend}/api/permisos/asignar`, payload, this.getAuthOptions());
  }

  eliminarPermisosAsignados(payload: { rolId: number; appId: number; permisoIds: number[] }): Observable<any> {
    return this.http.request('delete', `${environment.apiUrlBackend}/api/permisos/asignar`, {
      ...this.getAuthOptions(),
      body: payload
    });
  }

  private normalizarRespuestaProductos<T>(response: T): T {
    return normalizarMultimediaProducto(response);
  }
 

   // En ApiAdminService: método ping
  ping() {
    // Usa el prefijo /api para endpoints administrativos
    return this.http.get(`${environment.apiUrlBackend}/api/ping`);
  }



}
