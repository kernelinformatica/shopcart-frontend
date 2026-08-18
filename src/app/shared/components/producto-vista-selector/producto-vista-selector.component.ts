import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-producto-vista-selector',
  template: `
    <div class="btn-group btn-group-sm" role="group" aria-label="Selector de vista de productos">
      <button type="button" class="btn btn-outline-secondary" [class.active]="modoVista === 'grande'" (click)="cambiarVista('grande')" title="Vista grande">
        <i class="bi bi-grid-3x3-gap"></i>
      </button>
      <button type="button" class="btn btn-outline-secondary" [class.active]="modoVista === 'compacta'" (click)="cambiarVista('compacta')" title="Vista compacta">
        <i class="bi bi-grid-1x2"></i>
      </button>
      <button *ngIf="mostrarLista !== false" type="button" class="btn btn-outline-secondary" [class.active]="modoVista === 'lista'" (click)="cambiarVista('lista')" title="Vista lista">
        <i class="bi bi-list"></i>
      </button>
    </div>
  `,
  standalone: true,
  imports: [CommonModule],
  styles: []
})
export class ProductoVistaSelectorComponent {
  @Input() modoVista: 'grande' | 'compacta' | 'lista' = 'grande';
  @Input() mostrarLista: boolean = true;
  @Output() modoVistaChange = new EventEmitter<'grande' | 'compacta' | 'lista'>();

  cambiarVista(modo: 'grande' | 'compacta' | 'lista') {
    if (this.modoVista !== modo) {
      this.modoVista = modo;
      this.modoVistaChange.emit(modo);
    }
  }
}
