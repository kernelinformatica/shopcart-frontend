import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { promocionForm } from '../../../../forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EscapeCurlyBracesPipe } from '../../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-promocion-form',
  templateUrl: './promocion-form.component.html',
  styleUrls: ['./promocion-form.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, EscapeCurlyBracesPipe]
})
export class PromocionFormComponent {
  form: FormGroup = promocionForm();
  loading = false;
  error: string | null = null;

  submit() {
    if (this.form.invalid) return;
    // Aquí iría la lógica para guardar la promoción
  }
}
