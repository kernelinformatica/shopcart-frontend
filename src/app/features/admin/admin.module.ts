import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminRoutingModule } from './admin-routing.module';
import { SharedModule } from '../../shared.module';

import { CampanasComercialesListComponent } from './campanas-comerciales/campanas-comerciales-list.component';
import { CampanaComercialFormComponent } from './campanas-comerciales/campana-comercial-form.component';
import { ProductoMultiSelectComponent } from './campanas-comerciales/producto-multi-select.component';
import { ListaAccionesComponent } from './campanas-comerciales/lista-acciones.component';
import { ListaCondicionesComponent } from './campanas-comerciales/lista-condiciones.component';
import { EditorApilamientoComponent } from './campanas-comerciales/editor-apilamiento.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    SharedModule,
    AdminRoutingModule,
    CampanasComercialesListComponent,
    CampanaComercialFormComponent,
    ProductoMultiSelectComponent,
    ListaAccionesComponent,
    ListaCondicionesComponent,
    EditorApilamientoComponent,
  ],
  declarations: []
})
export class AdminModule { }
