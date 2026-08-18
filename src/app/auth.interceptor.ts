import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ToastService } from './shared/toast.service';
import { AuthUserService } from './auth-user.service';

// Evita múltiples redirects simultáneos si hay varias llamadas fallando a la vez
let sesiónExpiradaEnCurso = false;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly authUserService = inject(AuthUserService);

  private esEndpointPublico(req: HttpRequest<any>): boolean {
    return req.url.includes('/auth/login')
      || req.url.includes('/auth/register')
      || req.url.includes('/empresas/public/');
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const code401 = error.status === 401;
        const msg: string = error.error?.message ?? '';
        const esTokenInvalido =
          msg.toLowerCase().includes('token requerido') ||
          msg.toLowerCase().includes('token inválido') ||
          msg.toLowerCase().includes('token expirado') ||
          msg.toLowerCase().includes('jwt expired');

        if (code401 && !this.esEndpointPublico(req) && !sesiónExpiradaEnCurso) {
          sesiónExpiradaEnCurso = true;

          // Limpiar sesión completa
          this.authUserService.logout();

          // Mostrar aviso y redirigir
          this.toastService.warning(
            'Sesión cerrada',
            esTokenInvalido
              ? 'Tu sesión venció. Por favor volvé a iniciar sesión.'
              : 'Tu sesión no está autorizada. Volvé a iniciar sesión.',
            { duration: 4000 }
          );

          setTimeout(() => {
            sesiónExpiradaEnCurso = false;
            this.router.navigate(['/auth']);
          }, 1500);
        }

        return throwError(() => error);
      })
    );
  }
}
