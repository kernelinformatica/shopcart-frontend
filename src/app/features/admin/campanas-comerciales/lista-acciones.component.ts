import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lista-acciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="action-list">
  <!-- Lista de acciones existentes -->
  <div *ngIf="actions?.length" class="mb-3">
    <h5 class="mb-2">Acciones actuales</h5>
    <ul class="list-group">
      <li *ngFor="let a of actions"  class="list-group-item d-flex justify-content-between align-items-center" style="background: #e6e7e7;">
        <span>
          <strong>{{ a.tipoAccion | titlecase }}</strong> 
          - {{ a.valor }} {{ a.detalle }}
        </span>
          <button class="text-danger" (click)="removeAction(a.id)" style="border: none; background: none; padding: 0;" title="Eliminar acción" appTooltip="Eliminar acción">
           <i class="bi bi-trash"></i>
        </button>

       
      </li>
    </ul>
  </div>

  <!-- Formulario para agregar acción -->
  <h5 class="mt-4">Agregar acción</h5>
  <form class="row g-3">
    <div class="col-md-6">
      <label class="form-label">Tipo</label>
      <select class="form-select" [(ngModel)]="model.tipoAccion" name="tipoAccion">
        <option value="porcentaje">Porcentaje</option>
        <option value="monto_fijo">Monto fijo</option>
        <option value="2x1">2x1</option>
        <option value="3x2">3x2</option>
        <option value="6x3">6x3</option>
        <option value="envio_gratis">Envío gratis</option>
      </select>
    </div>

    <div class="col-md-6">
      <label class="form-label">Valor</label>
      <input type="number" class="form-control" [(ngModel)]="model.valor" name="valor" />
    </div>

    <div class="col-md-6">
      <label class="form-label">Valor extra</label>
      <input type="number" class="form-control" [(ngModel)]="model.valorExtra" name="valorExtra" />
    </div>

    <div class="col-md-6">
      <label class="form-label">Detalle</label>
      <input type="text" class="form-control" [(ngModel)]="model.detalle" name="detalle" />
    </div>

    <div class="col-12 text-end">
      <button type="button" class="btn btn-primary" (click)="addAction()">
        <i class="bi bi-plus-circle"></i> Agregar
      </button>
    </div>
  </form>
</div>

  `
})
export class ListaAccionesComponent {
  @Input() actions: any[] = [];
  @Output() add = new EventEmitter<any>();
  @Output() remove = new EventEmitter<number>();

  model: any = { tipoAccion: 'porcentaje', valor: 0, valorExtra: 0, detalle: '' };

  addAction() {
    this.add.emit({ ...this.model });
    this.model = { tipoAccion: 'porcentaje', valor: 0, valorExtra: 0, detalle: '' };
  }

  removeAction(id: number) { this.remove.emit(id); }
}
