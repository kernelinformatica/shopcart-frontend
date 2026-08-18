import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin.component';
import { CategoriasGestorComponent } from './categorias/categorias-gestor.component';
import { ArticulosAdminComponent } from './articulos/articulos-admin.component';
import { ArticulosApiFormComponent } from './articulos/articulos-api-form.component';
import { ArticulosManualFormComponent } from './articulos/articulos-manual-form.component';
import { ArticulosTxtFormComponent } from './articulos/articulos-txt-form.component';
import { ArticulosTxtComponent } from './articulos/articulos-txt.component';
import { UsuariosAdminComponent } from './usuarios/usuarios-admin.component';
import { UsuarioFormComponent } from './usuarios/usuario-form.component';
import { PerfilesAdminComponent } from './perfiles/perfiles-admin.component';
import { ListasPreciosAdminComponent } from './listas-precios/listas-precios-admin.component';
import { PreciosTxtComponent } from './listas-precios/precios-txt.component';
import { CampanasComercialesListComponent } from './campanas-comerciales/campanas-comerciales-list.component';
import { CampanaComercialFormComponent } from './campanas-comerciales/campana-comercial-form.component';

const routes: Routes = [
  { path: '', component: AdminComponent },
  { path: 'categorias', component: CategoriasGestorComponent },
  { path: 'articulos', component: ArticulosAdminComponent },
  { path: 'articulos/api', component: ArticulosApiFormComponent },
  { path: 'articulos/manual', component: ArticulosManualFormComponent },
  { path: 'articulos/manual/:id', component: ArticulosManualFormComponent },
  { path: 'articulos/txt', component: ArticulosTxtComponent },
  { path: 'usuarios', component: UsuariosAdminComponent },
  { path: 'usuarios/nuevo', component: UsuarioFormComponent },
  { path: 'usuarios/:id/editar', component: UsuarioFormComponent },
  { path: 'perfiles', component: PerfilesAdminComponent }
  ,{ path: 'listas-precios', component: ListasPreciosAdminComponent }
  ,{ path: 'listas-precios/import-txt', component: PreciosTxtComponent }
  ,{ path: 'marcas', loadComponent: () => import('./marcas/marcas-admin.component').then(m => m.MarcasAdminComponent) }
  ,{ path: 'campanas-comerciales', component: CampanasComercialesListComponent }
  ,{ path: 'campanas-comerciales/nuevo', component: CampanaComercialFormComponent }
  ,{ path: 'campanas-comerciales/:id', component: CampanaComercialFormComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
