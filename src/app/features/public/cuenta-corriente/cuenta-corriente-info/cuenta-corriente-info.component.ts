import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { EscapeCurlyBracesPipe } from '../../../shared/escape-curly-braces.pipe';

@Component({
  selector: 'app-cuenta-corriente-info',
  imports: [EscapeCurlyBracesPipe],
  templateUrl: './cuenta-corriente-info.component.html',
  styleUrl: './cuenta-corriente-info.component.scss'
})
  form: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nroCuentaCorriente: ['', Validators.required],
      saldoCuentaCorriente: [0, [Validators.required, Validators.min(0)]],
    });
  }

  submit() {
    if (this.form.invalid) return;
    // lógica para enviar el formulario
  }
}
