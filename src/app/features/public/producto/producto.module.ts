import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ProductoRoutingModule } from './producto-routing.module';
import { ProductoComponent } from './producto.component';
import { ProductoListComponent } from './producto-list/producto-list.component';
import { ProductoVistaComponent } from './producto-vista.component';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ProductoRoutingModule,
    ProductoListComponent,
    ProductoVistaComponent
  ]
})
export class ProductoModule { }
