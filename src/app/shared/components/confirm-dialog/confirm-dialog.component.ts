import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
   styleUrls: ['./confirm-dialog.component.scss'],
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent  {
  @Input() modalId = 'confirmDialog'; // id único para el modal
  @Input() title = 'Confirmación';
  @Input() message = '¿Estás seguro de realizar esta acción?';
  @Input() confirmText = 'Aceptar';
  @Input() cancelText = 'Cancelar';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Input() loading = false;
  @Input() preventAutoClose = false;

  onConfirm() {
    this.confirmed.emit();
  }

  onCancel() {
    this.cancelled.emit();
  }
}
