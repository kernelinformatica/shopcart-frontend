import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';
import {
  ActualizarUsuarioDireccionPayload,
  CotizacionEntregaRequest,
  CotizacionEntregaResponse,
  CrearUsuarioDireccionPayload,
  EntregaOpcion,
  EntregaTipo,
  EnvioEstado,
  Localidad,
  OrigenEnvioApp,
  PedidoEnvio,
  PedidoEnvioEstadoCambioPayload,
  PedidoEnvioEstadoHistorial,
  PedidoEnvioPayload,
  PrecisionGeo,
  UpdateOrigenEnvioAppPayload,
  UsuarioDireccion
} from './models';

@Injectable({ providedIn: 'root' })
export class LogisticaService {
  private readonly API = `${environment.apiUrl}/api`;

  constructor(private readonly http: HttpClient) {}

  getUsuarioDirecciones(appId: number, usuarioId: number): Observable<UsuarioDireccion[]> {
    const contexto = { appId, usuarioId };
    return this.http
      .get<UsuarioDireccion[]>(`${this.baseAppUrl(appId)}/usuarios/${usuarioId}/direcciones`, {
        headers: this.authHeaders()
      })
      .pipe(
        map((direcciones) => this.normalizarUsuarioDirecciones(direcciones, contexto)),
        switchMap((lista) => {
          if (lista.length) {
            return of(lista);
          }
          return this.getUsuarioDireccionesGlobal(usuarioId, contexto);
        }),
        catchError((error) => {
          if (error?.status === 404 || error?.status === 400) {
            return this.getUsuarioDireccionesGlobal(usuarioId, contexto);
          }
          return throwError(() => error);
        })
      );
  }

  private getUsuarioDireccionesGlobal(
    usuarioId: number,
    contexto: { appId?: number; usuarioId?: number }
  ): Observable<UsuarioDireccion[]> {
    return this.http
      .get<UsuarioDireccion[]>(`${this.API}/usuarios/${usuarioId}/direcciones`, {
        headers: this.authHeaders()
      })
      .pipe(map((direcciones) => this.normalizarUsuarioDirecciones(direcciones, contexto)));
  }

  createUsuarioDireccion(
    appId: number,
    usuarioId: number,
    payload: CrearUsuarioDireccionPayload
  ): Observable<UsuarioDireccion> {
    return this.http.post<UsuarioDireccion>(
      `${this.baseAppUrl(appId)}/usuarios/${usuarioId}/direcciones`,
      payload,
      { headers: this.authHeaders() }
    ).pipe(map((direccion) => this.normalizarUsuarioDireccion(direccion, { appId, usuarioId })));
  }

  updateUsuarioDireccion(
    appId: number,
    usuarioId: number,
    direccionId: number,
    payload: ActualizarUsuarioDireccionPayload
  ): Observable<UsuarioDireccion> {
    return this.http.patch<UsuarioDireccion>(
      `${this.baseAppUrl(appId)}/usuarios/${usuarioId}/direcciones/${direccionId}`,
      payload,
      { headers: this.authHeaders() }
    ).pipe(map((direccion) => this.normalizarUsuarioDireccion(direccion, { appId, usuarioId })));
  }

  deleteUsuarioDireccion(appId: number, usuarioId: number, direccionId: number): Observable<void> {
    return this.http.delete<void>(
      `${this.baseAppUrl(appId)}/usuarios/${usuarioId}/direcciones/${direccionId}`,
      { headers: this.authHeaders() }
    );
  }

  setDireccionPrincipal(appId: number, usuarioId: number, direccionId: number): Observable<void> {
    return this.http.post<void>(
      `${this.baseAppUrl(appId)}/usuarios/${usuarioId}/direcciones/${direccionId}/principal`,
      {},
      { headers: this.authHeaders() }
    );
  }

  getEntregaTipos(appId: number, params?: { activo?: boolean }): Observable<EntregaTipo[]> {
    return this.http.get<EntregaTipo[]>(`${this.baseAppUrl(appId)}/entrega-tipos`, {
      headers: this.authHeaders(),
      params: this.buildParams(params)
    });
  }

  getEntregaOpciones(
    appId: number,
    params?: {
      entregaTipoCodigo?: string;
      entregaTipoId?: number;
      localidadId?: number;
      habilitada?: boolean;
    }
  ): Observable<EntregaOpcion[]> {
    return this.http.get<EntregaOpcion[]>(`${this.baseAppUrl(appId)}/entrega-opciones`, {
      headers: this.authHeaders(),
      params: this.buildParams(params)
    });
  }

  cotizarEntrega(
    appId: number,
    entregaOpcionId: number,
    payload: CotizacionEntregaRequest
  ): Observable<CotizacionEntregaResponse> {
    return this.http.post<CotizacionEntregaResponse>(
      `${this.baseAppUrl(appId)}/entrega-opciones/${entregaOpcionId}/cotizar`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  getOrigenEnvio(appId: number): Observable<OrigenEnvioApp> {
    return this.http.get<OrigenEnvioApp>(`${this.baseAppUrl(appId)}/origen-envio`, {
      headers: this.authHeaders()
    });
  }

  updateOrigenEnvio(
    appId: number,
    payload: UpdateOrigenEnvioAppPayload
  ): Observable<OrigenEnvioApp> {
    return this.http.put<OrigenEnvioApp>(`${this.baseAppUrl(appId)}/origen-envio`, payload, {
      headers: this.authHeaders()
    });
  }

  buscarLocalidadesSeguras(query: string): Observable<Localidad[]> {
    const term = (query ?? '').trim();
    if (!term) {
      return of([]);
    }
    const params = new HttpParams().set('query', term);
    return this.http
      .get<any[]>(`${this.API}/localidades/buscar`, {
        headers: this.authHeaders(),
        params
      })
      .pipe(map((respuesta) => this.normalizarLocalidades(respuesta)));
  }

  getEnvioEstados(appId: number, params?: { activo?: boolean }): Observable<EnvioEstado[]> {
    return this.http.get<EnvioEstado[]>(`${this.baseAppUrl(appId)}/envio-estados`, {
      headers: this.authHeaders(),
      params: this.buildParams(params)
    });
  }

  getPedidoEnvio(appId: number, pedidoId: number): Observable<PedidoEnvio> {
    return this.http.get<PedidoEnvio>(
      `${this.baseAppUrl(appId)}/pedidos/${pedidoId}/envio`,
      { headers: this.authHeaders() }
    );
  }

  createPedidoEnvio(
    appId: number,
    pedidoId: number,
    payload: PedidoEnvioPayload
  ): Observable<PedidoEnvio> {
    return this.http.post<PedidoEnvio>(
      `${this.baseAppUrl(appId)}/pedidos/${pedidoId}/envio`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  updatePedidoEnvio(
    appId: number,
    pedidoId: number,
    payload: Partial<PedidoEnvioPayload>
  ): Observable<PedidoEnvio> {
    return this.http.patch<PedidoEnvio>(
      `${this.baseAppUrl(appId)}/pedidos/${pedidoId}/envio`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  /**
   * Registra un cambio de estado del envío de un pedido.
   *
   * ⚠️ USO EXCLUSIVO INTERNO / STAFF.
   *
   * No debe llamarse desde el flujo de checkout del cliente. La transición
   * "pago aprobado → pedido en preparación" la dispara el backend al recibir
   * el webhook de Mercado Pago. En el front del cliente solo se consulta el
   * estado del pedido vía `ApiService.getPedido()` (polling).
   */
  registrarEstadoPedidoEnvio(
    appId: number,
    pedidoId: number,
    payload: PedidoEnvioEstadoCambioPayload
  ): Observable<PedidoEnvio> {
    return this.http.post<PedidoEnvio>(
      `${this.baseAppUrl(appId)}/pedidos/${pedidoId}/envio/estado`,
      payload,
      { headers: this.authHeaders() }
    );
  }

  getPedidoEnvioHistorial(
    appId: number,
    pedidoId: number
  ): Observable<PedidoEnvioEstadoHistorial[]> {
    return this.http.get<PedidoEnvioEstadoHistorial[]>(
      `${this.baseAppUrl(appId)}/pedidos/${pedidoId}/envio/historial`,
      { headers: this.authHeaders() }
    );
  }

  private baseAppUrl(appId: number): string {
    if (!Number.isFinite(appId) || appId <= 0) {
      throw new Error('appId inválido para LogisticaService');
    }
    return `${this.API}/apps/${appId}`;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private buildParams(params?: Record<string, unknown>): HttpParams | undefined {
    if (!params) {
      return undefined;
    }
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  private normalizarLocalidades(respuesta: any): Localidad[] {
    if (!respuesta) {
      return [];
    }
    const lista = Array.isArray(respuesta) ? respuesta : [respuesta];
    return lista
      .map((item) => {
        const provinciaCruda =
          item?.provincia ??
          item?.provinciaObj ??
          item?.provinciaDTO ??
          item?.provinciaData ??
          item?.province ??
          item?.provinciaInfo;
        const provinciaId =
          this.parseNumero(item?.provinciaId) ??
          this.parseNumero(item?.provincia_id) ??
          this.parseNumero(provinciaCruda?.id) ??
          this.parseNumero(provinciaCruda?.provinciaId) ??
          this.parseNumero(provinciaCruda?.codigoProvincia) ??
          this.parseNumero(provinciaCruda?.codigo_provincia);
        const provinciaNombre =
          provinciaCruda?.nombre ??
          provinciaCruda?.descripcion ??
          provinciaCruda?.name ??
          item?.provinciaNombre ??
          item?.provincia_nombre ??
          '';

        const localidadId =
          this.parseNumero(item?.id) ??
          this.parseNumero(item?.localidadId) ??
          this.parseNumero(item?.localidad_id) ??
          this.parseNumero(item?.codigoLocalidad) ??
          this.parseNumero(item?.codigo_localidad) ??
          this.parseNumero(item?.codigo);

        const nombre = String(
          item?.nombre ??
            item?.localidad ??
            item?.descripcion ??
            item?.detalle ??
            ''
        ).trim();
        const codigoPostalRaw =
          item?.codigoPostal ??
          item?.codigopostal ??
          item?.codigo_postal ??
          item?.cp;
        const codigoPostal =
          codigoPostalRaw === undefined || codigoPostalRaw === null
            ? undefined
            : String(codigoPostalRaw);

        if (!localidadId || localidadId <= 0 || !nombre) {
          return null;
        }

        const provincia =
          provinciaId || provinciaNombre
            ? {
                id: provinciaId ?? 0,
                nombre: provinciaNombre || ''
              }
            : undefined;

        return {
          id: localidadId,
          nombre,
          codigoPostal,
          provinciaId: provinciaId ?? undefined,
          provincia
        } as Localidad;
      })
      .filter((loc): loc is Localidad => !!loc);
  }

  private normalizarUsuarioDirecciones(
    respuesta: any,
    contexto: { appId?: number; usuarioId?: number }
  ): UsuarioDireccion[] {
    if (!respuesta) {
      return [];
    }
    if (Array.isArray(respuesta)) {
      return respuesta.map((dir) => this.normalizarUsuarioDireccion(dir, contexto));
    }
    return [this.normalizarUsuarioDireccion(respuesta, contexto)];
  }

  private normalizarUsuarioDireccion(
    direccion: any,
    contexto: { appId?: number; usuarioId?: number }
  ): UsuarioDireccion {
    const localidadCruda =
      direccion?.localidad?.localidad ??
      direccion?.localidad?.data ??
      direccion?.localidad?.value ??
      direccion?.localidad ??
      direccion?.localidadDTO?.localidad ??
      direccion?.localidadDTO?.data ??
      direccion?.localidadDTO ??
      direccion?.localidadObj?.localidad ??
      direccion?.localidadObj?.data ??
      direccion?.localidadObj;
    const localidadId =
      this.parseNumero(direccion?.localidadId) ??
      this.parseNumero(direccion?.localidad_id) ??
      this.parseNumero(localidadCruda?.id) ??
      this.parseNumero(localidadCruda?.localidadId) ??
      this.parseNumero(localidadCruda?.idLocalidad) ??
      this.parseNumero(localidadCruda?.codigo_localidad) ??
      this.parseNumero(localidadCruda?.codigoLocalidad) ??
      this.parseNumero(localidadCruda?.codigo) ??
      0;
    const provinciaId =
      this.parseNumero(direccion?.provinciaId) ??
      this.parseNumero(direccion?.provincia_id) ??
      this.parseNumero(direccion?.provincia?.id) ??
      this.parseNumero(localidadCruda?.provinciaId) ??
      this.parseNumero(localidadCruda?.provincia_id) ??
      this.parseNumero(localidadCruda?.codigoprovincia) ??
      this.parseNumero(localidadCruda?.codigoProvincia) ??
      this.parseNumero(localidadCruda?.provincia?.id) ??
      this.parseNumero(localidadCruda?.provincia?.provinciaId) ??
      this.parseNumero(localidadCruda?.provincia?.codigoProvincia) ??
      this.parseNumero(localidadCruda?.provincia?.codigo_provincia);

    return {
      id: this.parseNumero(direccion?.id) || 0,
      appId: this.parseNumero(direccion?.appId ?? direccion?.app_id ?? contexto.appId) || 0,
      usuarioId: this.parseNumero(direccion?.usuarioId ?? direccion?.usuario_id ?? contexto.usuarioId) || 0,
      alias: direccion?.alias ?? direccion?.nombre ?? undefined,
      receptorNombre: direccion?.receptorNombre ?? direccion?.contactoNombre ?? direccion?.contacto ?? undefined,
      receptorTelefono: direccion?.receptorTelefono ?? direccion?.contactoTelefono ?? direccion?.telefono ?? undefined,
      calle: direccion?.calle ?? '',
      numero: direccion?.numero ?? direccion?.altura ?? undefined,
      piso: direccion?.piso ?? undefined,
      departamento: direccion?.departamento ?? undefined,
      entreCalles: direccion?.entreCalles ?? direccion?.entre_calles ?? undefined,
      referencia: direccion?.referencia ?? undefined,
      codigoPostal:
        direccion?.codigoPostal ??
        direccion?.codigo_postal ??
        localidadCruda?.codigoPostal ??
        localidadCruda?.codigopostal ??
        localidadCruda?.codigo_postal,
      localidadId,
      provinciaId,
      localidad: localidadCruda
        ? {
            id:
              localidadId ||
              this.parseNumero(localidadCruda?.id) ||
              this.parseNumero(localidadCruda?.localidadId) ||
              this.parseNumero(localidadCruda?.idLocalidad) ||
              this.parseNumero(localidadCruda?.codigo_localidad) ||
              this.parseNumero(localidadCruda?.codigoLocalidad) ||
              0,
            nombre: localidadCruda?.nombre ?? localidadCruda?.descripcion ?? '',
            codigoPostal:
              localidadCruda?.codigoPostal ?? localidadCruda?.codigopostal ?? localidadCruda?.codigo_postal,
            provinciaId: provinciaId
          }
        : undefined,
      latitud: this.parseNumero(direccion?.latitud ?? direccion?.lat),
      longitud: this.parseNumero(direccion?.longitud ?? direccion?.lng ?? direccion?.lon),
      precisionGeo: (direccion?.precisionGeo ?? direccion?.geocodePrecision ?? 'manual') as PrecisionGeo,
      esPrincipal: this.parseBoolean(direccion?.esPrincipal ?? direccion?.principal ?? direccion?.es_principal),
      activo: direccion?.activo ?? true,
      fechaCreacion: direccion?.fechaCreacion ?? direccion?.creado ?? direccion?.createdAt,
      fechaActualizacion: direccion?.fechaActualizacion ?? direccion?.actualizado ?? direccion?.updatedAt
    };
  }

  private parseNumero(valor: any): number | undefined {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : undefined;
  }

  private parseBoolean(valor: any): boolean {
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'number') return valor !== 0;
    if (typeof valor === 'string') {
      const normalized = valor.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'si';
    }
    return false;
  }
}
