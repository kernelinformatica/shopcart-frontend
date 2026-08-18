import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, ToastMessage } from '../../toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <div
        *ngFor="let toast of toasts; trackBy: trackById"
        class="toast-item toast-{{ toast.type }}"
        [class.toast-exit]="exitIds.has(toast.id)"
        role="alert"
      >
        <div class="toast-icon-wrap">
          <img
            *ngIf="toast.imageUrl"
            [src]="toast.imageUrl"
            class="toast-product-img"
            alt=""
            (error)="onImgError($event)"
          />
          <span *ngIf="!toast.imageUrl" class="toast-type-icon">
            <ng-container [ngSwitch]="toast.type">
              <i *ngSwitchCase="'success'" class="bi bi-check-circle-fill"></i>
              <i *ngSwitchCase="'error'"   class="bi bi-x-circle-fill"></i>
              <i *ngSwitchCase="'warning'" class="bi bi-exclamation-circle-fill"></i>
              <i *ngSwitchDefault          class="bi bi-info-circle-fill"></i>
            </ng-container>
          </span>
        </div>

        <div class="toast-body">
          <span class="toast-title">{{ toast.title }}</span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>

        <button class="toast-close" (click)="dismiss(toast.id)" aria-label="Cerrar">&times;</button>

        <div class="toast-progress">
          <div
            class="toast-progress-bar"
            [style.animation-duration.ms]="toast.duration"
          ></div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./toast.component.scss']
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  exitIds = new Set<number>();
  private sub!: Subscription;

  constructor(
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.toastService.toasts$.subscribe((toast) => {
      this.toasts = [...this.toasts, toast];
      this.cdr.markForCheck();

      setTimeout(() => this.dismiss(toast.id), toast.duration ?? 3500);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: number): void {
    this.exitIds = new Set([...this.exitIds, id]);
    this.cdr.markForCheck();

    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.exitIds.delete(id);
      this.cdr.markForCheck();
    }, 350);
  }

  trackById(_: number, toast: ToastMessage): number {
    return toast.id;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
