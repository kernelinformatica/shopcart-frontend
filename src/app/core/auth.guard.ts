import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (!token) {
    return router.createUrlTree(['/auth']);
  }

  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(decoded);
    const exp = data?.exp;

    if (typeof exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (exp <= now) {
        localStorage.removeItem('token');
        return router.createUrlTree(['/auth']);
      }
    }
  } catch {
    localStorage.removeItem('token');
    return router.createUrlTree(['/auth']);
  }

  return true;
};
