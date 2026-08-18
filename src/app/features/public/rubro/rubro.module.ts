import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RubroRoutingModule } from './rubro-routing.module';
import { RubroComponent } from './rubro.component';
import { RubroFormComponent } from './rubro-form/rubro-form.component';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
  declarations: [
    RubroComponent
  ],
  imports: [
    CommonModule,
    RubroRoutingModule,
    ReactiveFormsModule,
    RubroFormComponent
  ]
})
export class RubroModule { }
