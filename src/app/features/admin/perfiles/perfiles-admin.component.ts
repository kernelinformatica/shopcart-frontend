import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService, AppAdmin, PermisoCatalogoAdmin, RolAdmin } from '../../../api-admin.service';
import { AuthUserService } from '../../../auth-user.service';
import {PermisosService} from "../../../permisos.service";
interface PermisosGrupoView {
  nombre: string;
  permisos: PermisoSeleccionadoView[];
}

interface PermisoSeleccionadoView extends PermisoCatalogoAdmin {
  seleccionado?: boolean;
  esPrincipal?: boolean;
}

@Component({
  selector: 'app-perfiles-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfiles-admin.component.html',
  styleUrls: ['./perfiles-admin.component.scss']
})
export class PerfilesAdminComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);
  private readonly authUserService = inject(AuthUserService);
  private readonly permisosService = inject(PermisosService);

  cargando = false;
  cargandoPermisos = false;
  guardandoPermisos = false;
  quitandoPermisos = false;
  error = '';
  mensaje = '';

  roles: RolAdmin[] = [];
  apps: AppAdmin[] = [];
  empresaIdSeleccionada: number | null = null;
  appIdSeleccionada: number | null = null;
  rolIdSeleccionado: number | null = null;
  permisosCatalogo: PermisoCatalogoAdmin[] = [];
  permisosSeleccionados = new Set<number>();
  busqueda = '';
  seccionesAbiertas = {
    perfil: true,
    app: true,
    catalogo: true
  };
  gruposAbiertos = new Map<string, boolean>();

  ngOnInit(): void {
    
    void this.cargarDatosIniciales();
  }

  async cargarDatosIniciales(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const rolesResult = await firstValueFrom(this.apiAdmin.getRoles());

      this.roles = rolesResult ?? [];

      this.rolIdSeleccionado = this.roles[0]?.id ?? null;
      this.cargarAppsDesdeUsuario();
    } catch {
      this.error = 'No se pudieron cargar los perfiles.';
    } finally {
      this.cargando = false;
    }
  }


 get puedeAgregarQuitarPerfiles(): boolean {
   return this.permisosService.tienePermiso('permisos')  && this.permisosService.tienePermiso('permisos_agregar_quitar');
  }

  private cargarAppsDesdeUsuario(): void {
    const usuario = this.authUserService.getUsuario();
    const appsUsuario = Array.isArray(usuario?.apps) ? usuario.apps : [];
    this.apps = appsUsuario;
    this.empresaIdSeleccionada = usuario?.empresa?.id ?? null;
    this.appIdSeleccionada = this.apps[0]?.id ?? null;

    if (this.rolIdSeleccionado && this.appIdSeleccionada) {
      void this.cargarPermisos();
    }
  }

  getEmpresaDeAppSeleccionadaTexto(): string {
    if (!this.appIdSeleccionada) {
      return 'Sin empresa asociada';
    }

    const app = this.apps.find((item) => item.id === this.appIdSeleccionada);
    return app?.empresa?.nombre ?? this.authUserService.getUsuario()?.empresa?.nombre ?? 'Empresa asociada a la app';
  }

  async onPerfilChange(rolId: number | null): Promise<void> {
    this.rolIdSeleccionado = rolId;
    await this.cargarPermisos();
  }

  async onAppChange(appId: number | null): Promise<void> {
    this.appIdSeleccionada = appId;
    await this.cargarPermisos();
  }

  async cargarPermisos(): Promise<void> {
    this.error = '';
    this.mensaje = '';
    this.permisosCatalogo = [];
    this.permisosSeleccionados.clear();

    if (!this.rolIdSeleccionado || !this.appIdSeleccionada) {
      return;
    }

    this.cargandoPermisos = true;
    try {
      this.permisosCatalogo = await firstValueFrom(
        this.apiAdmin.getPermisosCatalogo(this.rolIdSeleccionado, this.appIdSeleccionada)
      );
      this.permisosCatalogo.forEach((permiso) => {
        if (permiso.asignado) {
          this.permisosSeleccionados.add(permiso.id);
        }
      });
    } catch {
      this.error = 'No se pudo cargar el catálogo de permisos.';
    } finally {
      this.cargandoPermisos = false;
    }
  }

  obtenerPermisosVisibles(): PermisoSeleccionadoView[] {
    const busqueda = this.busqueda.trim().toLowerCase();
    const base = this.permisosCatalogo.filter((permiso) => {
      if (!busqueda) {
        return true;
      }

      const texto = `${permiso.alias ?? ''} ${permiso.nombre ?? ''} ${permiso.descripcion ?? ''} ${permiso.modulo ?? ''}`.toLowerCase();
      return texto.includes(busqueda);
    });

    return base.map((permiso) => ({
      ...permiso,
      seleccionado: this.permisosSeleccionados.has(permiso.id),
      esPrincipal: this.esPermisoPrincipal(permiso)
    }));
  }

  togglePermisoSeleccionado(permiso: PermisoCatalogoAdmin, seleccionado: boolean): void {
    const esPrincipal = this.esPermisoPrincipal(permiso);

    if (!seleccionado && esPrincipal) {
      for (const item of this.getPermisosDelGrupo(permiso)) {
        this.permisosSeleccionados.delete(item.id);
      }
      return;
    }

    if (seleccionado) {
      for (const item of this.getPermisosDelGrupo(permiso)) {
        this.permisosSeleccionados.add(item.id);
      }
    } else {
      this.permisosSeleccionados.delete(permiso.id);
    }
  }

  getTotalSeleccionados(): number {
    return this.permisosSeleccionados.size;
  }

  todosLosPermisosSeleccionados(): boolean {
    return this.permisosCatalogo.length > 0 && this.permisosCatalogo.every((permiso) => this.permisosSeleccionados.has(permiso.id));
  }

  alternarTodosLosPermisos(): void {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    if (!this.permisosCatalogo.length) {
      return;
    }

    this.expandirTodosLosGrupos();

    if (this.todosLosPermisosSeleccionados()) {
      this.permisosSeleccionados.clear();
    } else {
      for (const permiso of this.permisosCatalogo) {
        this.permisosSeleccionados.add(permiso.id);
      }
    }

    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }

  private expandirTodosLosGrupos(): void {
    this.getGruposPermisos().forEach((grupo) => {
      this.gruposAbiertos.set(grupo.nombre, true);
    });
  }

  tieneCambiosParaGuardar(): boolean {
    return this.tieneCambiosPendientes();
  }

  tieneCambiosParaQuitar(): boolean {
    return this.getPermisosCambios().quitar.length > 0;
  }

  tieneCambiosPendientes(): boolean {
    const cambios = this.getPermisosCambios();
    return cambios.asignar.length > 0 || cambios.quitar.length > 0;
  }

  isGrupoAbierto(nombreGrupo: string): boolean {
    if (!this.gruposAbiertos.has(nombreGrupo)) {
      this.gruposAbiertos.set(nombreGrupo, true);
    }

    return this.gruposAbiertos.get(nombreGrupo) ?? true;
  }

  toggleGrupo(nombreGrupo: string, event?: MouseEvent, anchor?: HTMLElement | null): void {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const nuevoEstado = !this.isGrupoAbierto(nombreGrupo);
    this.gruposAbiertos.set(nombreGrupo, nuevoEstado);

    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
    });
  }

  seleccionarTodoGrupo(nombreGrupo: string): void {
    const grupo = this.getGrupoPorNombre(nombreGrupo);
    if (!grupo.length) {
      return;
    }

    for (const permiso of grupo) {
      this.permisosSeleccionados.add(permiso.id);
    }
  }

  deselectarTodoGrupo(nombreGrupo: string): void {
    const grupo = this.getGrupoPorNombre(nombreGrupo);
    if (!grupo.length) {
      return;
    }

    for (const permiso of grupo) {
      this.permisosSeleccionados.delete(permiso.id);
    }
  }

  alternarSeleccionGrupo(nombreGrupo: string): void {
    const grupo = this.getGrupoPorNombre(nombreGrupo);
    if (!grupo.length) {
      return;
    }

    if (this.todosLosPermisosDelGrupoSeleccionados(nombreGrupo)) {
      this.deselectarTodoGrupo(nombreGrupo);
      return;
    }

    this.seleccionarTodoGrupo(nombreGrupo);
  }

  todosLosPermisosDelGrupoSeleccionados(nombreGrupo: string): boolean {
    const grupo = this.getGrupoPorNombre(nombreGrupo);
    return grupo.length > 0 && grupo.every((permiso) => this.permisosSeleccionados.has(permiso.id));
  }

  private getOrdenPermiso(permiso: PermisoSeleccionadoView): number {
    return permiso.esPrincipal ? 0 : 1;
  }

  private getAliasBase(permiso: PermisoCatalogoAdmin): string {
    const alias = (permiso.alias ?? permiso.nombre ?? '').trim().toLowerCase();
    if (!alias) {
      return '';
    }

    const indice = alias.indexOf('_');
    return indice === -1 ? alias : alias.slice(0, indice);
  }

  private getAliasRelacionados(permiso: PermisoCatalogoAdmin): string[] {
    const base = this.getAliasBase(permiso);
    if (!base) {
      return [];
    }

    const relacionados = new Set<string>([base]);
    if (base.endsWith('s')) {
      relacionados.add(base.slice(0, -1));
    } else {
      relacionados.add(`${base}s`);
    }

    return [...relacionados];
  }

  private esPermisoPrincipal(permiso: PermisoCatalogoAdmin): boolean {
    const alias = (permiso.alias ?? permiso.nombre ?? '').trim().toLowerCase();
    if (!alias) {
      return false;
    }

    return !alias.includes('_');
  }

  private getPermisosDelGrupo(permiso: PermisoCatalogoAdmin): PermisoCatalogoAdmin[] {
    const basesRelacionadas = this.getAliasRelacionados(permiso);
    if (!basesRelacionadas.length) {
      return [permiso];
    }

    return this.permisosCatalogo.filter((item) => {
      const baseItem = this.getAliasBase(item);
      return basesRelacionadas.includes(baseItem);
    });
  }

  private getGrupoPorNombre(nombreGrupo: string): PermisoCatalogoAdmin[] {
    return this.permisosCatalogo.filter((permiso) => (permiso.grupo?.trim() || 'Sin Grupo') === nombreGrupo);
  }

  toggleSeccion(seccion: keyof typeof this.seccionesAbiertas): void {
    this.seccionesAbiertas[seccion] = !this.seccionesAbiertas[seccion];
  }

  getRolSeleccionadoTexto(): string {
    if (!this.rolIdSeleccionado) {
      return 'Sin rol seleccionado';
    }

    const rol = this.roles.find((item) => item.id === this.rolIdSeleccionado);
    if (!rol) {
      return `Rol ${this.rolIdSeleccionado}`;
    }

    return `${rol.alias ? rol.alias + ' - ' : ''}${rol.nombre}`;
  }

  getAppSeleccionadaTexto(): string {
    if (!this.appIdSeleccionada) {
      return 'Sin app seleccionada';
    }

    const app = this.apps.find((item) => item.id === this.appIdSeleccionada);
    return app?.nombre ?? `App ${this.appIdSeleccionada}`;
  }

  private getPermisosCambios(): { asignar: number[]; quitar: number[] } {
    const asignar: number[] = [];
    const quitar: number[] = [];

    for (const permiso of this.permisosCatalogo) {
      const seleccionado = this.permisosSeleccionados.has(permiso.id);

      if (seleccionado && !permiso.asignado) {
        asignar.push(permiso.id);
      }

      if (!seleccionado && permiso.asignado) {
        quitar.push(permiso.id);
      }
    }

    return { asignar, quitar };
  }

  async guardarCambiosPermisos(): Promise<void> {
    await this.asignarPermisos();
  }

  async asignarPermisos(): Promise<void> {
    this.error = '';
    this.mensaje = '';

    if (!this.rolIdSeleccionado || !this.appIdSeleccionada) {
      this.error = 'Seleccioná un rol y una app para administrar permisos.';
      return;
    }

    const cambios = this.getPermisosCambios();
    if (!cambios.asignar.length && !cambios.quitar.length) {
      this.error = 'No hay cambios para guardar.';
      return;
    }

    this.guardandoPermisos = true;
    try {
      if (cambios.asignar.length) {
        await firstValueFrom(this.apiAdmin.asignarPermisos({
          rolId: this.rolIdSeleccionado,
          appId: this.appIdSeleccionada,
          permisoIds: cambios.asignar
        }));
      }

      if (cambios.quitar.length) {
        await firstValueFrom(this.apiAdmin.eliminarPermisosAsignados({
          rolId: this.rolIdSeleccionado,
          appId: this.appIdSeleccionada,
          permisoIds: cambios.quitar
        }));
      }

      this.mensaje = 'Permisos actualizados correctamente.';
      await this.cargarPermisos();
    } catch {
      this.error = 'No se pudieron guardar los permisos.';
    } finally {
      this.guardandoPermisos = false;
    }
  }

  async quitarPermisos(): Promise<void> {
    this.error = '';
    this.mensaje = '';

    if (!this.rolIdSeleccionado || !this.appIdSeleccionada) {
      this.error = 'Seleccioná un rol y una app para quitar permisos.';
      return;
    }

    const permisosAEliminar = [...this.permisosSeleccionados].filter((permisoId) => {
      const permiso = this.permisosCatalogo.find((item) => item.id === permisoId);
      return !!permiso && permiso.asignado;
    });

    if (!permisosAEliminar.length) {
      this.error = 'Seleccioná al menos un permiso para quitar.';
      return;
    }

    this.quitandoPermisos = true;
    try {
      await firstValueFrom(this.apiAdmin.eliminarPermisosAsignados({
        rolId: this.rolIdSeleccionado,
        appId: this.appIdSeleccionada,
        permisoIds: permisosAEliminar
      }));
      this.mensaje = 'Permisos eliminados correctamente.';
      await this.cargarPermisos();
    } catch {
      this.error = 'No se pudieron quitar los permisos.';
    } finally {
      this.quitandoPermisos = false;
    }
  }

  getGruposPermisos(): PermisosGrupoView[] {
    const agrupados = new Map<string, PermisoSeleccionadoView[]>();

    for (const permiso of this.obtenerPermisosVisibles()) {
      const grupo = permiso.grupo?.trim() || 'Sin Grupo';
      const lista = agrupados.get(grupo) ?? [];
      lista.push(permiso);
      agrupados.set(grupo, lista);
    }

    return [...agrupados.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'es', { sensitivity: 'base' }))
      .map(([nombre, permisos]) => ({
        nombre,
        permisos: permisos.sort((a, b) => {
          const prioridad = this.getOrdenPermiso(a) - this.getOrdenPermiso(b);
          if (prioridad !== 0) {
            return prioridad;
          }

          const nombreA = (a.alias ?? a.nombre ?? '').toLowerCase();
          const nombreB = (b.alias ?? b.nombre ?? '').toLowerCase();
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
        })
      }));
  }
}
