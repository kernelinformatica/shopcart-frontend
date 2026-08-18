import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lista-condiciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="condition-list">
  <!-- Lista de condiciones existentes -->
  <div *ngIf="conditions?.length" class="mb-3">
    <h5 class="mb-2">Condiciones actuales</h5>
    <ul class="list-group">
      <li *ngFor="let c of conditions" class="list-group-item d-flex justify-content-between align-items-center" style="background: #e6e7e7;">
        <span>
          <strong><i class="bi bi-credit-card"></i>  - {{ c.tipoCondicion | titlecase }}</strong> 
          : {{ c.valor }} ({{ c.operador }})
        </span>
        <button (click)="removeCondition(c.id)" style="border: none; background: none; padding: 0;" title="Eliminar condición" appTooltip="Eliminar condición">
          <i class="bi bi-trash btn btn-icon-only text-danger"></i> 
        </button>
      </li>
    </ul>
  </div>

  <!-- Formulario para agregar condición -->
  <h5 class="mt-4">Agregar condición</h5>
  <form class="row g-3">
    <div class="col-md-6">
      <label class="form-label">Tipo</label>
      <select class="form-select" [(ngModel)]="model.tipoCondicion" name="tipoCondicion">
        <option value="cantidad_minima">Cantidad mínima</option>
        <option value="categoria_incluida">Categoría incluida</option>
        <option value="carrito_total_minimo">Carrito total mínimo</option>
      </select>
    </div>

    <div class="col-md-6">
      <label class="form-label">Valor</label>
      <input type="text" class="form-control" [(ngModel)]="model.valor" name="valor" />
    </div>

    <div class="col-md-6">
      <label class="form-label">Operador</label>
      <select class="form-select" [(ngModel)]="model.operador" name="operador">
        <option value="mayor_igual">Mayor o igual</option>
        <option value="igual">Igual</option>
        <option value="menor">Menor</option>
      </select>
    </div>

    <div class="col-12 text-end">
      <button type="button" class="btn btn-primary" (click)="addCondition()">
        <i class="bi bi-plus-circle"></i> Agregar
      </button>
    </div>
  </form>
</div>

  `
})
export class ListaCondicionesComponent {
  @Input() conditions: any[] = [];
  @Output() add = new EventEmitter<any>();
  @Output() remove = new EventEmitter<number>();

  model: any = { tipoCondicion: 'cantidad_minima', valor: '', operador: 'mayor_igual' };

  addCondition() { this.add.emit({ ...this.model }); this.model = { tipoCondicion: 'cantidad_minima', valor: '', operador: 'mayor_igual' }; }
  removeCondition(id: number) { this.remove.emit(id); }
}
