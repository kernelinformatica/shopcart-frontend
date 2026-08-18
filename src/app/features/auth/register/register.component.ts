// ...existing code...
// ...existing code...
// ...existing code...
import { Component } from '@angular/core';
import { ApiService } from '../../../api.service';
import { Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { usuarioForm } from '../../../forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { CompanyService } from '../../../company.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule, FormsModule]
})
export class RegisterComponent {
  checkingService: boolean = true;
  serviceAvailable: boolean = true;
  backendDisponible: boolean | null = null;
  provincias: string[] = [
    'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos',
    'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
    'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
    'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];
  setLocalidadBusqueda(valor: string) {
    this.localidadBusqueda = valor;
  }
  provinciaManual: string = '';
  showLocalidadMenu: boolean = false;
  onLocalidadBlur() {
    setTimeout(() => this.showLocalidadMenu = false, 200);
  }
  form: FormGroup = usuarioForm();
  error: string | null = null;
  registroExitoso: boolean = false;
  loading = false;
    localidades: any[] = [];
    localidadesFiltradas: any[] = [];
    localidadBusqueda: string = '';
    localidadSeleccionada: any = null;
    otraLocalidadSeleccionada: boolean = false;
    codigoPostalManual: string = '';
    nombreLocalidadManual: string = '';

    async buscarLocalidades(termInput?: string) {
      const term = String(termInput ?? this.localidadBusqueda ?? '').trim();
      if (term.length < 2) {
        this.localidadesFiltradas = [];
        return;
      }
      if (!this.serviceAvailable) {
        this.error = 'Servicio no disponible, intente más tarde';
        this.localidadesFiltradas = [];
        return;
      }
      try {
        const res = await fetch(`${environment.apiUrl}/api/localidades/buscar?query=${encodeURIComponent(term)}`);
        const data = await res.json();
        this.localidadesFiltradas = data.map((item: any) => {
          if (typeof item === 'string') {
            const match = item.match(/^(.*?) \((\d+)\)/);
            return match ? { id: null, nombre: match[1], codigoPostal: match[2], provincia: '', display: `${match[1]} (${match[2]})` } : { id: null, nombre: item, codigoPostal: '', provincia: '', display: item };
          }
          const nombre = item.nombre || '';
          // Soporta tanto 'codigoPostal' como 'codigopostal' (backend puede enviar cualquiera)
          const codigoPostal = item.codigoPostal || item.codigopostal || '';
          const provincia = item.provincia || '';
          return {
            ...item,
            codigoPostal, // asegura que el objeto tenga la propiedad 'codigoPostal'
            display: `${nombre} (${codigoPostal})-${provincia}`
          };
        });
      } catch (e) {
        this.error = 'Servicio no disponible, intente más tarde';
        this.localidadesFiltradas = [];
      }
    }

    onSeleccionarLocalidad(event: any) {
      if (event === 'OTRA') {
        this.otraLocalidadSeleccionada = true;
        this.form.get('localidad')?.setValue('');
        this.localidadSeleccionada = null;
        this.localidadBusqueda = '';
      } else {
        this.otraLocalidadSeleccionada = false;
        this.form.get('localidad')?.setValue(event.display || event.nombre);
        // Normaliza la propiedad para que siempre tenga 'codigoPostal'
        this.localidadSeleccionada = {
          ...event,
          codigoPostal: event.codigoPostal || event.codigopostal || ''
        };
        this.localidadBusqueda = (event.display || (event.nombre + (event.provincia ? ' (' + event.provincia + ')' : '') + ' CP = ' + (event.codigoPostal || event.codigopostal || '')));
        this.showLocalidadMenu = false;
      }
    }

    cancelarOtraLocalidad() {
      this.otraLocalidadSeleccionada = false;
      this.codigoPostalManual = '';
      this.nombreLocalidadManual = '';
    }
  empresaNombre = environment.empresaNombre;
  isFormValid: boolean = false;
  empresa: any = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private companyService: CompanyService
  ) {
    // Al iniciar, cargar datos de empresa igual que en login
    const codigo = String(environment.empresaCodigoWeb || environment.empresaCodigo);
    this.apiService.getEmpresaByCodigo(codigo).subscribe({
      next: (empresa) => {
        this.empresa = empresa;
        this.companyService.setEmpresa(empresa);
      },
      error: () => {
        this.empresa = null;
      }
    });
  }

  ngOnInit(): void {
    this.checkingService = false;
    this.serviceAvailable = true;
    this.form.valueChanges.subscribe(() => {
      this.isFormValid = this.form.valid && this.form.value.password === this.form.value.repeatPassword;
    });
  }

  get puedeRegistrar(): boolean {
    return this.form.valid && this.form.value.password === this.form.value.repeatPassword;
  }



  submit() {
    if (!this.puedeRegistrar) {
      this.error = 'Las contraseñas deben coincidir y todos los campos son obligatorios.';
      return;
    }
    
    this.loading = true;
    this.error = null;
    // Agrega prefijo automáticamente si el país es Argentina
    const paisCodigo = environment.paisCodigo || '54';
    const celularPrefijo = environment.celularPrefijo || '9';
    let telefono = this.form.value.telefono;
    if (paisCodigo === '54' && celularPrefijo === '9') {
      telefono = paisCodigo + celularPrefijo + telefono;
    }
    let localidad = this.form.value.localidad;
    let codigoPostal = '';
    let provincia = '';
    let localidadId = null;
    if (this.otraLocalidadSeleccionada) {
      localidad = this.nombreLocalidadManual;
      codigoPostal = this.codigoPostalManual;
      provincia = this.provinciaManual;
    } else if (this.localidadSeleccionada) {
      localidad = this.localidadSeleccionada.nombre;
      // Soporta ambas variantes
      codigoPostal = this.localidadSeleccionada.codigoPostal || this.localidadSeleccionada.codigopostal || '';
      provincia = this.localidadSeleccionada.display?.split(') ').pop()?.replace(')', '') || '';
      localidadId = this.localidadSeleccionada.id;
    }
    const empresaId = environment.empresaCodigo;
    const empresaCodigoWeb = environment.empresaCodigoWeb;
    const nroCuentaCorriente = String(this.form.value.opciones ?? '').trim();
    const formValue = {
      ...this.form.value,
      telefono,
      localidad,
      codigoPostal,
      provincia,
      localidadId,
      nroCuentaCorriente: nroCuentaCorriente || null,
      empresaId,
      empresaCodigoWeb
    };
    this.apiService.register(formValue).subscribe({
      next: () => {
        this.loading = false;
        this.registroExitoso = true;
      },
      error: (err: any) => {
        this.loading = false;
        if (err.status === 409) {
          this.error = 'El email ya está registrado.';
        } else if (err.status === 0) {
          this.error = 'No se puede conectar con el servidor.';
        } else if (err.error?.message) {
          this.error = err.error.message;
        } else {
          this.error = 'Error al registrar usuario. Intente nuevamente.';
        }
      }
    });
  }
}
