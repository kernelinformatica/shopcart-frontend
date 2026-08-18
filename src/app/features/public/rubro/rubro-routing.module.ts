import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RubroComponent } from './rubro.component';

const routes: Routes = [{ path: '', component: RubroComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RubroRoutingModule { }
