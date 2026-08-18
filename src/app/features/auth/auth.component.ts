import { Component } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  standalone: true,
  imports: [LoginComponent, RegisterComponent, CommonModule]
})
export class AuthComponent {
  constructor(private router: Router) {}
  isLoginPage() {
    return this.router.url === '/auth' || this.router.url === '/auth/';
  }
}
