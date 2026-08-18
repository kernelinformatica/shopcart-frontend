
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthUserService } from '../auth-user.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}
  canActivate(): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return false;
    }
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private router: Router, private authUser: AuthUserService) {}
  canActivate(): boolean {
    const token = localStorage.getItem('token');
    if (!token) {
      this.router.navigate(['/auth/login']);
      return false;
    }
    const rol = this.authUser.getRol();
    if (!rol || (rol.nombre !== 'admin' && rol.alias !== 'admin')) {
      this.router.navigate(['/']);
      return false;
    }
    return true;
  }
}
