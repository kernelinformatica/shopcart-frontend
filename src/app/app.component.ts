import { Component } from '@angular/core';
import { RouterOutlet } from "@angular/router";
import { CompanyService } from './company.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [RouterOutlet, FormsModule]
})
export class AppComponent {
  empresa: any = null;
  selectedAppId: number|null = null;
  usuario: any = null;
  constructor(private companyService: CompanyService) {
    this.companyService.getEmpresa().subscribe(e => {
      this.empresa = e;
      if (e && e.apps && e.apps.length) {
        this.selectedAppId = e.apps[0].id;
      }
    });
    // Simulación de usuario logueado (ajustar según tu auth real)
    const userStr = localStorage.getItem('usuario');
    if (userStr) {
      this.usuario = JSON.parse(userStr);
    }
  }
}
