import { TrackingTimelineComponent } from '../tracking-timeline/tracking-timeline.component';
import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../../api.service';

@Component({
  selector: 'app-tracking-timeline-wrapper',
  standalone: true,
  imports: [CommonModule, TrackingTimelineComponent],
  template: `
    <ng-container *ngIf="tracking && tracking.historial?.length; else sinTracking">
      <app-tracking-timeline
        [historial]="tracking.historial"
        [estadoActual]="tracking.estado"
      ></app-tracking-timeline>
      <div class="mt-2 small text-muted">
        <div *ngIf="tracking.destino">
          <b>Destino:</b>
          <span *ngIf="tracking.destino.calle">{{ tracking.destino.calle }}</span>
          <span *ngIf="tracking.destino.numero"> {{ tracking.destino.numero }}</span>
        </div>
        <div *ngIf="tracking.opcion">
          <b>Opción de entrega:</b> {{ tracking.opcion?.nombre || '-' }}
        </div>
      </div>
    </ng-container>
    <ng-template #sinTracking>
      <div class="text-muted small">No hay información de seguimiento disponible.</div>
    </ng-template>
  `
})

export class TrackingTimelineWrapperComponent implements OnInit, OnDestroy {
  private pollingInterval: any;
  @Input() trackingCodigo: string | null = null;
  tracking: any = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (this.trackingCodigo) {
      this.fetchTracking();
      this.pollingInterval = setInterval(() => {
        // Si el estado es final, no seguir consultando
        if (this.tracking && this.isFinalState(this.tracking)) {
          clearInterval(this.pollingInterval);
          return;
        }
        this.fetchTracking();
      }, 30000); // 30 segundos
    } else {
      console.warn('[TrackingTimeline] No trackingCodigo recibido');
    }
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private fetchTracking() {
    this.api.getTracking(this.trackingCodigo!).subscribe({
      next: (data: any) => {
        this.tracking = data;
        this.cdr.markForCheck();
      },
      error: () => {
        this.tracking = null;
        this.cdr.markForCheck();
      }
    });
  }

  private isFinalState(tracking: any): boolean {
    // Considera final si el último evento del historial tiene estado.esFinal=true
    if (!tracking?.historial?.length) return false;
    const last = tracking.historial[tracking.historial.length - 1];
    return last?.estado?.esFinal === true;
  }
}
