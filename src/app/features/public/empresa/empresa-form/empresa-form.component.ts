import { Component } from '@angular/core';
import { ApiService } from '../../../api.service';
import { empresaForm } from '../../../forms';
import { Empresa } from '../../../models';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { EscapeCurlyBracesPipe } from '../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-empresa-form',
  imports: [ReactiveFormsModule, NgIf, EscapeCurlyBracesPipe],
  templateUrl: './empresa-form.component.html',
  styleUrl: './empresa-form.component.scss'
})
export class EmpresaFormComponent {
  form = empresaForm();
  loading = false;
  error = '';

  constructor(private api: ApiService) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const raw = this.form.value;
    const empresa: Empresa = {
      id: 0,
      nombre: raw.nombre ?? '',
      descripcion: raw.descripcion ?? '',
      direccion: raw.direccion ?? '',
      telefono: raw.telefono ?? '',
      email: raw.email ?? '',
      rubros: []
    };
    this.api.createEmpresa(empresa).subscribe({
      next: () => {
        this.form.reset();
        this.loading = false;
        this.error = '';
      },
      error: err => {
        this.error = 'Error al guardar empresa';
        this.loading = false;
      }
    });
  }
}
