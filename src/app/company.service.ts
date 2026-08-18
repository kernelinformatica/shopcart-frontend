import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Empresa } from './models';
import { ApiService } from './api.service';
import { timeout } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private empresaSubject = new BehaviorSubject<Empresa | null>(null);
  private loadingEmpresa = false;
  private lastFetchAt = 0;
  private readonly fetchCooldownMs = 5000;

  constructor(private apiService: ApiService) {
    // Al iniciar, intenta cargar la empresa desde localStorage
    const empresaStr = localStorage.getItem('empresa');
    if (empresaStr) {
      try {
        const empresa = JSON.parse(empresaStr);
        this.empresaSubject.next(empresa);
      } catch {}
    }
  }

  setEmpresa(empresa: Empresa) {
    this.empresaSubject.next(empresa);
    localStorage.setItem('empresa', JSON.stringify(empresa));
  }

  clearEmpresa(): void {
    this.empresaSubject.next(null);
    localStorage.removeItem('empresa');
  }

  getEmpresa(): Observable<Empresa | null> {
    // Siempre refresca en background cuando el cooldown lo permite (no solo cuando es null)
    const now = Date.now();
    if (!this.loadingEmpresa && (now - this.lastFetchAt > this.fetchCooldownMs)) {
      this.loadingEmpresa = true;
      this.lastFetchAt = now;
      // Cambia el id según corresponda (puede venir de environment)
      const empresaId = (window as any).environment?.empresaCodigo || 2;
      this.apiService.getEmpresa(empresaId).pipe(
        timeout(10000)
      ).subscribe({
        next: (empresa) => {
          this.setEmpresa(empresa);
          this.loadingEmpresa = false;
        },
        error: () => {
          // Mantener cache/local state anterior para no romper refresh
          this.loadingEmpresa = false;
        }
      });
    }
    return this.empresaSubject.asObservable();
  }

  getEmpresaValue(): Empresa | null {
    return this.empresaSubject.value;
  }
}
