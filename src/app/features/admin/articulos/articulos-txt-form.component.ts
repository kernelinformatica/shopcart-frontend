import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiAdminService } from '../../../api-admin.service';

interface ImportacionTxtFila {
  linea: number;
  nombre: string;
  descripcion: string;
  codigoBarra: string;
  codigoInterno: string;
  marca: string;
  stock: number | null;
  valido: boolean;
  error?: string;
}

@Component({
  selector: 'app-articulos-txt',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<section class="container py-3 articulos-txt">
  <div class="card shadow-sm mb-4">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <p class="eyebrow mb-1">Administración de artículos</p>
        <h4 class="mb-0">Carga masiva TXT</h4>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <a class="btn btn-outline-secondary" routerLink="/admin/articulos">Volver al listado</a>
        <button class="btn btn-primary" type="button" (click)="fileInput.click()">Seleccionar TXT</button>
        <input #fileInput class="d-none" type="file" accept=".txt,text/plain" (change)="onArchivoTxtSeleccionado($event)" />
      </div>
    </div>
    <div class="card-body">
      <div class="row g-4">
        <div class="col-12 col-lg-5">
          <div class="format-card">
            <h5 class="mb-3">Formato esperado</h5>
            <p class="text-muted mb-3">
              Cada línea debe contener los campos en este orden:
            </p>
            <pre class="format-code mb-3">nombre, descripcion, codigoBarra, codigoInterno, marca, stock</pre>
            <div class="small text-muted mb-2">Ejemplo:</div>
            <pre class="format-code">Yerba Mate, Yerba tradicional, 7791234567890, YM-001, Taragui, 25
Galletitas, Galletitas dulces, 7791234500000, GAL-002, , 12</pre>
            <ul class="small text-muted mb-0 ps-3">
              <li>nombre y stock son los campos mínimos recomendados.</li>
              <li>marca es opcional.</li>
              <li>Los demás datos se pueden completar luego desde la carga manual.</li>
            </ul>
          </div>
        </div>
        <div class="col-12 col-lg-7">
          <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
          <div *ngIf="mensaje" class="alert alert-success">{{ mensaje }}</div>
          <div class="selected-file mb-3" *ngIf="archivoTxtNombre">
            Archivo seleccionado: <strong>{{ archivoTxtNombre }}</strong>
          </div>
          <div class="selected-file mb-3" *ngIf="estadoImportacionTxt">{{ estadoImportacionTxt }}</div>

          <div *ngIf="importacionTxt.length === 0" class="empty-state">
            Seleccioná un archivo TXT para ver la vista previa antes de importar.
          </div>

          <div class="table-responsive" *ngIf="importacionTxt.length > 0">
            <table class="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Línea</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Código barra</th>
                  <th>Código interno</th>
                  <th>Marca</th>
                  <th>Stock</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let fila of importacionTxt" [class.table-warning]="!fila.valido">
                  <td>{{ fila.linea }}</td>
                  <td>{{ fila.nombre }}</td>
                  <td>{{ fila.descripcion }}</td>
                  <td>{{ fila.codigoBarra }}</td>
                  <td>{{ fila.codigoInterno }}</td>
                  <td>{{ fila.marca }}</td>
                  <td>{{ fila.stock ?? '-' }}</td>
                  <td>{{ fila.error || 'OK' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-3">
            <button class="btn btn-outline-secondary" type="button" (click)="limpiar()" [disabled]="importandoTxt">Limpiar</button>
            <button class="btn btn-primary" type="button" (click)="importarTxt()" [disabled]="importandoTxt || importacionTxt.length === 0">
              {{ importandoTxt ? 'Importando...' : 'Importar registros válidos' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
  `,
  styles: [
    `
.articulos-txt .eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
}
.articulos-txt .format-card,
.articulos-txt .empty-state,
.articulos-txt .selected-file {
  padding: 1rem;
  border-radius: 0.9rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.articulos-txt .format-code {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  white-space: pre-wrap;
}
    `
  ]
})
export class ArticulosTxtFormComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);

  ngOnInit(): void {
    console.log('ArticulosTxtFormComponent (legacy) initialized');
  }

  error = '';
  mensaje = '';
  archivoTxtNombre = '';
  importacionTxt: ImportacionTxtFila[] = [];
  importandoTxt = false;
  estadoImportacionTxt = '';

  onArchivoTxtSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.archivoTxtNombre = file.name;
    this.error = '';
    this.mensaje = '';

    const reader = new FileReader();
    reader.onload = () => {
      const contenido = String(reader.result ?? '');
      this.importacionTxt = this.parsearTxt(contenido);
      this.estadoImportacionTxt = `${this.importacionTxt.length} registros listos para revisar.`;
    };
    reader.onerror = () => {
      this.error = 'No pudimos leer el archivo TXT.';
      this.importacionTxt = [];
      this.archivoTxtNombre = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  limpiar(): void {
    this.archivoTxtNombre = '';
    this.importacionTxt = [];
    this.estadoImportacionTxt = '';
    this.error = '';
    this.mensaje = '';
  }

  async importarTxt(): Promise<void> {
    const filasValidas = this.importacionTxt.filter((fila) => fila.valido && fila.nombre);
    if (filasValidas.length === 0) {
      this.estadoImportacionTxt = 'No hay filas válidas para importar.';
      return;
    }

    this.importandoTxt = true;
    this.estadoImportacionTxt = '';
    let creados = 0;
    let fallidos = 0;

    try {
      for (const fila of filasValidas) {
        const payload = {
          nombre: fila.nombre,
          descripcion: fila.descripcion,
          codigoBarra: fila.codigoBarra,
          codigoInterno: fila.codigoInterno,
          codigo_barra: fila.codigoBarra,
          codigo_interno: fila.codigoInterno,
          marca: fila.marca,
          stock: fila.stock ?? 0,
          estado: 'activo'
        };

        try {
          await firstValueFrom(this.apiAdmin.crearProducto(payload));
          creados += 1;
        } catch {
          fallidos += 1;
        }
      }

      this.estadoImportacionTxt = `Importación finalizada. Creados: ${creados}. Fallidos: ${fallidos}.`;
      this.mensaje = 'La importación terminó.';
    } finally {
      this.importandoTxt = false;
    }
  }

  private parsearTxt(contenido: string): ImportacionTxtFila[] {
    return contenido
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0)
      .map((linea, index) => {
        const columnas = linea.split(',').map((valor) => valor.trim());
        const [nombre = '', descripcion = '', codigoBarra = '', codigoInterno = '', marca = '', stock = ''] = columnas;
        const stockNumero = stock === '' ? null : Number(stock);
        const valido = nombre.length > 0 && (stockNumero === null || Number.isFinite(stockNumero));

        return {
          linea: index + 1,
          nombre,
          descripcion,
          codigoBarra,
          codigoInterno,
          marca,
          stock: stockNumero,
          valido,
          error: valido ? undefined : 'Revisar nombre o stock.'
        };
      });
  }
}
