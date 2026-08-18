import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  imageUrl?: string;
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private toastsSubject = new Subject<ToastMessage>();
  readonly toasts$ = this.toastsSubject.asObservable();

  show(
    title: string,
    message: string,
    type: ToastType = 'success',
    options?: { imageUrl?: string; duration?: number }
  ): void {
    this.toastsSubject.next({
      id: ++this.counter,
      type,
      title,
      message,
      imageUrl: options?.imageUrl,
      duration: options?.duration ?? 3500
    });
  }

  success(title: string, message: string, options?: { imageUrl?: string; duration?: number }): void {
    this.show(title, message, 'success', options);
  }

  error(title: string, message: string, options?: { duration?: number }): void {
    this.show(title, message, 'error', options);
  }

  warning(title: string, message: string, options?: { duration?: number }): void {
    this.show(title, message, 'warning', options);
  }

  info(title: string, message: string, options?: { duration?: number }): void {
    this.show(title, message, 'info', options);
  }
}
