import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TarjetaRoutingModule } from './tarjeta-routing.module';
import { TarjetaComponent } from './tarjeta.component';
import { TarjetaFormComponent } from './tarjeta-form/tarjeta-form.component';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    TarjetaComponent
  ],
  imports: [
    CommonModule,
    TarjetaRoutingModule,
    ReactiveFormsModule,
    TarjetaFormComponent
  ]
})
export class TarjetaModule { }
