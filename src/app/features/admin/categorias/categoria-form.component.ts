import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-categoria-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './categoria-form.component.html',
  styleUrls: ['./categoria-form.component.scss']
})
export class CategoriaFormComponent {
  @Input() categoria: any;
  @Output() guardar = new EventEmitter<any>();
  @Output() cancelar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<any>();

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      codInterno: ['', [Validators.pattern('^\\d*$')]],
      descripcion: [''],
      imagen: ['']
    });
  }

  ngOnChanges() {
    if (this.categoria) {
      // Si viene 'url' pero no 'imagen', usar 'url' para el input de imagen
      const patch = { ...this.categoria };
      if (!patch.imagen && patch.url) {
        patch.imagen = patch.url;
      }
      this.form.patchValue(patch);
    } else {
      this.form.reset();
    }
  }

  onGuardar() {
    if (this.form.valid) {
      this.guardar.emit({ ...this.categoria, ...this.form.value });
    }
  }

  onCancelar() { this.cancelar.emit(); }
  onEliminar() { this.eliminar.emit(this.categoria); }
}
