import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CotizacionEntregaResponse, EntregaOpcion, UsuarioDireccion } from './models';

export interface CheckoutEntregaState {
  direccion?: UsuarioDireccion;
  entregaOpcion?: EntregaOpcion;
  cotizacion?: CotizacionEntregaResponse;
}

@Injectable({ providedIn: 'root' })
export class CheckoutEntregaService {
  private readonly stateSubject = new BehaviorSubject<CheckoutEntregaState>({});
  state$ = this.stateSubject.asObservable();

  get snapshot(): CheckoutEntregaState {
    return this.stateSubject.value;
  }

  setDireccion(direccion?: UsuarioDireccion): void {
    this.stateSubject.next({ ...this.stateSubject.value, direccion });
  }

  setEntrega(opcion?: EntregaOpcion, cotizacion?: CotizacionEntregaResponse): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      entregaOpcion: opcion,
      cotizacion
    });
  }

  reset(): void {
    this.stateSubject.next({});
  }
}
