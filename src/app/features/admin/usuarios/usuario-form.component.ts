import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ApiAdminService,
  UsuarioAdmin,
  UsuarioAdminPayload,
  RolAdmin,
  LocalidadAdmin,
  AppAdmin,
  PermisoCatalogoAdmin
} from '../../../api-admin.service';
import { AuthUserService } from '../../../auth-user.service';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuario-form.component.html',
  styleUrl: './usuario-form.component.scss'
})
export class UsuarioFormComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authUserService = inject(AuthUserService);

  usuarioId: number | null = null;
  esEdicion = false;
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';

  roles: RolAdmin[] = [];
  localidades: LocalidadAdmin[] = [];
  localidadSeleccionada: LocalidadAdmin | null = null;
  apps: AppAdmin[] = [];
  appPermisosId: number | null = null;
  permisosCatalogo: PermisoCatalogoAdmin[] = [];
  permisosSeleccionados = new Set<number>();
  busquedaPermiso = '';
  cargandoPermisos = false;
  guardandoPermisos = false;
  quitandoPermisos = false;
  mensajePermisos = '';

  // Form model
  form: UsuarioAdminPayload & { passwordConfirm?: string } = {
    email: '',
    password: '',
    passwordConfirm: '',
    nombre: '',
    apellido: '',
    direccion: '',
    telefono: '',
    codigopostal: '',
    localidadId: null,
    empresaId: null,
    rolId: null,
    appIds: [],
    nrocuentacorriente: '',
    nrocuentacorrienteConfirmada: 0,
    saldocuentacorriente: 0
  };

  appsSeleccionadas: Set<number> = new Set();
  busquedaLocalidad = '';
  mostrarSugerenciasLocalidad = false;
  cargandoLocalidades = false;
  seccionesAbiertas = {
    datosPersonales: true,
    accesoSeguridad: false,
    perfilPermisos: false,
    appsHabilitadas: false,
    permisos: false,
    cuentaCorriente: false
  };

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'nuevo') {
      this.usuarioId = Number(idParam);
      this.esEdicion = true;
    }
    void this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      // En el alta (nuevo usuario) no hay empresa seleccionada en el form;
      // se toma el empresaId del usuario logueado (localStorage) para poder
      // cargar las apps disponibles del endpoint /api/apps.
      if (!this.form.empresaId) {
        this.form.empresaId = this.authUserService.getUsuario()?.empresa?.id ?? null;
      }

      const [rolesResult, localidadesResult, appsResult] = await Promise.allSettled([
        firstValueFrom(this.apiAdmin.getRoles()),
        firstValueFrom(this.apiAdmin.getLocalidades()),
        firstValueFrom(this.apiAdmin.getApps(this.form.empresaId))
      ]);

      this.roles = rolesResult.status === 'fulfilled' ? (rolesResult.value ?? []) : [];
      this.localidades = localidadesResult.status === 'fulfilled' ? (localidadesResult.value ?? []) : [];
      this.apps = appsResult.status === 'fulfilled' ? (appsResult.value ?? []) : [];

      if (this.esEdicion && this.usuarioId) {
        const usuario = await firstValueFrom(this.apiAdmin.getUsuario(this.usuarioId));
        this.poblarFormulario(usuario);
        await this.cargarAppsPorEmpresa(this.form.empresaId);
        await this.asegurarAppPermisosSeleccionada();
      }
    } catch {
      this.error = 'No se pudieron cargar los datos del formulario.';
    } finally {
      this.cargando = false;
    }
  }

  private poblarFormulario(u: UsuarioAdmin): void {
    this.form.email = u.email ?? '';
    this.form.nombre = u.nombre ?? '';
    this.form.apellido = u.apellido ?? '';
    this.form.direccion = u.direccion ?? '';
    this.form.telefono = u.telefono ?? '';
    this.form.codigopostal = u.codigopostal ?? '';
    this.form.localidadId = u.localidad?.id ?? null;
    this.localidadSeleccionada = u.localidad ?? null;
    this.busquedaLocalidad = this.localidadSeleccionada
      ? `${this.localidadSeleccionada.nombre}${this.localidadSeleccionada.provincia ? ' - ' + this.localidadSeleccionada.provincia : ''}`
      : '';
    this.form.empresaId = u.empresa?.id ?? null;
    this.form.rolId = u.rol?.id ?? null;
    if (u.rol && !this.roles.some((rol) => rol.id === u.rol?.id)) {
      this.roles = [
        {
          id: u.rol.id,
          nombre: u.rol.nombre ?? u.rol.alias ?? `Rol ${u.rol.id}`,
          descripcion: u.rol.descripcion
        },
        ...this.roles
      ];
    }
    this.form.nrocuentacorriente = u.nrocuentacorriente ?? '';
    this.form.nrocuentacorrienteConfirmada = u.nrocuentacorrienteConfirmada ?? 0;
    this.form.saldocuentacorriente = u.saldocuentacorriente ?? 0;
    this.form.password = '';
    this.form.passwordConfirm = '';

    this.appsSeleccionadas = new Set((u.apps ?? []).map(a => a.id));
    this.form.appIds = [...this.appsSeleccionadas];

    this.appPermisosId = this.form.appIds?.[0] ?? this.apps[0]?.id ?? null;
  }

  async cargarAppsPorEmpresa(empresaId: number | null | undefined): Promise<void> {
    const appsSeleccionadasPrevias = new Set(this.form.appIds ?? []);

    if (!empresaId) {
      this.apps = [];
      return;
    }

    try {
      this.apps = await firstValueFrom(this.apiAdmin.getApps(empresaId));
      if (appsSeleccionadasPrevias.size) {
        this.appsSeleccionadas = new Set(
          this.apps.filter((app) => appsSeleccionadasPrevias.has(app.id)).map((app) => app.id)
        );
      } else {
        this.appsSeleccionadas = new Set(this.apps.map((app) => app.id));
      }
      this.form.appIds = [...this.appsSeleccionadas];
      if (this.appPermisosId && !this.apps.some((app) => app.id === this.appPermisosId)) {
        this.appPermisosId = this.apps[0]?.id ?? null;
      }
      if (!this.appPermisosId) {
        this.appPermisosId = this.apps[0]?.id ?? null;
      }
    } catch {
      this.apps = [];
      this.appPermisosId = null;
    }
  }

  async asegurarAppPermisosSeleccionada(): Promise<void> {
    if (!this.appPermisosId) {
      this.appPermisosId = this.form.appIds?.[0] ?? this.apps[0]?.id ?? null;
    }

    if (this.esEdicion && !this.appPermisosId && this.apps.length) {
      this.appPermisosId = this.apps[0].id;
    }

    if (this.form.rolId && this.appPermisosId) {
      await this.cargarCatalogoPermisos();
    }
  }

  async onRolChange(rolId: number | null): Promise<void> {
    this.form.rolId = rolId;
    await this.cargarCatalogoPermisos();
  }

  async onAppPermisosChange(appId: number | null): Promise<void> {
    this.appPermisosId = appId;
    await this.cargarCatalogoPermisos();
  }

  async cargarCatalogoPermisos(): Promise<void> {
    this.mensajePermisos = '';
    this.permisosCatalogo = [];
    this.permisosSeleccionados = new Set();

    if (!this.form.rolId || !this.appPermisosId) {
      return;
    }

    this.cargandoPermisos = true;
    try {
      this.permisosCatalogo = await firstValueFrom(
        this.apiAdmin.getPermisosCatalogo(this.form.rolId, this.appPermisosId)
      );
      this.permisosSeleccionados = new Set(
        this.permisosCatalogo.filter((permiso) => !!permiso.asignado).map((permiso) => permiso.id)
      );
    } catch {
      this.permisosCatalogo = [];
    } finally {
      this.cargandoPermisos = false;
    }
  }

  getPermisosFiltrados(): PermisoCatalogoAdmin[] {
    const busqueda = this.busquedaPermiso.trim().toLowerCase();
    const base = this.esEdicion
      ? this.permisosCatalogo.filter((permiso) => permiso.asignado)
      : this.permisosCatalogo;

    if (!busqueda) {
      return base;
    }

    return base.filter((permiso) => {
      const texto = `${permiso.alias ?? ''} ${permiso.nombre ?? ''} ${permiso.descripcion ?? ''} ${permiso.modulo ?? ''}`.toLowerCase();
      return texto.includes(busqueda);
    });
  }

  getGruposPermisos(): Array<{ nombre: string; permisos: PermisoCatalogoAdmin[] }> {
    const agrupados = new Map<string, PermisoCatalogoAdmin[]>();

    for (const permiso of this.getPermisosFiltrados()) {
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
          const nombreA = (a.alias ?? a.nombre ?? '').toLowerCase();
          const nombreB = (b.alias ?? b.nombre ?? '').toLowerCase();
          return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
        })
      }));
  }

  contarPermisosAsignados(grupo: { permisos: PermisoCatalogoAdmin[] }): number {
    return grupo.permisos.filter((permiso) => this.isPermisoSeleccionado(permiso.id)).length;
  }

  getRolSeleccionadoTexto(): string {
    if (!this.form.rolId) {
      return 'Sin rol asignado';
    }

    const rol = this.roles.find((item) => item.id === this.form.rolId);
    if (!rol) {
      return `Rol ${this.form.rolId}`;
    }

    const prefijo = rol.alias ? `${rol.alias} - ` : '';
    return `${rol.nombre}`;
  }

  getAppPermisosTexto(): string {
    if (!this.appPermisosId) {
      return 'Sin app asociada';
    }

    const app = this.apps.find((item) => item.id === this.appPermisosId);
    return app?.nombre ?? `App ${this.appPermisosId}`;
  }

  togglePermiso(permisoId: number): void {
    if (this.permisosSeleccionados.has(permisoId)) {
      this.permisosSeleccionados.delete(permisoId);
    } else {
      this.permisosSeleccionados.add(permisoId);
    }
  }

  isPermisoSeleccionado(permisoId: number): boolean {
    return this.permisosSeleccionados.has(permisoId);
  }

  async asignarPermisos(): Promise<void> {
    this.error = '';
    this.mensajePermisos = '';

    if (!this.form.rolId || !this.appPermisosId) {
      this.error = 'Seleccioná un rol y una app para administrar permisos.';
      return;
    }

    this.guardandoPermisos = true;
    try {
      await firstValueFrom(
        this.apiAdmin.asignarPermisos({
          rolId: this.form.rolId,
          appId: this.appPermisosId,
          permisoIds: [...this.permisosSeleccionados]
        })
      );
      this.mensajePermisos = 'Permisos actualizados correctamente.';
      await this.cargarCatalogoPermisos();
    } catch {
      this.error = 'No se pudieron guardar los permisos.';
    } finally {
      this.guardandoPermisos = false;
    }
  }

  async quitarPermisos(): Promise<void> {
    this.error = '';
    this.mensajePermisos = '';

    if (!this.form.rolId || !this.appPermisosId) {
      this.error = 'Seleccioná un rol y una app para quitar permisos.';
      return;
    }

    const permisosAEliminar = [...this.permisosSeleccionados];
    if (!permisosAEliminar.length) {
      this.error = 'Seleccioná al menos un permiso para quitar.';
      return;
    }

    this.quitandoPermisos = true;
    try {
      await firstValueFrom(
        this.apiAdmin.eliminarPermisosAsignados({
          rolId: this.form.rolId,
          appId: this.appPermisosId,
          permisoIds: permisosAEliminar
        })
      );
      this.mensajePermisos = 'Permisos eliminados correctamente.';
      await this.cargarCatalogoPermisos();
    } catch {
      this.error = 'No se pudieron quitar los permisos.';
    } finally {
      this.quitandoPermisos = false;
    }
  }

  async buscarLocalidades(texto: string): Promise<void> {
    this.busquedaLocalidad = texto;
    this.form.localidadId = null;
    this.localidadSeleccionada = null;

    const consulta = texto.trim();
    if (consulta.length < 2) {
      this.localidades = [];
      this.mostrarSugerenciasLocalidad = false;
      return;
    }

    this.cargandoLocalidades = true;
    try {
      this.localidades = await firstValueFrom(this.apiAdmin.getLocalidades(consulta));
      this.mostrarSugerenciasLocalidad = true;
    } catch {
      this.localidades = [];
      this.mostrarSugerenciasLocalidad = false;
    } finally {
      this.cargandoLocalidades = false;
    }
  }

  seleccionarLocalidad(localidad: LocalidadAdmin): void {
    this.localidadSeleccionada = localidad;
    this.form.localidadId = localidad.id;
    this.busquedaLocalidad = `${localidad.nombre}${localidad.provincia ? ' - ' + localidad.provincia : ''}`;
    this.mostrarSugerenciasLocalidad = false;
  }

  limpiarLocalidad(): void {
    this.localidadSeleccionada = null;
    this.form.localidadId = null;
    this.busquedaLocalidad = '';
    this.localidades = [];
    this.mostrarSugerenciasLocalidad = false;
  }

  getLocalidadesFiltradas(): LocalidadAdmin[] {
    return this.localidades;
  }

  toggleApp(appId: number): void {
    if (this.appsSeleccionadas.has(appId)) {
      this.appsSeleccionadas.delete(appId);
    } else {
      this.appsSeleccionadas.add(appId);
    }
    this.form.appIds = [...this.appsSeleccionadas];
  }

  async onEmpresaChange(empresaId: number | null): Promise<void> {
    this.form.empresaId = empresaId;
    await this.cargarAppsPorEmpresa(empresaId);
  }

  isAppSeleccionada(appId: number): boolean {
    return this.appsSeleccionadas.has(appId);
  }

  trackByAppId(_: number, app: AppAdmin): number {
    return app.id;
  }

  toggleSeccion(seccion: keyof typeof this.seccionesAbiertas): void {
    this.seccionesAbiertas[seccion] = !this.seccionesAbiertas[seccion];
  }

  async guardar(): Promise<void> {
    this.error = '';
    this.mensaje = '';

    if (!this.form.email?.trim() || !this.form.nombre?.trim() || !this.form.apellido?.trim()) {
      this.error = 'Email, nombre y apellido son obligatorios.';
      return;
    }

    if (!this.esEdicion && !this.form.password?.trim()) {
      this.error = 'La contraseña es obligatoria para crear un usuario.';
      return;
    }

    if (this.form.password?.trim() && this.form.password !== this.form.passwordConfirm) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    const nroCuentaCorrienteNormalizada = this.normalizarNroCuentaCorriente(this.form.nrocuentacorriente);
    const nroCuentaCorrientePendiente = nroCuentaCorrienteNormalizada ? 1 : 0;

    // Build payload: omit empty password on edit
    const payload: Partial<UsuarioAdminPayload> = {
      email: this.form.email.trim(),
      nombre: this.form.nombre.trim(),
      apellido: this.form.apellido.trim(),
      direccion: this.form.direccion?.trim() || undefined,
      telefono: this.form.telefono?.trim() || undefined,
      codigopostal: this.form.codigopostal?.trim() || undefined,
      localidadId: this.form.localidadId ?? undefined,
      empresaId: this.form.empresaId ?? undefined,
      rolId: this.form.rolId ?? undefined,
      appIds: this.form.appIds,
      nrocuentacorriente: nroCuentaCorrienteNormalizada,
      nrocuentacorrienteConfirmada: nroCuentaCorrientePendiente,
      saldocuentacorriente: this.form.saldocuentacorriente
    };

    if (this.form.password?.trim()) {
      payload.password = this.form.password.trim();
    }

    this.guardando = true;
    try {
      if (this.esEdicion && this.usuarioId) {
        await firstValueFrom(this.apiAdmin.editarUsuario(this.usuarioId, payload as Partial<UsuarioAdminPayload>));
        this.mensaje = 'Usuario actualizado correctamente.';
      } else {
        await firstValueFrom(this.apiAdmin.crearUsuario(payload as UsuarioAdminPayload));
        this.mensaje = 'Usuario creado correctamente.';
        setTimeout(() => void this.router.navigate(['/admin/usuarios']), 1200);
      }
    } catch {
      this.error = 'No se pudo guardar el usuario. Verificá los datos e intentá nuevamente.';
    } finally {
      this.guardando = false;
    }
  }

  volver(): void {
    void this.router.navigate(['/admin/usuarios']);
  }

  normalizarCuentaCorrienteVisual(): void {
    this.form.nrocuentacorriente = this.normalizarNroCuentaCorriente(this.form.nrocuentacorriente) ?? '';
    if (!this.form.nrocuentacorriente) {
      this.form.nrocuentacorrienteConfirmada = 0;
    }
  }

  private normalizarNroCuentaCorriente(valor: string | null | undefined): string | undefined {
    const texto = `${valor ?? ''}`.trim();
    if (!texto || texto === '0') {
      return undefined;
    }

    return texto;
  }
}
