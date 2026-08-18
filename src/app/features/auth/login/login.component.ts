import { Component, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { loginForm } from '../../../forms';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../api.service';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { CompanyService } from '../../../company.service';
import { Renderer2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, RouterModule]
})
export class LoginComponent implements OnDestroy {
  form: FormGroup = loginForm();
  error: string | null = null;
  loading = false;
  empresa: any = null;
  selectedAppId: number|null = null;
  servicioOffline: boolean = false;
  appVersion: string = environment.appVersion || '1.0.0';
  constructor(
    private apiService: ApiService,
    private router: Router,
    private companyService: CompanyService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
    const codigo = this.getCodigoEmpresa();
   
  
    this.apiService.getEmpresaByCodigo(codigo).subscribe({
      next: (empresa) => {
        this.servicioOffline = false;
        this.empresa = empresa;
        
        this.companyService.setEmpresa(empresa);
       
   
        if (empresa && Array.isArray(empresa['apps']) && empresa['apps'].length) {
          this.selectedAppId = empresa['apps'][0].id;
        }
        if (empresa?.codigo) {
          this.aplicarFondoLogin();
        }
      },
      error: (err: any) => {
        this.servicioOffline = err?.status === 0;
        if (err?.status === 404 || err?.status === 429) {
          this.servicioOffline = false;
        }
        this.empresa = null;
        this.document.body.style.backgroundImage = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.limpiarFondoLogin();
  }
  getCodigoEmpresa(): string {
    return String(environment.empresaCodigoWeb || environment.empresaCodigo);
  }
  private aplicarFondoLogin(): void {
    this.document.body.style.background = 'radial-gradient(circle at top, #f8fbff 0%, #eef4ff 38%, #dbeafe 100%)';
    this.document.body.style.backgroundAttachment = 'fixed';
    this.document.body.style.backgroundRepeat = 'no-repeat';
    this.document.body.style.backgroundSize = 'cover';
    this.document.body.style.backgroundPosition = 'center center';
  }

  private limpiarFondoLogin(): void {
    this.document.body.style.background = '';
    this.document.body.style.backgroundImage = '';
    this.document.body.style.backgroundSize = '';
    this.document.body.style.backgroundPosition = '';
    this.document.body.style.backgroundRepeat = '';
    this.document.body.style.backgroundAttachment = '';
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    // Limpiar todo lo relacionado al usuario anterior
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('permisos');
    localStorage.removeItem('selectedAppId');
    localStorage.removeItem('empresa');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    sessionStorage.removeItem('permisos');
    sessionStorage.removeItem('selectedAppId');
    sessionStorage.removeItem('empresa');
    // Si guardas otros datos de sesión, agrégalos aquí
    this.apiService.login(this.form.value).subscribe({
      next: (resp) => {
        
        this.loading = false;
        this.limpiarFondoLogin();
        if (resp.token) {
          localStorage.setItem('token', resp.token);
        }
        const usuarioLogueado = this.normalizarUsuarioLogin(resp);
        
        if (usuarioLogueado) {
          if (resp.permisos) {
            usuarioLogueado.permisos = resp.permisos;
          }
          localStorage.setItem('usuario', JSON.stringify(usuarioLogueado));
          // ensure a flattened permisos array is always persisted for frontend consumers
          const permisosSource = resp.permisos ?? usuarioLogueado.permisos ?? [];
          const permisosArray = Object.values(permisosSource)
            .flatMap((valor: any) => (Array.isArray(valor) ? valor : []))
            .filter(Boolean);
          if (permisosArray.length) {
            localStorage.setItem('permisos', JSON.stringify(permisosArray));
            console.log('Permisos seteados en localStorage:', permisosArray);
          }
        }
        this.router.navigate(['/']);
      },
      error: (err: any) => {
        this.loading = false;
        if (err.status === 401) {
          this.error = 'Credenciales incorrectas.';
        } else if (err.status === 0) {
          this.error = 'No se puede conectar con el servidor.';
        } else if (err.error?.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Error al iniciar sesión. Intente nuevamente.';
        }
      }
    });
  }

  private normalizarUsuarioLogin(resp: any): any {
    const usuario = resp?.usuario ?? resp?.user ?? resp?.usuarioLogueado ?? resp?.data?.usuario ?? resp?.data ?? resp;
    if (!usuario || typeof usuario !== 'object') {
      return null;
    }
    const nroCuentaCorriente = usuario.nrocuentacorriente ?? usuario.nroCuentaCorriente ?? usuario.nro_cuenta_corriente ?? usuario.nro_cuentacorriente ?? usuario.cuentaCorriente ?? usuario.cuenta_corriente ?? null;
    const saldoCuentaCorriente = usuario.saldocuentacorriente ?? usuario.saldoCuentaCorriente ?? usuario.saldo_cuenta_corriente ?? null;
    const nroCuentaCorrienteConfirmada = usuario.nrocuentacorrienteConfirmada ?? usuario.nroCuentaCorrienteConfirmada ?? usuario.nro_cuenta_corriente_confirmada ?? usuario.nrocuentaCorrienteConfirmada ?? null;
    return {
      ...usuario,
      nrocuentacorriente: nroCuentaCorriente,
      nrocuentacorrienteConfirmada: nroCuentaCorrienteConfirmada,
      saldocuentacorriente: saldoCuentaCorriente,
      cuentaCorriente: nroCuentaCorriente,
      nroCuentaCorrienteConfirmada: nroCuentaCorrienteConfirmada,
      saldoCuentaCorriente: saldoCuentaCorriente
    };
  }
}
