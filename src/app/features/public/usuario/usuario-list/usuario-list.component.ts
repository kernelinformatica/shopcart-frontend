import { Component } from '@angular/core';
import { ApiService } from '../../../../api.service';
import { Usuario } from '../../../../models';

@Component({
  selector: 'app-usuario-list',
  imports: [],
  templateUrl: './usuario-list.component.html',
  styleUrl: './usuario-list.component.scss'
})
export class UsuarioListComponent {
  usuarios: Usuario[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getUsuarios().subscribe(usuarios => this.usuarios = usuarios);
  }
}
