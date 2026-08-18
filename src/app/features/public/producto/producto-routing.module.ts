import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductoComponent } from './producto.component';
import { ProductoListComponent } from './producto-list/producto-list.component';

import { ProductoVistaComponent } from './producto-vista.component';

const routes: Routes = [
  { path: '', redirectTo: '/todos-los-productos', pathMatch: 'full' },
  { path: ':slug', component: ProductoVistaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductoRoutingModule { }
