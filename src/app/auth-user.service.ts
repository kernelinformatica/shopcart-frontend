// Servicio para manejar el usuario autenticado usando solo el token JWT
import { Injectable } from '@angular/core';
import { CarritoService } from './carrito.service';
import { CompanyService } from './company.service';

@Injectable({ providedIn: 'root' })
export class AuthUserService {

  constructor(
    private readonly carritoService: CarritoService,
    private readonly companyService: CompanyService
  ) {}

  clearAuthStorage(): void {
    const keys = ['token', 'usuario', 'permisos', 'selectedAppId', 'empresa'];
    for (const key of keys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Guarda el usuario explícitamente en localStorage (llamar tras login si el backend lo retorna)
   */
  setUsuario(usuario: any): void {
    if (usuario) {
      localStorage.setItem('usuario', JSON.stringify(usuario));
    }
  }

  /**
   * Obtiene el usuario desde localStorage (preferido si existe, si no, decodifica el token)
   */
  getUsuario(): any {
    const raw = localStorage.getItem('usuario');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return this.getUserFromToken();
  }

  // Decodifica el JWT y retorna el payload (sin validación de firma)
  getUserFromToken(): any {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }


  getNombre(): string {
    return this.getUsuario()?.nombre || 'Usuario';
  }


  /**
   * Devuelve el objeto rol completo del usuario autenticado (o null si no hay usuario)
   */

  getRol(): any {
    return this.getUsuario()?.rol || null;
  }

  /**
   * Devuelve el nombre del rol (o string vacío si no hay usuario)
   */
 getRolNombre(): string {
  const rol = this.getUsuario()?.rol;
  return (rol?.nombre ?? "").trim();
}

  /**
   * Devuelve el alias del rol (o string vacío si no hay usuario)
   */
  getRolAlias(): string {
    return this.getRol()?.alias || '';
  }


  getUsuarioId(): number | null {
    const usuario = this.getUsuario();
    if (!usuario) return null;
    const posiblesClaves = ['id', 'usuarioId', 'userId', 'sub'];
    for (const key of posiblesClaves) {
      const valor = Number(usuario?.[key]);
      if (Number.isFinite(valor) && valor > 0) {
        return valor;
      }
    }
    return null;
  }

  logout() {
    this.clearAuthStorage();
    this.carritoService.resetSesion();
    this.companyService.clearEmpresa();
  }
}
