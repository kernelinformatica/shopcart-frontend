import { CommonModule } from '@angular/common';

import { Component, OnInit, inject } from '@angular/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
//import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PermisosService } from '../../../permisos.service';


import { ApiAdminService, MarcaAdminOption, MediaSearchItem, MediaSearchMode, MediaSearchProvider, PrecioProductoAdminPayload, ProductoCaracteristicaAdminItem, ModeloImputacionAdminOption } from '../../../api-admin.service';
import { ListaPrecio, Media, Producto, ProductoMedia, Monedas, Canal } from '../../../models';
import { environment } from '../../../../environments/environment';


interface CategoriaFiltroOption {
  id: number;
  nombre: string;
  ruta: string;
}

interface MediaCatalogOption {
  id: number;
  nombre: string;
  accept: string;
}

interface PreciosPorProductos {
  id: number;
  productoId: number;
  listaPrecioId: number;
  listaNombre: string;
  canal: Canal;
  precio: number;
  precioCompra?: number;
  margen?: number;
  moneda: Monedas;
  observaciones?: string;
  vigenciaDesde?: string;
  vigenciaHasta?: string;

}

interface ProductoCaracteristicaDraft {
  id?: number | null;
  nombre: string;
  valor: string;
  orden: number | null;
}



interface PendingProductoMediaUpload {
  localId: string;
  file: File;
  mediaId: number;
  descripcion: string;
  orden: number;
  previewUrl: string;
}

interface PrecioProducto {
  id: number;
  precio: number;
  moneda?: { id: number; codigoISO: string };
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  observaciones?: string;
  canal?: { id: number; nombre: string; descripcion: string };
  listaprecio?: { id: number; canal?: { id: number; nombre: string; descripcion: string } };
}

type MultimediaTab = 'upload' | 'search';

@Component({
  selector: 'app-articulos-manual',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DragDropModule, ConfirmDialogComponent],
  template: `

   
<section class="container py-3 articulos-manual">
  <div class="hero-panel mb-4">
    <div>
      <p class="eyebrow mb-2">Administración de artículos</p>
      <h2 class="mb-2"><i class="bi bi-pencil-square"></i> {{ getTituloHero() }}</h2>
      <p class="text-muted mb-0">
        Gestioná la información del producto, su multimedia y su configuración comercial desde una sola pantalla.
      </p>
    </div>
    <div class="hero-actions">
      <a class="icon-action-btn icon-action-btn-light" routerLink="/admin/articulos" title="Volver al listado" aria-label="Volver al listado">
        <i class="bi bi-arrow-left" aria-hidden="true"></i>
        <span class="visually-hidden">Volver al listado</span>
      </a>
      <button class="icon-action-btn" type="button" (click)="limpiar()" title="Limpiar formulario" aria-label="Limpiar formulario">
        <i class="bi bi-eraser" aria-hidden="true"></i>
        <span class="visually-hidden">Limpiar formulario</span>
      </button>
    </div>
  </div>


    <app-confirm-dialog
      modalId="deleteModal"
      title="Eliminar registro"
      message="¿Seguro que querés eliminar este registro?"
      confirmText="Sí, eliminar"
      cancelText="Cancelar"
      (confirmed)="onDeleteConfirmed()"
      (cancelled)="onDeleteCancelled()">
    </app-confirm-dialog>
    <app-confirm-dialog
      modalId="deleteProductoModal"
      title="Eliminar Producto"
      message="¿Seguro que querés eliminar este Producto y todas sus relaciones, tenga en cuenta que no se podrá deshacer esta acción?"
      confirmText="Sí, eliminar"
      cancelText="Cancelar"
      (confirmed)="onDeleteProductoConfirm()"
      (cancelled)="onDeleteCancelled()">
    </app-confirm-dialog>
  <div class="card shadow-sm articulos-manual-card">
    <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <p class="section-kicker mb-1">Formulario</p>
        <h4 class="mb-0">{{ editandoId ? 'Editar artículo' : 'Carga manual de artículo' }}</h4>
      </div>
      
    </div>
    <div class="card-body">
      <div *ngIf="cargando" class="text-muted py-3">Cargando formulario...</div>
      <div *ngIf="error" class="alert alert-danger">{{ error }}</div>
      <div *ngIf="mensaje" class="alert alert-success">{{ mensaje }}</div>

      <form [formGroup]="formulario" (ngSubmit)="guardar()" class="articulos-manual-form" *ngIf="!cargando">
      
      
      
         <div class="form-section" >
            <!-- Botón con flechita -->
   
        <div  class="form-section-header d-flex justify-content-between align-items-start">
   
            <h5 class="mb-1"><i class="bi bi-info-circle"></i> Información principal</h5>
            <div class="text-muted mb-0">
              Datos base del producto para identificarlo rápidamente.
            </div>
         <button type="button" class="btn btn-link p-0" (click)="mostrarInfo = !mostrarInfo">
            <i class="bi" [ngClass]="mostrarInfo ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
         </button>  
        </div>
          
          <div class="row g-3" *ngIf="mostrarInfo">
            <div class="col-12 col-lg-7">
              <label class="form-label">Nombre</label>
              <input class="form-control" formControlName="nombre" />
            </div>
            <div class="col-12 col-lg-5">
              <label class="form-label">Marca</label>
              
              <select class="form-select" formControlName="marcaId">
                <option [ngValue]="null">Sin marca</option>
                <option *ngFor="let marca of marcas" [ngValue]="marca.id">{{ marca.nombre }}</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">Descripción</label>
              <textarea class="form-control" rows="3" formControlName="descripcion"></textarea>
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Estado</label>
              <select class="form-select" formControlName="estado">
  <option [ngValue]="true">Activo</option>
  <option [ngValue]="false">Inactivo</option>
</select>
            </div>
            <div class="col-12 col-md-2" *ngIf="formulario.get('estado')?.value == false">
              <label class="form-label">{{ formulario.get('baja')?.value == true ? 'Baja' : 'Baja' }}</label>
              <select class="form-select" formControlName="baja">
  <option [ngValue]="true"> {{ formulario.get('baja')?.value ? 'Baja' : 'Baja' }}</option>
  <option [ngValue]="false"> {{ formulario.get('baja')?.value ? 'Activar' : 'Activo' }}</option>
</select>
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Modelo</label>
              <select class="form-select" formControlName="modelo">
                <option value="">Seleccionar modelo</option>
                <option *ngFor="let modelo of modeloOptions" [value]="modelo">{{ modelo }}</option>
              </select>
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Unidad de medida</label>
              <select class="form-select" formControlName="unidadMedida">
                <option value="">Seleccionar unidad</option>
                <option *ngFor="let unidad of unidadMedidaOptions" [value]="unidad">{{ unidad }}</option>
              </select>
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Contenido neto</label>
              <input type="number" class="form-control" formControlName="contenidoNeto" placeholder="500" />
            </div>
          </div>
          
        </div>

        <div class="form-section">
          <div class="form-section-header d-flex justify-content-between align-items-start">
            <h5 class="mb-1"><i class="bi bi-upc-scan"></i> Códigos y stock</h5>
            <div class="text-muted mb-0">
              Campos operativos que se usan para integración y control interno.
            </div>
          <button type="button" class="btn btn-link p-0" (click)="mostrarStock = !mostrarStock">
            <i class="bi" [ngClass]="mostrarStock ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
          </button>
          </div>
          <div class="row g-3" *ngIf="mostrarStock">
            <div class="col-12 col-md-4">
              <label class="form-label">Código de barra</label>
              <input class="form-control" formControlName="codigoBarra" />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label">Código interno</label>
             
              <input type= "number" style="color: black;  font-weight: 600; text-align:right;"   class="form-control" formControlName="codigoInterno" />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label">Stock</label>
              <input style="color: green; font-weight: bold; text-align:right; " type="number" class="form-control" formControlName="stock" />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">Categoría</label>
              <div class="categoria-autocomplete">
                <input
                  class="form-control categoria-autocomplete-input"
                  type="search"
                  [value]="categoriaBusqueda"
                  (input)="onCategoriaBusquedaChange($any($event.target).value)"
                  placeholder="Escribí una categoría y elegí una coincidencia"
                />

                <button
                  *ngIf="getCategoriaSeleccionadaForm()"
                  type="button"
                  class="categoria-limpiar-btn categoria-limpiar-btn-inline"
                  (click)="limpiarCategoriaSeleccionada()"
                  title="Quitar categoría"
                  aria-label="Quitar categoría"
                >
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>

                <div class="categoria-sugerencias" *ngIf="getMostrarSugerenciasCategoria()">
                  <button
                    *ngFor="let categoria of getCategoriasFiltradas()"
                    class="categoria-sugerencia-item"
                    type="button"
                    (click)="seleccionarCategoriaFormulario(categoria)"
                    [class.active]="categoria.id === formulario.controls.categoriaId.value"
                  >
                    {{ categoria.ruta }}
                  </button>
                </div>

                <div class="categoria-sin-resultados" *ngIf="getSinResultadosCategoria()">
                  No encontramos categorías con ese texto.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="form-section" *ngIf="puedeVerCaracteristicas">
        
          
           <div class="form-section-header d-flex justify-content-between align-items-start">
            <div>
              <h5 class="mb-1"><i class="bi bi-sliders2-vertical"></i> Características</h5>
              <p class="text-muted mb-0">Agregá atributos simples como Color, Talle, Light o cualquier par nombre y valor.</p>
              
            </div>
           
            <!-- Bloque derecho: flechita + badge -->
   <!-- Bloque derecho: flechita + badge en la misma fila -->
  <div class="d-flex align-items-center gap-2">
    <span class="badge bg-light text-dark border">{{ caracteristicas.length }} cargadas</span>
    <button type="button" class="btn btn-link p-0" (click)="mostrarCaract = !mostrarCaract">
      <i class="bi" [ngClass]="mostrarCaract ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
    </button>
    
  </div>
           
           
          </div>

        <div *ngIf="puedeCrearCaracteristicas && mostrarCaract">
          <div class="row g-3 align-items-end mb-3" >
            <div class="col-12 col-md-4">
              <label class="form-label">Nombre</label>
              <input [disabled]="!puedeEditarCaracteristicas"
                class="form-control"
                [(ngModel)]="nuevaCaracteristicaNombre"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Característica"
              />
            </div>
            <div class="col-12 col-md-6">
              <label class="form-label">Valor</label>
              <input [disabled]="!puedeEditarCaracteristicas"
                class="form-control"
                [(ngModel)]="nuevaCaracteristicaValor"
                [ngModelOptions]="{ standalone: true }"
                placeholder="Valor"
              />
            </div>
            <div class="col-12 col-md-1">
              <label class="form-label">Orden</label>
              <input [disabled]="!puedeEditarCaracteristicas"
                type="number"
                class="form-control"
                [(ngModel)]="nuevaCaracteristicaOrden"
                [ngModelOptions]="{ standalone: true }"
                placeholder="1"
              />
            </div>
            <div class="col-12 col-md-1 d-flex justify-content-md-end" *ngIf="puedeCrearCaracteristicas">
              <button  type="button" class="btn btn-outline-primary w-100" (click)="agregarCaracteristica()">
                <i class="bi bi-plus-lg"></i> Agregar 
              </button>
            </div>
          </div>

          <div *ngIf="caracteristicas.length === 0" class="alert alert-light border mb-0">
            Todavía no cargaste características para este artículo.
          </div>
  </div>
          <div class="table-responsive" *ngIf="caracteristicas.length > 0 && mostrarCaract" >
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th style="width: 110px;">Orden</th>
                  <th style="width: 35%;">Nombre</th>
                  <th>Valor</th>
                  <th class="text-end" style="width: 140px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
             
                <tr *ngFor="let caracteristica of caracteristicas; let i = index; trackBy: trackByCaracteristica">
                  <td>
                    <input [disabled]="!puedeEditarCaracteristicas"
                      type="number"
                      class="form-control form-control-sm"
                      [(ngModel)]="caracteristica.orden"
                      [ngModelOptions]="{ standalone: true }"
                      placeholder="1"
                    />
                  </td>
                  <td>
                    <input
                    [disabled]="!puedeEditarCaracteristicas"
                      class="form-control form-control-sm"
                      [(ngModel)]="caracteristica.nombre"
                      [ngModelOptions]="{ standalone: true }"
                      placeholder="Característica"
                    />
                  </td>
                  <td>
                    <input
                    [disabled]="!puedeEditarCaracteristicas"
                      class="form-control form-control-sm"
                      [(ngModel)]="caracteristica.valor"
                      [ngModelOptions]="{ standalone: true }"
                      placeholder="Valor"
                    />
                  </td>
                  
                  <td class="text-end">
                    <button [disabled]="!puedeBorrarCaracteristicas" type="button" class="btn btn-sm text-danger border-0" (click)="eliminarCaracteristica(i)">
                      <i class="bi bi-trash"></i> 
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        <div class="form-section">
          <div class="form-section-header d-flex justify-content-between align-items-start">
            <div>
              <h5 class="mb-1"><i class="bi bi-receipt-cutoff"></i> Imputaciones / impuestos</h5>
              <p class="text-muted mb-0">
                Impuestos / Imputaciones asociadas al producto
              </p>
              
            </div>
          
           
               <!-- Bloque derecho: flechita + badges -->
    <div class="d-flex align-items-center gap-2">
     
      <span class="badge bg-light text-dark border">{{ imputacionesSeleccionadasIds.length }} seleccionadas</span>
      <span class="badge text-bg-secondary" *ngIf="!puedeEditarImputaciones">Solo lectura</span>
       <button type="button" class="btn btn-link p-0" (click)="mostrarImpuestos = !mostrarImpuestos">
        <i class="bi" [ngClass]="mostrarImpuestos ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </button>
    </div>
             
          
          </div>

          <div *ngIf="imputacionesError" class="alert alert-danger mb-3">{{ imputacionesError }}</div>
          <div *ngIf="imputacionesMensaje" class="alert alert-success mb-3">{{ imputacionesMensaje }}</div>

          <div *ngIf="!editandoId" class="alert alert-warning mb-3">
            Guardá el artículo primero para habilitar la asignación de imputaciones.
          </div>

          <div class="row g-3 align-items-start" *ngIf="mostrarImpuestos">
            <div class="col-12 col-lg-7">
              <label class="form-label">Imputaciones disponibles</label>
              <select
                class="form-select"
                multiple
                size="8"
                [(ngModel)]="imputacionesSeleccionadasIds"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="imputacionesGuardando || !editandoId || imputacionesDisponibles.length === 0 || !puedeEditarImputaciones"
              >
                <option *ngFor="let imputacion of imputacionesDisponibles; trackBy: trackByImputacion" [ngValue]="imputacion.id">
                  {{ imputacion.nombre }}<span *ngIf="imputacion.tipo"> - {{ imputacion.tipo }}</span>
                </option>
              </select>
              <small class="text-muted d-block mt-2">
                Podés seleccionar varias usando Ctrl o Shift. También podés desmarcar para quitar relaciones.
              </small>
            </div>

            <div class="col-12 col-lg-5">
             
              <label class="form-label">Seleccionadas</label> 
              <div *ngIf="getImputacionesSeleccionadasDetalles().length > 0; else sinImputacionesSeleccionadas" class="d-flex flex-wrap gap-2">
                <span class="badge rounded-pill text-bg-primary" *ngFor="let imputacion of getImputacionesSeleccionadasDetalles()">
                  {{ imputacion.nombre }}<span *ngIf="imputacion.tipo"> · {{ imputacion.tipo }}</span>
                </span>
                
              </div>


              
              <ng-template #sinImputacionesSeleccionadas>
                <div class="alert alert-light border mb-0">No hay imputaciones seleccionadas.</div>
              </ng-template>
             
            </div>
           
            
          
          </div>

          <div class="d-flex justify-content-end gap-2 pt-3">
            <button *ngIf="!puedeEditarImputaciones" 
              type="button"
              class="btn btn-outline-primary"
              (click)="guardarImputacionesDelProducto(editandoId)"
              [disabled]="imputacionesGuardando || !editandoId || imputacionesDisponibles.length === 0 || !puedeEditarImputaciones"
            >
              <span *ngIf="imputacionesGuardando" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ imputacionesGuardando ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>  
           
        </div>
     
      
        <div class="form-section" *ngIf="puedeVerMultimedia">
          <div class="form-section-header d-flex justify-content-between align-items-start">
            <h5 class="mb-1"><i class="bi bi-images"></i> Multimedia</h5>
            <p class="text-muted mb-0">Definí la imagen principal y las imágenes alternativas que se muestran en el producto.</p>
             <button type="button" class="btn btn-link p-0" (click)="mostrarMultimedia = !mostrarMultimedia">
              
              <i class="bi" [ngClass]="mostrarMultimedia ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
             </button>
          </div>
          <div class="row g-4 align-items-start" *ngIf="mostrarMultimedia">
            <div class="col-12 col-xl-5">
              <div class="media-panel">
                <div class="media-preview-card">
                  <div class="media-preview-title">Imagen principal</div>
                  <div class="media-tab-switch mb-3">
                    <button type="button" class="media-tab-btn" *ngIf="puedeSubirMultimedia" [class.active]="principalTab === 'upload'" (click)="principalTab = 'upload'">Subir archivo</button>
                    <button type="button" class="media-tab-btn" *ngIf="puedeBuscarWebMultimedia" [class.active]="principalTab === 'search'" (click)="principalTab = 'search'">Buscar web</button>
                  </div>

                  <ng-container *ngIf="principalTab === 'upload' && puedeSubirMultimedia; else principalSearchTab">
                    <input #principalFileInput class="d-none"   type="file" (change)="onImagenPrincipalFileSelected($event)" />
                    <button
                      type="button"
                      class="media-dropzone"
                      [class.drag-active]="imagenPrincipalDragActiva"
                      (click)="principalFileInput.click()"
                      (dragover)="onPrincipalDragOver($event)"
                      (dragleave)="onPrincipalDragLeave($event)"
                      (drop)="onPrincipalDrop($event)"
                    >
                      <span class="media-dropzone-icon"><i class="bi bi-cloud-arrow-up"></i></span>
                      <span class="media-dropzone-title">Arrastrá o elegí el archivo principal</span>
                      <span class="media-dropzone-copy">Acepta imágenes y también otros archivos si el backend lo permite.</span>
                    </button>
                  </ng-container>
                  <ng-template #principalSearchTab>
                    <div class="media-search-box">
                      <div class="row g-2 mb-2" *ngIf="puedeBuscarWebMultimedia">
                        <div class="col-12 col-md-5">
                          <input class="form-control" [(ngModel)]="principalSearchQuery" [ngModelOptions]="{ standalone: true }" placeholder="Buscar imagen del producto o logo de marca" />
                        </div>
                        <div class="col-12 col-md-2">
                          <select class="form-select" [(ngModel)]="principalSearchMode" (ngModelChange)="onPrincipalSearchModeChange($event)" [ngModelOptions]="{ standalone: true }">
                            <option value="product">Producto</option>
                            <option value="logo">Logo</option>
                          </select>
                        </div>
                        <div class="col-12 col-md-3">
                          <select class="form-select" [(ngModel)]="principalSearchProvider" [ngModelOptions]="{ standalone: true }">
                            <option value="brandfetch">Brandfetch</option>
                            <option value="pexels">Pexels</option>
                          </select>
                        </div>
                        <div class="col-12 col-md-2 d-flex justify-content-md-end">
                          <button
                            type="button"
                            class="icon-action-btn icon-action-btn-light media-search-action-btn"
                            (click)="buscarImagenesPrincipalWeb()"
                            [disabled]="principalSearchLoading || !principalSearchQuery.trim()"
                            [attr.title]="principalSearchLoading ? 'Buscando...' : 'Buscar en web'"
                            [attr.aria-label]="principalSearchLoading ? 'Buscando...' : 'Buscar en web'"
                          >
                            <i class="bi bi-search" aria-hidden="true"></i>
                            <span class="visually-hidden">{{ principalSearchLoading ? 'Buscando...' : 'Buscar en web' }}</span>
                          </button>
                        </div>
                      </div>
                     </div>
                    <div class="media-search-summary mt-2" *ngIf="principalSearchHasRun">
                      <span class="media-search-pill">Proveedor: {{ principalSearchProviderUsed }}</span>
                      <span class="media-search-pill">Modo: {{ principalSearchModeUsed }}</span>
                    </div>
                    <div class="media-search-grid mt-3" *ngIf="principalSearchResults.length > 0">
                      <div class="media-search-card" *ngFor="let item of principalSearchResults">
                        <div class="media-search-thumb">
                          <img [src]="item.thumbnailUrl || item.imageUrl" [alt]="item.title || 'Resultado de imagen'" />
                        </div>
                        <div class="media-search-body">
                          <div class="media-search-title">{{ item.title || 'Sin título' }}</div>
                          <div class="media-search-meta">{{ item.source || 'Origen desconocido' }}</div>
                          <div class="media-search-meta" *ngIf="item.license">Licencia: {{ item.license }}</div>
                          <button type="button" class="btn btn-primary btn-sm mt-2" (click)="importarImagenPrincipalDesdeWeb(item)" [disabled]="principalImportLoading || !editandoId">
                            {{ principalImportLoading ? 'Importando...' : 'Usar esta' }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="media-empty-state mt-3" *ngIf="principalSearchHasRun && !principalSearchLoading && principalSearchResults.length === 0">
                      No encontramos imágenes web para esa búsqueda.
                    </div>
                  </ng-template>

                  <div class="media-preview-main" *ngIf="getImagenPrincipalPreview(); else sinImagenPrincipal">
                    <ng-container [ngSwitch]="getMediaKind(getImagenPrincipalPreview())">
                      <img *ngSwitchCase="'image'" [src]="getImagenPrincipalPreview()!" alt="Archivo principal del producto" />
                      <video *ngSwitchCase="'video'" [src]="getImagenPrincipalPreview()!" controls playsinline></video>
                      <div *ngSwitchCase="'pdf'" class="media-file-fallback">
                        <i class="bi bi-file-earmark-pdf"></i>
                        <span>PDF principal cargado</span>
                      </div>
                      <div *ngSwitchDefault class="media-file-fallback">
                        <i class="bi bi-file-earmark"></i>
                        <span>Archivo principal cargado</span>
                      </div>
                    </ng-container>
                  </div>
                  <ng-template #sinImagenPrincipal>
                    <div class="media-preview-empty">Sin archivo principal</div>
                  </ng-template>

                  <div class="d-flex flex-wrap gap-2 mt-3">
                    <button *ngIf="puedeSubirMultimedia" type="button" class="btn btn-outline-primary btn-sm" (click)="subirImagenPrincipalSeleccionada()" [disabled]="!imagenPrincipalFile || multimediaGuardando">
                      Subir principal
                    </button>
                    <button *ngIf="puedeSubirMultimedia" type="button" class="btn btn-outline-secondary btn-sm" (click)="limpiarArchivoPrincipalSeleccionado()" [disabled]="!imagenPrincipalFile && !formulario.controls.imagen.value">
                      Limpiar selección
                    </button>
                  </div>

                  <div class="mt-3">
                    <label class="form-label">URL principal actual</label>
                    <input class="form-control" formControlName="imagen" placeholder="/media/archivo-principal.png" readonly />
                    <small class="text-muted">La URL amigable se actualiza automáticamente al subir o importar desde web.</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-12 col-xl-7">
              <div class="media-panel">
                <div class="media-preview-card">
                  <div class="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
                    <div>
                      <div class="media-preview-title mb-1">Galería alternativa</div>
                      <div *ngIf="puedeSubirMultimedia && puedeBuscarWebMultimedia" >
                        <small class="text-muted">Subí archivos o buscá en web e importá directamente a la galería.</small>
                      </div>
                      <div *ngIf="puedeSubirMultimedia && !puedeBuscarWebMultimedia" >
                        <small class="text-muted">Subí archivos e importá directamente a la galería.</small>
                      </div>
                     
                    </div>
                    <button *ngIf="puedeSubirMultimedia" type="button" class="btn btn-outline-primary btn-sm" (click)="subirGaleriaPendiente()" [disabled]="galeriaPendiente.length === 0 || multimediaGuardando || galeriaImportLoading">
                      Subir cola
                    </button>
                  </div>

                  <div class="media-tab-switch mb-3">
                    <button  *ngIf="puedeSubirMultimedia"  type="button" class="media-tab-btn" [class.active]="galeriaTab === 'upload'" (click)="galeriaTab = 'upload'">Subir archivo</button>
                    <button *ngIf="puedeBuscarWebMultimedia" type="button" class="media-tab-btn" [class.active]="galeriaTab === 'search'" (click)="galeriaTab = 'search'">Buscar web</button>
                  </div>

                  <ng-container *ngIf="puedeSubirMultimedia && galeriaTab === 'upload'; else galeriaSearchTab">
                    <input #galeriaFileInput class="d-none" type="file" multiple (change)="onGaleriaFilesSelected($event)" />
                    <button
                      type="button"
                      class="media-dropzone media-dropzone-gallery"
                      [class.drag-active]="galeriaDragActiva"
                      (click)="galeriaFileInput.click()"
                      (dragover)="onGaleriaDragOver($event)"
                      (dragleave)="onGaleriaDragLeave($event)"
                      (drop)="onGaleriaDrop($event)"
                    >
                      <span class="media-dropzone-icon"><i class="bi bi-collection-play"></i></span>
                      <span class="media-dropzone-title">Soltá acá imágenes, videos, PDF u otros archivos</span>
                      <span class="media-dropzone-copy">El orden visual de esta cola define el campo orden que se enviará al backend.</span>
                    </button>
                  </ng-container>
                  <ng-template #galeriaSearchTab  >
                    <div *ngIf="puedeBuscarWebMultimedia" class="row g-2 align-items-end mb-3">
                      <div class="col-12 col-md-3">
                        <label class="form-label">Buscar en web</label>
                        <input class="form-control" [(ngModel)]="galeriaSearchQuery" [ngModelOptions]="{ standalone: true }" placeholder="Buscar imágenes del producto" />
                      </div>
                      <div class="col-12 col-md-2">
                        <label class="form-label">Modo</label>
                        <select class="form-select" [(ngModel)]="galeriaSearchMode" (ngModelChange)="onGaleriaSearchModeChange($event)" [ngModelOptions]="{ standalone: true }">
                          <option value="product">Producto</option>
                          <option value="logo">Logo</option>
                        </select>
                      </div>
                      <div class="col-12 col-md-3">
                        <label class="form-label">Proveedor</label>
                        <select class="form-select" [(ngModel)]="galeriaSearchProvider" [ngModelOptions]="{ standalone: true }">
                          <option value="brandfetch">Brandfetch</option>
                          <option value="pexels">Pexels</option>
                        </select>
                      </div>
                      <div class="col-12 col-md-2">
                        <label class="form-label">Tipo</label>
                        <select class="form-select" [(ngModel)]="galeriaUrlMediaId" [ngModelOptions]="{ standalone: true }">
                          <option *ngFor="let option of mediaCatalogOptions" [ngValue]="option.id">{{ option.nombre }}</option>
                        </select>
                      </div>
                      <div class="col-12 col-md-2 d-flex justify-content-md-end">
                        <button
                          type="button"
                          class="icon-action-btn icon-action-btn-light media-search-action-btn"
                          (click)="buscarImagenesGaleriaWeb()"
                          [disabled]="galeriaSearchLoading || !galeriaSearchQuery.trim()"
                          [attr.title]="galeriaSearchLoading ? 'Buscando...' : 'Buscar en web'"
                          [attr.aria-label]="galeriaSearchLoading ? 'Buscando...' : 'Buscar en web'"
                        >
                          <i class="bi bi-search" aria-hidden="true"></i>
                          <span class="visually-hidden">{{ galeriaSearchLoading ? 'Buscando...' : 'Buscar en web' }}</span>
                        </button>
                      </div>
                    </div>
                    <div class="row g-2 mb-3" *ngIf="puedeBuscarWebMultimedia">
                      <div class="col-12 col-md-8">
                        <label class="form-label">Descripción</label>
                        <input class="form-control" [(ngModel)]="galeriaUrlDescripcion" [ngModelOptions]="{ standalone: true }" placeholder="Vista lateral, packaging, ficha técnica" />
                      </div>
                      <div class="col-12 col-md-4">
                        <label class="form-label">Orden</label>
                        <input type="number" class="form-control" [(ngModel)]="galeriaUrlOrden" [ngModelOptions]="{ standalone: true }" />
                      </div>
                    </div>
                    <div *ngIf="puedeBuscarWebMultimedia && galeriaSearchHasRun" class="media-search-summary mb-3">
                      <span class="media-search-pill">Proveedor: {{ galeriaSearchProviderUsed }}</span>
                      <span class="media-search-pill">Modo: {{ galeriaSearchModeUsed }}</span>
                    </div>
                    <div *ngIf="puedeBuscarWebMultimedia && galeriaSearchResults.length > 0" class="media-search-grid">
                      <div class="media-search-card" *ngFor="let item of galeriaSearchResults">
                        <div class="media-search-thumb">
                          <img [src]="item.thumbnailUrl || item.imageUrl" [alt]="item.title || 'Resultado de imagen'" />
                        </div>
                        <div class="media-search-body">
                          <div class="media-search-title">{{ item.title || 'Sin título' }}</div>
                          <div class="media-search-meta">{{ item.source || 'Origen desconocido' }}</div>
                          <div class="media-search-meta" *ngIf="item.license">Licencia: {{ item.license }}</div>
                          <button type="button" class="btn btn-primary btn-sm mt-2" (click)="importarGaleriaDesdeWeb(item)" [disabled]="galeriaImportLoading || !editandoId">
                            {{ galeriaImportLoading ? 'Importando...' : 'Agregar a galería' }}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div class="media-empty-state mt-3" *ngIf="galeriaSearchHasRun && !galeriaSearchLoading && galeriaSearchResults.length === 0">
                      No encontramos imágenes web para agregar a la galería.
                    </div>
                  </ng-template>

                  <div class="mt-3" *ngIf="galeriaPendiente.length > 0">
                    <div class="media-preview-title mb-2">Cola pendiente</div>
                    <div cdkDropList [cdkDropListData]="galeriaPendiente" class="media-sortable-list" (cdkDropListDropped)="onDropGaleriaPendiente($event)">
                      <div class="gallery-item-card" *ngFor="let item of galeriaPendiente; let index = index" cdkDrag>
                        <div class="gallery-item-preview">
                          <ng-container [ngSwitch]="getMediaKind(item.previewUrl, item.mediaId)">
                            <img *ngSwitchCase="'image'" [src]="item.previewUrl" alt="Archivo pendiente" />
                            <video *ngSwitchCase="'video'" [src]="item.previewUrl" controls playsinline></video>
                            <div *ngSwitchCase="'pdf'" class="media-file-fallback media-file-fallback-sm">
                              <i class="bi bi-file-earmark-pdf"></i>
                              <span>{{ item.file.name }}</span>
                            </div>
                            <div *ngSwitchDefault class="media-file-fallback media-file-fallback-sm">
                              <i class="bi bi-file-earmark"></i>
                              <span>{{ item.file.name }}</span>
                            </div>
                          </ng-container>
                        </div>
                        <div class="gallery-item-fields">
                          <div class="gallery-item-handle" cdkDragHandle title="Arrastrar para reordenar">
                            <i class="bi bi-grip-vertical"></i>
                          </div>
                          <div class="row g-2">
                            <div class="col-12 col-md-5">
                              <label class="form-label">Tipo de media</label>
                              <select class="form-select" [(ngModel)]="item.mediaId" [ngModelOptions]="{ standalone: true }">
                                <option *ngFor="let option of mediaCatalogOptions" [ngValue]="option.id">{{ option.nombre }}</option>
                              </select>
                            </div>
                            <div class="col-12 col-md-4">
                              <label class="form-label">Orden</label>
                              <input type="number" class="form-control" [(ngModel)]="item.orden" [ngModelOptions]="{ standalone: true }" />
                            </div>
                            <div class="col-12 col-md-3 d-flex align-items-end justify-content-end">
                              <button type="button" class="btn btn-outline-danger btn-sm" (click)="quitarMediaPendiente(item.localId)">
                                Quitar
                              </button>
                            </div>
                            <div class="col-12">
                              <label class="form-label">Descripción</label>
                              <input class="form-control" [(ngModel)]="item.descripcion" [ngModelOptions]="{ standalone: true }" placeholder="Vista lateral, ficha técnica, demo, etc." />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="mt-3" *ngIf="productoMediaItems.length > 0">
                    <div class="media-preview-title mb-2">Galería actual</div>
                    <div cdkDropList [cdkDropListData]="productoMediaItems" class="media-sortable-list" (cdkDropListDropped)="onDropGaleriaActual($event)">
                      <div class="gallery-item-card" *ngFor="let item of productoMediaItems" cdkDrag>
                        <div class="gallery-item-preview">
                          <ng-container [ngSwitch]="getMediaKind(item.url, item.mediaId ?? item.media?.id)">
                            <img *ngSwitchCase="'image'" [src]="resolveMediaUrl(item.url)!" alt="Media del producto" />
                            <video *ngSwitchCase="'video'" [src]="resolveMediaUrl(item.url)!" controls playsinline></video>
                            <div *ngSwitchCase="'pdf'" class="media-file-fallback media-file-fallback-sm">
                              <i class="bi bi-file-earmark-pdf"></i>
                              <a [href]="resolveMediaUrl(item.url)!" target="_blank" rel="noreferrer">Abrir PDF</a>
                            </div>
                            <div *ngSwitchDefault class="media-file-fallback media-file-fallback-sm">
                              <i class="bi bi-file-earmark"></i>
                              <a [href]="resolveMediaUrl(item.url)!" target="_blank" rel="noreferrer">Abrir archivo</a>
                            </div>
                          </ng-container>
                        </div>
                        <div class="gallery-item-fields">
                          <div class="gallery-item-handle" *ngIf="puedeEditarMultimedia" cdkDragHandle title="Arrastrar para reordenar">
                            <i class="bi bi-grip-vertical"></i>
                          </div>
                          <div class="row g-2">
                            <div class="col-12 col-md-5">
                              <label class="form-label">Tipo de media</label>
                              <select [disabled]="!puedeEditarMultimedia"  class="form-select" [(ngModel)]="item.mediaId" [ngModelOptions]="{ standalone: true }">
                                <option *ngFor="let option of mediaCatalogOptions" [ngValue]="option.id">{{ option.nombre }}</option>
                              </select>
                            </div>
                            <div class="col-12 col-md-3">
                              <label class="form-label">Orden</label>
                              <input [disabled]="!puedeEditarMultimedia" type="number" class="form-control" [(ngModel)]="item.orden" [ngModelOptions]="{ standalone: true }" />
                            </div>
                            <div class="col-12 col-md-4 d-flex align-items-end justify-content-end gap-2" *ngIf="puedeEditarMultimedia">
                              <button type="button" class="btn btn-outline-primary btn-sm" (click)="guardarMediaExistente(item)" [disabled]="multimediaGuardando">
                                Guardar
                              </button>
                              <button type="button" class="btn btn-outline-danger btn-sm" *ngIf="puedeBorrarMultimedia" (click)="eliminarMediaExistente(item)" [disabled]="multimediaGuardando">
                                Eliminar
                              </button>
                            </div>
                            <div class="col-12">
                              <label class="form-label">Descripción</label>
                              <input [disabled]="!puedeEditarMultimedia" class="form-control"  [(ngModel)]="item.descripcion" [ngModelOptions]="{ standalone: true }" placeholder="Descripción opcional" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        <!-- Overlay de loading -->
     <div *ngIf="cargando" class="listado-loading-overlay" aria-live="polite" aria-busy="true">
       <div class="listado-loading-box">
        <div class="spinner-border text-success" role="status" aria-hidden="true"></div>
        <div class="listado-loading-message">Cargando precios...</div>
      </div>
     </div>
  
        <!-- DARIO: LISTAS DE PRECIOS Y PRECIO  //--> 
        
        <div class="form-section" >
         
          <div class="form-section-header d-flex justify-content-between align-items-start">
            <h5 class="mb-1"><i class="bi bi-cash-coin"></i> Precio asociado</h5>
            <p class="text-muted mb-0">Configurá la lista y los datos del precio administrativo del producto.</p> 
            <button type="button" class="btn btn-link p-0" (click)="mostrarPrecio = !mostrarPrecio">
              <i class="bi" [ngClass]="mostrarPrecio ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
             </button>
           
           
          </div>
<div *ngIf="precioProductoCant === 0" class="alert alert-warning mt-2">
            <div class="d-flex justify-content-between align-items-end gap-2">
  <span class="badge bg-warning text-dark" style="font-size: 0.85rem; padding: 0.4em 0.8em;">
    <i class="bi bi-exclamation-triangle"></i> Lista de Precios sin precio asociado
  </span>
</div>
<p class="text-muted mt-1 mb-0" style="font-size: 0.75rem;">
  <i>Recuerde que el precio de venta es obligatorio para poder publicar el artículo en los canales de venta.</i>
</p>
</div>



          <div class="row g-3" *ngIf="mostrarPrecio">
            <div class="col-12 col-md-4">
              <label class="form-label">Lista de precios</label>
              
              <select class="form-select" formControlName="listaPrecioId" (change)="onListaPrecioChange()">

                <option [ngValue]="null">Sin lista</option>
                <option *ngFor="let lista of listasPrecios" [ngValue]="lista.id">{{ lista.nombre }}</option>
              </select>
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Precio Venta</label>
              <input style="color: green; font-weight: bold; text-align:right;" type="number" class="form-control" formControlName="precio" />
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Precio Compra</label>
              <input style="color: #1E90FF; font-weight: bold; text-align:right;" type="number" class="form-control" formControlName="precio_compra" (change)="onRecalculaMargen()" />
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Margen</label>
              <input style="color:#FF9800 ; font-weight: bold; text-align:right;" type="number" class="form-control" formControlName="margen" />
            </div>
            <div class="col-12 col-md-2">
              <label class="form-label">Moneda</label>
              <select class="form-select" formControlName="monedaId">
                <option [ngValue]="null">Sin moneda</option>
                <option *ngFor="let moneda of monedas" [ngValue]="moneda.id">
                  {{ moneda.codigoISO }}
                </option>
              </select>
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label">Vigencia desde</label>
              <input type="date" class="form-control" formControlName="vigenciaDesde" />
            </div>
            <div class="col-12 col-md-4">
              <label class="form-label">Vigencia hasta</label>
              <input type="date" class="form-control" formControlName="vigenciaHasta" />
            </div>
           <div class="col-12 col-md-4">
            <label class="form-label">Canal</label>
                 

  <select class="form-select" formControlName="canal" [disabled]="true">
    <option *ngFor="let canal of canales" [ngValue]="canal.id">
      {{ canal.nombre }} ({{ canal.descripcion }})
    </option>
  </select>

           
         
          </div>
            <div class="col-12">
              <label class="form-label">Observaciones de precio</label>
              <textarea class="form-control" rows="2" formControlName="observacionesPrecio"></textarea>
            </div>
          </div>
          
<!-- LISTADO DE PRECIOS DEFINIDOS -->


<div class="row g-3" style="margin-top: 1.5rem; font-size: 0.875rem;" *ngIf="preciosProductos.length > 0 && puedeVerListaDePrecios && mostrarPrecio">
  <h6 class="fw-bold">
    <i class="bi bi-tags"></i> Precios definidos a este producto
  </h6>
  <table class="table table-sm table-striped table-bordered align-middle">
    <thead class="table-light">
      <tr>
        <th><i class="bi bi-tag-fill"></i> Lista de Precios</th>
        <th><i class="bi bi-globe"></i> Canal</th>
        <th class="text-end">Precio Venta</th>
        <th class="text-end">Precio Compra</th>
        <th class="text-end"> <i class="bi bi-graph-up"></i> Margen</th>
        <th class="text-center">Moneda</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let precio of preciosProductos">
        <td><i class="bi bi-tag"></i> {{ precio?.listaNombre }}</td>
        <td>{{ precio.canal.nombre }}</td>
        <td class="text-success fw-bold text-end">
          {{ precio.precio | currency:precio.moneda.codigoISO }} 
        </td>
        <td class="text-primary fw-bold text-end">
          {{ precio.precioCompra | currency:precio.moneda.codigoISO }}
        </td>
        <td class="text-warning fw-bold text-end">
          {{ precio.margen | number:'1.2-2' }}
        </td>
        <td class="text-center">{{ precio.moneda }}</td>
        <td class="text-center" > 
          <i  class="bi bi-trash ms-2" *ngIf="puedeBorrarListaDePrecios" data-bs-toggle="modal" [attr.data-bs-target]="'#deleteModal'" (click)="precioProductoEditandoId = precio.id"></i>
        </td>
      </tr>
    </tbody>
  </table>
</div>



        </div>







<!-- Prouductos relacionados -->
<div class="form-section relacionados-panel" *ngIf="puedeEditarRelacionados || relacionadosSeleccionados.length > 0">
  <div class="form-section-header d-flex justify-content-between align-items-start gap-3 flex-wrap">
    <div>
      <h5 class="mb-1"><i class="bi bi-link-45deg"></i> Productos relacionados</h5>
      <p class="text-muted mb-0">Relacioná este artículo con otros para mostrar sugerencias cruzadas en la tienda.</p>
    </div>
    <div class="d-flex align-items-center gap-2">
      <span class="badge bg-light text-dark border">{{ relacionadosSeleccionados.length }} seleccionados</span>
      <button type="button" class="btn btn-link p-0" (click)="mostrarRelacionados = !mostrarRelacionados">
        <i class="bi" [ngClass]="mostrarRelacionados ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </button>
    </div>
  </div>

  <div *ngIf="mostrarRelacionados">

    <!-- Chips seleccionados -->
    <div *ngIf="relacionadosSeleccionados.length > 0" class="mb-3">
      <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
        <span class="fw-semibold text-dark small">Seleccionados</span>
        <span class="text-muted small">Se sincronizan al guardar el artículo</span>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <span class="badge rounded-pill bg-primary text-white d-flex align-items-center gap-1 px-3 py-2"
          *ngFor="let rel of relacionadosSeleccionados; trackBy: trackByRelacionado">
          <img *ngIf="rel.imagen" [src]="resolveMediaUrl(rel.imagen)" [alt]="rel.nombre"
            style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />
          {{ rel.nombre }}
          <button *ngIf="puedeEditarRelacionados" type="button" class="btn-close btn-close-white ms-1"
            style="font-size:0.6rem;" (click)="quitarRelacionado(rel)" aria-label="Quitar"></button>
        </span>
      </div>
    </div>

    <!-- Buscador -->
    <div *ngIf="puedeEditarRelacionados" class="mb-3">
      <div class="input-group">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input class="form-control" type="search"
          [(ngModel)]="relacionadosBusqueda"
          [ngModelOptions]="{ standalone: true }"
          (keyup.enter)="buscarRelacionados()"
          placeholder="Buscar por nombre o código" />
        <button type="button" class="btn btn-outline-primary"
          (click)="buscarRelacionados()"
          [disabled]="relacionadosBuscando || !relacionadosBusqueda.trim()">
          {{ relacionadosBuscando ? 'Buscando...' : 'Buscar' }}
        </button>
        <button type="button" class="btn btn-outline-secondary"
          (click)="limpiarBusquedaRelacionados()">
          Limpiar
        </button>
      </div>
      <small class="text-muted">Tip: buscá complementarios, variantes o reemplazos para sugerir al cliente.</small>
    </div>

    <!-- Resultados -->
    <div *ngIf="puedeEditarRelacionados">
      <div *ngIf="relacionadosBuscando" class="alert alert-info mb-0 py-2">Buscando productos...</div>
      <div *ngIf="!relacionadosBuscando && relacionadosBuscado && relacionadosResultados.length === 0"
        class="alert alert-light border mb-0">
        No encontramos coincidencias. Probá con otro nombre o código.
      </div>

      <div *ngIf="relacionadosResultados.length > 0" class="row g-2 mt-1">
        <div class="col-12 col-sm-6 col-lg-4" *ngFor="let res of relacionadosResultados; trackBy: trackByRelacionado">
          <div class="card h-100 border shadow-none" [class.border-primary]="estaSeleccionadoRelacionado(res)">
            <div class="card-body p-2 d-flex align-items-center gap-2">
              <img *ngIf="res.imagen" [src]="resolveMediaUrl(res.imagen)" [alt]="res.nombre"
                style="width:48px;height:48px;object-fit:cover;border-radius:0.5rem;flex-shrink:0;" />
              <div class="flex-grow-1 overflow-hidden">
                <div class="fw-semibold text-truncate small">{{ res.nombre }}</div>
                <div class="text-muted" style="font-size:0.75rem;">{{ res.marca?.nombre || res.marca }}</div>
              </div>
              <button *ngIf="!estaSeleccionadoRelacionado(res)"
                type="button" class="btn btn-sm btn-outline-primary flex-shrink-0"
                (click)="agregarRelacionado(res)">
                <i class="bi bi-plus-lg"></i>
              </button>
              <button *ngIf="estaSeleccionadoRelacionado(res)"
                type="button" class="btn btn-sm btn-primary flex-shrink-0"
                (click)="quitarRelacionado(res)">
                <i class="bi bi-check-lg"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Botón guardar relacionados -->

      <div *ngIf="relacionadosTotalPaginas > 1" class="mt-3 d-flex justify-content-center">
        <nav aria-label="Paginación relacionados">
          <ul class="pagination pagination-sm mb-0">
            <li class="page-item" [class.disabled]="relacionadosPaginaActual === 1">
              <button class="page-link" type="button" (click)="cambiarPaginaRelacionados(relacionadosPaginaActual - 1)" [disabled]="relacionadosPaginaActual === 1">Anterior</button>
            </li>
            <li class="page-item" *ngFor="let p of relacionadosPages" [class.active]="p === relacionadosPaginaActual">
              <button class="page-link" type="button" (click)="cambiarPaginaRelacionados(p)">{{ p }}</button>
            </li>
            <li class="page-item" [class.disabled]="relacionadosPaginaActual === relacionadosTotalPaginas">
              <button class="page-link" type="button" (click)="cambiarPaginaRelacionados(relacionadosPaginaActual + 1)" [disabled]="relacionadosPaginaActual === relacionadosTotalPaginas">Siguiente</button>
            </li>
          </ul>
        </nav>
      </div>

  </div>
</div>
<!-- fin productos relacionados -->



<br>
    <br><br>    


        <div class="col-12 d-flex justify-content-end gap-2 pt-2">
          <button class="btn btn-outline-secondary" type="button" (click)="cancelar()">Salir</button>
          <button *ngIf="puedeBorrarArticulos && editandoId"  [disabled]="guardando || !puedeBorrarArticulos" class="btn btn-danger" type="button" data-bs-toggle="modal" [attr.data-bs-target]="'#deleteProductoModal'">
      Eliminar 
    </button>

          <!-- Botón para edición: misma lógica que antes, no se modifica -->
          <button *ngIf="puedeEditarArticulos && editandoId" class="btn btn-primary" type="submit" [disabled]="guardando || !puedeEditarArticulos">
            {{ guardando ? 'Guardando...' : 'Actualizar' }}
          </button>

          <!-- Botón para creación manual: solo visible si NO estamos editando y el usuario puede crear -->
          <button *ngIf="!editandoId && puedeCrearArticulos" class="btn btn-primary" type="submit" [disabled]="guardando || !puedeCrearArticulos">
            {{ guardando ? 'Guardando...' : 'Guardar producto' }}
          </button>
        </div>
      </form>
    </div>





















































  </div>
</section>
  `,
  styles: [
    `
.articulos-manual .eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.82);
}

.articulos-manual .hero-panel {
  padding: 1.5rem;
  border-radius: 1.25rem;
  background: var(--gradient-global);
  color: #141414;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  box-shadow: 0 1rem 2rem rgba(15, 23, 42, 0.18);
}

.articulos-manual .hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.articulos-manual .icon-action-btn {
  width: 3rem;
  height: 3rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.articulos-manual .icon-action-btn:hover,
.articulos-manual .icon-action-btn:focus-visible {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.28);
  box-shadow: 0 0.75rem 1.5rem rgba(15, 23, 42, 0.16);
  outline: none;
}

.articulos-manual .icon-action-btn-light {
  background: rgba(15, 23, 42, 0.16);
}

.articulos-manual .icon-action-btn i {
  font-size: 1.1rem;
}

.articulos-manual .section-kicker {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
}

.articulos-manual-card {
  border: 0;
  border-radius: 1rem;
}

.articulos-manual-form {
  display: grid;
  gap: 1.25rem;
}

.form-section {
  padding: 1.15rem;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.form-section-header {
  margin-bottom: 1rem;
}

.form-section-header h5 {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
}

.articulos-manual .form-label {
  font-weight: 600;
  color: #334155;
}

.articulos-manual .form-control,
.articulos-manual .form-select {
  font-size: 0.82rem;
  border-radius: 0.75rem;
  border-color: #cbd5e1;
}

.articulos-manual .form-control:focus,
.articulos-manual .form-select:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 0.2rem rgba(34, 197, 94, 0.12);
}

.media-preview-card {
  padding: 1rem;
  border: 1px solid #dbeafe;
  border-radius: 1rem;
  background: #eff6ff;
}

.media-preview-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #1d4ed8;
  margin-bottom: 0.75rem;
}
.media-preview-main {
  aspect-ratio: 4 / 3;
  border-radius: 0.9rem;
  overflow: hidden;
  background: #dbeafe;
  margin-bottom: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-preview-main img,
.media-preview-main video,
.media-preview-thumb img,
.media-preview-thumb video {
  display: block;
}

.media-preview-main img,
.media-preview-main video {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}

.media-preview-main img,
.media-preview-main video {
  object-fit: contain;
  background: #dbeafe;
}

.media-preview-thumb img,
.media-preview-thumb video {
  width: 100%;
  height: 100%;
}

.media-preview-thumb img,
.media-preview-thumb video {
  object-fit: cover;
}

.media-preview-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 0.65rem;
}

.media-preview-thumb {
  aspect-ratio: 1;
  border-radius: 0.8rem;
  overflow: hidden;
  background: #dbeafe;
}

.media-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  font-weight: 600;
  text-align: center;
  padding: 1rem;
}

.media-preview-empty-sm {
  min-height: 72px;
  margin-top: 0.75rem;
}

.media-panel {
  display: grid;
  gap: 1rem;
}

.media-tab-switch {
  display: inline-flex;
  gap: 0.45rem;
  padding: 0.25rem;
  border-radius: 999px;
  background: rgba(219, 234, 254, 0.7);
}

.media-tab-btn {
  border: 0;
  background: transparent;
  color: #1e3a8a;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.84rem;
}

.media-tab-btn.active {
  background: #ffffff;
  box-shadow: 0 0.35rem 0.8rem rgba(15, 23, 42, 0.1);
}

.media-search-box {
  display: grid;
  gap: 0.35rem;
}

.media-search-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.85rem;
}

.media-search-card {
  border: 1px solid #dbeafe;
  border-radius: 0.95rem;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.86);
}

.media-search-thumb {
  aspect-ratio: 4 / 3;
  background: #dbeafe;
}

.media-search-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.media-search-body {
  padding: 0.8rem;
}

.media-search-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 0.86rem;
  line-height: 1.3;
  margin-bottom: 0.25rem;
}

.media-search-meta {
  color: #64748b;
  font-size: 0.78rem;
}

.media-search-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.media-search-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.76rem;
  font-weight: 700;
}

.media-search-action-btn {
  width: 2.1rem;
  height: 2.1rem;
}

.media-search-action-btn i {
  font-size: 0.82rem;
}

.media-empty-state {
  border: 1px dashed #bfdbfe;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.72);
  color: #64748b;
  text-align: center;
  padding: 1rem;
  font-weight: 600;
}

.media-dropzone {
  width: 100%;
  border: 1px dashed #93c5fd;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.74);
  color: #0f172a;
  padding: 1.1rem;
  display: grid;
  gap: 0.35rem;
  text-align: center;
  transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
}

.media-dropzone.drag-active {
  border-color: #2563eb;
  background: #dbeafe;
  transform: translateY(-1px);
}

.media-dropzone-icon {
  font-size: 1.35rem;
  color: #2563eb;
}

.media-dropzone-title {
  font-weight: 700;
}

.media-dropzone-copy {
  color: #64748b;
  font-size: 0.83rem;
}

.media-dropzone-gallery {
  min-height: 132px;
  align-content: center;
}

.media-sortable-list {
  display: grid;
  gap: 0.85rem;
}

.gallery-item-card {
  display: grid;
  grid-template-columns: minmax(120px, 150px) 1fr;
  gap: 0.9rem;
  border: 1px solid #dbeafe;
  border-radius: 0.95rem;
  background: rgba(255, 255, 255, 0.8);
  padding: 0.85rem;
}

.gallery-item-preview {
  min-height: 122px;
  border-radius: 0.85rem;
  overflow: hidden;
  background: #dbeafe;
}

.gallery-item-preview img,
.gallery-item-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-item-fields {
  display: grid;
  gap: 0.65rem;
}

.gallery-item-handle {
  justify-self: end;
  color: #64748b;
  cursor: grab;
}

.gallery-item-handle:active {
  cursor: grabbing;
}

.media-file-fallback {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: #1e3a8a;
  text-align: center;
  padding: 1rem;
}

.media-file-fallback i {
  font-size: 1.5rem;
}

.media-file-fallback-sm {
  min-height: 122px;
}

.media-file-fallback a {
  color: #1d4ed8;
  font-weight: 600;
  text-decoration: none;
}

.media-url-card {
  border-top: 1px solid rgba(148, 163, 184, 0.28);
  padding-top: 1rem;
}

@media (max-width: 991.98px) {
  .gallery-item-card {
    grid-template-columns: 1fr;
  }
}

.categoria-autocomplete {
  position: relative;
}

.categoria-autocomplete-input {
  padding-right: 2.4rem;
}

.categoria-limpiar-btn {
  border: 0;
  background: transparent;
  color: #64748b;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
}

.categoria-limpiar-btn-inline {
  position: absolute;
  top: 2.1rem;
  right: 0.45rem;
  transform: translateY(-50%);
}

.categoria-sugerencias {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  right: 0;
  z-index: 5;
  display: grid;
  gap: 0.35rem;
  max-height: 14rem;
  overflow-y: auto;
  padding: 0.55rem;
  border: 1px solid #dbeafe;
  border-radius: 0.9rem;
  background: #ffffff;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.categoria-sugerencia-item {
  border: 0;
  background: #f8fafc;
  color: #0f172a;
  text-align: left;
  border-radius: 0.75rem;
  padding: 0.55rem 0.7rem;
  font-size: 0.84rem;
}

.categoria-sugerencia-item.active,
.categoria-sugerencia-item:hover {
  background: #dbeafe;
}

.categoria-sin-resultados {
  margin-top: 0.45rem;
  color: #64748b;
  font-size: 0.82rem;
}
    `
  ]
})
export class ArticulosManualFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly apiAdmin = inject(ApiAdminService);
  private readonly permisosService = inject(PermisosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly selectedAppStorageKey = 'selectedAppId';
  readonly modeloOptions = ['Frasco', 'Botella', 'Paquete', 'Caja', 'Lata', 'Bolsa', 'Pote', 'Tetra', 'Bidon', 'Blister', 'Sobre', 'Sachet'];
  readonly unidadMedidaOptions = ['Lt', 'Kg', 'Gr', 'Ml', 'Un', 'Cm', 'M'];
  readonly mediaCatalogOptions: MediaCatalogOption[] = [
    { id: 1, nombre: 'Imagen', accept: 'image/*' },
    { id: 2, nombre: 'Video', accept: 'video/*' },
    { id: 3, nombre: 'PDF', accept: 'application/pdf' },
    { id: 4, nombre: 'Documento', accept: '.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' },
    { id: 5, nombre: 'Archivo', accept: '*/*' }
  ];
  //constructor(private dialog: MatDialog) { }
  cargando = false;
  mostrarInfo = true;
  mostrarStock = false;
  mostrarCaract = false
  mostrarImpuestos = false
  mostrarMultimedia = false
  mostrarPrecio = false
  precioAsoc = false
  guardando = false;
  eliminando = false;
  precioProductoCant = 0;
  multimediaGuardando = false;
  error = '';
  mensaje = '';
  categorias: any[] = [];
  monedas: any[] = [];
  canales: any[] = [];
  precioPorProducto: PrecioProducto | null = null;
  categoriasFiltro: CategoriaFiltroOption[] = [];
  marcas: MarcaAdminOption[] = [];
  preciosProductos: PreciosPorProductos[] = [];
  listasPrecios: ListaPrecio[] = [];
  appIdActual = 1;
  editandoId: number | null = null;
  editandoPrecioId: number | null = null;
  precioProductoEditandoId: number | null = null;
  precioCompraEditandoId: number | null = null;
  margenEditandoId: number | null = null;
  categoriaBusqueda = '';
  imagenPrincipalFile: File | null = null;
  imagenPrincipalPreviewLocal = '';
  imagenPrincipalOriginal = '';
  imagenPrincipalDragActiva = false;
  principalTab: MultimediaTab = 'upload';
  principalSearchQuery = '';
  principalSearchMode: MediaSearchMode = 'product';
  principalSearchProvider: MediaSearchProvider = 'pexels';
  principalSearchLoading = false;
  principalImportLoading = false;
  principalSearchHasRun = false;
  principalSearchProviderUsed = 'brandfetch';
  principalSearchModeUsed: MediaSearchMode = 'product';
  principalSearchResults: MediaSearchItem[] = [];
  galeriaDragActiva = false;
  galeriaTab: MultimediaTab = 'upload';
  galeriaSearchQuery = '';
  galeriaSearchMode: MediaSearchMode = 'product';
  galeriaSearchProvider: MediaSearchProvider = 'pexels';
  galeriaSearchLoading = false;
  galeriaImportLoading = false;
  galeriaSearchHasRun = false;
  galeriaSearchProviderUsed = 'brandfetch';
  galeriaSearchModeUsed: MediaSearchMode = 'product';
  galeriaSearchResults: MediaSearchItem[] = [];
  productoMediaItems: ProductoMedia[] = [];
  galeriaPendiente: PendingProductoMediaUpload[] = [];
  galeriaUrl = '';
  galeriaUrlDescripcion = '';
  galeriaUrlOrden: number | null = null;
  galeriaUrlMediaId = 1;
  caracteristicas: ProductoCaracteristicaDraft[] = [];
  nuevaCaracteristicaNombre = '';
  nuevaCaracteristicaValor = '';
  nuevaCaracteristicaOrden: number | null = null;
  imputacionesDisponibles: ModeloImputacionAdminOption[] = [];
  imputacionesSeleccionadasIds: number[] = [];
  imputacionesCargando = false;
  imputacionesGuardando = false;
  imputacionesMensaje = '';
  imputacionesError = '';
  /*
  
  Permisos 
  falta aplicar a la vista html 
  */
  get puedeEditarImputaciones(): boolean {
    return this.permisosService.tienePermiso('imputa') && this.permisosService.tienePermiso('imputa_editar');
  }


  // articulos
  get puedeEditarArticulos(): boolean {
    return this.permisosService.tienePermiso('articulos') && this.permisosService.tienePermiso('articulos_editar');
  }
  get puedeCrearArticulos(): boolean {
    return this.permisosService.tienePermiso('articulos') && this.permisosService.tienePermiso('articulos_crear');
  }
  get puedeBorrarArticulos(): boolean {
    return this.permisosService.tienePermiso('articulos') && this.permisosService.tienePermiso('articulos_borrar');
  }
  // lista de precios
  get puedeVerListaDePrecios(): boolean {
    return this.permisosService.tienePermiso('lista_precios') && this.permisosService.tienePermiso('lista_precios_ver');
  }
  get puedeCrearListaDePrecios(): boolean {
    return this.permisosService.tienePermiso('lista_precios') && this.permisosService.tienePermiso('lista_precios_crear');
  }
  get puedeEditarListaDePrecios(): boolean {
    return this.permisosService.tienePermiso('lista_precios') && this.permisosService.tienePermiso('lista_precios_editar');
  }
  get puedeAsignarListaDePrecios(): boolean {
    return this.permisosService.tienePermiso('lista_precios') && this.permisosService.tienePermiso('lista_precios_asignar');
  }
  get puedeBorrarListaDePrecios(): boolean {
    return this.permisosService.tienePermiso('lista_precios') && this.permisosService.tienePermiso('lista_precios_borrar');
  }

  // caracteristicas
  get puedeVerCaracteristicas(): boolean {
    return this.permisosService.tienePermiso('caracteristicas') && this.permisosService.tienePermiso('caracteristica_ver');
  }
  get puedeEditarCaracteristicas(): boolean {
    return this.permisosService.tienePermiso('caracteristicas') && this.permisosService.tienePermiso('caracteristica_editar');
  }
  get puedeCrearCaracteristicas(): boolean {
    return this.permisosService.tienePermiso('caracteristicas') && this.permisosService.tienePermiso('caracteristica_crear');
  }
  get puedeBorrarCaracteristicas(): boolean {
    return this.permisosService.tienePermiso('caracteristicas') && this.permisosService.tienePermiso('caracteristica_borrar');
  }
  // multimedia
  get puedeVerMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_ver');
  }
  get puedeEditarMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_editar');
  }
  get puedeCrearMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_crear');
  }
  get puedeBorrarMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_borrar');
  }
  get puedeBuscarWebMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_buscar_web');
  }
  get puedeSubirMultimedia(): boolean {
    return this.permisosService.tienePermiso('multimedia') && this.permisosService.tienePermiso('multimedia_subir');
  }




  /* Fin Permisos */



  formulario = this.fb.group({
    nombre: ['', [Validators.required]],
    descripcion: [''],
    estado: [true],
    baja: [false],
    modelo: [''],
    unidadMedida: [''],
    contenidoNeto: [null as number | null],
    codigoBarra: [''],
    codigoInterno: [''],
    marcaId: [null as number | string | null],
    imagen: [''],
    imagenUrl: [''],
    imagenesAlternativas: [''],
    stock: [0, [Validators.required, Validators.min(0)]],
    categoriaId: [null as number | null],
    listaPrecioId: [null as number | null],
    precio: [null as number | null],
    precio_compra: [null as number | null],
    margen: [null as number | null],
    monedaId: [{ value: null as number | null, disabled: true }],
    vigenciaDesde: [''],
    vigenciaHasta: [''],
    observacionesPrecio: [''],
    canal: [{ value: null as number | null, disabled: true }]

  });

  async ngOnInit(): Promise<void> {
    this.cargando = true;
    try {
      this.appIdActual = this.getSelectedAppId();
      const id = Number(this.route.snapshot.paramMap.get('id'));
      this.editandoId = id;
      const [categorias, monedas, canales, marcas, listasPrecios, preciosProductos, imputacionesDisponibles] = await Promise.all([
        firstValueFrom(this.apiAdmin.getCategorias()),
        firstValueFrom(this.apiAdmin.getMonedas(this.appIdActual)),
        firstValueFrom(this.apiAdmin.getCanales(this.appIdActual)),
        firstValueFrom(this.apiAdmin.getMarcas(this.appIdActual)),
        firstValueFrom(this.apiAdmin.getListasPrecios(this.appIdActual)),
        firstValueFrom(this.apiAdmin.getPreciosProducto(this.appIdActual, this.editandoId ?? 0)),
        firstValueFrom(this.apiAdmin.getModeloImputaciones({ appId: this.appIdActual, aplica: 'items' })).catch(() => [])




      ]);

      this.categorias = categorias || [];
      this.monedas = monedas || [];
      this.canales = canales || [];
      this.preciosProductos = preciosProductos || [];
      this.imputacionesDisponibles = this.normalizarImputacionesDisponibles(imputacionesDisponibles || []);
      this.categoriasFiltro = this.aplanarCategorias(this.categorias);
      this.marcas = (marcas || []).filter((marca) => marca?.activa !== false);
      this.listasPrecios = (listasPrecios || []).filter((lista) => !!lista?.id);


      if (Number.isFinite(id) && id > 0) {

        const producto = await firstValueFrom(this.apiAdmin.getProducto(id));

        if (producto.precioConfig?.id > 0) {
          this.precioProductoCant = 1;
          this.editandoPrecioId = producto.precioConfig.id;
          this.precioProductoEditandoId = producto.precioConfig.id;
          this.precioCompraEditandoId = producto.precioConfig.id;
          this.margenEditandoId = producto.precioConfig.id;
        }
        this.cargarProductoEnFormulario(producto);
        await this.cargarCaracteristicasDelProducto(id);
        await this.cargarImputacionesDelProducto(id);
        await this.cargarRelacionados(id);
      }
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos cargar la pantalla de carga manual.';
    } finally {
      this.cargando = false;
    }
  }
  cargarPrecios(): void {

    this.apiAdmin.getPreciosProducto(this.appIdActual, this.editandoId ?? 0).subscribe({
      next: (data) => {
        this.preciosProductos = data;
      },
      error: (err) => {
        console.error('Error al cargar precios', err);
      }
    });
  }



  cancelar(): void {
    void this.router.navigate(['/admin/articulos']);
  }

  getTituloHero(): string {
    const nombre = this.formulario.controls.nombre.value?.trim();
    if (this.editandoId && nombre) {
      return nombre;
    }

    return this.editandoId ? 'Editar artículo' : 'Carga manual de artículo';
  }

  limpiar(): void {
    this.editandoId = null;
    this.precioProductoEditandoId = null;
    this.precioCompraEditandoId = null;
    this.margenEditandoId = null;
    this.imagenPrincipalFile = null;
    this.imagenPrincipalPreviewLocal = '';
    this.imagenPrincipalOriginal = '';
    this.principalTab = 'upload';
    this.principalSearchQuery = '';
    this.principalSearchMode = 'product';
    this.principalSearchProvider = 'pexels';
    this.principalSearchHasRun = false;
    this.principalSearchProviderUsed = 'brandfetch';
    this.principalSearchModeUsed = 'product';
    this.principalSearchResults = [];
    this.productoMediaItems = [];
    this.galeriaPendiente = [];
    this.galeriaTab = 'upload';
    this.galeriaSearchQuery = '';
    this.galeriaSearchMode = 'product';
    this.galeriaSearchProvider = 'pexels';
    this.galeriaSearchHasRun = false;
    this.galeriaSearchProviderUsed = 'brandfetch';
    this.galeriaSearchModeUsed = 'product';
    this.galeriaSearchResults = [];
    this.galeriaUrl = '';
    this.galeriaUrlDescripcion = '';
    this.galeriaUrlOrden = null;
    this.galeriaUrlMediaId = 1;
    this.caracteristicas = [];
    this.nuevaCaracteristicaNombre = '';
    this.nuevaCaracteristicaValor = '';
    this.nuevaCaracteristicaOrden = null;
    this.imputacionesSeleccionadasIds = [];
    this.imputacionesMensaje = '';
    this.imputacionesError = '';
    this.formulario.reset({
      nombre: '',
      descripcion: '',
      estado: true,
      baja: false,
      modelo: '',
      unidadMedida: '',
      contenidoNeto: null,
      codigoBarra: '',
      codigoInterno: '',
      marcaId: null,
      imagen: '',
      imagenUrl: '',
      imagenesAlternativas: '',
      stock: 0,
      categoriaId: null,
      listaPrecioId: null,
      precio: null,
      monedaId: null,
      vigenciaDesde: '',
      vigenciaHasta: '',
      observacionesPrecio: '',
      canal: null

    });
  }

  async guardar(): Promise<void> {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const raw = this.formulario.value;

    const marcaId = raw.marcaId ?? null;

    const marcaSeleccionada = this.marcas.find((marca) => String(marca.id) === String(marcaId ?? ''));

    const listaPrecioId = this.normalizarIdNumerico(raw.listaPrecioId);
    const precio = this.normalizarNumero(raw.precio) ?? 0;
    const precioCompra = this.normalizarNumero(raw.precio_compra) ?? 0;
    const margen = this.normalizarNumero(raw.margen) ?? 0;

    if ((listaPrecioId && precio == null) || (!listaPrecioId && precio != null)) {
      this.error = 'Para guardar precio tenés que completar lista de precios y precio.';
      this.mensaje = '';
      return;
    }

    const empresaStorage = localStorage.getItem('empresa');
    let empresaIdFromStorage: number | null = null;
    try {
      const parsedEmpresa = empresaStorage ? JSON.parse(empresaStorage) : null;
      empresaIdFromStorage = parsedEmpresa?.id ?? null;
    } catch {}

    const payload = {
      nombre: raw.nombre ?? '',
      descripcion: raw.descripcion ?? '',
      estado: raw.estado === false ? false : true,
      baja: raw.baja === true ? true : false,
      modelo: this.normalizarTextoOpcional(raw.modelo),
      unidadMedida: this.normalizarTextoOpcional(raw.unidadMedida),
      unidad_medida: this.normalizarTextoOpcional(raw.unidadMedida),
      contenidoNeto: this.normalizarContenidoNeto(raw.contenidoNeto),
      contenido_neto: this.normalizarContenidoNeto(raw.contenidoNeto),
      imagen: this.normalizarTextoOpcional(raw.imagen),
      imagen_url: this.normalizarTextoOpcional(raw.imagenUrl),
      codigoBarra: raw.codigoBarra ?? '',
      codigoInterno: raw.codigoInterno ?? '',
      codigo_barra: raw.codigoBarra ?? '',
      codigo_interno: raw.codigoInterno ?? '',
      marcaId: marcaId,
      idMarca: marcaId,
      marca: marcaSeleccionada?.nombre ?? '',
      stock: Number(raw.stock ?? 0),
      categoriaId: raw.categoriaId ?? null,
      rubroId: raw.categoriaId ?? null,
      subcategoriaId: raw.categoriaId ?? null,
      productoCaracteristica: this.construirPayloadCaracteristicas()
    } as any;

    // Asegurar que el producto se asocie a la app/empresa seleccionada
    try {
      payload.appId = Number(this.appIdActual) || undefined;
      if (empresaIdFromStorage) payload.empresaId = Number(empresaIdFromStorage);
    } catch {}
    console.log('Payload a guardar:', payload);

    this.guardando = true;
    this.error = '';
    this.mensaje = '';

    try {
      let productoId = this.editandoId;
      if (this.editandoId) {
        await firstValueFrom(this.apiAdmin.editarProducto(this.editandoId, payload));
        productoId = this.editandoId;
      } else {
        const productoCreado = await firstValueFrom(this.apiAdmin.crearProducto(payload));
        productoId = Number(productoCreado?.id ?? productoCreado?.producto?.id ?? productoCreado?.data?.id ?? 0) || null;
      }

      if (productoId && listaPrecioId && precio != null) {
        await this.guardarPrecioAsociado(productoId, this.construirPayloadPrecioAsociado(productoId, listaPrecioId, precio, precioCompra, margen, raw));
      }

      if (productoId) {
        await this.persistirMultimediaPendiente(productoId);
        await this.guardarCaracteristicasDelProducto(productoId);
        await this.guardarImputacionesDelProducto(productoId);
        await this.guardarRelacionados();
      }

      this.mensaje = this.editandoId ? 'Artículo actualizado correctamente.' : 'Artículo creado correctamente.';

      this.formulario.markAsPristine();
      this.formulario.markAsUntouched();

      setTimeout(() => void this.router.navigate(['/admin/articulos']), 500);
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos guardar el artículo.';
    } finally {
      this.guardando = false;
    }
  }

  private cargarProductoEnFormulario(producto: Producto): void {
    const precioAsociado = this.getPrecioEditable(producto);
    this.precioProductoEditandoId = this.extraerPrecioProductoId(precioAsociado);
    this.sincronizarCaracteristicasProducto(producto);

    this.formulario.patchValue({
      nombre: producto.nombre ?? '',
      descripcion: producto.descripcion ?? '',
      estado: producto.activo ? true : false,
      baja: producto.baja ? true : false,
      modelo: producto.modelo ?? '',
      unidadMedida: producto.unidad_medida ?? (producto as any).unidadMedida ?? '',
      contenidoNeto: this.normalizarNumero(producto.contenido_neto ?? (producto as any).contenidoNeto),
      imagen: this.getImagenPrincipalProducto(producto),
      imagenUrl: (producto as any)?.imagen_url ?? (producto as any)?.imagenUrl ?? '',
      imagenesAlternativas: this.getImagenesAlternativasTexto(producto),
      codigoBarra: (producto as any).codigoBarra ?? producto.codigo_barra ?? '',
      codigoInterno: (producto as any).codigoInterno ?? (producto as any).codigo_interno ?? '',
      marcaId: this.getMarcaEditableId(producto),
      stock: Number(producto.stock ?? 0),
      categoriaId: this.getCategoriaEditableId(producto),
      listaPrecioId:
        (precioAsociado as any)?.listaPrecioId ??
        precioAsociado?.listaPrecio?.id ??
        (producto as any)?.precioConfig?.listaPrecioId ??
        (producto as any)?.listaPrecioId ??
        producto.listaPrecio?.id ??
        null,

      precio: this.normalizarNumero(
        (precioAsociado as any)?.precio ??
        (producto as any)?.precioConfig?.precio ??
        producto.precio ??
        producto.precioLista
      ),
      precio_compra: this.normalizarNumero(
        (precioAsociado as any)?.precioCompra ??
        (producto as any)?.precioConfig?.precioCompra ??
        producto.precioCompra
      ),
      margen: this.normalizarNumero(
        (precioAsociado as any)?.margen ??
        (producto as any)?.precioConfig?.margen ??
        producto.margen
      ),

      monedaId: Number(
        (precioAsociado as any)?.monedaId ??
        (producto as any)?.precioConfig?.monedaId ??
        (producto as any)?.monedaId ??
        1
      ),



      vigenciaDesde: precioAsociado?.vigenciaDesde ??
        producto.precioConfig?.vigenciaDesde ??
        '',

      vigenciaHasta: precioAsociado?.vigenciaHasta ??
        producto.precioConfig?.vigenciaHasta ??
        '',
      observacionesPrecio: precioAsociado?.observacionesPrecio ??
        producto.precioConfig?.observacionesPrecio ?? '',

      canal: precioAsociado?.canal?.id ??
        producto.precioConfig?.canal?.id ??
        null

    });

    this.sincronizarMultimediaProducto(producto);
    const categoriaSeleccionada = this.getCategoriaSeleccionadaForm();
    this.categoriaBusqueda = categoriaSeleccionada?.ruta || '';
  }

  agregarCaracteristica(): void {
    const nombre = this.normalizarTextoOpcional(this.nuevaCaracteristicaNombre) ?? '';
    const valor = this.normalizarTextoOpcional(this.nuevaCaracteristicaValor) ?? '';
    const orden = this.normalizarNumero(this.nuevaCaracteristicaOrden) ?? this.getSiguienteOrdenCaracteristica();

    if (!nombre || !valor) {
      this.error = 'Completá nombre y valor para agregar la característica.';
      this.mensaje = '';
      return;
    }

    this.caracteristicas = [
      ...this.caracteristicas,
      { nombre, valor, orden }
    ];
    this.nuevaCaracteristicaNombre = '';
    this.nuevaCaracteristicaValor = '';
    this.nuevaCaracteristicaOrden = null;
    this.error = '';
  }

  eliminarCaracteristica(index: number): void {
    if (index < 0 || index >= this.caracteristicas.length) {
      return;
    }

    this.caracteristicas = this.caracteristicas.filter((_, currentIndex) => currentIndex !== index);
  }

  trackByCaracteristica(index: number, item: ProductoCaracteristicaDraft): number | string {
    return item.id ?? index;
  }

  private async guardarPrecioAsociado(productoId: number, payload: PrecioProductoAdminPayload): Promise<void> {
    if (this.editandoId && this.precioProductoEditandoId) {
      try {
        await firstValueFrom(this.apiAdmin.actualizarPrecioProducto(this.precioProductoEditandoId, payload));
        return;
      } catch (err: any) {
        if (!this.puedeCrearPrecioComoFallback(err)) {
          throw err;
        }
      }
    }

    const response = await firstValueFrom(this.apiAdmin.crearPrecioProducto(payload));
    this.precioProductoEditandoId = this.extraerPrecioProductoId(response) ?? this.precioProductoEditandoId;
  }

  private getPrecioEditable(producto: Producto): any | null {
    const precios = Array.isArray(producto?.precioConfig) ? producto.precioConfig : [];
    const listaPrecioIdActual =
      (producto as any)?.listaPrecioId ??
      producto.listaPrecio?.id ??
      null;

    if (listaPrecioIdActual != null) {
      const precioAsociado = precios.find((precio: any) => {
        const listaPrecioId =
          precio?.listaPrecio?.id ??
          precio?.listaPrecioId ??
          precio?.lista_precio_id ??
          null;
        return Number(listaPrecioId) === Number(listaPrecioIdActual);
      });

      if (precioAsociado) {
        return precioAsociado;
      }
    }

    return precios[0] ?? null;
  }

  private extraerPrecioProductoId(value: any): number | null {
    const id = Number(
      value?.id ??
      value?.precioProductoId ??
      value?.precio_producto_id ??
      value?.data?.id ??
      value?.precio?.id
    );
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private puedeCrearPrecioComoFallback(err: any): boolean {
    const status = Number(err?.status ?? err?.error?.status ?? 0);
    return status === 404 || status === 405;
  }

  private construirPayloadPrecioAsociado(productoId: number, listaPrecioId: number, precio: number, precioCompra: number, margen: number, raw: any): PrecioProductoAdminPayload {
    return {
      productoId,
      producto: { id: productoId },
      producto_id: productoId,
      listaPrecioId,
      listaPrecio: { id: listaPrecioId },
      lista_precio_id: listaPrecioId,
      precio,
      precioCompra,
      margen,
      moneda: this.normalizarMonedaId(raw.monedaId),
      vigenciaDesde: this.normalizarTextoOpcional(raw.vigenciaDesde),
      vigenciaHasta: this.normalizarTextoOpcional(raw.vigenciaHasta),
      observaciones: this.normalizarTextoOpcional(raw.observacionesPrecio),
      canal: this.normalizarTextoOpcional(raw.canal)
    };
  }

  private construirPayloadCaracteristicas(): Array<{ id?: number; nombre: string; valor: string; orden: number }> {
    return this.caracteristicas
      .map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        nombre: this.normalizarTextoOpcional(item.nombre) ?? '',
        valor: this.normalizarTextoOpcional(item.valor) ?? '',
        orden: this.normalizarNumero(item.orden) ?? this.getSiguienteOrdenCaracteristica()
      }))
      .filter((item) => !!item.nombre && !!item.valor);
  }

  private normalizarImputacionesDisponibles(items: ModeloImputacionAdminOption[]): ModeloImputacionAdminOption[] {
    return (items || [])
      .map((item) => ({
        id: this.normalizarIdNumerico(item?.id ?? item?.modeloImputacionId) ?? undefined,
        nombre: this.normalizarTextoOpcional(item?.nombre) ?? '',
        tipo: this.normalizarTextoOpcional(item?.tipo)
      }))
      .filter((item) => !!item.id && !!item.nombre)
      .filter((item, index, self) => self.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }

  private normalizarImputacionesSeleccionadasIds(value: unknown): number[] {
    const array = Array.isArray(value) ? value : [];
    const ids = array
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }

  private getSiguienteOrdenCaracteristica(): number {
    if (!this.caracteristicas.length) {
      return 1;
    }

    return Math.max(...this.caracteristicas.map((item) => this.normalizarNumero(item.orden) ?? 0)) + 1;
  }

  trackByImputacion(index: number, item: ModeloImputacionAdminOption): number {
    return item.id ?? index;
  }

  getImputacionesSeleccionadasDetalles(): ModeloImputacionAdminOption[] {
    const seleccionadas = this.normalizarImputacionesSeleccionadasIds(this.imputacionesSeleccionadasIds);
    return seleccionadas
      .map((id) => this.imputacionesDisponibles.find((item) => item.id === id))
      .filter((item): item is ModeloImputacionAdminOption => !!item);
  }

  private getMensajeErrorImputaciones(err: any): string {
    const status = Number(err?.status ?? err?.error?.status ?? 0);
    const backendMessage = err?.error?.message || err?.error?.error || err?.message;

    if (status === 400) {
      return backendMessage || 'La selección de imputaciones es inválida. Revisá los ids enviados.';
    }
    if (status === 404) {
      return 'No encontramos el producto o alguna imputación seleccionada.';
    }
    if (status === 500) {
      return backendMessage || 'Hubo un error del servidor al guardar las imputaciones.';
    }

    return backendMessage || 'No pudimos actualizar las imputaciones del producto.';
  }

  private async cargarCaracteristicasDelProducto(productoId: number): Promise<void> {
    try {
      const caracteristicas = await firstValueFrom(this.apiAdmin.getProductoCaracteristicas(productoId));
      this.caracteristicas = Array.isArray(caracteristicas)
        ? caracteristicas
          .map((item: ProductoCaracteristicaAdminItem) => ({
            id: this.normalizarIdNumerico(item?.id),
            nombre: this.normalizarTextoOpcional(item?.nombre) ?? '',
            valor: this.normalizarTextoOpcional(item?.valor) ?? '',
            orden: this.normalizarNumero(item?.orden)
          }))
          .filter((item) => !!item.nombre && !!item.valor)
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        : [];
    } catch {
      this.caracteristicas = [];
    }
  }

  private async cargarImputacionesDelProducto(productoId: number): Promise<void> {
    this.imputacionesError = '';
    try {
      const asignadas = await firstValueFrom(this.apiAdmin.getProductoImputaciones(productoId));
      const opciones = this.normalizarImputacionesDisponibles(asignadas || []);
      this.imputacionesDisponibles = this.mergeImputacionesDisponibles(this.imputacionesDisponibles, opciones);
      this.imputacionesSeleccionadasIds = this.normalizarImputacionesSeleccionadasIds(opciones.map((item) => item.id));
    } catch (err: any) {
      this.imputacionesError = this.getMensajeErrorImputaciones(err);
      this.imputacionesSeleccionadasIds = [];
    }
  }

  async guardarImputacionesDelProducto(productoId?: number | null): Promise<void> {
    if (!this.puedeEditarImputaciones) {
      this.imputacionesError = 'No tenés permisos para modificar imputaciones.';
      this.imputacionesMensaje = '';
      return;
    }

    const targetProductoId = Number(productoId ?? this.editandoId ?? 0);
    if (!Number.isInteger(targetProductoId) || targetProductoId <= 0) {
      this.imputacionesError = 'Primero guardá el artículo para poder asignar imputaciones.';
      this.imputacionesMensaje = '';
      return;
    }

    const imputaciones = this.normalizarImputacionesSeleccionadasIds(this.imputacionesSeleccionadasIds);
    if (imputaciones.length !== this.imputacionesSeleccionadasIds.length) {
      this.imputacionesError = 'La lista de imputaciones debe contener solo ids numéricos válidos.';
      this.imputacionesMensaje = '';
      return;
    }

    this.imputacionesGuardando = true;
    this.imputacionesError = '';
    this.imputacionesMensaje = '';

    try {
      await firstValueFrom(this.apiAdmin.guardarProductoImputaciones(targetProductoId, imputaciones));
      this.imputacionesMensaje = 'Imputaciones actualizadas correctamente.';
      await this.cargarImputacionesDelProducto(targetProductoId);
    } catch (err: any) {
      this.imputacionesError = this.getMensajeErrorImputaciones(err);
      this.imputacionesMensaje = '';
    } finally {
      this.imputacionesGuardando = false;
    }
  }

  private mergeImputacionesDisponibles(
    base: ModeloImputacionAdminOption[],
    extras: ModeloImputacionAdminOption[]
  ): ModeloImputacionAdminOption[] {
    const merged = [...(base || []), ...(extras || [])]
      .filter((item) => !!item?.id && !!item?.nombre)
      .filter((item, index, self) => self.findIndex((candidate) => candidate.id === item.id) === index)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    return merged;
  }

  private async guardarCaracteristicasDelProducto(productoId: number): Promise<void> {
    await firstValueFrom(
      this.apiAdmin.guardarProductoCaracteristicas(productoId, {
        caracteristicas: this.construirPayloadCaracteristicas().sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      })
    );
  }

  private sincronizarCaracteristicasProducto(producto: Producto): void {
    const rawCaracteristicas = (producto as any)?.productoCaracteristica ?? (producto as any)?.caracteristicas ?? [];
    if (!Array.isArray(rawCaracteristicas)) {
      this.caracteristicas = [];
      this.nuevaCaracteristicaNombre = '';
      this.nuevaCaracteristicaValor = '';
      return;
    }

    this.caracteristicas = rawCaracteristicas
      .map((item: any) => ({
        id: this.normalizarIdNumerico(item?.id),
        nombre: this.normalizarTextoOpcional(item?.nombre) ?? '',
        valor: this.normalizarTextoOpcional(item?.valor) ?? '',
        orden: this.normalizarNumero(item?.orden)
      }))
      .filter((item: ProductoCaracteristicaDraft) => !!item.nombre && !!item.valor)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    this.nuevaCaracteristicaNombre = '';
    this.nuevaCaracteristicaValor = '';
    this.nuevaCaracteristicaOrden = null;
  }

  private normalizarMonedaId(valor: unknown): number {
    const texto = String(valor ?? '').trim().toUpperCase();
    if (!texto) {
      return 1;
    }

    const numero = Number(texto);
    if (Number.isFinite(numero) && numero > 0) {
      return numero;
    }

    switch (texto) {
      case 'ARS':
      case 'PESO':
      case 'PESO ARGENTINO':
        return 1;
      case 'USD':
      case 'DOLAR':
      case 'DÓLAR':
        return 2;
      default:
        return 1;
    }
  }

  onImagenPrincipalFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      return;
    }

    this.asignarArchivoPrincipal(file);
    if (input) {
      input.value = '';
    }
  }

  onPrincipalDragOver(event: DragEvent): void {
    event.preventDefault();
    this.imagenPrincipalDragActiva = true;
  }

  onPrincipalDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.imagenPrincipalDragActiva = false;
  }

  onPrincipalDrop(event: DragEvent): void {
    event.preventDefault();
    this.imagenPrincipalDragActiva = false;
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) {
      this.asignarArchivoPrincipal(file);
    }
  }

  async subirImagenPrincipalSeleccionada(): Promise<void> {
    if (!this.imagenPrincipalFile) {
      return;
    }

    if (!this.editandoId) {
      this.mensaje = 'La imagen principal se subirá cuando guardes el artículo por primera vez.';
      this.error = '';
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await this.subirArchivoPrincipal(this.editandoId);
      await this.refrescarMultimedia(this.editandoId);
      this.mensaje = 'Imagen principal subida correctamente.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos subir la imagen principal.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  limpiarArchivoPrincipalSeleccionado(): void {
    this.imagenPrincipalFile = null;
    this.imagenPrincipalPreviewLocal = '';
    if (!this.imagenPrincipalOriginal) {
      this.formulario.patchValue({ imagen: '' });
    }
  }

  async aplicarImagenPrincipalPorUrl(): Promise<void> {
    const imagen = this.normalizarTextoOpcional(this.formulario.controls.imagen.value) ?? null;
    if (!this.editandoId) {
      this.mensaje = imagen
        ? 'La URL principal se aplicará cuando guardes el artículo por primera vez.'
        : 'La imagen principal quedará vacía al guardar el artículo.';
      this.error = '';
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await firstValueFrom(this.apiAdmin.setImagenPrincipal(this.editandoId, imagen));
      this.imagenPrincipalOriginal = imagen ?? '';
      await this.refrescarMultimedia(this.editandoId);
      this.mensaje = 'Imagen principal actualizada correctamente.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos actualizar la imagen principal.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  async buscarImagenesPrincipalWeb(): Promise<void> {
    const query = this.normalizarTextoOpcional(this.principalSearchQuery);
    if (!query) {
      return;
    }

    this.principalSearchHasRun = true;
    this.principalSearchLoading = true;
    this.error = '';
    this.mensaje = '';
    try {
      const response = await firstValueFrom(this.apiAdmin.searchMedia(query, this.principalSearchMode, 12, this.principalSearchProvider));
      this.principalSearchProviderUsed = response?.provider || this.principalSearchProvider;
      this.principalSearchModeUsed = response?.mode || this.principalSearchMode;
      this.principalSearchResults = response?.items || [];
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos buscar imágenes en la web.');
      this.principalSearchResults = [];
    } finally {
      this.principalSearchLoading = false;
    }
  }

  async importarImagenPrincipalDesdeWeb(item: MediaSearchItem): Promise<void> {
    if (!this.editandoId) {
      this.error = 'Primero guardá el artículo para poder importar una imagen web.';
      this.mensaje = '';
      return;
    }

    this.principalImportLoading = true;
    this.error = '';
    this.mensaje = '';
    try {
      const response = await firstValueFrom(this.apiAdmin.importMainImageFromUrl(this.editandoId, item.imageUrl));
      this.formulario.patchValue({ imagen: response.imagen });
      this.imagenPrincipalOriginal = response.imagen;
      await this.refrescarMultimedia(this.editandoId);
      this.mensaje = 'Imagen principal importada correctamente desde web.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos importar la imagen principal desde web.');
    } finally {
      this.principalImportLoading = false;
    }
  }

  onGaleriaFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files || []);
    if (files.length > 0) {
      this.agregarArchivosGaleria(files);
    }

    if (input) {
      input.value = '';
    }
  }

  onGaleriaDragOver(event: DragEvent): void {
    event.preventDefault();
    this.galeriaDragActiva = true;
  }

  onGaleriaDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.galeriaDragActiva = false;
  }

  onGaleriaDrop(event: DragEvent): void {
    event.preventDefault();
    this.galeriaDragActiva = false;
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length > 0) {
      this.agregarArchivosGaleria(files);
    }
  }

  onDropGaleriaPendiente(event: CdkDragDrop<PendingProductoMediaUpload[]>): void {
    moveItemInArray(this.galeriaPendiente, event.previousIndex, event.currentIndex);
    this.reindexarGaleriaPendiente();
  }

  async onDropGaleriaActual(event: CdkDragDrop<ProductoMedia[]>): Promise<void> {
    moveItemInArray(this.productoMediaItems, event.previousIndex, event.currentIndex);
    this.productoMediaItems = this.ordenarProductoMediaItems(
      this.productoMediaItems.map((item, index) => ({ ...item, orden: index + 1 }))
    );

    if (!this.editandoId) {
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      for (const item of this.productoMediaItems) {
        if (!item.id) {
          continue;
        }
        await firstValueFrom(this.apiAdmin.updateProductoMedia(this.editandoId, item.id, {
          url: item.url,
          descripcion: item.descripcion ?? undefined,
          orden: item.orden ?? undefined,
          mediaId: item.mediaId ?? item.media?.id ?? undefined
        }));
      }
      this.mensaje = 'Orden de galería actualizado.';
    } catch (err: any) {
      this.error = err?.error?.message || err?.message || 'No pudimos actualizar el orden de la galería.';
    } finally {
      this.multimediaGuardando = false;
    }
  }

  quitarMediaPendiente(localId: string): void {
    this.galeriaPendiente = this.galeriaPendiente.filter((item) => item.localId !== localId);
    this.reindexarGaleriaPendiente();
  }

  async subirGaleriaPendiente(): Promise<void> {
    if (this.galeriaPendiente.length === 0) {
      return;
    }

    if (!this.editandoId) {
      this.mensaje = 'La galería pendiente se subirá cuando guardes el artículo por primera vez.';
      this.error = '';
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await this.subirGaleriaPendienteInterna(this.editandoId);
      await this.refrescarMultimedia(this.editandoId);
      this.mensaje = 'Galería actualizada correctamente.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos subir la galería.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  async buscarImagenesGaleriaWeb(): Promise<void> {
    const query = this.normalizarTextoOpcional(this.galeriaSearchQuery);
    if (!query) {
      return;
    }

    this.galeriaSearchHasRun = true;
    this.galeriaSearchLoading = true;
    this.error = '';
    this.mensaje = '';
    try {
      const response = await firstValueFrom(this.apiAdmin.searchMedia(query, this.galeriaSearchMode, 12, this.galeriaSearchProvider));
      this.galeriaSearchProviderUsed = response?.provider || this.galeriaSearchProvider;
      this.galeriaSearchModeUsed = response?.mode || this.galeriaSearchMode;
      this.galeriaSearchResults = response?.items || [];
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos buscar imágenes para la galería.');
      this.galeriaSearchResults = [];
    } finally {
      this.galeriaSearchLoading = false;
    }
  }

  async importarGaleriaDesdeWeb(item: MediaSearchItem): Promise<void> {
    if (!this.editandoId) {
      this.error = 'Primero guardá el artículo para poder importar multimedia desde web.';
      this.mensaje = '';
      return;
    }

    if (!this.galeriaUrlMediaId) {
      this.error = 'Seleccioná el tipo de media antes de importar a la galería.';
      this.mensaje = '';
      return;
    }

    this.galeriaImportLoading = true;
    this.error = '';
    this.mensaje = '';
    try {
      const response = await firstValueFrom(this.apiAdmin.importGalleryImageFromUrl(this.editandoId, {
        imageUrl: item.imageUrl,
        mediaId: this.galeriaUrlMediaId,
        descripcion: this.normalizarTextoOpcional(this.galeriaUrlDescripcion),
        orden: this.normalizarNumero(this.galeriaUrlOrden) ?? undefined
      }));
      this.productoMediaItems = this.ordenarProductoMediaItems([...this.productoMediaItems, response.item]);
      this.formulario.patchValue({ imagenesAlternativas: this.productoMediaItems.map((media) => media.url).join('\n') });
      this.galeriaUrlDescripcion = '';
      this.galeriaUrlOrden = null;
      this.mensaje = 'Item importado correctamente a la galería.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos importar la imagen a la galería.');
    } finally {
      this.galeriaImportLoading = false;
    }
  }

  onPrincipalSearchModeChange(mode: MediaSearchMode): void {
    this.principalSearchMode = mode;
    this.principalSearchProvider = this.getDefaultProviderForMode(mode);
  }

  onGaleriaSearchModeChange(mode: MediaSearchMode): void {
    this.galeriaSearchMode = mode;
    this.galeriaSearchProvider = this.getDefaultProviderForMode(mode);
  }

  async crearMediaPorUrl(): Promise<void> {
    const url = this.normalizarTextoOpcional(this.galeriaUrl);
    if (!url) {
      this.error = 'Indicá una URL amigable para agregar a la galería.';
      this.mensaje = '';
      return;
    }

    if (!this.editandoId) {
      this.error = 'Primero guardá el artículo para poder asociar multimedia por URL.';
      this.mensaje = '';
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await firstValueFrom(this.apiAdmin.createProductoMedia(this.editandoId, {
        url,
        descripcion: this.normalizarTextoOpcional(this.galeriaUrlDescripcion),
        orden: this.normalizarNumero(this.galeriaUrlOrden),
        mediaId: this.galeriaUrlMediaId
      }));
      this.galeriaUrl = '';
      this.galeriaUrlDescripcion = '';
      this.galeriaUrlOrden = null;
      this.galeriaUrlMediaId = 1;
      await this.refrescarMultimedia(this.editandoId);
      this.mensaje = 'Item de multimedia agregado correctamente.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos agregar la multimedia por URL.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  async guardarMediaExistente(item: ProductoMedia): Promise<void> {
    if (!this.editandoId || !item.id) {
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await firstValueFrom(this.apiAdmin.updateProductoMedia(this.editandoId, item.id, {
        url: item.url,
        descripcion: item.descripcion ?? undefined,
        orden: this.normalizarNumero(item.orden),
        mediaId: item.mediaId ?? item.media?.id ?? undefined
      }));
      this.mensaje = 'Item de galería actualizado.';
      await this.refrescarMultimedia(this.editandoId);
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos actualizar el item de la galería.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  async eliminarMediaExistente(item: ProductoMedia): Promise<void> {
    if (!this.editandoId || !item.id) {
      return;
    }

    this.multimediaGuardando = true;
    this.error = '';
    try {
      await firstValueFrom(this.apiAdmin.deleteProductoMedia(this.editandoId, item.id));
      this.productoMediaItems = this.productoMediaItems.filter((media) => media.id !== item.id);
      this.formulario.patchValue({ imagenesAlternativas: this.productoMediaItems.map((media) => media.url).join('\n') });
      this.mensaje = 'Item de galería eliminado.';
    } catch (err: any) {
      this.error = this.getMensajeErrorMultimedia(err, 'No pudimos eliminar el item de la galería.');
    } finally {
      this.multimediaGuardando = false;
    }
  }

  getMediaKind(url: string | null | undefined, mediaId?: number | null): 'image' | 'video' | 'pdf' | 'file' {
    const normalized = (url || '').toLowerCase();
    if (mediaId === 2 || /\.(mp4|webm|ogg|mov|m4v)$/i.test(normalized)) {
      return 'video';
    }
    if (mediaId === 3 || normalized.endsWith('.pdf')) {
      return 'pdf';
    }
    if (mediaId === 1 || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(normalized)) {
      return 'image';
    }
    return 'file';
  }

  private async persistirMultimediaPendiente(productoId: number): Promise<void> {
    let refrescar = false;
    const imagenUrl = this.normalizarTextoOpcional(this.formulario.controls.imagen.value) ?? null;
    const imagenOriginal = this.normalizarTextoOpcional(this.imagenPrincipalOriginal) ?? null;

    if (this.imagenPrincipalFile) {
      await this.subirArchivoPrincipal(productoId);
      refrescar = true;
    } else if (imagenUrl !== imagenOriginal) {
      await firstValueFrom(this.apiAdmin.setImagenPrincipal(productoId, imagenUrl));
      this.imagenPrincipalOriginal = imagenUrl ?? '';
      refrescar = true;
    }

    if (this.galeriaPendiente.length > 0) {
      await this.subirGaleriaPendienteInterna(productoId);
      refrescar = true;
    }

    if (refrescar) {
      await this.refrescarMultimedia(productoId);
    }
  }

  private async subirArchivoPrincipal(productoId: number): Promise<void> {
    if (!this.imagenPrincipalFile) {
      return;
    }

    const response = await firstValueFrom(this.apiAdmin.uploadImagenPrincipal(productoId, this.imagenPrincipalFile));
    this.formulario.patchValue({ imagen: response.imagen });
    this.imagenPrincipalOriginal = response.imagen;
    this.imagenPrincipalFile = null;
    this.imagenPrincipalPreviewLocal = '';
  }

  private async subirGaleriaPendienteInterna(productoId: number): Promise<void> {
    const items = [...this.galeriaPendiente].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    for (const item of items) {
      await firstValueFrom(this.apiAdmin.uploadProductoMedia(
        productoId,
        item.file,
        item.mediaId,
        this.normalizarTextoOpcional(item.descripcion),
        this.normalizarNumero(item.orden) ?? undefined
      ));
    }
    this.galeriaPendiente = [];
  }

  private async refrescarMultimedia(productoId: number): Promise<void> {
    const producto = await firstValueFrom(this.apiAdmin.getProducto(productoId));
    this.sincronizarMultimediaProducto(producto);
  }

  private sincronizarMultimediaProducto(producto: Producto): void {
    this.imagenPrincipalOriginal = this.getImagenPrincipalProducto(producto);
    this.imagenPrincipalPreviewLocal = '';
    this.imagenPrincipalFile = null;
    this.productoMediaItems = this.ordenarProductoMediaItems(producto.productoMedia || producto.imagenes || []);
    this.formulario.patchValue({
      imagen: this.imagenPrincipalOriginal,
      imagenUrl: (producto as any)?.imagen_url ?? (producto as any)?.imagenUrl ?? '',
      imagenesAlternativas: this.productoMediaItems.map((item) => item.url).join('\n')
    });
  }

  private agregarArchivosGaleria(files: File[]): void {
    const ordenBase = this.getOrdenBaseGaleria();
    const nuevosItems = files.map((file, index) => ({
      localId: `${Date.now()}-${index}-${file.name}`,
      file,
      mediaId: this.detectarMediaId(file),
      descripcion: '',
      orden: ordenBase + index,
      previewUrl: URL.createObjectURL(file)
    }));

    this.galeriaPendiente = [...this.galeriaPendiente, ...nuevosItems];
    this.reindexarGaleriaPendiente();
  }

  private asignarArchivoPrincipal(file: File): void {
    this.imagenPrincipalFile = file;
    this.imagenPrincipalPreviewLocal = URL.createObjectURL(file);
  }

  private reindexarGaleriaPendiente(): void {
    this.galeriaPendiente = this.galeriaPendiente.map((item, index) => ({
      ...item,
      orden: index + 1
    }));
  }

  private getOrdenBaseGaleria(): number {
    return this.productoMediaItems.length + this.galeriaPendiente.length + 1;
  }

  private detectarMediaId(file: File): number {
    const type = (file.type || '').toLowerCase();
    const nombre = file.name.toLowerCase();
    if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(nombre)) {
      return 1;
    }
    if (type.startsWith('video/') || /\.(mp4|webm|ogg|mov|m4v)$/i.test(nombre)) {
      return 2;
    }
    if (type === 'application/pdf' || nombre.endsWith('.pdf')) {
      return 3;
    }
    return 5;
  }

  private ordenarProductoMediaItems(items: ProductoMedia[]): ProductoMedia[] {
    return [...(items || [])]
      .map((item, index) => ({
        ...item,
        mediaId: item.mediaId ?? item.media?.id ?? undefined,
        orden: this.normalizarNumero(item.orden) ?? index + 1,
        descripcion: item.descripcion ?? null
      }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }

  onCategoriaBusquedaChange(valor: string): void {
    this.categoriaBusqueda = valor;
    const termino = valor.trim();
    if (!termino) {
      this.formulario.patchValue({ categoriaId: null });
      return;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionadaForm();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta !== valor) {
      this.formulario.patchValue({ categoriaId: null });
    }
  }

  getCategoriasFiltradas(): CategoriaFiltroOption[] {
    const termino = this.normalizarTexto(this.categoriaBusqueda);
    if (!termino) {
      return this.categoriasFiltro.slice(0, 80);
    }

    return this.categoriasFiltro
      .filter((categoria) => this.normalizarTexto(categoria.ruta).includes(termino))
      .slice(0, 80);
  }

  seleccionarCategoriaFormulario(categoria: CategoriaFiltroOption): void {
    this.formulario.patchValue({ categoriaId: categoria.id });
    this.categoriaBusqueda = categoria.ruta;
  }

  limpiarCategoriaSeleccionada(): void {
    this.formulario.patchValue({ categoriaId: null });
    this.categoriaBusqueda = '';
  }

  getCategoriaSeleccionadaForm(): CategoriaFiltroOption | undefined {
    return this.categoriasFiltro.find((categoria) => categoria.id === this.formulario.controls.categoriaId.value);
  }

  getMostrarSugerenciasCategoria(): boolean {
    const termino = this.categoriaBusqueda.trim();
    if (!termino) {
      return false;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionadaForm();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta === termino) {
      return false;
    }

    return this.getCategoriasFiltradas().length > 0;
  }

  getSinResultadosCategoria(): boolean {
    const termino = this.categoriaBusqueda.trim();
    if (!termino) {
      return false;
    }

    const categoriaSeleccionada = this.getCategoriaSeleccionadaForm();
    if (categoriaSeleccionada && categoriaSeleccionada.ruta === termino) {
      return false;
    }

    return this.getCategoriasFiltradas().length === 0;
  }

  private getSelectedAppId(): number {
    try {
      const raw = localStorage.getItem(this.selectedAppStorageKey);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    } catch { }

    return 1;
  }

  private normalizarIdNumerico(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }

  private normalizarNumero(valor: unknown): number | null {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
  }

  private normalizarContenidoNeto(valor: unknown): string | undefined {
    const numero = this.normalizarNumero(valor);
    return numero == null ? undefined : String(numero);
  }

  private getDefaultProviderForMode(mode: MediaSearchMode): MediaSearchProvider {
    return mode === 'logo' ? 'brandfetch' : 'pexels';
  }

  private getMensajeErrorMultimedia(err: any, fallback: string): string {
    const status = Number(err?.status ?? err?.error?.status ?? 0);
    const backendMessage = err?.error?.message || err?.error?.error || err?.message;

    if (status === 400) {
      return backendMessage || 'La solicitud es inválida. Revisá los datos o la URL seleccionada.';
    }
    if (status === 403) {
      return 'No tenés permisos para realizar esta acción.';
    }
    if (status === 404) {
      return 'No encontramos el producto o el recurso multimedia solicitado.';
    }
    if (status === 429) {
      return 'Se excedió la cuota de búsqueda de imágenes. Probá de nuevo más tarde.';
    }
    if (status === 500 || status === 502) {
      return backendMessage || 'Hubo un error del servidor o del proveedor de imágenes.';
    }

    return backendMessage || fallback;
  }

  private normalizarTextoOpcional(valor: unknown): string | undefined {
    if (typeof valor !== 'string') {
      return undefined;
    }
    const texto = valor.trim();
    return texto ? texto : undefined;
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private aplanarCategorias(categorias: any[], rutaPadre = ''): CategoriaFiltroOption[] {
    const resultado: CategoriaFiltroOption[] = [];
    for (const categoria of categorias || []) {
      if (!categoria?.id || !categoria?.nombre) {
        continue;
      }
      const ruta = rutaPadre ? `${rutaPadre} > ${categoria.nombre}` : categoria.nombre;
      resultado.push({ id: categoria.id, nombre: categoria.nombre, ruta });
      const subcategorias = this.obtenerSubcategorias(categoria);
      if (subcategorias.length > 0) {
        resultado.push(...this.aplanarCategorias(subcategorias, ruta));
      }
    }
    return resultado;
  }

  private obtenerSubcategorias(categoria: any): any[] {
    const colecciones = [
      categoria?.hijos,
      categoria?.children,
      categoria?.subcategorias,
      categoria?.subCategorias,
      categoria?.categorias
    ];

    for (const coleccion of colecciones) {
      if (Array.isArray(coleccion) && coleccion.length > 0) {
        return coleccion;
      }
    }

    return [];
  }

  private getCategoriaEditableId(producto: Producto): number | null {
    const categoriaId =
      (producto as any)?.categoriaId ??
      (producto as any)?.rubroId ??
      (producto as any)?.subcategoriaId ??
      (producto as any)?.categoria?.id ??
      (producto as any)?.rubro?.id ??
      producto.subcategoria?.id ??
      null;

    if (Number.isFinite(Number(categoriaId)) && Number(categoriaId) > 0) {
      return this.buscarCategoriaPorId(Number(categoriaId))?.id ?? Number(categoriaId);
    }

    return this.buscarCategoriaProducto(producto)?.id ?? null;
  }

  private buscarCategoriaPorId(categoriaId: number | null): CategoriaFiltroOption | undefined {
    if (!categoriaId) {
      return undefined;
    }

    return this.categoriasFiltro.find((categoria) => categoria.id === categoriaId);
  }

  private buscarCategoriaProducto(producto: Producto): CategoriaFiltroOption | undefined {
    const categoriaNombre = this.normalizarTexto(this.getCategoriaNombreProducto(producto));
    if (!categoriaNombre) {
      return undefined;
    }

    return this.categoriasFiltro.find((categoria) => {
      return this.normalizarTexto(categoria.ruta) === categoriaNombre || this.normalizarTexto(categoria.nombre) === categoriaNombre;
    });
  }

  private getCategoriaNombreProducto(producto: Producto): string {
    return (
      producto.subcategoria?.nombre ||
      (producto as any)?.rubro?.nombre ||
      (producto as any)?.categoria?.nombre ||
      (producto as any)?.categoriaNombre ||
      (producto as any)?.nombreCategoria ||
      (producto as any)?.subcategoriaNombre ||
      ''
    ).trim();
  }

  getImagenPrincipalPreview(): string | null {
    if (this.imagenPrincipalPreviewLocal) {
      return this.imagenPrincipalPreviewLocal;
    }

    const imagen = this.normalizarTextoOpcional(this.formulario.get('imagen')?.value);
    const imagenUrl = this.normalizarTextoOpcional(this.formulario.get('imagenUrl')?.value);
    return this.resolveMediaUrl(imagen || imagenUrl || null);
  }

  resolveMediaUrl(url: string | null | undefined): string | null {
    const value = (url || '').trim();
    if (!value) {
      return null;
    }

    if (/^(https?:|blob:|data:)/i.test(value)) {
      return value;
    }

    const baseUrl = (environment.urlMultimedia || environment.apiUrlBackend || '').replace(/\/$/, '');
    if (value.startsWith('/')) {
      return `${baseUrl}${value}`;
    }

    return `${baseUrl}/${value}`;
  }

  getImagenesAlternativasPreview(): string[] {
    const raw = this.formulario.get('imagenesAlternativas')?.value;
    if (typeof raw !== 'string') {
      return [];
    }

    return raw
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => !!item);
  }

  private getImagenPrincipalProducto(producto: Producto): string {
    return (
      producto.imagenPrincipal ||
      producto.imagen ||
      (producto as any)?.imagen_url ||
      (producto as any)?.imagenUrl ||
      ''
    ).trim();
  }

  private getImagenesAlternativasTexto(producto: Producto): string {
    const principal = this.getImagenPrincipalProducto(producto);
    const urls = [
      ...(producto.imagenesRelacionadas || []),
      ...((producto.productoMedia || []).map((media) => media?.url || '')),
      ...((producto.imagenes || []).map((media) => media?.url || ''))
    ]
      .map((url) => (url || '').trim())
      .filter((url) => !!url && url !== principal);

    return Array.from(new Set(urls)).join('\n');
  }

  private getMarcaEditableId(producto: Producto): number | string | null {
    const marcaId =
      (producto as any)?.marca?.id ??
      (producto as any)?.marcaId ??
      (producto as any)?.marca_id ??
      (producto as any)?.idMarca ??
      (producto as any)?.id_marca ??
      null;

    if (marcaId != null && String(marcaId).trim() !== '') {
      return this.marcas.find((marca) => String(marca.id) === String(marcaId))?.id ?? marcaId;
    }

    const marcaNombre = (typeof producto.marca === 'string' ? producto.marca : producto.marca?.nombre || '').trim();
    if (!marcaNombre) {
      return null;
    }

    return this.marcas.find((marca) => marca.nombre.trim().toLowerCase() === marcaNombre.toLowerCase())?.id ?? null;
  }






  onListaPrecioChange(): void {
    const listaPrecioId = this.formulario.value.listaPrecioId;
    if (!listaPrecioId) {
      this.precioProductoCant = 0;
      this.formulario.patchValue({
        precio: null,
        monedaId: null,
        vigenciaDesde: '',
        vigenciaHasta: '',
        observacionesPrecio: '',
        canal: null
      });
      return;
    }

    // ✅ Ejecutar el endpoint y poblar el formulario
    debugger
    this.buscarPrecioPorLista(listaPrecioId);
  }
  onRecalculaMargen(): void {
    const precio = this.normalizarNumero(this.formulario.value.precio) ?? 0;
    const precioCompra = this.normalizarNumero(this.formulario.value.precio_compra) ?? 0;
    const margenCalculado = precio - precioCompra;
    this.formulario.patchValue({ margen: margenCalculado });
  }
  private buscarPrecioPorLista(listaPrecioId: number): void {
    let canalIdSel = 0
    this.listasPrecios.forEach(lp => {

      if (lp.id === listaPrecioId) {
        canalIdSel = lp.canal?.id || 0
      }
    });
    this.apiAdmin.getPrecioProducto(this.appIdActual, listaPrecioId, this.editandoId!)
      .subscribe({
        next: (precioProd) => {
          this.precioProductoCant = 1;

          this.formulario.get('canal')?.disable();
          if (precioProd) {
            this.editandoPrecioId = precioProd.id;
            this.precioProductoEditandoId = precioProd.id;
            this.precioCompraEditandoId = precioProd.id;
            this.margenEditandoId = precioProd.id;
            let margen = 0
            let precomp = 0
            if (precioProd.preciocompra == 0) {
              precomp = 0
            } else {
              precioProd.preciocompra
            }
            if (precioProd.margen == 0) {
              margen = precioProd.precio - precomp;
            }
            this.formulario.patchValue({
              precio: precioProd.precio,
              precio_compra: precioProd.preciocompra,
              margen: precioProd.margen,
              monedaId: precioProd.moneda?.id ?? null,
              vigenciaDesde: precioProd.vigenciadesde ?? '',
              vigenciaHasta: precioProd.vigenciahasta ?? '',
              observacionesPrecio: precioProd.observaciones ?? '',
              canal: precioProd.listaprecio?.canal?.id ?? null
            });
          } else {
            this.formulario.get('canal')?.disable();
            this.precioProductoCant = 0;
            this.editandoPrecioId = 0
            this.precioProductoEditandoId = 0
            this.precioCompraEditandoId = 0
            this.margenEditandoId = 0
            this.formulario.patchValue({
              precio: 0,
              precio_compra: 0,
              margen: 0,
              monedaId: this.monedas.length > 0 ? this.monedas[0].id : null,
              vigenciaDesde: '',
              vigenciaHasta: '',
              observacionesPrecio: '',
              canal: canalIdSel
            });
          }
        },
        error: (err) => {
          console.error('Error al obtener precioProducto', err);
          this.formulario.get('canal')?.disable();
          this.precioProductoCant = 0;
          this.precioProductoCant = 0;
          this.editandoPrecioId = 0
          this.precioProductoEditandoId = 0
          this.precioCompraEditandoId = 0
          this.margenEditandoId = 0
          this.formulario.patchValue({
            precio: 0,
            precio_compra: 0,
            margen: 0,
            monedaId: this.monedas.length > 0 ? this.monedas[0].id : null,
            vigenciaDesde: '',
            vigenciaHasta: '',
            observacionesPrecio: '',
            canal: canalIdSel

          });
        }
      });
  }




  eliminarPrecioProducto(precioProductoId: number): void {



    this.eliminando = true;
    if (!precioProductoId) {
      console.warn('No hay precioProductoId definido');
      return;
    }
    this.apiAdmin.eliminarPrecioProducto(precioProductoId).subscribe({
      next: () => {
        this.eliminando = false;
        this.cargarPrecios();
        this.formulario.reset();
      },
      error: (err) => {
        this.eliminando = false;
        console.error('Error al eliminar precio', err);
      }
    })




  }

  eliminarProducto(productoId: number): void {



    this.eliminando = true;
    if (!productoId) {
      console.warn('No hay producto definido');
      return;
    }
    this.apiAdmin.eliminarProducto(productoId).subscribe({
      next: (resp) => {
        this.eliminando = false;
        this.formulario.markAsPristine();
        this.formulario.markAsUntouched();
        const mensaje = resp.message;
        alert(mensaje);
        setTimeout(() => void this.router.navigate(['/admin/articulos']), 500);
      },
      error: (err) => {
        this.eliminando = false;
        console.error('Error al eliminar el producto', err);
      }
    })




  }
  // ─── Productos relacionados ────────────────────────────────────────────────
  mostrarRelacionados = true;
  relacionadosBusqueda = '';
  relacionadosBuscando = false;
  relacionadosBuscado = false;
  relacionadosGuardando = false;
  relacionadosResultados: any[] = [];
  relacionadosSeleccionados: any[] = [];
  relacionadosMensaje = '';
  relacionadosError = '';
  relacionadosPaginaActual = 1;
  relacionadosTotalPaginas = 1;
  relacionadosPageSize = 20;

  get puedeEditarRelacionados(): boolean {
    return this.permisosService.tienePermiso('articulos') && this.permisosService.tienePermiso('articulos_editar');
  }

  trackByRelacionado(_index: number, item: any): number {
    return item.id ?? item.relacionadoId ?? _index;
  }

  estaSeleccionadoRelacionado(producto: any): boolean {
    const id = producto.id ?? producto.relacionadoId;
    return this.relacionadosSeleccionados.some((r) => (r.id ?? r.relacionadoId) === id);
  }

  agregarRelacionado(producto: any): void {
    const id = producto.id ?? producto.relacionadoId;
    if (id === this.editandoId) { return; }  // no auto-relacionarse
    if (!this.estaSeleccionadoRelacionado(producto)) {
      this.relacionadosSeleccionados = [...this.relacionadosSeleccionados, producto];
    }
  }

  quitarRelacionado(producto: any): void {
    const id = producto.id ?? producto.relacionadoId;
    this.relacionadosSeleccionados = this.relacionadosSeleccionados.filter(
      (r) => (r.id ?? r.relacionadoId) !== id
    );
  }

  buscarRelacionados(): void {
    this.buscarRelacionadosPagina(1);
  }

  buscarRelacionadosPagina(page: number): void {
    const q = this.relacionadosBusqueda.trim();
    if (!q) { return; }
    this.relacionadosBuscando = true;
    this.relacionadosBuscado = false;
    this.relacionadosResultados = [];
    const params: any = { appId: this.appIdActual, nombre: q, page, pageSize: this.relacionadosPageSize, limite: this.relacionadosPageSize };
    this.apiAdmin.getProductos(params).subscribe({
      next: (resp: any) => {
        console.log('buscarRelacionados resp:', resp, 'params:', params);
        let arr: any[] = [];
        if (Array.isArray(resp)) {
          arr = resp;
          this.relacionadosPaginaActual = 1;
          this.relacionadosTotalPaginas = 1;
        } else if (resp && Array.isArray(resp.items)) {
          arr = resp.items;
          this.relacionadosPaginaActual = Number(resp.page ?? page) || 1;
          this.relacionadosPageSize = Number(resp.pageSize ?? this.relacionadosPageSize) || this.relacionadosPageSize;
          this.relacionadosTotalPaginas = Number(resp.totalPages ?? Math.ceil((resp.total || arr.length) / this.relacionadosPageSize)) || 1;
        } else {
          arr = resp?.productos ?? resp?.items ?? [];
          this.relacionadosPaginaActual = Number(page) || 1;
          this.relacionadosTotalPaginas = 1;
        }
        this.relacionadosResultados = (arr || []).filter((p: any) => p.id !== this.editandoId);
        console.log('relacionadosPaginaActual, pageSize, totalPages, resultadosCount', this.relacionadosPaginaActual, this.relacionadosPageSize, this.relacionadosTotalPaginas, this.relacionadosResultados.length);
        this.relacionadosBuscado = true;
        this.relacionadosBuscando = false;
      },
      error: () => {
        this.relacionadosBuscado = true;
        this.relacionadosBuscando = false;
      }
    });
  }

  cambiarPaginaRelacionados(nuevaPagina: number): void {
    if (nuevaPagina < 1 || nuevaPagina > this.relacionadosTotalPaginas || nuevaPagina === this.relacionadosPaginaActual) return;
    this.buscarRelacionadosPagina(nuevaPagina);
  }

  get relacionadosPages(): number[] {
    return Array.from({ length: Math.max(0, this.relacionadosTotalPaginas) }, (_, i) => i + 1);
  }

  limpiarBusquedaRelacionados(): void {
    this.relacionadosBusqueda = '';
    this.relacionadosResultados = [];
    this.relacionadosBuscado = false;
  }

  private async cargarRelacionados(productoId: number): Promise<void> {
    try {
      const data = await firstValueFrom(this.apiAdmin.getProductosRelacionados(productoId));
      this.relacionadosSeleccionados = (data || []).map((r: any) => ({
        id: r.relacionadoId ?? r.id,
        nombre: r.nombre ?? '',
        imagen: r.imagen ?? '',
        marca: r.marca ?? null
      }));
    } catch {
      this.relacionadosSeleccionados = [];
    }
  }

  async guardarRelacionados(): Promise<void> {
    if (!this.editandoId || !this.puedeEditarRelacionados) { return; }
    // Deduplicar y evitar auto-relación
    const ids = Array.from(
      new Set(
        this.relacionadosSeleccionados
          .map((r) => r.id ?? r.relacionadoId)
          .filter((id) => Number.isFinite(id) && id !== this.editandoId)
      )
    ) as number[];
    this.relacionadosGuardando = true;
    this.relacionadosMensaje = '';
    this.relacionadosError = '';
    try {
      await firstValueFrom(this.apiAdmin.syncProductosRelacionados(this.editandoId, ids));
      await this.cargarRelacionados(this.editandoId);
      this.relacionadosMensaje = 'Relacionados guardados correctamente.';
    } catch (err: any) {
      const status = Number(err?.status ?? 0);
      if (status === 403) {
        this.relacionadosError = 'Algunos productos no pertenecen a tu empresa.';
      } else if (status === 404) {
        this.relacionadosError = 'Producto no encontrado.';
      } else {
        this.relacionadosError = err?.error?.message || 'No pudimos guardar los relacionados.';
      }
    } finally {
      this.relacionadosGuardando = false;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Este se conecta al modal
  onDeleteConfirmed() {

    if (this.precioProductoEditandoId) {
      this.eliminarPrecioProducto(this.precioProductoEditandoId);
    }
  }

  onDeleteCancelled() {
    console.log('Acción cancelada');
  }

  onDeleteProductoConfirm() {

    this.eliminarProducto(this.editandoId!);
  }

}
