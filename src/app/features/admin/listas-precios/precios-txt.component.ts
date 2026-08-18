import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiAdminService } from '../../../api-admin.service';
import { ListaPrecio } from '../../../models';

@Component({
  selector: 'app-precios-txt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<section class="container py-3 precios-txt">
  <div class="card shadow-sm mb-4">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <p class="eyebrow mb-1">Administración de precios</p>
        <h4 class="mb-0">Carga masiva de precios</h4>
      </div>
        <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-outline-secondary" (click)="limpiar()">Limpiar</button>
        <button class="btn btn-primary" type="button" (click)="fileInput.click()" [disabled]="!selectedListaId" title="Seleccioná una lista de precios antes de seleccionar un archivo">Seleccionar archivo TSV</button>
        <input #fileInput class="d-none" type="file" accept=".txt,.tsv,text/tab-separated-values,text/plain" (change)="onArchivoSeleccionado($event)" />
      </div>
    </div>
    <div class="card-body">
      <div class="row g-4">
        <div class="col-12 col-lg-5">
          <div class="format-card">
            <h5 class="mb-3">Formato esperado</h5>
            <p class="text-muted mb-3">El backend procesa un archivo TSV (tab-separated). La <strong>primera línea</strong> debe ser la cabecera con los siguientes campos (usar exactamente estos nombres evita ambigüedades):</p>
                  <pre class="format-code mb-3">codigoInterno	codigoBarra	precio	precioCompra	margen	monedaId	vigenciaDesde	vigenciaHasta	observaciones	canal</pre>
            <div class="small text-muted mb-2">Ejemplo de contenido (TSV):</div>
            <pre class="format-code">00062	7790787087198	999.99	800.00	25	1	2026-01-01	2026-12-31	Comentario	online</pre>
            <ul class="small text-muted mb-0 ps-3"><br>
              <li><strong>Campos obligatorios:</strong> <code>codigoInterno</code> o <code>codigoBarra</code>, y <code>precio</code> (si no seleccionás una lista en el selector).</li>
              <li><strong>Campos numéricos:</strong> <code>precio</code>, <code>precioCompra</code>, <code>margen</code>, <code>monedaId</code> deben poder convertirse a número.</li>
              <li><strong>Fechas:</strong> <code>vigenciaDesde</code> y <code>vigenciaHasta</code> en formato <code>YYYY-MM-DD</code> o vacías.</li>
              <li>Límite: máximo 5000 filas por archivo.</li>
              <li>Si seleccionás una <strong>lista de precios</strong> en el selector, todos los registros se importarán a esa lista y el parámetro <code>listaPrecioId</code> de cada fila será ignorado.</li>
            </ul>
          </div>
        </div>
        <div class="col-12 col-lg-7">
          <div class="mb-3 d-flex gap-2 align-items-center">
            <label class="mb-0 me-2">Lista destino:</label>
            <select class="form-select w-auto" [(ngModel)]="selectedListaId" (ngModelChange)="onListaSeleccionada()" [disabled]="cargandoListas">
              <option [ngValue]="null">-- Usar columna en archivo --</option>
              <option *ngFor="let l of listas" [ngValue]="l.id">{{ l.nombre }} ({{ l.estado }})</option>
            </select>
            <div *ngIf="cargandoListas" class="ms-2 text-muted">Cargando listas...</div>
          </div>

          <div *ngIf="error" class="alert alert-danger mt-2">{{ error }}</div>
          <div *ngIf="mensaje" class="alert alert-success mt-2">{{ mensaje }}</div>

          <div *ngIf="selectedFile" class="selected-file mb-3">
            Archivo seleccionado: <strong>{{ selectedFile.name }}</strong>
          </div>

          <div *ngIf="filasValidas.length || filasInvalidas.length" class="mb-3 small">
            <strong>Resumen:</strong> Filas totales: {{ filasValidas.length + filasInvalidas.length }} — Válidas: {{ filasValidas.length }} — Inválidas: {{ filasInvalidas.length }}
            <div class="mt-2">
              <button class="btn btn-primary btn-sm me-2" (click)="importarFilasValidas()" [disabled]="filasValidas.length===0 || importando">Subir filas válidas</button>
              <button class="btn btn-outline-secondary btn-sm me-2" (click)="importarArchivoOriginal()" [disabled]="!selectedFile || importando">Enviar archivo original</button>
              <button class="btn btn-secondary btn-sm me-2" (click)="descargarResultados('json')">Descargar errores (JSON)</button>
              <button class="btn btn-outline-secondary btn-sm" (click)="descargarResultados('csv')" [disabled]="filasInvalidas.length===0">Descargar errores (CSV)</button>
            </div>
          </div>

          <div *ngIf="filasValidas.length" class="mt-3">
            <h6>Preview (primeras 10 válidas)</h6>
            <table class="table table-sm">
              <thead><tr><th>#</th><th>codigoInterno</th><th>codigoBarra</th><th>listaPrecioId</th><th style="text-align:right">precio</th></tr></thead>
              <tbody>
                <tr *ngFor="let f of filasValidas.slice(0,10); let i = index">
                  <td>{{ i+1 }}</td>
                  <td>{{ f.codigoInterno || '-' }}</td>
                  <td>{{ f.codigoBarra || '-' }}</td>
                  <td>{{ f.listaPrecioId || '-' }}</td>
                  <td style="text-align:right">{{ f.precio }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div *ngIf="importacionResultados && importacionResultados.length > 0" class="mt-3">
            <h6>Resultados de importación</h6>
            <div class="d-flex gap-2 mb-2">
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="descargarResultadosImportacion('json')">Descargar JSON</button>
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="descargarResultadosImportacion('csv')">Descargar CSV</button>
            </div>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr><th>Línea</th><th>Estado</th><th>ID</th><th>Error</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of importacionResultados">
                    <td>{{ r.line || r.linea || '-' }}</td>
                    <td>{{ r.status || (r.error ? 'error' : '') }}</td>
                    <td>{{ r.id ?? '-' }}</td>
                    <td>{{ r.error ?? '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</section>
  `,
  styles: [`
.precios-txt .format-card {
  padding: 1rem;
  border-radius: 0.9rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.precios-txt .format-code {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  white-space: pre-wrap;
}
  `]
})
export class PreciosTxtComponent implements OnInit {
  filasValidas: any[] = [];
  filasInvalidas: any[] = [];
  selectedFile: File | null = null;
  error = '';
  mensaje = '';
  appId: number | null = null;
  listas: ListaPrecio[] = [];
  cargandoListas = false;
  selectedListaId: number | null = null;
  importacionResultados: any[] = [];
  importando = false;
  estadoImportacion = '';

  private expectedOrder = [
    'codigoInterno', 'codigoBarra', 'precio', 'precioCompra', 'margen', 'monedaId', 'vigenciaDesde', 'vigenciaHasta', 'observaciones', 'canal'
  ];

  constructor(private api: ApiAdminService) {}

  ngOnInit(): void {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
      const apps = Array.isArray(usuario?.apps) ? usuario.apps : [];
      this.appId = apps[0]?.id ?? null;
    } catch {
      this.appId = null;
    }
    void this.cargarListas();
  }

  async cargarListas(): Promise<void> {
    this.cargandoListas = true;
    try {
      this.listas = await firstValueFrom(this.api.getListasPrecios(this.appId ?? 0));
    } catch (e) {
      console.error('No se pudieron cargar las listas', e);
      this.listas = [];
    } finally {
      this.cargandoListas = false;
    }
  }

  onListaSeleccionada(): void {
    // re-parse file to enforce precio-required rule if needed
    if (this.selectedFile && (this.filasValidas.length || this.filasInvalidas.length)) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        this.parsearTsvConCabecera(text);
      };
      reader.readAsText(this.selectedFile, 'utf-8');
    }
  }

  onArchivoSeleccionado(event: any): void {
    this.error = '';
    const file: File = event?.target?.files?.[0] ?? null;
    if (!file) return;
    this.selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      this.parsearTsvConCabecera(text);
    };
    reader.readAsText(file, 'utf-8');
  }

  private parsearTsvConCabecera(contenido: string): void {
    this.filasValidas = [];
    this.filasInvalidas = [];
    this.importacionResultados = [];
    this.estadoImportacion = '';
    if (!contenido) return;
    contenido = contenido.replace(/^\uFEFF/, '');
    const lines = contenido.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return;

    const headers = lines[0].split(/\t/).map(h => (h || '').toString().trim());
    // normalize headers for flexible alias matching
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/_/g, ''));

    const expected = this.expectedOrder.map(e => e.toLowerCase().replace(/\s+/g, '').replace(/_/g, ''));
    const aliases: Record<string, string[]> = {
      codigointerno: ['codigointerno','sku','codigointerno'],
      codigobarra: ['codigobarra','barcode','ean','gtin'],
      listaprecioid: ['listaprecioid','listaprecio','listaprecioid','listaid','listaid'],
      precio: ['precio','price'],
      preciocompra: ['preciocompra','preciacompra','precio_compra','cost'],
      margen: ['margen','margin'],
      monedaid: ['monedaid','moneda_id','moneda'],
      vigenciadesde: ['vigenciadesde','vigenciadesde','vigenciadesde'],
      vigenciahasta: ['vigenciahasta','vigencia_hasta','vigenciahasta'],
      observaciones: ['observaciones','observacion','notes'],
      canal: ['canal']
    };

    if (normalizedHeaders.length < expected.length) {
      this.error = 'La cabecera no tiene todas las columnas esperadas en el orden requerido.';
      return;
    }

    for (let i = 0; i < expected.length; i++) {
      const found = normalizedHeaders[i];
      const exp = expected[i];
      const allowed = aliases[exp] ?? [exp];
      if (!allowed.includes(found)) {
        this.error = `Cabecera inválida en columna ${i+1}: se esperaba '${this.expectedOrder[i]}' (o alias), se encontró '${headers[i] || ''}'.`;
        return;
      }
    }

    const maxLines = 5000;
    if (lines.length - 1 > maxLines) {
      this.error = `Archivo supera el límite de ${maxLines} filas.`;
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/\t/);
      const row: any = {};
      for (let j = 0; j < this.expectedOrder.length; j++) {
        row[this.expectedOrder[j]] = (cols[j] ?? '').trim();
      }

      // If a lista destino was selected in the UI, override the displayed listaPrecioId for preview
      if (this.selectedListaId !== null && typeof this.selectedListaId !== 'undefined') {
        row.listaPrecioId = String(this.selectedListaId);
      }

      const errs: string[] = [];
      if (!row.codigoInterno && !row.codigoBarra) errs.push('Falta codigoInterno o codigoBarra');
      if (!this.selectedListaId && (!row.precio || String(row.precio).trim() === '')) errs.push('Falta precio (si no se seleccionó lista destino)');

      if (row.precio) {
        row.precio = this.normalizeNumericString(row.precio);
        if (isNaN(Number(row.precio))) errs.push('Precio inválido');
      }
      if (row.precioCompra) {
        row.precioCompra = this.normalizeNumericString(row.precioCompra);
        if (isNaN(Number(row.precioCompra))) errs.push('precioCompra inválido');
      }
      if (row.margen) {
        row.margen = this.normalizeNumericString(row.margen);
        if (isNaN(Number(row.margen))) errs.push('margen inválido');
      }
      // dates basic validation YYYY-MM-DD
      ['vigenciaDesde','vigenciaHasta'].forEach(dk => {
        if (row[dk] && !/^\d{4}-\d{2}-\d{2}$/.test(row[dk])) errs.push(`${dk} formato inválido (YYYY-MM-DD)`);
      });

      if (errs.length) {
        this.filasInvalidas.push({ line: i + 1, raw: lines[i], errors: errs });
      } else {
        this.filasValidas.push(row);
      }
    }
  }

  private normalizeNumericString(s: string): string {
    if (!s) return s;
    return s.replace(/\./g, '').replace(/,/g, '.');
  }

  generarTsvDeFilasValidas(): Blob {
    const header = this.expectedOrder.join('\t');
    const rows = this.filasValidas.map(r => this.expectedOrder.map(k => (r[k] ?? '')).join('\t'));
    const content = [header, ...rows].join('\n');
    return new Blob([content], { type: 'text/plain;charset=utf-8' });
  }

  async importarFilasValidas(): Promise<void> {
    if (!this.filasValidas.length) return;
    if (this.selectedListaId === null || typeof this.selectedListaId === 'undefined') {
      this.error = 'Debe seleccionar una lista de precios destino antes de subir.';
      return;
    }
    this.importando = true;
    this.error = '';
    this.mensaje = '';
    this.importacionResultados = [];
    try {
      const blob = this.generarTsvDeFilasValidas();
      const file = new File([blob], 'precios-validos.txt', { type: 'text/plain' });
      const resp: any = await firstValueFrom(this.api.importPreciosTxt(file, this.selectedListaId ?? undefined));
      this.importacionResultados = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? resp : []);
      const created = this.importacionResultados.filter((r: any) => r.status === 'created').length;
      const updated = this.importacionResultados.filter((r: any) => r.status === 'updated').length;
      const errors = this.importacionResultados.filter((r: any) => r.status === 'error' || r.error).length;
      this.estadoImportacion = `Importación finalizada. Creados: ${created}. Actualizados: ${updated}. Fallidos: ${errors}.`;
      this.mensaje = 'Importación completada.';
    } catch (e: any) {
      console.error(e);
      if (e?.status === 413) this.error = 'El archivo excede el límite permitido por el servidor (máx 5000 líneas).';
      else if (e?.status === 401 || e?.status === 403) this.error = 'No autorizado. Requiere token con rol administrador/operador.';
      else this.error = 'Error al importar: ' + (e?.message || e?.statusText || '');
    } finally {
      this.importando = false;
    }
  }

  async importarArchivoOriginal(): Promise<void> {
    if (!this.selectedFile) {
      this.error = 'No hay archivo seleccionado para subir.';
      return;
    }
    if (this.selectedListaId === null || typeof this.selectedListaId === 'undefined') {
      this.error = 'Debe seleccionar una lista de precios destino antes de subir.';
      return;
    }
    this.importando = true;
    this.error = '';
    this.mensaje = '';
    this.importacionResultados = [];
    try {
      const resp: any = await firstValueFrom(this.api.importPreciosTxt(this.selectedFile, this.selectedListaId ?? undefined));
      this.importacionResultados = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? resp : []);
      const created = this.importacionResultados.filter((r: any) => r.status === 'created').length;
      const updated = this.importacionResultados.filter((r: any) => r.status === 'updated').length;
      const errors = this.importacionResultados.filter((r: any) => r.status === 'error' || r.error).length;
      this.estadoImportacion = `Importación finalizada. Creados: ${created}. Actualizados: ${updated}. Fallidos: ${errors}.`;
      this.mensaje = 'La importación terminó.';
    } catch (e: any) {
      console.error('Error importando archivo', e);
      if (e?.status === 413) this.error = 'El archivo excede el límite permitido por el servidor (máx 5000 líneas).';
      else if (e?.status === 401 || e?.status === 403) this.error = 'No autorizado. Requiere token con rol administrador/operador.';
      else this.error = 'Ocurrió un error durante la importación.';
    } finally {
      this.importando = false;
    }
  }

  descargarResultadosImportacion(format: 'json' | 'csv' = 'json') {
    if (!this.importacionResultados || !this.importacionResultados.length) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(this.importacionResultados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'precios-import-results.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const lines = ['line,status,id,error'];
      for (const r of this.importacionResultados) {
        const parts = [r.line ?? r.linea ?? '', r.status || '', r.id ?? '', (r.error || '').toString().replace(/\n/g, ' ')];
        lines.push(parts.map(p => '"' + String(p).replace(/"/g, '""') + '"').join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'precios-import-results.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  descargarResultados(format: 'json' | 'csv' = 'json') {
    const data = { validas: this.filasValidas, invalidas: this.filasInvalidas };
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `precios-import-result.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } else {
      const lines = ['line,raw,errors'];
      for (const r of this.filasInvalidas) {
        lines.push(`"${r.line}","${(r.raw || '').replace(/"/g, '""')}","${(r.errors || []).join('; ').replace(/"/g, '""')}"`);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'precios-import-errors.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  limpiar() {
    this.filasValidas = [];
    this.filasInvalidas = [];
    this.selectedFile = null;
    this.error = '';
    this.mensaje = '';
    this.selectedListaId = null;
    this.importacionResultados = [];
    this.estadoImportacion = '';
    this.importando = false;
  }

}
