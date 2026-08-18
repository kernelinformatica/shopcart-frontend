import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { CuentaCorrienteRoutingModule } from './cuenta-corriente-routing.module';
import { CuentaCorrienteComponent } from './cuenta-corriente.component';
import { SharedModule } from '../../../shared.module';


@NgModule({
  declarations: [
    CuentaCorrienteComponent
  ],
  imports: [
    CommonModule,
    CuentaCorrienteRoutingModule,
    SharedModule,
    ReactiveFormsModule
  ]
})
export class CuentaCorrienteModule { }
