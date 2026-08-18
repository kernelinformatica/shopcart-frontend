import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CampanasComercialesService } from './campanas-comerciales.service';
import { ToastService } from '../../../shared/toast.service';
import { AuthUserService } from '../../../auth-user.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PermisosService } from '../../../permisos.service';

@Component({
  selector: 'app-campanas-comerciales-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmDialogComponent],
  templateUrl: './campanas-comerciales-list.component.html',
  styleUrls: ['./campanas-comerciales-list.component.scss']
})
export class CampanasComercialesListComponent implements OnInit {
  campanas: any[] = [];
  loading = false;
  search = '';
  tipos: any[] = [];
  selectedTipo = '';
  mensaje: string = '';
error: any = null;
  constructor(
    private svc: CampanasComercialesService,
    private toast: ToastService,
    private auth: AuthUserService,
    private permisosService: PermisosService
  ) {}

  ngOnInit(): void {
    this.fetchTipos();
    this.load();
  }

  userHasRole(): boolean {
    const roleAlias = this.auth.getRolAlias ? this.auth.getRolAlias() : '';
    return ['administrador', 'operador', 'super_admin'].includes(roleAlias);
  }
filtrosAbiertos: boolean = true;

toggleFiltros() {
  this.filtrosAbiertos = !this.filtrosAbiertos;
}

  load(): void {
    this.loading = true;
    this.svc.list({ search: this.search, tipo: this.selectedTipo }).subscribe({
      next: (res) => { this.campanas = res || []; this.loading = false; },
      error: (err) => { this.loading = false; this.toast.error('Error al cargar', err?.error?.message || 'Error al cargar campañas'); }
    });
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

  deleteCampana(p: any): void {
    if (!confirm(`Eliminar campaña ${p.nombre}?`)) return;
    this.svc.delete(p.id).subscribe({
      next: () => { this.toast.success('Campaña eliminada','La campaña fue eliminada'); this.load(); },
      error: (e) => this.toast.error('Error al eliminar', e?.error?.message || 'Error al eliminar')
    });
  }

  toggleActivate(p: any): void {
    this.svc.toggleActivate(p.id).subscribe({
      next: () => { this.toast.success('Estado actualizado','Estado de la campaña actualizado'); this.load(); },
      error: (e) => this.toast.error('Error al actualizar', e?.error?.message || 'Error al actualizar')
    });
  }

  fetchTipos(): void {
    this.svc.listTipos().subscribe({ next: (r) => this.tipos = r || [], error: () => {} });
  }







}
