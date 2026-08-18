import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-editor-apilamiento',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="stacking-editor">
  <form class="row g-3">
    <!-- Checkbox combinable -->
    <div class="col-12 col-md-6 d-flex align-items-center">
      <div class="form-check">
        <input class="form-check-input" type="checkbox" [(ngModel)]="combinable" name="combinable" />
        <label class="form-check-label">Combinable</label>
      </div>
    </div>

    <!-- Prioridad -->
    <div class="col-12 col-md-6">
      <label class="form-label">Prioridad</label>
      <input type="number" class="form-control" [(ngModel)]="prioridad" name="prioridad" />
    </div>

    <!-- Botón aplicar -->
    <div class="col-12 text-end mt-3">
      <button type="button" class="btn btn-primary" (click)="apply()">
        <i class="bi bi-check-circle"></i> Aplicar
      </button>
    </div>
  </form>
</div>

  `
})
export class EditorApilamientoComponent {
  @Input() combinable = false;
  @Input() prioridad = 0;
  @Output() change = new EventEmitter<{ combinable: boolean; prioridad: number }>();

  apply() { this.change.emit({ combinable: this.combinable, prioridad: Number(this.prioridad) }); }
}
