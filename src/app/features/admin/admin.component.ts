import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EscapeCurlyBracesPipe } from '../../shared/escape-curly-braces.pipe';
import { take } from 'rxjs/operators';
import { AuthUserService } from '../../auth-user.service';
import { LogisticaService } from '../../logistica.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, EscapeCurlyBracesPipe],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authUserService = inject(AuthUserService);
  private readonly logisticaService = inject(LogisticaService);
  private readonly selectedAppStorageKey = 'selectedAppId';

  appId: number | null = null;
  esUsuarioStaff = false;
  cargandoOrigen = false;
  guardandoOrigen = false;
  error?: string;
  mensaje?: string;

  origenForm = this.fb.group({
    latitudOrigen: [null as number | null, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitudOrigen: [null as number | null, [Validators.required, Validators.min(-180), Validators.max(180)]]
  });

  ngOnInit(): void {
    this.appId = this.obtenerAppId();

    const rol = this.authUserService.getRol();
    const nombre = rol?.nombre?.trim().toLowerCase() || '';
    const alias = rol?.alias?.trim().toLowerCase() || '';
    this.esUsuarioStaff = nombre === 'staff' || nombre === 'admin' || alias === 'staff' || alias === 'admin';

    if (!this.appId) {
      this.error = 'Selecciona una app para configurar origen de envío.';
      return;
    }
    this.cargarOrigen();
  }

  cargarOrigen(): void {
    if (!this.appId) {
      return;
    }
    this.cargandoOrigen = true;
    this.error = undefined;
    this.logisticaService
      .getOrigenEnvio(this.appId)
      .pipe(take(1))
      .subscribe({
        next: (origen) => {
          this.cargandoOrigen = false;
          this.origenForm.patchValue(
            {
              latitudOrigen: typeof origen?.latitudOrigen === 'number' ? origen.latitudOrigen : null,
              longitudOrigen: typeof origen?.longitudOrigen === 'number' ? origen.longitudOrigen : null
            },
            { emitEvent: false }
          );
        },
        error: (error) => {
          this.cargandoOrigen = false;
          if (error?.status === 404) {
            this.mensaje = 'Aún no hay origen configurado para esta app.';
            return;
          }
          this.error = 'No pudimos cargar el origen de envío de la app.';
        }
      });
  }

  guardarOrigen(): void {
    if (!this.appId) {
      this.error = 'Selecciona una app para guardar el origen.';
      return;
    }
    if (!this.esUsuarioStaff) {
      this.error = 'No tienes permisos para guardar el origen de envío.';
      return;
    }
    if (this.origenForm.invalid) {
      this.origenForm.markAllAsTouched();
      return;
    }
    const latitudOrigen = Number(this.origenForm.value.latitudOrigen);
    const longitudOrigen = Number(this.origenForm.value.longitudOrigen);
    this.guardandoOrigen = true;
    this.error = undefined;
    this.mensaje = undefined;

    this.logisticaService
      .updateOrigenEnvio(this.appId, { latitudOrigen, longitudOrigen })
      .pipe(take(1))
      .subscribe({
        next: (origen) => {
          this.guardandoOrigen = false;
          this.origenForm.patchValue(
            {
              latitudOrigen: origen.latitudOrigen,
              longitudOrigen: origen.longitudOrigen
            },
            { emitEvent: false }
          );
          this.mensaje = 'Origen de envío guardado correctamente.';
        },
        error: () => {
          this.guardandoOrigen = false;
          this.error = 'No pudimos guardar el origen de envío.';
        }
      });
  }

  private obtenerAppId(): number | null {
    const raw = localStorage.getItem(this.selectedAppStorageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

}
