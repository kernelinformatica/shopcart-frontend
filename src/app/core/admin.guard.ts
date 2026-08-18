import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthUserService } from '../auth-user.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authUser = inject(AuthUserService);
  const token = localStorage.getItem('token');
  if (!token) {
    return router.createUrlTree(['/auth']);
  }
  const rol = authUser.getRol();
  const alias = String(rol?.alias ?? rol?.nombre ?? rol ?? '').trim().toLowerCase();
  if (!alias || (alias !== 'admin' && alias !== 'super_admin' && alias !== 'administrador')) {
    return router.createUrlTree(['/']);
  }
  return true;
};
