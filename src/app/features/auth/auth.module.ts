import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared.module';
import { AuthRoutingModule } from './auth-routing.module';
// import { AuthComponent } from './auth.component';

@NgModule({
  declarations: [
    // AuthComponent // Elimina la declaración de un componente standalone
  ],
  imports: [
    CommonModule,
    AuthRoutingModule, 
    
  ]
})
export class AuthModule { }
