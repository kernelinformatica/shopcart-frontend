import { Component, Input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-global-loading',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div *ngIf="show" class="global-loading-overlay">
      <div class="global-loading-spinner">
        <mat-spinner diameter="48"></mat-spinner>
        <div *ngIf="message" class="global-loading-message">{{ message }}</div>
      </div>
    </div>
  `,
  styles: [`
    .global-loading-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255,255,255,0.6);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .global-loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .global-loading-message {
      font-size: 1.1em;
      color: #333;
      margin-top: 8px;
    }
  `]
})
export class GlobalLoadingComponent {
  @Input() show = false;
  @Input() message = '';
}
