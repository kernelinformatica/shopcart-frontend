import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampanasComercialesService } from './campanas-comerciales.service';
import { ToastService } from '../../../shared/toast.service';
import { AuthUserService } from '../../../auth-user.service';
import { ListaAccionesComponent } from './lista-acciones.component';
import { ListaCondicionesComponent } from './lista-condiciones.component';
import { EditorApilamientoComponent } from './editor-apilamiento.component';
import { Producto, Campana } from '../../../models';
import { ApiAdminService, MarcaAdminOption, ProductoAtributosMasivosItem, ProductosPaginadosResponse } from '../../../api-admin.service';
import { PermisosService } from '../../../permisos.service';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { resolveBackendMediaUrl } from '../../../shared/utils/producto.utils';



interface CategoriaFiltroOption {
    id: number;
    nombre: string;
    ruta: string;
}

interface ProductoActualizacionPendiente {
    productoId: number;
    marcaId: number | string | null;
    marca: string;
    activo: boolean | true | false | null;
    categoriaId: number | null;
    rubroId: number | null;
    subcategoriaId: number | null;
}
interface PromocionTipoConfigFlags {
    permiteProductos?: boolean;
    requiereProductos?: boolean;
    permiteTarjetas?: boolean;
    requiereTarjetas?: boolean;
    permiteCondiciones?: boolean;
    requiereCondiciones?: boolean;
    permiteAcciones?: boolean;
    requiereAccion?: boolean;
    permiteStacking?: boolean;
    permiteSlide?: boolean;
    requiereImagenSlide?: boolean;
    permiteImagenSlide?: boolean;
    esSlide?: boolean;
}
interface PromocionTipoUi {
    id: number;
    nombre: string;
    alias?: string;
    descripcion?: string;
    config?: PromocionTipoConfigFlags | any;
    [key: string]: any;
}
interface CampanaVisibilityState {
    general: boolean;
    productos: boolean;
    tarjetas: boolean;
    condiciones: boolean;
    acciones: boolean;
    stacking: boolean;
    visual: boolean;
    slide: boolean;
    imagenSlide: boolean;
    esSlide: boolean;
    requiereProductos: boolean;
    requiereTarjetas: boolean;
    requiereCondiciones: boolean;
    requiereAccion: boolean;
    requiereImagenSlide: boolean;
}
type TabType = 'general' | 'visual' | 'productos' | 'acciones' | 'condiciones' | 'tarjetas' | 'stacking' | 'historial';
@Component({
    selector: 'app-campana-comercial-form',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, ListaAccionesComponent, ListaCondicionesComponent, EditorApilamientoComponent, ConfirmDialogComponent],
    templateUrl: './campana-comercial-form.component.html',
    styleUrls: ['./campana-comercial-form.component.scss']
})

export class CampanaComercialFormComponent implements OnInit {
    private readonly apiAdmin = inject(ApiAdminService);
    private readonly permisosService = inject(PermisosService);
    private readonly selectedAppStorageKey = 'selectedAppId';
    readonly pageSizeOptions = [10, 25, 50, 100];
    id?: number;
    campana: any = { nombre: '', descripcion: '', tipoId: null, appId: this.getSelectedAppId(), fechaInicio: '', fechaFin: '', imagenSlide: null, imagenesSlide: [], enSlide: 0, activa: 1 };
    tipos: PromocionTipoUi[] = [];
    tab!: TabType;
    todosLosProductos: Producto[] = [];
    busquedaNombre = '';
    marcaSeleccionadaId: number | string | null = null;
    marcas: MarcaAdminOption[] = [];
    cargando = false;
    eliminandoId: number | null = null;
    productoAEliminar: Producto | null = null;
    mensaje: string = '';
    paginaActual = 1;
    error = '';
    productos: Producto[] = [];
    productosPorPagina = 25;
    totalProductos = 0;
    appIdActual = this.getSelectedAppId();
    categoriaSeleccionadaId: number | null = null;
    categorias: any[] = [];
    imagenAmpliadaUrl: string | null = null;
    imagenAmpliadaAlt = '';
    imagenesSlidePendientes: Array<{ id: string; file?: File; url: string; nombre: string; orden: number }> = [];
    categoriaBusqueda = '';
    listaPrecioSeleccionadaId: number | null = null;
    categoriasFiltro: CategoriaFiltroOption[] = [];
    filtrosPlegados = false;
    productosSeleccionados = new Set<number>();
    eliminandoSeleccionados = false;
    // Selección en el panel de búsqueda
    productosBusquedaSeleccionados = new Set<number>();
    assigningSeleccionados = false;
    // Filtros para productos asignados
    assignedBusquedaNombre = '';
    assignedMarcaSeleccionadaId: number | string | null = null;
    assignedCategoriaBusqueda = '';
    assignedCategoriaSeleccionadaId: number | null = null;
    assignedCategoriaShowSuggestions = false;
    // Paginación para productos asignados
    assignedPage = 1;
    assignedPageSize = 15;
    assignedPageSizeOptions: number[] = [15, 30, 50, 100];
    actualizacionesPendientes: Record<number, ProductoActualizacionPendiente> = {};
    uiState: CampanaVisibilityState = this.crearEstadoUIVacio();
    errorGuardado = '';
    cargandoTipos = false;


    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private svc: CampanasComercialesService,
        private toast: ToastService,
        private auth: AuthUserService
    ) { }

    ngOnInit(): void {
        this.cargarTipos();
        const paramId = this.route.snapshot.paramMap.get('id');
        if (paramId) {
            this.id = Number(paramId);
            this.svc.get(this.id).subscribe({ next: r => { this.campana = { ...this.campana, ...r }; this.campana.imagenesSlide = this.normalizarImagenesSlide(this.campana.imagenesSlide || [], this.campana.imagenSlide); this.sincronizarPendientesDesdeGuardadas(); this.aplicarConfiguracionTipo(); this.setTab('general'); this.normalizarAssignedPage(); }, error: e => this.toast.error('Error al cargar', e?.error?.message || 'Error al cargar') });
        }
        this.cargarDatos();

    }

    editarArticulo(producto: Producto, event?: Event): void {
        if (event) { event.stopPropagation(); event.preventDefault(); }
        if (!producto?.id) return;
        if (!this.permisosService.tienePermiso('articulos') || !this.permisosService.tienePermiso('articulos_editar')) {
            this.toast.error('No autorizado', 'No tenés permiso para editar artículos');
            return;
        }
        this.router.navigate(['/admin/articulos/manual', producto.id]);
    }




  get puedeCrearCampanasComerciales(): boolean {
   return this.permisosService.tienePermiso('comercial')  && this.permisosService.tienePermiso('comercial_crear');
  }
   get puedeVerCampanasComerciales(): boolean {
   return this.permisosService.tienePermiso('comercial')  && this.permisosService.tienePermiso('comercial_ver');
  }
  get puedeBorrarCampanasComerciales(): boolean {
   return this.permisosService.tienePermiso('comercial')  && this.permisosService.tienePermiso('comercial_borrar');
  }
  get puedeEditarCampanasComerciales(): boolean {
   return this.permisosService.tienePermiso('comercial')  && this.permisosService.tienePermiso('comercial_editar');
  }
  get puedeAsignarProductosACampana(): boolean {
   return this.permisosService.tienePermiso('comercial')  && this.permisosService.tienePermiso('comercial_asignar');
  }




    setTab(tabName: TabType) {
        this.tab = tabName;
    }
    isTab(tabName: TabType): boolean {
        return this.tab === tabName;
    }
    isGeneralTab(): boolean { return this.isTab('general'); }
    isVisualTab(): boolean { return this.isTab('visual'); }
    isProductosTab(): boolean { return this.isTab('productos'); }
    isAccionesTab(): boolean { return this.isTab('acciones'); }
    isCondicionesTab(): boolean { return this.isTab('condiciones'); }
    isTarjetasTab(): boolean { return this.isTab('tarjetas'); }
    isStackingTab(): boolean { return this.isTab('stacking'); }
    onTipoChange(tipoId: number | null): void {
        this.campana.tipoId = tipoId;
        this.aplicarConfiguracionTipo();
    }
    userCanEdit(): boolean {
        const roleAlias = this.auth.getRolAlias ? this.auth.getRolAlias() : '';
        return ['administrador', 'operador', 'super_admin'].includes(roleAlias);
    }
    private getSelectedAppId(): number {
        try {
            const raw = localStorage.getItem(this.selectedAppStorageKey);
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        } catch { }

        return 1;
    }

    async save(): Promise<void> {
        if (!this.userCanEdit()) { this.toast.error('No autorizado', 'No tenés permisos para guardar la campaña'); return; }

        try {
            this.campana.appId = this.appIdActual;
            const payload = { ...this.campana, appId: this.appIdActual };
            let campanaId = this.id ?? null;
            if (this.id) {
                await firstValueFrom(this.svc.update(this.id, payload));
                this.toast.success('Guardado', 'Campaña guardada');
            } else {
                const res = await firstValueFrom(this.svc.create(payload));
                campanaId = Number(res?.id || res?.insertId || res?.campanaId || 0) || null;
                this.toast.success('Creado', 'Campaña creada');
                if (campanaId) {
                    this.id = campanaId;
                    this.campana.id = campanaId;
                }
            }

            await this.subirImagenesSlidePendientes(campanaId);

            if (!this.id && campanaId) {
                this.router.navigate(['/admin/campanas-comerciales', campanaId]);
            }
        } catch (e: any) {
            this.toast.error('Error', this.extraerMensajeError(e) || 'Error al guardar');
        }
    }
    get productosAsignados(): Producto[] {
        return this.campana.productos || [];
    }
    private buscarMarcaPorId(marcaId: unknown): MarcaAdminOption | undefined {
        if (marcaId == null || String(marcaId).trim() === '') {
            return undefined;
        }

        return this.marcas.find((marca) => String(marca.id) === String(marcaId));
    }

    private buscarMarcaPorNombre(nombre: string): MarcaAdminOption | undefined {
        const nombreNormalizado = this.normalizarTexto(nombre);
        if (!nombreNormalizado) {
            return undefined;
        }

        return this.marcas.find((marca) => this.normalizarTexto(marca.nombre || '') === nombreNormalizado);
    }
    getCategoriasFiltradasAssigned(): CategoriaFiltroOption[] {
        const termino = this.normalizarTexto(this.assignedCategoriaBusqueda || '');
        if (!termino) return [];
        return this.categoriasFiltro
            .filter((categoria) => this.normalizarTexto(categoria.ruta).includes(termino))
            .slice(0, 20);
    }

    onAssignedCategoriaBusquedaChange(valor: string): void {
        const termino = String(valor || '').trim();
        this.assignedCategoriaBusqueda = termino;
        this.assignedCategoriaShowSuggestions = !!termino;
        if (!termino) {
            this.assignedCategoriaSeleccionadaId = null;
            return;
        }
        const match = this.categoriasFiltro.find(c => this.normalizarTexto(c.ruta) === this.normalizarTexto(termino));
        if (match) {
            this.assignedCategoriaSeleccionadaId = match.id;
            this.assignedGoto(1);
            this.assignedCategoriaShowSuggestions = false;
        } else {
            this.assignedCategoriaSeleccionadaId = null;
        }
    }

    selectAssignedCategoria(categoria: CategoriaFiltroOption): void {
        if (!categoria) return;
        this.assignedCategoriaSeleccionadaId = categoria.id;
        this.assignedCategoriaBusqueda = categoria.ruta || '';
        this.assignedCategoriaShowSuggestions = false;
        this.assignedGoto(1);
    }
    get productosDisponibles(): Producto[] {
        return this.todosLosProductos.filter(
            (p: Producto) => !(this.campana.productos || []).some((asignado: Producto) => asignado.id === p.id)
        );
    }
    aplicarFiltros(): void {
        this.paginaActual = 1;
        void this.cargarDatos();
    }
    async cargarDatos(): Promise<void> {
        this.cargando = true;
        this.error = '';
        
        try {
            this.appIdActual = this.getSelectedAppId();
            const [productosResponse, categorias, marcas, listasPrecios] = await Promise.all([
                firstValueFrom(this.apiAdmin.getProductos(this.construirParamsConsulta())),
                firstValueFrom(this.apiAdmin.getCategorias()),
                firstValueFrom(this.apiAdmin.getMarcas(this.appIdActual)),
                firstValueFrom(this.apiAdmin.getListasPrecios(this.appIdActual))
            ]);
            this.categorias = categorias || [];
            this.marcas = (marcas || []).filter((marca) => marca?.activa !== false);
            if (this.marcaSeleccionadaId != null && !this.marcas.some((marca) => String(marca.id) === String(this.marcaSeleccionadaId))) {
                this.marcaSeleccionadaId = null;
            }
            this.categoriasFiltro = this.aplanarCategorias(this.categorias);
            this.asignarProductosDesdeRespuesta(productosResponse);
            this.normalizarPaginaActual();
        } catch {
            this.productos = [];
            this.totalProductos = 0;
            this.categorias = [];
            this.marcas = [];

            this.categoriasFiltro = [];
            this.productosSeleccionados.clear();
            this.actualizacionesPendientes = {};
            this.error = 'No pudimos cargar los artículos administrativos.';
        } finally {
            this.cargando = false;
        }
    }

    get tipoSeleccionado(): PromocionTipoUi | null {
        const tipoId = Number(this.campana?.tipoId);
        if (!Number.isFinite(tipoId) || tipoId <= 0) return null;
        return this.tipos.find((tipo) => Number(tipo.id) === tipoId) || null;
    }

    get tieneTipoSeleccionado(): boolean {
        return !!this.tipoSeleccionado;
    }

    get configTipoActual(): PromocionTipoConfigFlags {
        return this.normalizarConfigTipo(this.tipoSeleccionado?.config);
    }

    get esTipoSlide(): boolean {
        return !!this.uiState.esSlide;
    }

    get tipoRequiereProductos(): boolean { return this.uiState.requiereProductos; }
    get tipoRequiereTarjetas(): boolean { return this.uiState.requiereTarjetas; }
    get tipoRequiereCondiciones(): boolean { return this.uiState.requiereCondiciones; }
    get tipoRequiereAccion(): boolean { return this.uiState.requiereAccion; }
    get tipoRequiereImagenSlide(): boolean { return this.uiState.requiereImagenSlide; }

    get mostrarGeneral(): boolean { return this.uiState.general; }
    get mostrarProductos(): boolean { return this.tieneTipoSeleccionado && this.uiState.productos; }
    get mostrarTarjetas(): boolean { return this.tieneTipoSeleccionado && this.uiState.tarjetas; }
    get mostrarCondiciones(): boolean { return this.tieneTipoSeleccionado && this.uiState.condiciones; }
    get mostrarAcciones(): boolean { return this.tieneTipoSeleccionado && this.uiState.acciones; }
    get mostrarStacking(): boolean { return this.tieneTipoSeleccionado && this.uiState.stacking; }
    get mostrarVisual(): boolean { return this.tieneTipoSeleccionado && this.uiState.visual; }
    get mostrarImagenSlide(): boolean { return this.uiState.imagenSlide; }
    get mostrarSlide(): boolean { return this.uiState.slide; }
    get tieneImagenesSlidePendientes(): boolean { return this.imagenesSlidePendientes.length > 0; }

    get tipoLabel(): string {
        return this.tipoSeleccionado?.nombre || 'Sin tipo seleccionado';
    }

    private cargarTipos(): void {
        this.cargandoTipos = true;
        this.svc.listTipos(this.appIdActual).subscribe({
            next: (r) => {
                this.tipos = Array.isArray(r) ? r : [];
                this.cargandoTipos = false;
                this.aplicarConfiguracionTipo();
                if (!this.tab) {
                    this.setTab('general');
                }
            },
            error: () => {
                this.cargandoTipos = false;
                this.tipos = [];
            }
        });
    }

    private aplicarConfiguracionTipo(): void {
        const config = this.normalizarConfigTipo(this.tipoSeleccionado?.config);
        this.uiState = this.construirEstadoUIDesdeConfig(config);
        this.recortarCamposSegunConfig();
    }

    private construirEstadoUIDesdeConfig(config: PromocionTipoConfigFlags): CampanaVisibilityState {
        const hasConfig = Object.keys(config || {}).length > 0;
        const permite = (valor: unknown): boolean => valor === true || (!hasConfig && valor == null);
        const requiere = (valor: unknown): boolean => valor === true;
        const permiteSlide = permite(config.permiteSlide);
        const permiteImagenSlide = permite(config.permiteImagenSlide);
        const esSlide = !!config.esSlide;
        return {
            general: true,
            productos: permite(config.permiteProductos),
            tarjetas: permite(config.permiteTarjetas),
            condiciones: permite(config.permiteCondiciones),
            acciones: permite(config.permiteAcciones),
            stacking: permite(config.permiteStacking),
            visual: permiteSlide || permiteImagenSlide || esSlide || !hasConfig,
            slide: permiteSlide,
            imagenSlide: permiteImagenSlide,
            esSlide,
            requiereProductos: requiere(config.requiereProductos),
            requiereTarjetas: requiere(config.requiereTarjetas),
            requiereCondiciones: requiere(config.requiereCondiciones),
            requiereAccion: requiere(config.requiereAccion),
            requiereImagenSlide: requiere(config.requiereImagenSlide)
        };
    }

    private recortarCamposSegunConfig(): void {
        if (!this.uiState.productos) this.campana.productos = [];
        if (!this.uiState.tarjetas) this.campana.tarjetas = [];
        if (!this.uiState.condiciones) this.campana.condiciones = [];
        if (!this.uiState.acciones) this.campana.acciones = [];
        if (!this.uiState.stacking) this.campana.stacking = null;
        if (!this.uiState.slide) this.campana.enSlide = 0;
        if (!this.uiState.imagenSlide) this.campana.imagenSlide = null;
        if (!this.uiState.imagenSlide) this.imagenesSlidePendientes = [];
    }

    private normalizarConfigTipo(config: any): PromocionTipoConfigFlags {
        if (!config) return {};
        if (typeof config === 'string') {
            try {
                return this.normalizarConfigTipo(JSON.parse(config));
            } catch {
                return {};
            }
        }
        const fuente = config.config || config;
        const normalizarFlag = (valor: unknown): boolean | undefined => {
            if (valor === 1 || valor === '1' || valor === true) return true;
            if (valor === 0 || valor === '0' || valor === false) return false;
            return undefined;
        };
        return {
            permiteProductos: normalizarFlag(fuente.permiteProductos ?? fuente.allowProducts ?? fuente.permitirProductos),
            requiereProductos: normalizarFlag(fuente.requiereProductos ?? fuente.requireProducts),
            permiteTarjetas: normalizarFlag(fuente.permiteTarjetas ?? fuente.allowTarjetas ?? fuente.permitirTarjetas),
            requiereTarjetas: normalizarFlag(fuente.requiereTarjetas ?? fuente.requireTarjetas),
            permiteCondiciones: normalizarFlag(fuente.permiteCondiciones ?? fuente.allowConditions ?? fuente.permitirCondiciones),
            requiereCondiciones: normalizarFlag(fuente.requiereCondiciones ?? fuente.requireConditions),
            permiteAcciones: normalizarFlag(fuente.permiteAcciones ?? fuente.allowActions ?? fuente.permitirAcciones),
            requiereAccion: normalizarFlag(fuente.requiereAccion ?? fuente.requireAction),
            permiteStacking: normalizarFlag(fuente.permiteStacking ?? fuente.allowStacking ?? fuente.permitirStacking),
            permiteSlide: normalizarFlag(fuente.permiteSlide ?? fuente.allowSlide ?? fuente.permitirSlide),
            requiereImagenSlide: normalizarFlag(fuente.requiereImagenSlide ?? fuente.requireImageSlide),
            permiteImagenSlide: normalizarFlag(fuente.permiteImagenSlide ?? fuente.allowImageSlide),
            esSlide: fuente.esSlide ?? fuente.slide ?? fuente.tipoSlide
        };
    }

    private crearEstadoUIVacio(): CampanaVisibilityState {
        return {
            general: true,
            productos: false,
            tarjetas: false,
            condiciones: false,
            acciones: false,
            stacking: false,
            visual: false,
            slide: false,
            imagenSlide: false,
            esSlide: false,
            requiereProductos: false,
            requiereTarjetas: false,
            requiereCondiciones: false,
            requiereAccion: false,
            requiereImagenSlide: false
        };
    }

    private extraerMensajeError(error: any): string {
        return error?.error?.message || error?.error?.mensaje || error?.message || '';
    }

    verImagenSlide(imagen: { url?: string; nombre?: string }): void {
        const url = resolveBackendMediaUrl(imagen?.url ?? '');
        if (!url) {
            return;
        }

        this.imagenAmpliadaUrl = url;
        this.imagenAmpliadaAlt = imagen?.nombre || 'Imagen de slide';
    }

    cerrarImagenAmpliada(): void {
        this.imagenAmpliadaUrl = null;
        this.imagenAmpliadaAlt = '';
    }

    onSlideFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const files = Array.from(input?.files || []);
        if (files.length > 0) {
            this.agregarImagenesSlide(files);
        }
        if (input) {
            input.value = '';
        }
    }

    private agregarImagenesSlide(files: File[]): void {
        const ordenBase = this.imagenesSlidePendientes.length + 1;
        const nuevos = files.map((file, index) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            url: '',
            nombre: file.name
            ,
            orden: ordenBase + index
        }));

        this.imagenesSlidePendientes = [...this.imagenesSlidePendientes, ...nuevos];

        nuevos.forEach((item) => {
            const reader = new FileReader();
            reader.onload = () => {
                item.url = String(reader.result || '');
                this.imagenesSlidePendientes = [...this.imagenesSlidePendientes];
                if (!this.campana.imagenSlide && item.url) {
                    this.campana.imagenSlide = item.url;
                }
                if (!Array.isArray(this.campana.imagenesSlide)) {
                    this.campana.imagenesSlide = [];
                }
                this.sincronizarImagenesSlideCampana();
            };
            reader.readAsDataURL(item.file as File);
        });
    }

    quitarImagenSlide(itemId: string): void {
        const imagen = this.imagenesSlidePendientes.find((item) => item.id === itemId);
        if (!imagen) {
            return;
        }

        if (!imagen.file && this.id && typeof imagen.id === 'string' && !imagen.id.startsWith('fallback')) {
            const confirmed = window.confirm('¿Querés eliminar esta imagen del slide?');
            if (!confirmed) {
                return;
            }

            const slideId = Number(imagen.id);
            if (!Number.isFinite(slideId) || slideId <= 0) {
                this.toast.error('Atención', 'No se pudo identificar la imagen a eliminar');
                return;
            }

            this.svc.deleteSlideImage(this.id, slideId).subscribe({
                next: (res: any) => {
                    const imagenes = Array.isArray(res?.imagenesSlide) ? res.imagenesSlide : [];
                    this.campana.imagenesSlide = this.normalizarImagenesSlide(imagenes, res?.imagenSlide ?? null);
                    this.campana.imagenSlide = this.campana.imagenesSlide[0]?.url || null;
                    this.sincronizarPendientesDesdeGuardadas();
                    this.toast.success(res?.message || 'Imagen eliminada', res?.message || 'Imagen de slide eliminada');
                },
                error: (e) => this.toast.error('Error', this.extraerMensajeError(e) || 'No se pudo eliminar la imagen del slide')
            });
            return;
        }

        this.imagenesSlidePendientes = this.imagenesSlidePendientes.filter((item) => item.id !== itemId);
        this.reordenarImagenesSlide();
        this.sincronizarImagenesSlideCampana();
    }

    limpiarImagenesSlide(): void {
        this.imagenesSlidePendientes = [];
        this.campana.imagenesSlide = [];
        this.campana.imagenSlide = null;
    }

    subirImagenSlide(itemId: string): void {
        const index = this.imagenesSlidePendientes.findIndex((item) => item.id === itemId);
        if (index > 0) {
            const [item] = this.imagenesSlidePendientes.splice(index, 1);
            this.imagenesSlidePendientes.splice(index - 1, 0, item);
            this.reordenarImagenesSlide();
            this.sincronizarImagenesSlideCampana();
        }
    }

    bajarImagenSlide(itemId: string): void {
        const index = this.imagenesSlidePendientes.findIndex((item) => item.id === itemId);
        if (index >= 0 && index < this.imagenesSlidePendientes.length - 1) {
            const [item] = this.imagenesSlidePendientes.splice(index, 1);
            this.imagenesSlidePendientes.splice(index + 1, 0, item);
            this.reordenarImagenesSlide();
            this.sincronizarImagenesSlideCampana();
        }
    }

    private reordenarImagenesSlide(): void {
        this.imagenesSlidePendientes = this.imagenesSlidePendientes.map((item, index) => ({
            ...item,
            orden: index + 1
        }));
    }

    private sincronizarImagenesSlideCampana(): void {
        this.campana.imagenesSlide = this.imagenesSlidePendientes
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((item) => ({
                id: item.id,
                url: resolveBackendMediaUrl(item.url),
                orden: item.orden,
                nombreOriginal: item.nombre
            }))
            .filter(Boolean);
        this.campana.imagenSlide = this.campana.imagenesSlide[0]?.url || null;
    }

    private async subirImagenesSlidePendientes(campanaId: number | null): Promise<void> {
        if (!campanaId || !this.imagenesSlidePendientes.length) {
            return;
        }

        const pendientes = this.imagenesSlidePendientes
            .filter((item) => item.file)
            .slice()
            .sort((a, b) => a.orden - b.orden);

        if (!pendientes.length) {
            return;
        }

        const files = pendientes.map((item) => item.file as File);
        await firstValueFrom(this.svc.uploadSlideImages(campanaId, files));
        this.limpiarImagenesSlide();
        const cargada = await firstValueFrom(this.svc.get(campanaId));
        this.campana = { ...this.campana, ...cargada };
        this.campana.imagenesSlide = this.normalizarImagenesSlide(this.campana.imagenesSlide || [], this.campana.imagenSlide);
        this.sincronizarPendientesDesdeGuardadas();
    }

    private normalizarImagenesSlide(imagenes: any[], fallbackImagenSlide?: string | null): Array<{ id: number | string; url: string; orden: number; nombreOriginal?: string; alias?: string }> {
        const normalizadas = (Array.isArray(imagenes) ? imagenes : [])
            .map((item, index) => ({
                id: item?.id ?? `${index}`,
                url: resolveBackendMediaUrl(item?.url ?? item?.imagenSlide ?? item?.imagen ?? ''),
                orden: Number(item?.orden ?? index + 1) || index + 1,
                nombreOriginal: item?.nombreOriginal ?? item?.nombre_original ?? item?.nombre ?? '',
                alias: item?.alias ?? ''
            }))
            .filter((item) => !!item.url)
            .sort((a, b) => a.orden - b.orden);

        if (!normalizadas.length && fallbackImagenSlide) {
            return [{ id: 'fallback', url: resolveBackendMediaUrl(fallbackImagenSlide), orden: 1, nombreOriginal: '' }];
        }

        return normalizadas;
    }

    private sincronizarPendientesDesdeGuardadas(): void {
        const guardadas = Array.isArray(this.campana.imagenesSlide) ? this.campana.imagenesSlide : [];
        this.imagenesSlidePendientes = guardadas.map((item: any, index: number) => ({
            id: String(item?.id ?? `saved-${index}`),
            file: undefined,
            url: resolveBackendMediaUrl(item?.url ?? ''),
            nombre: item?.nombreOriginal || item?.nombre_original || `slide-${index + 1}`,
            orden: Number(item?.orden ?? index + 1) || index + 1
        })).filter((item: { url: string }) => !!item.url).sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden);
    }

    async confirmarSubidaSlide(): Promise<void> {
        if (!this.userCanEdit()) {
            this.toast.error('No autorizado', 'No tenés permisos para subir imágenes');
            return;
        }
        if (!this.id) {
            this.toast.error('Atención', 'Guardá la campaña antes de subir imágenes del slide');
            return;
        }
        if (!this.imagenesSlidePendientes.length) {
            this.toast.error('Atención', 'No hay imágenes pendientes para subir');
            return;
        }

        try {
            await this.subirImagenesSlidePendientes(this.id);
            this.toast.success('Subida completa', 'Las imágenes del slide se subieron correctamente');
        } catch (e: any) {
            this.toast.error('Error', this.extraerMensajeError(e) || 'No se pudieron subir las imágenes del slide');
        }
    }
    onAssignProducts(ids: number[]) {
        if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de asignar productos');
        this.assigningSeleccionados = true;
        this.svc.assignProduct(this.id, ids).subscribe({
            next: (res: any) => {
                // Backend may return the updated productos list. If so, use it.
                if (res && Array.isArray(res.productos)) {
                    this.campana.productos = res.productos;
                } else {
                    // Fallback: try to add product objects from the current search results
                    const asignados = (this.productos || []).filter(p => ids.includes(p.id));
                    this.campana.productos = [...(this.campana.productos || []), ...asignados];
                }
                // Remove assigned items from current search results to update the panel immediately
                if (this.productos && this.productos.length) {
                    this.productos = this.productos.filter(p => !ids.includes(p.id));
                    this.totalProductos = Math.max(0, (Number(this.totalProductos) || 0) - ids.length);
                }
                this.toast.success(res?.message || 'Productos asignados', res?.message || 'Productos asignados a la campaña');
                this.normalizarPaginaActual();
                this.normalizarAssignedPage();
                // clear any selection used for bulk operations
                this.productosSeleccionados.clear();
                this.productosBusquedaSeleccionados.clear();
            },
            error: e => this.toast.error('Error', e?.error?.message || 'Error asignando productos'),
            complete: () => { this.assigningSeleccionados = false; }
        });
    }

    // --- Bulk assign from search panel ---
    areAllSearchSelected(): boolean {
        const visibles = this.productos || [];
        if (!visibles.length) return false;
        return visibles.every((producto) => producto?.id && this.productosBusquedaSeleccionados.has(producto.id));
    }

    async toggleSelectAllSearch(checked: any): Promise<void> {
        const isChecked = !!checked;
        const items = this.productos || [];

        if (!isChecked) {
            items.forEach(p => { if (p?.id) this.productosBusquedaSeleccionados.delete(p.id); });
            return;
        }

        items.forEach(p => { if (p?.id) this.productosBusquedaSeleccionados.add(p.id); });
    }

    toggleSearchSelection(id: number, checked: any): void {
        const isChecked = !!checked;
        if (isChecked) this.productosBusquedaSeleccionados.add(id); else this.productosBusquedaSeleccionados.delete(id);
    }

    assignSelectedFromSearch(): void {
        if (!this.puedeAsignarProductosACampana) { this.toast.error('No autorizado', 'No tenés permiso para asignar productos'); return; }
        const ids = Array.from(this.productosBusquedaSeleccionados);
        if (!ids || ids.length === 0) return;
        this.onAssignProducts(ids);
    }
 limpiarFiltros(): void {
    this.busquedaNombre = '';
    this.marcaSeleccionadaId = null;
   
    this.categoriaBusqueda = '';
    this.categoriaSeleccionadaId = null;
    this.listaPrecioSeleccionadaId = null;
    
    this.paginaActual = 1;
    void this.cargarDatos();
  }
    private construirParamsConsulta(): Record<string, string | number | boolean> {
        const params: Record<string, string | number | boolean> = {
            page: this.paginaActual,
            pageSize: this.productosPorPagina
        };

        const nombre = this.busquedaNombre.trim();
        if (nombre) {
            params['search'] = nombre;
        }

        if (this.marcaSeleccionadaId != null) {
            params['marcaId'] = this.marcaSeleccionadaId;
        }

        if (this.categoriaSeleccionadaId) {
            params['categoriaId'] = this.categoriaSeleccionadaId;
        }
        return params;
    }
    /* onAssignProducts(ids: number[]) {
       if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de asignar productos');
       this.svc.assignProducts(this.id, ids).subscribe({ next: () => this.toast.success('Productos asignados','Productos asignados a la campaña'), error: e => this.toast.error('Error', e?.error?.message || 'Error asignando productos') });
     }
   */
    private aplanarCategorias(categorias: any[], rutaPadre = ''): CategoriaFiltroOption[] {
        const resultado: CategoriaFiltroOption[] = [];
        for (const categoria of categorias || []) {
            if (!categoria?.id || !categoria?.nombre) {
                continue;
            }
            const ruta = rutaPadre ? `${rutaPadre} > ${categoria.nombre}` : categoria.nombre;
            resultado.push({ id: categoria.id, nombre: categoria.nombre, ruta });
            const subcategorias = this.obtenerSubcategorias(categoria);
            if (subcategorias.length > 0) {
                resultado.push(...this.aplanarCategorias(subcategorias, ruta));
            }
        }
        return resultado;
    }
    private filtrarProductosLocalmente(productos: Producto[]): Producto[] {
        const terminoNombre = this.normalizarTexto(this.busquedaNombre);
        const asignadosIds = new Set<number>((this.campana?.productos || []).map((p: any) => p.id));
        return (productos || []).filter((producto) => {
            if (producto?.id && asignadosIds.has(producto.id)) return false;
            const coincideNombre = !terminoNombre || this.normalizarTexto(`${producto.nombre || ''} ${producto.descripcion || ''}`).includes(terminoNombre);
            const coincideMarca = this.marcaSeleccionadaId == null || this.productoPerteneceAMarca(producto, this.marcaSeleccionadaId);
            const coincideCategoria = !this.categoriaSeleccionadaId || this.productoPerteneceACategoria(producto, this.categoriaSeleccionadaId);
            return coincideNombre && coincideMarca && coincideCategoria;
        });
    }
    async onRemoveProducts(ids: number[]): Promise<boolean> {
        // Recomendado: enviar la nueva lista completa al endpoint POST /:id/productos
        if (!this.id) { this.toast.error('Atención', 'Guarda la campaña antes de eliminar productos'); return false; }
        if (!ids || ids.length === 0) return false;
        this.eliminandoSeleccionados = true;
        this.error = '';
        try {
            const actuales = (this.campana?.productos || []).map((p: Producto) => p.id).filter((n: any) => Number.isFinite(Number(n)));
            // nueva lista = actuales menos los seleccionados
            const nuevaLista = actuales.filter((pid: number) => !ids.includes(pid));
            const body = { productoIds: nuevaLista };
            const res: any = await firstValueFrom(this.svc.assignProducts(this.id, body.productoIds || []));
            // Backend recommended response: { message, productos }
            if (res && Array.isArray(res.productos)) {
                this.campana.productos = res.productos;
            } else {
                // fallback: recargar
                await this.cargarDatos();
            }
            this.toast.success(res?.message || 'Productos actualizados', res?.message || 'Productos actualizados en la campaña');
            this.normalizarPaginaActual();
            this.normalizarAssignedPage();
            return true;
        } catch (err: any) {
            if (err?.status === 404) this.toast.error('No encontrado', 'La promoción no existe (404)');
            else if (err?.status === 403) this.toast.error('No autorizado', 'No tenés permisos para modificar esta promoción (403)');
            else this.toast.error('Error al eliminar', err?.error?.message || err?.message || 'No se pudieron eliminar los artículos');
            return false;
        } finally {
            this.eliminandoSeleccionados = false;
            this.productosSeleccionados.clear();
        }
    }
    private asignarProductosDesdeRespuesta(response: Producto[] | ProductosPaginadosResponse): void {
       
        if (Array.isArray(response)) {
            const productosFiltrados = this.filtrarProductosLocalmente(response);
            this.productos = productosFiltrados;
            this.totalProductos = productosFiltrados.length;
            return;
        }

        const productosRespuesta = response?.items || [];
        const productosFiltrados = this.filtrarProductosLocalmente(productosRespuesta);

        this.productos = productosFiltrados;
        this.totalProductos = productosFiltrados.length !== productosRespuesta.length
            ? productosFiltrados.length
            : Number(response?.total ?? productosFiltrados.length);
        this.paginaActual = Number(response?.page || this.paginaActual);
        this.productosPorPagina = Number(response?.pageSize || this.productosPorPagina);
    }
    private normalizarPaginaActual(): void {
        this.paginaActual = Math.min(this.paginaActual, this.getTotalPaginas());
        this.paginaActual = Math.max(1, this.paginaActual);
    }
  
    private productoPerteneceAMarca(producto: Producto, marcaId: string | number): boolean {
        return [
            (producto as any)?.marca?.id,
            (producto as any)?.marcaId,
            (producto as any)?.marca_id,
            (producto as any)?.idMarca,
            (producto as any)?.id_marca
        ].some((id) => String(id ?? '') === String(marcaId));
    }
    private obtenerSubcategorias(categoria: any): any[] {
        const colecciones = [
            categoria?.hijos,
            categoria?.children,
            categoria?.subcategorias,
            categoria?.subCategorias,
            categoria?.categorias
        ];

        for (const coleccion of colecciones) {
            if (Array.isArray(coleccion) && coleccion.length > 0) {
                return coleccion;
            }
        }

        return [];
    }
    onCategoriaBusquedaChange(valor: string): void {
        const termino = valor.trim();
        if (!termino) {
            this.categoriaSeleccionadaId = null;
            this.assignedCategoriaSeleccionadaId = null;
            this.assignedCategoriaShowSuggestions = false;
            this.aplicarFiltros();
            return;
        }

        const categoriaSeleccionada = this.getCategoriasFiltradas().find((categoria) => this.normalizarTexto(categoria.ruta) === this.normalizarTexto(valor));
        if (categoriaSeleccionada) {
            this.categoriaSeleccionadaId = categoriaSeleccionada.id;
            this.assignedCategoriaSeleccionadaId = categoriaSeleccionada.id;
            this.assignedCategoriaShowSuggestions = false;
            this.aplicarFiltros();
        } else {
            this.categoriaSeleccionadaId = null;
            this.assignedCategoriaSeleccionadaId = null;
            this.assignedCategoriaShowSuggestions = true;
            this.aplicarFiltros();
        }
    }
    private getCategoriaSeleccionada(): CategoriaFiltroOption | undefined {
        return this.categoriasFiltro.find((categoria) => categoria.id === this.categoriaSeleccionadaId);
    }



    private esValorVacio(valor: unknown): boolean {
        return valor == null || (typeof valor === 'string' && valor.trim() === '');
    }

    private normalizarIdNumerico(valor: unknown): number | null {
        const numero = Number(valor);
        return Number.isFinite(numero) && numero > 0 ? numero : null;
    }
    limpiarCategoriaSeleccionada(): void {
        this.categoriaSeleccionadaId = null;
        this.categoriaBusqueda = '';
        this.assignedCategoriaSeleccionadaId = null;
        this.assignedCategoriaShowSuggestions = false;
        this.aplicarFiltros();
    }
    seleccionarCategoria(categoria: CategoriaFiltroOption): void {
        this.categoriaSeleccionadaId = categoria.id;
        this.categoriaBusqueda = categoria.ruta;
        this.assignedCategoriaSeleccionadaId = categoria.id;
        this.assignedCategoriaShowSuggestions = false;
        this.aplicarFiltros();
    }

    private productoPerteneceACategoria(producto: Producto, categoriaId: number): boolean {
        return [
            (producto as any)?.categoria?.id,
            (producto as any)?.categoriaId,
            (producto as any)?.rubro?.id,
            (producto as any)?.rubroId,
            producto.subcategoria?.id,
            (producto as any)?.subcategoriaId
        ].some((id) => Number(id) === categoriaId);
    }
    private normalizarTexto(valor: string): string {
        return (valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
    }

    getProductoImagen(producto: Producto): string {
        const candidato =
            (producto as any)?.imagen ||
            (producto as any)?.imagenUrl ||
            (producto as any)?.imagenPrincipal ||
            (producto as any)?.urlImagen ||
            (producto as any)?.media?.url ||
            (producto as any)?.media?.[0]?.url ||
            '';
        return resolveBackendMediaUrl(String(candidato || '')) || 'assets/bg/no-image.png';
    }

    getProductoMarcaNombre(producto: Producto): string {
        const marca = (producto as any)?.marca ?? (producto as any)?.marcaObj ?? null;
        if (!marca) {
            return String((producto as any)?.marcaNombre ?? (producto as any)?.marca_nombre ?? '').trim();
        }
        if (typeof marca === 'string') return marca.trim();
        return String(marca?.nombre ?? marca?.denominacion ?? '').trim();
    }

    getProductoCategoriaNombre(producto: Producto): string {
        const categoria = (producto as any)?.categoria ?? (producto as any)?.rubro ?? (producto as any)?.subcategoria ?? null;
        if (!categoria) {
            return '';
        }
        if (typeof categoria === 'string') return categoria.trim();
        return String(categoria?.nombre ?? categoria?.ruta ?? '').trim();
    }
    onAddAction(action: any) {
        if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de agregar acciones');
        this.svc.addAction(this.id, action).subscribe({ next: () => { this.toast.success('Acción agregada', 'Acción agregada a la campaña'); this.reload(); }, error: e => this.toast.error('Error', e?.error?.message || 'Error agregando acción') });
    }

    onRemoveAction(accionId: number) {
        if (!this.id) return;
        this.svc.deleteAction(this.id, accionId).subscribe({ next: () => { this.toast.success('Acción eliminada', 'Acción eliminada de la campaña'); this.reload(); }, error: e => this.toast.error('Error', e?.error?.message || 'Error eliminando acción') });
    }

    onAddCondition(cond: any) {
        if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de agregar condiciones');
        this.svc.addCondition(this.id, cond).subscribe({ next: () => { this.toast.success('Condición agregada', 'Condición agregada a la campaña'); this.reload(); }, error: e => this.toast.error('Error', e?.error?.message || 'Error agregando condición') });
    }

    onRemoveCondition(condicionId: number) {
        if (!this.id) return;
        this.svc.deleteCondition(this.id, condicionId).subscribe({ next: () => { this.toast.success('Condición eliminada', 'Condición eliminada de la campaña'); this.reload(); }, error: e => this.toast.error('Error', e?.error?.message || 'Error eliminando condición') });
    }

    onAssignTarjetas(ids: number[]) {
        if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de asignar tarjetas');
        this.svc.assignTarjetas(this.id, ids).subscribe({ next: () => this.toast.success('Tarjetas asignadas', 'Tarjetas asignadas a la campaña'), error: e => this.toast.error('Error', e?.error?.message || 'Error asignando tarjetas') });
    }

    onSetStacking(s: { combinable: boolean; prioridad: number }) {
        if (!this.id) return this.toast.error('Atención', 'Guarda la campaña antes de configurar stacking');
        this.svc.setStacking(this.id, s).subscribe({ next: () => this.toast.success('Stacking actualizado', 'Stacking actualizado'), error: e => this.toast.error('Error', e?.error?.message || 'Error actualizando stacking') });
    }

    reload() { if (this.id) this.svc.get(this.id).subscribe({ next: r => { this.campana = r; this.normalizarAssignedPage(); } }); }

    private normalizarAssignedPage(): void {
        this.assignedPage = Math.min(this.assignedPage, this.assignedTotalPages || 1);
        this.assignedPage = Math.max(1, this.assignedPage || 1);
    }



    getTotalPaginas(): number {
        return Math.max(1, Math.ceil(this.totalProductos / this.productosPorPagina));
    }



    getMostrarSugerenciasCategoria(): boolean {
        const termino = this.categoriaBusqueda.trim();
        if (!termino) {
            return false;
        }

        const categoriaSeleccionada = this.getCategoriaSeleccionada();
        if (categoriaSeleccionada && categoriaSeleccionada.ruta === termino) {
            return false;
        }

        return this.getCategoriasFiltradas().length > 0;
    }
    getCategoriasFiltradas(): CategoriaFiltroOption[] {
        const termino = this.normalizarTexto(this.categoriaBusqueda);
        if (!termino) {
            return this.categoriasFiltro.slice(0, 80);
        }
        return this.categoriasFiltro
            .filter((categoria) => this.normalizarTexto(categoria.ruta).includes(termino))
            .slice(0, 80);
    }
    get selectedProductos(): number[] {
        return this.campana?.productos?.map((p: Producto) => p.id) || [];
    }

    
  async eliminarProducto(producto: Producto): Promise<void> {
    if (!producto?.id) return;
    // set the producto to be deleted and open modal via data-bs attributes in template
    this.productoAEliminar = producto;
  }

  async onEliminarProductoConfirmed(): Promise<void> {
        if (!this.productoAEliminar) return;
        const producto = this.productoAEliminar;
        this.eliminandoId = producto.id;
        this.error = '';
        try {
            const res: any = await firstValueFrom(this.svc.deleteProducto(this.campana?.id, producto.id));
            if (res && Array.isArray(res.productos)) {
                this.campana.productos = res.productos;
            } else {
                // fallback: recargar desde API
                await this.cargarDatos();
            }
            this.mensaje = res?.message || 'Artículo eliminado correctamente.';
            this.normalizarPaginaActual();
            this.normalizarAssignedPage();
        } catch (err: any) {
            if (err?.status === 404) this.toast.error('No encontrado', 'La promoción o el producto no existen (404)');
            else if (err?.status === 403) this.toast.error('No autorizado', 'No tenés permisos para eliminar este artículo (403)');
            else this.toast.error('Error', err?.error?.message || err?.message || 'No pudimos eliminar el artículo.');
        } finally {
            this.eliminandoId = null;
            this.productoAEliminar = null;
        }
  }

  onEliminarProductoCancelled(): void {
    this.productoAEliminar = null;
  }

    // --- Selección y borrado masivo ---
    get selectedCount(): number {
        return this.productosSeleccionados.size;
    }

    // --- Assigned products pagination helpers ---
    get assignedTotal(): number {
        return (this.filteredProductosAsignados() || []).length;
    }

    get assignedTotalPages(): number {
        return Math.max(1, Math.ceil(this.assignedTotal / this.assignedPageSize));
    }

    filteredProductosAsignados(): Producto[] {
        const termino = this.normalizarTexto(this.assignedBusquedaNombre);
        const marcaId = this.assignedMarcaSeleccionadaId;
        const categoriaId = this.assignedCategoriaSeleccionadaId;
        let items = (this.productosAsignados || []).slice();
        if (termino) {
            items = items.filter(p => this.normalizarTexto(`${p.nombre || ''} ${p.descripcion || ''}`).includes(termino));
        }
        if (marcaId != null) {
            items = items.filter(p => this.productoPerteneceAMarca(p, marcaId));
        }
        if (categoriaId != null) {
            items = items.filter(p => this.productoPerteneceACategoria(p, categoriaId));
        }
        return items;
    }

    filteredProductosBusqueda(): Producto[] {
        let items = (this.productos || []).slice();
        const termino = this.normalizarTexto(this.busquedaNombre);
        const marcaId = this.marcaSeleccionadaId;
        const categoriaId = this.categoriaSeleccionadaId;

        if (termino) {
            items = items.filter((p) => {
                const texto = this.normalizarTexto(`${p.nombre || ''} ${p.descripcion || ''} ${this.getProductoMarcaNombre(p)} ${this.getProductoCategoriaNombre(p)}`);
                return texto.includes(termino);
            });
        }

        if (marcaId != null) {
            items = items.filter((p) => this.productoPerteneceAMarca(p, marcaId));
        }

        if (categoriaId != null) {
            items = items.filter((p) => this.productoPerteneceACategoria(p, categoriaId));
        }

        return items;
    }

    pagedProductosAsignados(): Producto[] {
        const all = this.filteredProductosAsignados();
        const start = (this.assignedPage - 1) * this.assignedPageSize;
        return all.slice(start, start + this.assignedPageSize);
    }

    assignedChangePageSize(size: number | string): void {
        const s = Number(size) || 15;
        this.assignedPageSize = s;
        this.assignedPage = 1;
        this.normalizarAssignedPage();
    }

    areAllSelected(): boolean {
        const allItems = this.filteredProductosAsignados();
        if (!allItems || allItems.length === 0) return false;
        return allItems.every(p => this.productosSeleccionados.has(p.id));
    }

    toggleSelectAll(checked: any): void {
        const isChecked = !!checked;
        const allItems = this.filteredProductosAsignados();
        if (isChecked) {
            // select all products across all pages (filtered set)
            allItems.forEach(p => { if (p?.id) this.productosSeleccionados.add(p.id); });
        } else {
            // clear selection for all items in the filtered set
            allItems.forEach(p => { if (p?.id) this.productosSeleccionados.delete(p.id); });
        }
    }

    assignedGoto(page: number): void {
        if (page < 1) page = 1;
        if (page > this.assignedTotalPages) page = this.assignedTotalPages;
        this.assignedPage = page;
    }

    toggleProductoSelection(id: number, checked: any): void {
        const isChecked = !!checked;
        if (isChecked) this.productosSeleccionados.add(id); else this.productosSeleccionados.delete(id);
    }

    async onEliminarSeleccionadosConfirmed(): Promise<void> {
        const ids = Array.from(this.productosSeleccionados);
        if (ids.length === 0) return;
        const ok = await this.onRemoveProducts(ids);
        if (ok) {
            this.closeModal('deleteSelectedProductosModalAdmin');
        }
    }

    private closeModal(modalId: string): void {
        try {
            const el = document.getElementById(modalId);
            if (!el) return;
            const bs = (window as any).bootstrap;
            if (!bs) {
                // fallback: try to hide by removing show classes
                el.classList.remove('show');
                (el as any).style.display = 'none';
                return;
            }
            const Modal = bs.Modal;
            const instance = Modal.getInstance(el) || new Modal(el);
            instance.hide();
        } catch { }
    }

    onEliminarSeleccionadosCancelled(): void {
        // no-op; mantiene la selección para posibles acciones posteriores
    }

}
