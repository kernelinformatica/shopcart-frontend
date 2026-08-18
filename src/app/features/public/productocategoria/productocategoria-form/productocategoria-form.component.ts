import { Component } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { productoCategoriaForm } from '../../../../forms'; 
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { EscapeCurlyBracesPipe } from '../../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-productocategoria-form',
  templateUrl: './productocategoria-form.component.html',
  styleUrls: ['./productocategoria-form.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, EscapeCurlyBracesPipe]
})
export class ProductoCategoriaFormComponent {
  form: FormGroup = productoCategoriaForm();
  error: string | null = null;
  loading = false;

  submit() {
    if (this.form.invalid) return;
    // Aquí iría la lógica para guardar la categoría
  }
}
