import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService } from '../../../api-admin.service';
import { PermisosService } from '../../../permisos.service';
import { resolveMarcaLogo } from '../../../shared/utils/producto.utils';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-marcas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './marcas-admin.component.html',
  styleUrls: ['./marcas-admin.component.scss']
})
export class MarcasAdminComponent implements OnInit {
  private readonly api = inject(ApiAdminService);
  private readonly permisosService = inject(PermisosService);
  private readonly router = inject(Router);

  marcas: any[] = [];
  cargando = false;
  error = '';
  appId: number | null = null;
  // pagination
  marcasPage = 1;
  marcasPageSize = 10;
  marcasTotal = 0;
  readonly pageSizeOptions = [10, 25, 50, 100,200,300];
  marcasMostradas: any[] = [];
  busquedaNombre = '';

  // sorting
  sortField: 'nombre' | 'productCount' | null = null;
  sortAsc = true;

  editarModo = false;
  editarMarca: any = {};
  procesando = false;
  puedeGestionarMarcas = false;

  // image upload helper
  logoFile: File | null = null;
  logoPreviewUrl: string | null = null;

  // imagen ampliada
  imageModalOpen = false;
  imageModalUrl: string | null = null;
  imageModalAlt: string | null = null;

  // productos modal
  showProductosModal = false;
  productosModal: any[] = [];
  productosModalLoading = false;
  productosModalError: string | null = null;
  productosModalMarcaNombre: string | null = null;

  constructor() {}

  // keep a TS reference so the standalone import is considered used by the compiler
  // (some Angular diagnostics require imported standalone components to be referenced)
  private _confirmDialogRef = ConfirmDialogComponent;

  verProductosPorMarca(m: any): void {
    if (!m) return;
    const marcaId = m.id ?? m.marcaId ?? null;
    const nombre = m.nombre || '';
    // Abrir modal con productos relacionados a la marca
    this.productosModal = [];
    this.productosModalError = null;
    this.productosModalMarcaNombre = nombre;
    this.showProductosModal = true;
    this.productosModalLoading = true;
    const params: any = { pageSize: 1000 };
    if (this.appId) params.appId = this.appId;
    if (marcaId) params.marcaId = marcaId;
    else if (nombre) params.marca = nombre;
    firstValueFrom(this.api.getProductos(params))
      .then((res: any) => {
        // respuesta puede ser array o paginado
        this.productosModal = Array.isArray(res) ? res : (res?.items || res?.data || []);
      })
      .catch(e => {
        console.error('Error cargando productos por marca', e);
        this.productosModalError = 'No se pudieron cargar los productos.';
      })
      .finally(() => (this.productosModalLoading = false));
  }

  cerrarProductosModal(): void {
    this.showProductosModal = false;
    this.productosModal = [];
    this.productosModalError = null;
    this.productosModalMarcaNombre = null;
  }

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    const apps = Array.isArray(usuario?.apps) ? usuario.apps : [];
    this.appId = apps[0]?.id ?? null;
    this.puedeGestionarMarcas = this.permisosService.tienePermiso('marcas') || this.permisosService.tienePermiso('articulos');
    void this.cargarMarcas();
  }

  async cargarMarcas(): Promise<void> {
    this.cargando = true;
    try {
      const params: any = { appId: this.appId ?? 0 };
      if (this.busquedaNombre && String(this.busquedaNombre).trim().length) params.nombre = String(this.busquedaNombre).trim();
      this.marcas = await firstValueFrom(this.api.getMarcas(params));
      this.marcasPage = 1;
      this.prepararPaginadoMarcas();
    } catch (e) {
      console.error('Error cargando marcas', e);
      this.error = 'No se pudieron cargar las marcas.';
      this.marcas = [];
    } finally {
      this.cargando = false;
    }
  }

  aplicarFiltroNombre(): void {
    this.marcasPage = 1;
    void this.cargarMarcas();
  }

  private prepararPaginadoMarcas(): void {
    this.marcasTotal = Array.isArray(this.marcas) ? this.marcas.length : 0;
    // apply sorting before slicing
    this.applySorting();
    const start = (this.marcasPage - 1) * this.marcasPageSize;
    this.marcasMostradas = Array.isArray(this.marcas) ? this.marcas.slice(start, start + this.marcasPageSize) : [];
  }

  applySorting(): void {
    if (!Array.isArray(this.marcas) || !this.sortField) return;
    const field = this.sortField;
    const asc = !!this.sortAsc;
    this.marcas.sort((a: any, b: any) => {
      if (field === 'nombre') {
        const na = String(a?.nombre || '').toLowerCase();
        const nb = String(b?.nombre || '').toLowerCase();
        if (na < nb) return asc ? -1 : 1;
        if (na > nb) return asc ? 1 : -1;
        return 0;
      }
      if (field === 'productCount') {
        const pa = Number((a?.productCount ?? a?.productosCount ?? 0) || 0);
        const pb = Number((b?.productCount ?? b?.productosCount ?? 0) || 0);
        if (pa < pb) return asc ? -1 : 1;
        if (pa > pb) return asc ? 1 : -1;
        return 0;
      }
      return 0;
    });
  }

  toggleSort(field: 'nombre' | 'productCount'): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    // reset to first page and re-paginate
    this.marcasPage = 1;
    this.prepararPaginadoMarcas();
  }

  cambiarPagina(deltaOrPage: number): void {
    if (deltaOrPage === 0) return;
    if (deltaOrPage === 1 || deltaOrPage === -1) {
      const nueva = this.marcasPage + deltaOrPage;
      const totalPages = Math.max(1, Math.ceil(this.marcasTotal / this.marcasPageSize));
      if (nueva < 1 || nueva > totalPages) return;
      this.marcasPage = nueva;
    } else {
      // set absolute page
      this.marcasPage = deltaOrPage;
    }
    this.prepararPaginadoMarcas();
  }

  cambiarPageSize(size: number): void {
    this.marcasPageSize = Number(size) || 25;
    this.marcasPage = 1;
    this.prepararPaginadoMarcas();
  }

  get marcasMaxPages(): number {
    return Math.max(1, Math.ceil((this.marcasTotal || 0) / (this.marcasPageSize || 1)));
  }

  nuevo(): void {
    this.editarModo = true;
    this.editarMarca = { nombre: '', descripcion: '', activa: true };
    this.logoFile = null;
    this.logoPreviewUrl = null;
  }

  editar(m: any): void {
    this.editarMarca = { ...m };
    this.editarModo = true;
    this.logoFile = null;
    this.logoPreviewUrl = this.getLogoUrl(m);
  }

  cancelar(): void {
    this.editarModo = false;
    this.editarMarca = {};
    this.logoFile = null;
    this.logoPreviewUrl = null;
  }

  onLogoFileChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input && input.files && input.files.length) {
      this.logoFile = input.files[0];
      this.logoPreviewUrl = URL.createObjectURL(this.logoFile);
    } else {
      this.logoFile = null;
      this.logoPreviewUrl = null;
    }
  }

  openImageModal(url: string | null, alt?: string | null): void {
    if (!url) return;
    this.imageModalUrl = url;
    this.imageModalAlt = alt || null;
    this.imageModalOpen = true;
  }

  closeImageModal(): void {
    this.imageModalOpen = false;
    this.imageModalUrl = null;
    this.imageModalAlt = null;
  }

  getLogoUrl(item: any): string | null {
    try {
      if (!item) return null;
      const v = resolveMarcaLogo(item);
      return v ? String(v) : null;
    } catch (e) {
      return null;
    }
  }

  async guardar(): Promise<void> {
    if (!this.editarMarca || !this.editarMarca.nombre) {
      this.error = 'El nombre es requerido.';
      return;
    }
    this.procesando = true;
    this.error = '';
    try {
      if (this.editarMarca.id) {
        // Update existing marca
        if (this.logoFile) {
          const fd = new FormData();
          fd.append('nombre', this.editarMarca.nombre);
          fd.append('descripcion', this.editarMarca.descripcion || '');
          fd.append('activa', String(!!this.editarMarca.activa));
          if (this.appId) fd.append('appId', String(this.appId));
          fd.append('image', this.logoFile);
          await firstValueFrom(this.api.editarMarcaMultipart(this.editarMarca.id, fd));
        } else {
          await firstValueFrom(this.api.editarMarca(this.editarMarca.id, { nombre: this.editarMarca.nombre, descripcion: this.editarMarca.descripcion, activa: this.editarMarca.activa }));
        }
      } else {
        // Create new marca
        if (this.logoFile) {
          const fd = new FormData();
          fd.append('nombre', this.editarMarca.nombre);
          fd.append('descripcion', this.editarMarca.descripcion || '');
          if (this.appId) fd.append('appId', String(this.appId));
          fd.append('image', this.logoFile);
          await firstValueFrom(this.api.crearMarcaMultipart(fd));
        } else {
          const created: any = await firstValueFrom(this.api.crearMarca({ nombre: this.editarMarca.nombre, descripcion: this.editarMarca.descripcion, appId: this.appId }));
          if (created && created.id) {
            // nothing else
          }
        }
      }
      this.editarModo = false;
      await this.cargarMarcas();
    } catch (e: any) {
      console.error('Error guardando marca', e);
      // Try to surface backend validation messages
      const msg = e?.error?.message || e?.message || null;
      if (e && (e.status === 409 || (e?.error && e.error.code === 'ER_DUP_ENTRY'))) {
        this.error = 'Ya existe una marca con ese nombre para esta app.';
      } else if (msg) {
        this.error = String(msg);
      } else {
        this.error = 'No se pudo guardar la marca.';
      }
    } finally {
      this.procesando = false;
    }
  }

  async eliminar(m: any): Promise<void> {
    // Simplified: template now opens the modal via data-bs attributes and sets marcaAEliminar on click.
    // Keep this method for backward compatibility; just set the item.
    if (!m || !m.id) return Promise.resolve();
    this.marcaAEliminar = m;
    return Promise.resolve();
  }

  // state for delete confirm
  marcaAEliminar: any | null = null;
  confirmMarcaLoading = false;
  confirmModalOpen = false;

  async onEliminarMarcaConfirmed(): Promise<void> {
    if (!this.marcaAEliminar) return;
    const id = this.marcaAEliminar.id;
    try {
      await this._doEliminarMarca(id);
      // cerrar modal bootstrap manualmente (confirm-dialog usa preventAutoClose=true)
      try {
        const el = document.getElementById('deleteMarcaModal');
        if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
          const Modal = (window as any).bootstrap.Modal;
          let inst: any = null;
          if (typeof Modal.getInstance === 'function') {
            inst = Modal.getInstance(el) || null;
          }
          if (!inst && typeof Modal.getOrCreateInstance === 'function') {
            inst = Modal.getOrCreateInstance(el);
          }
          if (!inst) inst = new Modal(el);
          if (inst && typeof inst.hide === 'function') {
            inst.hide();
            if (typeof inst.dispose === 'function') inst.dispose();
          }
          this.confirmModalOpen = false;
        }
      } catch (hideErr) {
        // ignore
      }
    } finally {
      this.marcaAEliminar = null;
    }
  }

  onEliminarMarcaCancelled(): void {
    // hide modal instance if open
    try {
      const el = document.getElementById('deleteMarcaModal');
      if (el && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const Modal = (window as any).bootstrap.Modal;
        const inst = (typeof Modal.getInstance === 'function' && Modal.getInstance(el)) || (typeof Modal.getOrCreateInstance === 'function' && Modal.getOrCreateInstance(el));
        if (inst && typeof inst.hide === 'function') {
          inst.hide();
          if (typeof inst.dispose === 'function') inst.dispose();
        }
      }
    } catch (e) {
      // ignore
    }
    this.confirmModalOpen = false;
    this.marcaAEliminar = null;
  }

  private async _doEliminarMarca(id: number): Promise<void> {
    this.confirmMarcaLoading = true;
    try {
      await firstValueFrom(this.api.eliminarMarca(id));
      await this.cargarMarcas();
    } catch (e) {
      console.error('Error eliminando marca', e);
      this.error = 'No se pudo eliminar la marca.';
    } finally {
      this.confirmMarcaLoading = false;
    }
  }
}
