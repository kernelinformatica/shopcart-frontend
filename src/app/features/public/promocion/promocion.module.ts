import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { PromocionRoutingModule } from './promocion-routing.module';
import { PromocionComponent } from './promocion.component';
import { PromocionFormComponent } from './promocion-form/promocion-form.component';
import { ProductoDetalleModalComponent } from '../../../shared/components/producto-detalle-modal/producto-detalle-modal.component';
import { ProductoItemComponent } from '../../../shared/components/producto-item/producto-item.component';


@NgModule({
  declarations: [
  ],
  imports: [
    CommonModule,
    PromocionRoutingModule,
    ReactiveFormsModule,
    PromocionFormComponent,
    ProductoDetalleModalComponent,
    ProductoItemComponent,
    PromocionComponent
  ]
})
export class PromocionModule { }
