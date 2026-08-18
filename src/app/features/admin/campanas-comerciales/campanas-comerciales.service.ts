import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CampanasComercialesService {
  private base = environment.apiUrlBackend+"/api/promociones" ;
  private readonly selectedAppStorageKey = 'selectedAppId';

  constructor(private http: HttpClient) {}

  private authHeaders() {
    const token = localStorage.getItem('token') || '';
   
   
    return { headers: new HttpHeaders({ Authorization: token ? `Bearer ${token}` : '' }) };
  }

  list(params?: { canal?: string; listaPrecioId?: number; search?: string; tipo?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.canal) httpParams = httpParams.set('canal', params.canal);
      if (params.listaPrecioId) httpParams = httpParams.set('listaPrecioId', String(params.listaPrecioId));
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
     
    }
    return this.http.get<any>(this.base, { params: httpParams, ...this.authHeaders() });
  }

  get(id: number): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}`, this.authHeaders());
  }

  create(body: any): Observable<any> {
    return this.http.post<any>(this.base, body, this.authHeaders());
  }

  update(id: number, body: any): Observable<any> {
    return this.http.put<any>(`${this.base}/${id}`, body, this.authHeaders());
  }

  uploadSlideImages(id: number, files: File[]): Observable<any> {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append('files', file);
      formData.append('orden', String(index + 1));
    });
    return this.http.post<any>(`${this.base}/${id}/slide/upload`, formData, this.authHeaders());
  }

  deleteSlideImage(id: number, slideId: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}/slide/${slideId}`, this.authHeaders());
  }
  deleteProducto(campanaId: number, id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/${campanaId}/producto/${id}`, this.authHeaders());
  }
  delete(id: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}`, this.authHeaders());
  }

  toggleActivate(id: number): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/activar`, {}, this.authHeaders());
  }

  // Acciones
  addAction(id: number, action: any): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/accion`, action, this.authHeaders());
  }

  deleteAction(id: number, accionId: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}/accion/${accionId}`, this.authHeaders());
  }

  // Condiciones
  addCondition(id: number, condition: any): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/condicion`, condition, this.authHeaders());
  }

  deleteCondition(id: number, condicionId: number): Observable<any> {
    return this.http.delete<any>(`${this.base}/${id}/condicion/${condicionId}`, this.authHeaders());
  }

  // Asignaciones de a uno
  assignProduct(id: number, productoIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/producto`, { productoIds }, this.authHeaders());
  }
  // asignaciones de a muchos
  assignProducts(id: number, productoIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/productos`, { productoIds }, this.authHeaders());
  }


  assignTarjetas(id: number, tarjetaIds: number[]): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/tarjetas`, { tarjetaIds }, this.authHeaders());
  }

  // Stacking
  setStacking(id: number, stacking: { combinable: boolean; prioridad: number }): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/stacking`, stacking, this.authHeaders());
  }

  // Tipos
  listTipos(appId?: number): Observable<any> {
    const resolvedAppId = this.resolveAppId(appId);
    let params = new HttpParams();
    if (resolvedAppId) {
      params = params.set('appId', String(resolvedAppId));
    }
    return this.http.get<any>(`${this.base}/tipos/list`, { params, ...this.authHeaders() });
  }

  createTipo(body: any): Observable<any> {
    return this.http.post<any>(`${this.base}/tipos`, body, this.authHeaders());
  }

  private resolveAppId(appId?: number): number | null {
    if (typeof appId === 'number' && Number.isFinite(appId) && appId > 0) {
      return appId;
    }
    try {
      const raw = localStorage.getItem(this.selectedAppStorageKey);
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
}
