import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CuentaCorrienteComponent } from './cuenta-corriente.component';

const routes: Routes = [{ path: '', component: CuentaCorrienteComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CuentaCorrienteRoutingModule { }
