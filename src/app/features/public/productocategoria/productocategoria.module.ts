import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductoCategoriaRoutingModule } from './productocategoria-routing.module';
import { ProductoCategoriaComponent } from './productocategoria.component';
import { ProductoCategoriaFormComponent } from './productocategoria-form/productocategoria-form.component';
import { ProductoCategoriaProductosComponent } from './productocategoria-productos.component';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    ProductoCategoriaComponent
  ],
  imports: [
    CommonModule,
    ProductoCategoriaRoutingModule,
    ReactiveFormsModule,
    ProductoCategoriaFormComponent,
    ProductoCategoriaProductosComponent
  ]
})
export class ProductoCategoriaModule { }
