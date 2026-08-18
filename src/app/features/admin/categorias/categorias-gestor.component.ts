import { Component, OnInit, ViewChild, TemplateRef, ElementRef } from '@angular/core';
import { MatDialog, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CategoriaArbolComponent } from './categoria-arbol.component';
import { CategoriaFormComponent } from './categoria-form.component';
import { ArticulosEnCategoriaComponent } from './articulos-en-categoria.component';
import { ApiService } from '../../../api.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiAdminService } from '../../../api-admin.service';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermisosService } from '../../../permisos.service';
import { GlobalLoadingComponent } from '../../../shared/global-loading.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-categorias-gestor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CategoriaArbolComponent, CategoriaFormComponent, ArticulosEnCategoriaComponent,
    MatDialogModule, MatIconModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
    DragDropModule,
    GlobalLoadingComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './categorias-gestor.component.html',
  styleUrls: ['./categorias-gestor.component.scss']
})
export class CategoriasGestorComponent implements OnInit {
  loading = false;
  categorias: any[] = [];
  categoriaSeleccionada: any = null;
  loadingAdmin = false;
  private readonly selectedAppStorageKey = 'selectedAppId';
  @ViewChild('artCatComp', { static: false }) articulosEnCategoriaComp!: ArticulosEnCategoriaComponent;
  @ViewChild('inputBusqueda', { static: false }) inputBusquedaRef!: ElementRef<HTMLInputElement>;
  plegadas: { [id: string]: boolean } = {};
  @ViewChild('modalNuevaCategoria') modalNuevaCategoria!: TemplateRef<any>;
  dialogRef: MatDialogRef<any> | null = null;
  articulosAsociados: any[] = [];
  articulosBusqueda: any[] = [];
  busquedaArticulo: string = '';
  permisos: string[] = [];
  // Solo usuarios con permisos de admin/operador pueden ver este módulo
  // Aquí se validará el permiso antes de mostrar la UI
  constructor(
    private api: ApiService,
    private apiAdmin: ApiAdminService,
    private dialog: MatDialog,
    public permisosService: PermisosService,
    private http: HttpClient
  ) {}
  abrirModalNuevaCategoria() {
    this.dialogRef = this.dialog.open(this.modalNuevaCategoria, {
      width: '420px',
      disableClose: true
    });
  }
  cerrarModalNuevaCategoria() {
    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = null;
    }
  }
  onDropAsociado(event: CdkDragDrop<any[]>) {
    // Permite reordenar o quitar artículos asociados
    if (event.previousContainer === event.container) {
      moveItemInArray(this.articulosAsociados, event.previousIndex, event.currentIndex);
    } else {
      // Quitar de búsqueda y asociar
      const item = event.previousContainer.data[event.previousIndex];
      // Solo agregar si no está ya en asociados
      if (!this.articulosAsociados.includes(item)) {
        this.articulosAsociados.push(item);
      }
      // Eliminar de búsqueda si está
      this.articulosBusqueda = this.articulosBusqueda.filter(a => a !== item);
      // Actualizar visualmente el drop
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      // Aquí puedes llamar a la API para asociar el artículo
    }
  }
  onDropBusqueda(event: CdkDragDrop<any[]>) {
    // Permite quitar asociación (drag de asociados a búsqueda)
    if (event.previousContainer === event.container) {
      moveItemInArray(this.articulosBusqueda, event.previousIndex, event.currentIndex);
    } else {
      // Quitar de asociados y desasociar
      const item = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      // Aquí puedes llamar a la API para desasociar el artículo
    }
  }
  onBuscarArticulo() {
    const nombre = this.busquedaArticulo.trim();
    if (!nombre) {
      this.articulosBusqueda = [];
      return;
    }
    this.loadingAdmin = true;
    const appId = this.getSelectedAppId();
    this.api.buscarProductosPorNombre(nombre, appId).subscribe({
      next: (productos) => {
        this.articulosBusqueda = productos || [];
        this.loadingAdmin = false;
      },
      error: () => {
        this.articulosBusqueda = [];
        this.loadingAdmin = false;
      }
    });
  }

  private getSelectedAppId(): number {
    try {
      const raw = localStorage.getItem(this.selectedAppStorageKey);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch {}
    return 1;
  }

  private buildCategoryAppPayload(source: any): { appId: number; app: any } {
    const sourceAppId = Number(source?.appId ?? source?.app?.id);
    const appId = Number.isFinite(sourceAppId) && sourceAppId > 0 ? sourceAppId : this.getSelectedAppId();
    const app = source?.app && typeof source.app === 'object'
      ? { ...source.app, id: appId }
      : { id: appId };

    return { appId, app };
  }
  // --- Selección masiva para resultados de búsqueda ---
  busquedaSeleccionados: Set<number> = new Set();
  get todosBusquedaSeleccionados(): boolean {
    return this.articulosBusqueda.length > 0 && this.articulosBusqueda.every(a => this.busquedaSeleccionados.has(a.id));
  }
  toggleSeleccionBusqueda(id: number) {
    if (this.busquedaSeleccionados.has(id)) {
      this.busquedaSeleccionados.delete(id);
    } else {
      this.busquedaSeleccionados.add(id);
    }
  }
  toggleSeleccionTodosBusqueda(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.articulosBusqueda.forEach(a => this.busquedaSeleccionados.add(a.id));
    } else {
      this.busquedaSeleccionados.clear();
    }
  }
  asociarSeleccionBusqueda() {
    const seleccionados = this.articulosBusqueda.filter(a => this.busquedaSeleccionados.has(a.id));
    if (seleccionados.length === 0) return;
    this.loadingAdmin = true;
    this.mensajeAsociar = '';
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const url = `${environment.apiUrlBackend}/api/categorias/${this.categoriaSeleccionada.id}/asignar-productos`;
    const productos = seleccionados.map(a => a.id);
    this.http.post(url, { productos }, { headers }).subscribe({
      next: (resp: any) => {
        // Quitar los asociados de la búsqueda y limpiar selección
        this.articulosBusqueda = this.articulosBusqueda.filter(a => !this.busquedaSeleccionados.has(a.id));
        this.busquedaSeleccionados.clear();
        if (this.articulosEnCategoriaComp) {
          this.articulosEnCategoriaComp.cargarProductos();
        }
        this.loadingAdmin = false;
        this.mensajeAsociar = resp?.message || 'Productos asignados correctamente.';
      },
      error: err => {
        this.loadingAdmin = false;
        this.mensajeAsociar = err?.error?.message || err.message || 'Error al asignar productos.';
      }
    });
  }
  async onAsociarArticulo(art: any) {
    this.loadingAdmin = true;
    this.mensajeAsociar = '';
    if (!(await this.pingBackendAdmin())) {
      this.loadingAdmin = false;
      this.mensajeAsociar = 'Servicio no disponible momentáneamente, intente más tarde o comuníquese con el administrador del sistema';
      return;
    }
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const url = `${environment.apiUrlBackend}/api/categorias/${this.categoriaSeleccionada.id}/asignar-productos`;
    this.http.post(url, { productos: [art.id] }, { headers }).subscribe({
      next: (resp: any) => {
        this.articulosAsociados.push(art);
        this.articulosBusqueda = this.articulosBusqueda.filter(a => a !== art);
        // Recargar productos asignados en la vista
        if (this.articulosEnCategoriaComp) {
          this.articulosEnCategoriaComp.cargarProductos();
        }
        this.loadingAdmin = false;
        this.mensajeAsociar = resp?.message || 'Producto asignado correctamente.';
      },
      error: err => {
        this.loadingAdmin = false;
        this.mensajeAsociar = err?.error?.message || err.message || 'Error al asignar producto.';
      }
    });
  }
  mensajeAsociar: string = '';

  // PING al backend antes de operaciones administrativas
  private pingBackendAdmin(): Promise<boolean> {
    return new Promise((resolve) => {
      this.apiAdmin.ping().subscribe({
        next: () => resolve(true),
        error: () => resolve(false)
      });
    });
  }

  // CREAR CATEGORÍA
  async crearCategoria(data: any) {
    this.loadingAdmin = true;
    if (!(await this.pingBackendAdmin())) {
      this.loadingAdmin = false;
      alert('Servicio no disponible momentáneamente, intente más tarde o comuníquese con el administrador del sistema');
      return;
    }
    // Calcular el siguiente valor de orden para el nivel
    const parentId = data.parentId ?? null;
    const mismasNivel = this.categorias.filter((c: any) => (c.parentId ?? null) === parentId);
    const maxOrden = mismasNivel.length > 0 ? Math.max(...mismasNivel.map((c: any) => c.orden ?? 0)) : -1;
    const payload = {
      ...data,
      ...this.buildCategoryAppPayload(data),
      orden: (data.orden !== undefined && data.orden !== null) ? data.orden : maxOrden + 1
    };
    this.apiAdmin.crearCategoria(payload).subscribe({
      next: () => { this.refrescarCategorias(); this.loadingAdmin = false; },
      error: err => { this.loadingAdmin = false; alert('Error al crear categoría: ' + (err?.error?.message || err.message || err)); }
    });
  }

  // EDITAR CATEGORÍA
  async editarCategoria(id: number, data: any) {
    this.loadingAdmin = true;
    if (!(await this.pingBackendAdmin())) {
      this.loadingAdmin = false;
      alert('Servicio no disponible momentáneamente, intente más tarde o comuníquese con el administrador del sistema');
      return;
    }
    // Siempre enviar el campo url (igual a imagen si existe)
    const payload = {
      ...data,
      ...this.buildCategoryAppPayload(data),
      url: data.imagen ?? data.url ?? ''
    };
    this.apiAdmin.editarCategoria(id, payload).subscribe({
      next: () => { this.refrescarCategorias(); this.loadingAdmin = false; },
      error: err => { this.loadingAdmin = false; alert('Error al editar categoría: ' + (err?.error?.message || err.message || err)); }
    });
  }

  // EDITAR CATEGORÍA DESDE EL ÁRBOL
  // (Eliminada función duplicada onEditarCategoriaArbol, se mantiene solo la versión correcta al final de la clase)

  // ELIMINAR CATEGORÍA
  async eliminarCategoria(id: number) {
    // Open confirmation modal instead of native confirm
    this.categoriaAEliminarId = id;
    // show modal programmatically (modal exists in template)
    try {
      const el = document.getElementById('deleteCategoriaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const m = new (window as any).bootstrap.Modal(el);
        m.show();
      }
    } catch (e) {
      // fallback to confirm
      if (!confirm('¿Seguro que deseas eliminar esta categoría?')) return;
      this._doEliminarCategoria(id);
    }
  }

  categoriaAEliminarId: number | null = null;

  async onEliminarCategoriaConfirmed(): Promise<void> {
    if (!this.categoriaAEliminarId) return;
    await this._doEliminarCategoria(this.categoriaAEliminarId);
    this.categoriaAEliminarId = null;
  }

  onEliminarCategoriaCancelled(): void {
    this.categoriaAEliminarId = null;
  }

  private async _doEliminarCategoria(id: number) {
    this.loadingAdmin = true;
    if (!(await this.pingBackendAdmin())) {
      this.loadingAdmin = false;
      alert('Servicio no disponible momentáneamente, intente más tarde o comuníquese con el administrador del sistema');
      return;
    }
    this.apiAdmin.eliminarCategoria(id).subscribe({
      next: () => { this.refrescarCategorias(); this.loadingAdmin = false; },
      error: err => { this.loadingAdmin = false; alert('Error al eliminar categoría: ' + (err?.error?.message || err.message || err)); }
    });
  }

  async onActualizarOrdenCategoria(id: number, nuevoOrden: number) {
    this.loadingAdmin = true;
    if (!(await this.pingBackendAdmin())) {
      this.loadingAdmin = false;
      alert('Servicio no disponible momentáneamente, intente más tarde o comuníquese con el administrador del sistema');
      return;
    }
    const payload = { ordenes: [{ id, orden: nuevoOrden }] };
    this.apiAdmin.actualizarOrdenCategoria(payload).subscribe({
      next: () => { this.refrescarCategorias(); this.loadingAdmin = false; },
      error: err => { this.loadingAdmin = false; alert('Error al actualizar orden: ' + (err?.error?.message || err.message || err)); }
    });
  }

  onActualizarOrdenCategoriaUI(event: { id: number, direccion: 'up' | 'down' }) {
    // Busca la categoría y filtra solo las del mismo nivel (mismo parentId)
    const catActual = this.categorias.find((c: any) => c.id === event.id);
    if (!catActual) return;
    const parentId = catActual.parentId ?? null;
    // Filtrar solo las del mismo nivel
    const mismasNivel = this.categorias.filter((c: any) => (c.parentId ?? null) === parentId);
    // Ordenar por orden ascendente
    const ordenadas = [...mismasNivel].sort((a, b) => a.orden - b.orden);
    const idx = ordenadas.findIndex((c: any) => c.id === event.id);
    if (idx === -1) return;
    let swapIdx = event.direccion === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordenadas.length) return;
    const catSwap = ordenadas[swapIdx];
    // Intercambiar los valores de orden
    const payload: { ordenes: { id: number, orden: number }[] } = { ordenes: [] };
    payload.ordenes.push({ id: catActual.id, orden: catSwap.orden });
    payload.ordenes.push({ id: catSwap.id, orden: catActual.orden });
    this.loadingAdmin = true;
    this.apiAdmin.actualizarOrdenCategoria(payload).subscribe({
      next: () => { this.refrescarCategorias(); this.loadingAdmin = false; },
      error: err => { this.loadingAdmin = false; alert('Error al actualizar orden: ' + (err?.error?.message || err.message || err)); }
    });
  }

  refrescarCategorias() {
    // Guardar el estado de plegado antes de refrescar
    const plegadasPrevio = { ...this.plegadas };
    this.loadingAdmin = true;
    this.apiAdmin.getCategorias().subscribe({
      next: (cats: any[]) => {
        this.categorias = cats;
        // Restaurar el estado de plegado
        setTimeout(() => { this.plegadas = { ...plegadasPrevio }; }, 0);
        this.loadingAdmin = false;
      },
      error: () => {
        this.categorias = [];
        this.loadingAdmin = false;
      }
    });
  }

  ngOnInit(): void {
    console.log('Permisos cargados:', this.permisosService.getAliases());
    this.loadingAdmin = true;
    this.apiAdmin.getCategorias().subscribe({
      next: (cats: any[]) => {
        this.categorias = cats;
        this.loadingAdmin = false;
      },
      error: () => {
        this.categorias = [];
        this.loadingAdmin = false;
      }
    });
  }
// --- Métodos para eventos del árbol y formulario ---
  onSeleccionarCategoria(cat: any) {
    this.categoriaSeleccionada = cat;
    setTimeout(() => {
      const panel = document.getElementById('panel-articulos-categoria');
      const input = this.inputBusquedaRef?.nativeElement;
      if (panel && input) {
        // Scroll para que el input quede en el top del panel
        const panelRect = panel.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        const offset = inputRect.top - panelRect.top;
        panel.scrollTop += offset;
      }
    }, 100);
  }

  onAgregarSubcategoria(data: any) {
    // data: { parent, nombre, descripcion, codInterno, imagen, orden }
    if (!data || !data.parent || !data.nombre) return;
    const payload = {
      parentId: data.parent.id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      codInterno: data.codInterno,
      imagen: data.imagen,
      orden: data.orden,
      ...this.buildCategoryAppPayload(data.parent)
    };
    this.crearCategoria(payload);
  }

  onEditarCategoriaArbol(cat: any) {
    if (!cat || !cat.id) return;
    // Tomar todos los campos editables, incluyendo url
    const data = {
      nombre: cat.nombre,
      descripcion: cat.descripcion,
      codInterno: cat.codInterno,
      imagen: cat.imagen ?? '',
      url: cat.url ?? cat.imagen ?? '', // Prioriza url si viene del formulario, si no, imagen
      appId: cat.appId,
      app: cat.app
    };
    this.editarCategoria(cat.id, data);
  }

  onEliminarCategoria(cat: any) {
    if (cat && cat.id) {
      this.eliminarCategoria(cat.id);
    }
  }

  onGuardarCategoria(data: any) {
    this.crearCategoria(data);
  }

  plegarTodasCategorias() {
    // Marca todas las categorías como plegadas
    if (this.categorias && Array.isArray(this.categorias)) {
      for (const cat of this.categorias) {
        this.plegarRecursivo(cat);
      }
    }
  }
  private plegarRecursivo(cat: any) {
    if (!cat) return;
    this.plegadas[cat.id] = true;
    if (cat.hijos && Array.isArray(cat.hijos)) {
      for (const hijo of cat.hijos) {
        this.plegarRecursivo(hijo);
      }
    }
  }
}




