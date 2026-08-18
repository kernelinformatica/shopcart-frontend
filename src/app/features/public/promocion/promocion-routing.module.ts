import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PromocionComponent } from './promocion.component';

const routes: Routes = [
  { path: '', component: PromocionComponent },
  { path: ':slug', component: PromocionComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PromocionRoutingModule { }
