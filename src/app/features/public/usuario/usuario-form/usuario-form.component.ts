import { Component } from '@angular/core';
import { ApiService } from '../../../../api.service';
import { usuarioForm } from '../../../../forms';
import { Usuario } from '../../../../models';
import { ReactiveFormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-usuario-form',
  imports: [ReactiveFormsModule, NgIf],
  templateUrl: './usuario-form.component.html',
  styleUrls: ['./usuario-form.component.scss']
})
export class UsuarioFormComponent {
  form = usuarioForm();
  loading = false;
  error = '';

  constructor(private api: ApiService) {}

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const raw = this.form.value;
    // TODO: Reemplazar esto por una selección real de roles desde el backend
    const rolObj = typeof raw.rol === 'object' && raw.rol !== null
      ? raw.rol
      : { id: 0, nombre: raw.rol ?? 'usuario', alias: (raw.rol ?? 'usuario').toLowerCase(), descripcion: '' };
    const usuario: Usuario = {
      id: 0,
      nombre: raw.nombre ?? '',
      email: raw.email ?? '',
      rol: rolObj
    };
    // Usar updateUsuario como ejemplo (ajusta según tu backend)
    this.api.updateUsuario(usuario).subscribe({
      next: () => {
        this.form.reset();
        this.loading = false;
        this.error = '';
      },
      error: (err: any) => {
        this.error = 'Error al guardar usuario';
        this.loading = false;
      }
    });
  }
}
