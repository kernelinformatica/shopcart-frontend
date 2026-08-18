import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductoCategoriaComponent } from './productocategoria.component';
import { ProductoCategoriaProductosComponent } from './productocategoria-productos.component';

const routes: Routes = [
  { path: '', component: ProductoCategoriaProductosComponent },
  { path: ':categoriaSlug', component: ProductoCategoriaProductosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductoCategoriaRoutingModule { }
