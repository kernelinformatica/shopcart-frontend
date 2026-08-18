import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiAdminService } from '../../../api-admin.service';
import { Producto } from '../../../models';

interface ImportacionTxtFila {
  linea: number;
  nombre: string;
  descripcion: string;
  codigoBarra: string;
  codigoInterno: string;
  marca: string;
  marcaId?: number | null;
  appId?: number | null;
  productoCategoriaId?: number | null;
  unidadMedida?: string;
  contenidoNeto?: string;
  stock: number | null;
  actualiza_producto?: string | null;
  actualiza_stock?: string | null;
  imagen?: string;
  modelo?: string;
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
        <h4 class="mb-0">Carga masiva de artìculos</h4>
      </div>
        <div class="d-flex gap-2 flex-wrap">
        <a class="btn btn-outline-secondary" routerLink="/admin/articulos">Volver al listado</a>
        <button class="btn btn-primary" type="button" (click)="fileInput.click()">Seleccionar archivo TSV</button>
        <input #fileInput class="d-none" type="file" accept=".txt,.tsv,text/tab-separated-values,text/plain" (change)="onArchivoTxtSeleccionado($event)" />
      </div>
    </div>
    <div class="card-body">
      <div class="row g-4">
        <div class="col-12 col-lg-5">
          <div class="format-card">
            <h5 class="mb-3">Formato esperado</h5>
            <p class="text-muted mb-3">El backend procesa un archivo TSV (tab-separated). La <strong>primera línea</strong> debe ser la cabecera con los siguientes campos (se aceptan variantes de nombre, pero recomendamos usar exactamente estos nombres):</p>
            <pre class="format-code mb-3">nombre	appId	productoCategoriaId	codigoInterno	codigoBarra	descripcion	imagen	marca	modelo	unidadMedida	contenidoNeto	stock actualiza_producto  actualiza_stock</pre>
            <div class="small text-muted mb-2">Ejemplo de contenido (TSV):</div>
            <pre class="format-code">Yerba Mate 1kg	123	45	YM100	7790000000000	Yerba premium	/media/ym1.jpg	MarcaX	M1	kg	1	50  S N</pre>
            <ul class="small text-muted mb-0 ps-3"><br>
              <li><strong>Campos obligatorios por fila:</strong> <code>nombre</code>, <code>appId</code>, <code>productoCategoriaId</code> (subrubroId).</li>
              <li><strong>Campos numéricos:</strong> <code>appId</code>, <code>productoCategoriaId</code>, <code>marcaId</code>, <code>stock</code> deben poder convertirse a número.</li>
              <li>Se aceptan variantes (ej. <code>brand</code> → <code>marcaId</code>, <code>sku</code> → <code>codigoInterno</code>), pero usar los nombres mostrados evita ambigüedades.</li>
              <li>Límite: máximo 1000 líneas por archivo (el backend responde 413 si se excede).</li>
              <li>actualiza_producto: Si enviàs 'S', actualiza los datos del producto como el nombre y la descripciòn.</li>
              <li>actualiza_stock: Si enviàs 'S' actualiza el stock del producto, or el valor que le envias en el campo stock.</li>
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
            Seleccioná un archivo TSV (con cabecera) para ver la vista previa antes de importar.
          </div>

          <div *ngIf="importacionTxt.length > 0" class="mb-3 small">
            <strong>Resumen:</strong>
            - Filas totales: {{ importacionTxt.length }}
            - Válidas: {{ filasValidas.length }}
            - Inválidas: {{ filasInvalidas.length }}
            <div class="mt-2">
              <button class="btn btn-sm btn-outline-secondary me-2" type="button" (click)="descargarErrores('json')" [disabled]="filasInvalidas.length===0">Descargar errores (JSON)</button>
              <button class="btn btn-sm btn-outline-secondary me-2" type="button" (click)="descargarErrores('csv')" [disabled]="filasInvalidas.length===0">Descargar errores (CSV)</button>
              <button class="btn btn-sm btn-primary me-2" type="button" (click)="enviarFilasValidas()" [disabled]="filasValidas.length===0 || importandoTxt">Enviar sólo filas válidas</button>
              <button class="btn btn-sm btn-secondary" type="button" (click)="importarTxt()" [disabled]="importandoTxt || importacionTxt.length===0">Enviar archivo original</button>
            </div>
          </div>

          <div style="font-size: 10px;" *ngIf="importacionTxt.length > 0">
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
                    <td>{{ fila.appId ?? '-' }}</td>
                    <td>{{ fila.productoCategoriaId ?? '-' }}</td>
                    <td>{{ fila.marcaId ?? (fila.marca || '-') }}</td>
                    <td>{{ fila.codigoBarra }}</td>
                    <td>{{ fila.codigoInterno }}</td>
                    <td>{{ fila.stock ?? '-' }}</td>
                    <td>
                      <span *ngIf="!fila.error" class="text-success" aria-label="ok">&#10003;</span>
                      <span *ngIf="fila.error">{{ fila.error }}</span>
                    </td>
                  </tr>
              </tbody>
            </table>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-3">
            <button class="btn btn-outline-secondary" type="button" (click)="limpiar()" [disabled]="importandoTxt">Limpiar</button>
            <button class="btn btn-primary" type="button" (click)="importarTxt()" [disabled]="importandoTxt || importacionTxt.length === 0">
              {{ importandoTxt ? 'Importando...' : 'Enviar archivo original' }}
            </button>
          </div>

          <div *ngIf="importacionResultados && importacionResultados.length > 0" class="mt-3">
            <h6>Resultados de importación</h6>
            <div class="d-flex gap-2 mb-2">
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="descargarResultados('json')">Descargar JSON</button>
              <button class="btn btn-sm btn-outline-secondary" type="button" (click)="descargarResultados('csv')">Descargar CSV</button>
            </div>
            <div class="table-responsive">
              <table class="table table-sm">
                <thead>
                  <tr><th>Línea</th><th>Estado</th><th>ID</th><th>Error</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of importacionResultados">
                    <td>{{ r.line }}</td>
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
export class ArticulosTxtComponent implements OnInit {
  private readonly apiAdmin = inject(ApiAdminService);

  private normalizeNumericString(val: any): string {
    if (val === undefined || val === null) return '';
    let s = String(val).trim();
    if (s === '') return '';
    // remove non-breaking spaces and regular spaces
    s = s.replace(/\u00A0/g, '').replace(/\s+/g, '');
    // If both dot and comma present, assume dot as thousand separator and comma as decimal
    if (s.indexOf('.') !== -1 && s.indexOf(',') !== -1) {
      s = s.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // replace comma with dot
      s = s.replace(/,/g, '.');
    }
    return s;
  }

  ngOnInit(): void {
    console.log('ArticulosTxtComponent (updated) initialized');
  }

  error = '';
  mensaje = '';
  archivoTxtNombre = '';
  importacionTxt: ImportacionTxtFila[] = [];
  importandoTxt = false;
  estadoImportacionTxt = '';
  // appId detected from user session (si está disponible)
  appId: number | null = null;
  // archivo seleccionado para enviar al backend (multipart)
  selectedFile: File | null = null;
  // resultados devueltos por el backend después de importar
  importacionResultados: any[] = [];
  // validation summary
  filasInvalidas: ImportacionTxtFila[] = [];
  filasValidas: ImportacionTxtFila[] = [];

  onArchivoTxtSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.archivoTxtNombre = file.name;
    this.error = '';
    this.mensaje = '';
    this.selectedFile = file;

    // set appId from session if available (para llenar filas sin appId)
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
      const apps = Array.isArray(usuario?.apps) ? usuario.apps : [];
      this.appId = apps[0]?.id ?? null;
    } catch {
      this.appId = null;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const contenido = String(reader.result ?? '');
      this.importacionTxt = this.parsearTsvConCabecera(contenido);
      this.estadoImportacionTxt = `${this.importacionTxt.length} registros listos para revisar.`;
    };
    reader.onerror = () => {
      this.error = 'No pudimos leer el archivo.';
      this.importacionTxt = [];
      this.archivoTxtNombre = '';
      this.selectedFile = null;
    };
    reader.readAsText(file, 'utf-8');
  }

  limpiar(): void {
    this.archivoTxtNombre = '';
    this.importacionTxt = [];
    this.estadoImportacionTxt = '';
    this.error = '';
    this.mensaje = '';
    this.importacionResultados = [];
    this.filasValidas = [];
    this.filasInvalidas = [];
    this.selectedFile = null;
  }

  async importarTxt(): Promise<void> {
    if (!this.selectedFile) {
      this.error = 'No hay archivo seleccionado para subir.';
      return;
    }

    await this.subirArchivo(this.selectedFile);
  }

  private async subirArchivo(file: File): Promise<void> {
    this.importandoTxt = true;
    this.estadoImportacionTxt = '';
    this.importacionResultados = [];
    try {
      const resp: any = await firstValueFrom(this.apiAdmin.importProductosTxt(file));
      // backend returns { results: [...] }
      this.importacionResultados = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? resp : []);
      const created = this.importacionResultados.filter((r: any) => r.status === 'created').length;
      const updated = this.importacionResultados.filter((r: any) => r.status === 'updated').length;
      const errors = this.importacionResultados.filter((r: any) => r.status === 'error' || r.error).length;
      this.estadoImportacionTxt = `Importación finalizada. Creados: ${created}. Actualizados: ${updated}. Fallidos: ${errors}.`;
      this.mensaje = 'La importación terminó.';
    } catch (e: any) {
      console.error('Error importando archivo', e);
      if (e?.status === 413) this.error = 'El archivo excede el límite permitido por el servidor (máx 5000 líneas).';
      else if (e?.status === 401 || e?.status === 403) this.error = 'No autorizado. Requiere token con rol administrador/operador.';
      else this.error = 'Ocurrió un error durante la importación.';
    } finally {
      this.importandoTxt = false;
    }
  }

  async enviarFilasValidas(): Promise<void> {
    if (!this.filasValidas || this.filasValidas.length === 0) {
      this.error = 'No hay filas válidas para enviar.';
      return;
    }
    this.importandoTxt = true;
    this.estadoImportacionTxt = 'Verificando existencia de productos y aplicando actualizaciones condicionales...';
    const crearFilas: ImportacionTxtFila[] = [];
    const resultados: any[] = [];

    for (const fila of this.filasValidas) {
      try {
        // try to find existing producto by codigoInterno first, then codigoBarra
        const params: any = {};
        if (fila.appId) params.appId = String(fila.appId);
        if (fila.codigoInterno) params.codigoInterno = fila.codigoInterno;
        let encontradosRaw: any = [];
        let encontrados: Producto[] = [];
        if (fila.codigoInterno) {
          encontradosRaw = await firstValueFrom(this.apiAdmin.getProductos(params));
          if (Array.isArray(encontradosRaw)) encontrados = encontradosRaw as Producto[];
          else if (encontradosRaw && Array.isArray(encontradosRaw.items)) encontrados = encontradosRaw.items as Producto[];
        }
        // if not found by codigoInterno, try codigoBarra
        if ((!Array.isArray(encontrados) || encontrados.length === 0) && fila.codigoBarra) {
          const params2: any = {};
          if (fila.appId) params2.appId = String(fila.appId);
          params2.codigoBarra = fila.codigoBarra;
          const encontradosRaw2: any = await firstValueFrom(this.apiAdmin.getProductos(params2));
          if (Array.isArray(encontradosRaw2)) encontrados = encontradosRaw2 as Producto[];
          else if (encontradosRaw2 && Array.isArray(encontradosRaw2.items)) encontrados = encontradosRaw2.items as Producto[];
        }

          if (Array.isArray(encontrados) && encontrados.length > 0) {
          const prod = encontrados[0];
          const estado = (prod as any).estado ?? ((prod as any).activo === false ? 'inactivo' : 'activo');

          // Determine update behavior based on flags
          const shouldUpdateProductFlag = String(fila.actualiza_producto || '').toUpperCase() === 'S';
          const shouldUpdateStockFlag = String(fila.actualiza_stock || '').toUpperCase() === 'S';

          // Build payload according to flags and rules:
          // - if actualiza_producto === 'S' -> update product fields (except stock)
          // - else if product is inactivo -> allow update of nombre/descripcion
          // - if actualiza_stock === 'S' -> include stock in update
          if (shouldUpdateProductFlag || estado === 'inactivo' || (prod as any).activo === false || (prod as any).baja === true) {
            try {
              const payload: any = {};
              if (shouldUpdateProductFlag) {
                payload.nombre = fila.nombre;
                if (fila.descripcion) payload.descripcion = fila.descripcion;
                if ((fila as any).imagen) payload.imagen = (fila as any).imagen;
                if (fila.marca) payload.marca = fila.marca;
                if ((fila as any).modelo) payload.modelo = (fila as any).modelo;
                if (fila.unidadMedida) payload.unidad_medida = fila.unidadMedida;
                if (fila.contenidoNeto) payload.contenido_neto = fila.contenidoNeto;
              } else {
                // update only nombre & descripcion when product is inactive
                payload.nombre = fila.nombre;
                if (fila.descripcion) payload.descripcion = fila.descripcion;
              }

              if (shouldUpdateStockFlag) {
                payload.stock = fila.stock ?? 0;
              }

              const updated = await firstValueFrom(this.apiAdmin.editarProducto(prod.id, payload));
              resultados.push({ line: fila.linea, status: 'updated', id: prod.id });
            } catch (err) {
              resultados.push({ line: fila.linea, status: 'error', error: 'Fallo al actualizar producto existente' });
            }
          } else {
            // product exists and no update requested -> skip
            resultados.push({ line: fila.linea, status: 'skipped', error: 'Producto existente — no se solicitó actualización' });
          }
        } else {
          // no existing product found -> include for creation via import endpoint
          crearFilas.push(fila);
        }
      } catch (err) {
        resultados.push({ line: fila.linea, status: 'error', error: 'Error buscando producto existente' });
      }
    }

    // if there are rows to create, upload them using existing import endpoint
    if (crearFilas.length > 0) {
      const tsv = this.generarTsvDeFilasValidas(crearFilas);
      const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
      const file = new File([blob], 'import-valid-rows.tsv', { type: 'text/tab-separated-values' });
      try {
        const resp: any = await firstValueFrom(this.apiAdmin.importProductosTxt(file));
        const serverResults = Array.isArray(resp?.results) ? resp.results : (Array.isArray(resp) ? resp : []);
        // merge serverResults into resultados
        for (const r of serverResults) resultados.push(r);
      } catch (e: any) {
        console.error('Error subiendo filas para creación', e);
        resultados.push({ line: 0, status: 'error', error: 'Error subiendo TSV de creación' });
      }
    }

    // show combined resultados
    this.importacionResultados = resultados;
    const created = resultados.filter((r: any) => r.status === 'created').length;
    const updated = resultados.filter((r: any) => r.status === 'updated').length;
    const errors = resultados.filter((r: any) => r.status === 'error' || r.error).length;
    this.estadoImportacionTxt = `Operación finalizada. Creados: ${created}. Actualizados: ${updated}. Fallidos: ${errors}.`;
    this.mensaje = 'Procesamiento de filas válidas finalizado.';
    this.importandoTxt = false;
  }

  private parsearTsvConCabecera(contenido: string): ImportacionTxtFila[] {
    const lines = String(contenido || '').split(/\r?\n/).map(l => l.replace(/\u00A0/g, ''));
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    if (nonEmpty.length === 0) return [];
    if (nonEmpty.length > 5000) {
      this.error = 'Archivo con más de 5000 líneas. No se permite.';
      return [];
    }
    let headerLine = nonEmpty[0];
    // strip UTF-8 BOM if present
    headerLine = headerLine.replace(/^\uFEFF/, '');
    const headers = headerLine.split(/\t/).map(h => (h || '').toString().trim());
    // map header names to canonical lowercase keys without spaces
    const mapHeader = (h: string) => {
      if (!h) return '';
      const raw = h.toLowerCase().trim();
      if (raw === 'brand') return 'marcaid';
      if (raw === 'marca') return 'marcaid';
      if (raw === 'marcaid') return 'marcaid';
      if (raw === 'sku') return 'codigointerno';
      if (raw === 'barcode') return 'codigobarra';
      // keep camel-like tokens compacted
      return raw.replace(/\s+/g, '').replace(/\-/g, '');
    };
    const canonical = headers.map(mapHeader);
    console.debug('TSV header parsed', { headerLine, headers, canonical });

    // enforce exact order (allowing aliases) for the expected header sequence
    const expectedOrder = ['nombre','appid','productocategoriaid','codigointerno','codigobarra','descripcion','imagen','marca','modelo','unidadmedida','contenidoneto','stock','actualizaproducto','actualizastock'];
    // build a mapping of allowed aliases per expected key
    const aliases: Record<string,string[]> = {
      nombre: ['nombre','ombre'],
      appid: ['appid','app_id','app'],
      productocategoriaid: ['productocategoriaid','categoriaid','categoria_id','subrubroid'],
      codigointerno: ['codigointerno','codigo_interno','sku'],
      codigobarra: ['codigobarra','codigo_barra','barcode'],
      descripcion: ['descripcion','descripcion_larga','desc'],
      imagen: ['imagen','image','foto'],
      marca: ['marca','brand'],
      modelo: ['modelo','model'],
      unidadmedida: ['unidadmedida','unidad_medida','uom'],
      contenidoneto: ['contenidoneto','contenido_neto'],
      stock: ['stock'],
      actualizaproducto: ['actualizaproducto','actualiza_producto','actualiza-producto','update_product','updateproduct'],
      actualizastock: ['actualizastock','actualiza_stock','actualiza-stock','update_stock','updatestock']
    };

    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/\s+/g, '').replace(/_/g, ''));
    // For each expected position, check that header at same index matches one alias
    if (normalizedHeaders.length < expectedOrder.length) {
      this.error = 'La cabecera no tiene todas las columnas esperadas en el orden requerido.';
      return [];
    }
    for (let i = 0; i < expectedOrder.length; i++) {
      const expected = expectedOrder[i];
      const found = normalizedHeaders[i];
      const allowed = aliases[expected]?.map(a => a.toLowerCase().replace(/\s+/g, '').replace(/_/g, '')) || [expected];
      if (!allowed.includes(found)) {
        this.error = `Cabecera inválida en columna ${i+1}: se esperaba '${expected}' (o alias), se encontró '${headers[i] || ''}'.`;
        console.debug('Header mismatch', { index: i, expected, found, headers });
        return [];
      }
    }

    const parsedRows = nonEmpty.slice(1).map((line, idx) => {
      const cols = line.split(/\t/);
      const obj: any = {};
      for (let i = 0; i < canonical.length; i++) {
        const key = canonical[i];
        if (!key) continue;
        obj[key] = (cols[i] || '').toString().trim();
      }
      // try to fill appId from session if missing
      if (!obj['appid'] && this.appId) obj['appid'] = String(this.appId);

      // normalize empty strings to undefined
      for (const k of Object.keys(obj)) {
        if (obj[k] === '') obj[k] = undefined;
      }

      const nombre = (obj['nombre'] || '') as string;
      const appIdRaw = obj['appid'] ?? obj['appId'] ?? obj['app'] ?? '';
      const categoriaRaw = obj['productocategoriaid'] ?? obj['productocategoriaId'] ?? obj['productocategoria'] ?? obj['categoriaid'] ?? '';
      const errors: string[] = [];

      // validations
      if (!nombre || nombre.trim().length === 0) errors.push('nombre vacío');
      if (nombre && nombre.length > 250) errors.push('nombre demasiado largo (>250)');
      const appIdNum = Number(appIdRaw);
      if (!appIdRaw || isNaN(appIdNum) || !Number.isFinite(appIdNum) || appIdNum <= 0) errors.push('appId inválido');
      const prodCatNum = Number(categoriaRaw);
      // allow 0 as a valid productoCategoriaId (represents 'sin categoría')
      if (categoriaRaw === undefined || categoriaRaw === '' || isNaN(prodCatNum) || !Number.isFinite(prodCatNum) || prodCatNum < 0) errors.push('productoCategoriaId inválido');
      if (obj['contenidoneto'] !== undefined) {
        const normContenido = this.normalizeNumericString(obj['contenidoneto']);
        if (normContenido === '' || isNaN(Number(normContenido))) errors.push('contenidoNeto no es numérico');
        else obj['contenidoneto'] = normContenido;
      }
      if (obj['stock'] !== undefined) {
        const normStock = this.normalizeNumericString(obj['stock']);
        if (normStock === '' || isNaN(Number(normStock))) errors.push('stock no es numérico');
        else obj['stock'] = normStock;
      }
      if (obj['codigointerno'] && obj['codigointerno'].length > 120) errors.push('codigoInterno demasiado largo (>120)');
      if (obj['codigobarra'] && obj['codigobarra'].length > 120) errors.push('codigoBarra demasiado largo (>120)');
      if (obj['imagen'] && obj['imagen'].length > 400) errors.push('imagen demasiado larga (>400)');

      const marcaIdNum = obj['marcaid'] ? (Number(obj['marcaid']) || null) : null;

      const actualizaProductoRaw = (obj['actualizaproducto'] ?? obj['actualiza_producto'] ?? obj['actualizaproducto'] ?? '') as string;
      const actualizaStockRaw = (obj['actualizastock'] ?? obj['actualiza_stock'] ?? obj['actualizastock'] ?? '') as string;

      const valido = errors.length === 0;
      const error = valido ? undefined : errors.join('; ');

      return {
        linea: idx + 2,
        nombre: nombre,
        descripcion: obj['descripcion'] || '',
        codigoBarra: obj['codigobarra'] || obj['barcode'] || '',
        codigoInterno: obj['codigointerno'] || obj['sku'] || '',
        marca: obj['marca'] || obj['brand'] || '',
        marcaId: marcaIdNum,
        appId: !isNaN(appIdNum) ? Number(appIdNum) : (this.appId ?? null),
        productoCategoriaId: !isNaN(prodCatNum) ? Number(prodCatNum) : null,
        unidadMedida: obj['unidadmedida'] || '',
        contenidoNeto: obj['contenidoneto'] || '',
        imagen: obj['imagen'] || '',
        modelo: obj['modelo'] || '',
        stock: obj['stock'] === undefined ? null : Number(obj['stock']),
        actualiza_producto: actualizaProductoRaw ? String(actualizaProductoRaw).toUpperCase() : null,
        actualiza_stock: actualizaStockRaw ? String(actualizaStockRaw).toUpperCase() : null,
        valido,
        error
      } as ImportacionTxtFila;
    });

    this.filasValidas = parsedRows.filter(r => r.valido);
    this.filasInvalidas = parsedRows.filter(r => !r.valido);
    if (this.filasInvalidas.length > 0) console.debug('TSV parse: filas inválidas detectadas', this.filasInvalidas.slice(0, 20));

    return parsedRows;
  }

  generarTsvDeFilasValidas(rows: ImportacionTxtFila[]): string {
    const header = 'nombre\tappId\tproductoCategoriaId\tcodigoInterno\tcodigoBarra\tdescripcion\timagen\tmarca\tmodelo\tunidadMedida\tcontenidoNeto\tstock';
    const headerWithFlags = header + '\tactualiza_producto\tactualiza_stock';
    const lines = [headerWithFlags];
    for (const r of rows) {
      const parts = [
        r.nombre ?? '',
        String(r.appId ?? ''),
        String(r.productoCategoriaId ?? ''),
        r.codigoInterno ?? '',
        r.codigoBarra ?? '',
        r.descripcion ?? '',
        (r as any).imagen ?? '',
        r.marca ?? '',
        (r as any).modelo ?? '',
        r.unidadMedida ?? '',
        r.contenidoNeto ?? '',
        r.stock ?? '',
        r.actualiza_producto ?? '',
        r.actualiza_stock ?? ''
      ];
      lines.push(parts.join('\t'));
    }
    return lines.join('\n');
  }

  descargarErrores(format: 'json' | 'csv' = 'json') {
    if (!this.filasInvalidas || this.filasInvalidas.length === 0) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(this.filasInvalidas, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import-errors.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const lines = ['line,error'];
      for (const r of this.filasInvalidas) {
        lines.push(`"${r.linea}","${(r.error || '').replace(/"/g, '""')}"`);
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import-errors.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  descargarResultados(format: 'json' | 'csv' = 'json') {
    if (!this.importacionResultados || !this.importacionResultados.length) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(this.importacionResultados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import-results.json';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV: line, status, id, error
      const lines = ['line,status,id,error'];
      for (const r of this.importacionResultados) {
        const parts = [r.line, r.status || '', r.id ?? '', (r.error || '').replace(/\n/g, ' ')];
        lines.push(parts.map(p => '"' + String(p).replace(/"/g, '""') + '"').join(','));
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import-results.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }
}
