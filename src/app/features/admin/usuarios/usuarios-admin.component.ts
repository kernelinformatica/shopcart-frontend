import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService, AppAdmin, LocalidadAdmin, PermisoAdmin, RolAdmin, UsuarioAdmin } from '../../../api-admin.service';

interface UsuarioAdminNormalizado extends UsuarioAdmin {
  permisos: PermisoAdmin[];
  apps: AppAdmin[];
  localidad?: LocalidadAdmin;
}

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './usuarios-admin.component.html',
  styleUrl: './usuarios-admin.component.scss'
})
export class UsuariosAdminComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);

  cargando = false;
  error = '';
  mensaje = '';
  eliminandoId: number | null = null;
  mostrarConfirmEliminar: number | null = null;
  filtrosPlegados = false;

  usuarios: UsuarioAdminNormalizado[] = [];
  roles: RolAdmin[] = [];
  usuariosFiltrados: UsuarioAdminNormalizado[] = [];

  // filtros
  busquedaNombre = '';
  busquedaEmail = '';
  rolFiltroId: number | null = null;

  ngOnInit(): void {
    void this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {

    this.cargando = true;
    this.error = '';
    try {
      const [usuariosResult, rolesResult] = await Promise.allSettled([
        firstValueFrom(this.apiAdmin.getUsuarios()),
        firstValueFrom(this.apiAdmin.getRoles())
      ]);

      if (usuariosResult.status === 'fulfilled') {
        this.usuarios = (usuariosResult.value ?? []).map((usuario) => this.normalizarUsuario(usuario));
      } else {
        this.usuarios = [];
      }

      this.roles = rolesResult.status === 'fulfilled' ? (rolesResult.value ?? []) : [];
      this.aplicarFiltros();
      if (usuariosResult.status === 'rejected') {
        this.error = 'No se pudo cargar el listado de usuarios.';
      }
    } catch {
      this.usuarios = [];
      this.usuariosFiltrados = [];
      this.error = 'No se pudo cargar el listado de usuarios.';
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltros(): void {
    let lista = [...this.usuarios];

    const nombre = this.busquedaNombre.trim().toLowerCase();
    if (nombre) {
      lista = lista.filter(u =>
        `${u.nombre} ${u.apellido}`.toLowerCase().includes(nombre)
      );
    }

    const email = this.busquedaEmail.trim().toLowerCase();
    if (email) {
      lista = lista.filter(u => u.email?.toLowerCase().includes(email));
    }

    if (this.rolFiltroId !== null) {
      lista = lista.filter(u => u.rol?.id === this.rolFiltroId);
    }

    this.usuariosFiltrados = lista;
  }

  limpiarFiltros(): void {
    this.busquedaNombre = '';
    this.busquedaEmail = '';
    this.rolFiltroId = null;
    this.aplicarFiltros();
  }

  toggleFiltros(): void {
    this.filtrosPlegados = !this.filtrosPlegados;
  }

  pedirConfirmEliminar(id: number): void {
    this.mostrarConfirmEliminar = id;
  }

  cancelarEliminar(): void {
    this.mostrarConfirmEliminar = null;
  }

  async confirmarEliminar(id: number): Promise<void> {
    this.eliminandoId = id;
    this.mostrarConfirmEliminar = null;
    this.error = '';
    this.mensaje = '';
    try {
      await firstValueFrom(this.apiAdmin.eliminarUsuario(id));
      this.mensaje = 'Usuario eliminado correctamente.';
      this.usuarios = this.usuarios.filter(u => u.id !== id);
      this.aplicarFiltros();
    } catch {
      this.error = 'No se pudo eliminar el usuario.';
    } finally {
      this.eliminandoId = null;
    }
  }

  getNombreCompleto(u: UsuarioAdmin): string {
    return `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim();
  }

  getPermisosTexto(u: UsuarioAdmin): string {
    if (!u.permisos?.length) return '—';
    return u.permisos.map(p => p.alias ?? p.nombre).join(', ');
  }

  getAppsTexto(u: UsuarioAdmin): string {
    if (!u.apps?.length) return '—';
    return u.apps.map(a => a.nombre).join(', ');
  }

  getRolBadgeClass(rolNombre?: string): string {
    switch (rolNombre?.toLowerCase()) {
      case 'administrador': return 'badge-rol-admin';
      case 'staff': return 'badge-rol-staff';
      case 'cliente': return 'badge-rol-cliente';
      default: return 'badge-rol-default';
    }
  }

  private normalizarUsuario(usuario: UsuarioAdmin): UsuarioAdminNormalizado {
    return {
      ...usuario,
      nombre: usuario.nombre ?? '',
      apellido: usuario.apellido ?? '',
      permisos: this.normalizarPermisos(usuario.permisos),
      apps: Array.isArray(usuario.apps) ? usuario.apps : [],
      localidad: usuario.localidad
    };
  }

  private normalizarPermisos(permisos: unknown): PermisoAdmin[] {
    if (Array.isArray(permisos)) {
      return permisos.filter(Boolean) as PermisoAdmin[];
    }

    if (permisos && typeof permisos === 'object') {
      const salida: PermisoAdmin[] = [];
      for (const value of Object.values(permisos as Record<string, unknown>)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              salida.push(item as PermisoAdmin);
            }
          }
        } else if (value && typeof value === 'object') {
          salida.push(value as PermisoAdmin);
        }
      }
      return salida;
    }

    return [];
  }
}
