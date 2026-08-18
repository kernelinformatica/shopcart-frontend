import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private getPermisos(): any[] {
    try {
      const permisos = this.normalizarPermisos(this.leerPermisosPersistidos());
      if (!permisos.length) {
        console.warn('[PermisosService] No hay permisos en localStorage para el usuario actual');
      }
      return permisos;
    } catch {
      return [];
    }
  }

  private leerPermisosPersistidos(): unknown {
    const permisosRaw = localStorage.getItem('permisos');
    if (permisosRaw) {
      try {
        return JSON.parse(permisosRaw);
      } catch {
        return [];
      }
    }

    const usuarioRaw = localStorage.getItem('usuario');
    if (!usuarioRaw) {
      return [];
    }

    try {
      const usuario = JSON.parse(usuarioRaw);
      return usuario?.permisos ?? [];
    } catch {
      return [];
    }
  }

  private normalizarPermisos(permisos: unknown): any[] {
    if (Array.isArray(permisos)) {
      return permisos.filter(Boolean);
    }

    if (!permisos || typeof permisos !== 'object') {
      return [];
    }

    return Object.values(permisos as Record<string, unknown>).flatMap((valor) =>
      Array.isArray(valor) ? valor.filter(Boolean) : []
    );
  }

  tienePermiso(alias: string, modulo?: string): boolean {
    const permisos = this.getPermisos();
    
    return permisos.some(
      (perm: any) =>
        perm &&
        typeof perm.alias === 'string' &&
        perm.alias.trim() === alias &&
        (modulo ? perm.modulo === modulo : true)
    );
  }

  // Opcional: obtener todos los alias
  getAliases(): string[] {
    return this.getPermisos().map((perm: any) => perm && perm.alias).filter(Boolean);
  }
}
