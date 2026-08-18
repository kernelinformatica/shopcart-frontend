import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { rubroForm } from '../../../../forms';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EscapeCurlyBracesPipe } from '../../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-rubro-form',
  templateUrl: './rubro-form.component.html',
  styleUrls: ['./rubro-form.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, EscapeCurlyBracesPipe]
})
export class RubroFormComponent {
  form: FormGroup = rubroForm();
  error: string | null = null;
  loading = false;

  submit() {
    if (this.form.invalid) return;
    // Aquí iría la lógica para guardar el rubro
  }
}
