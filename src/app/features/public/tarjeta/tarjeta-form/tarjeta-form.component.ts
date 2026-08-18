import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { tarjetaForm } from '../../../../forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EscapeCurlyBracesPipe } from '../../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-tarjeta-form',
  templateUrl: './tarjeta-form.component.html',
  styleUrls: ['./tarjeta-form.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, EscapeCurlyBracesPipe]
})
export class TarjetaFormComponent {
  form: FormGroup = tarjetaForm();
  error: string | null = null;
  loading = false;
  submit() {
    if (this.form.invalid) return;
    // Aquí iría la lógica para guardar la tarjeta
  }
}
