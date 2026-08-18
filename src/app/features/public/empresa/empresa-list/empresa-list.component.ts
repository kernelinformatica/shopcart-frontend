import { Component } from '@angular/core';
import { ApiService } from '../../../api.service';
import { Empresa } from '../../../models';

@Component({
  selector: 'app-empresa-list',
  imports: [],
  templateUrl: './empresa-list.component.html',
  styleUrl: './empresa-list.component.scss'
})
export class EmpresaListComponent {
  empresas: Empresa[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getEmpresas().subscribe(empresas => this.empresas = empresas);
  }
}
