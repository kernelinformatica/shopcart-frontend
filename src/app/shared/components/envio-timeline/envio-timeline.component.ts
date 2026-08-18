import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Pedido } from '../../../models';

interface TimelineNodo {
  key: 'recibido' | 'preparacion' | 'en_camino' | 'entregado';
  label: string;
  estado: 'completado' | 'activo' | 'pendiente' | 'demorado' | 'cancelado';
  timestamp?: string;
}

/**
 * Línea temporal vertical del estado de envío de un pedido.
 * No depende de Angular Material: usa Bootstrap + Bootstrap Icons.
 */
@Component({
  selector: 'app-envio-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './envio-timeline.component.html',
  styleUrls: ['./envio-timeline.component.scss']
})
export class EnvioTimelineComponent {
  @Input() pedido?: Pedido;

  /** Orden canónico de hitos del envío. */
  private readonly hitos: { key: TimelineNodo['key']; label: string; codigos: string[] }[] = [
    { key: 'recibido', label: 'Pedido recibido', codigos: ['pendiente', 'recibido', 'pendiente_pago'] },
    { key: 'preparacion', label: 'En preparación', codigos: ['pendiente_preparacion', 'preparando', 'en_preparacion', 'en preparación', 'en preparacion'] },
    { key: 'en_camino', label: 'Despachado / En camino', codigos: ['despachado', 'en_camino', 'en camino', 'enviado'] },
    { key: 'entregado', label: 'Entregado', codigos: ['entregado'] }
  ];

  get nodos(): TimelineNodo[] {
    const codigoActual = this.codigoEstadoActual();
    const idxActual = this.indiceHitoActual(codigoActual);
    const cancelado = this.esCancelado(codigoActual);
    const demorado = this.esDemorado();
    const historialMap = this.mapearHistorial();

    return this.hitos.map((h, idx) => {
      let estado: TimelineNodo['estado'] = 'pendiente';
      if (cancelado && idx === idxActual) {
        estado = 'cancelado';
      } else if (idx < idxActual) {
        estado = 'completado';
      } else if (idx === idxActual) {
        estado = demorado ? 'demorado' : 'activo';
      }
      return { key: h.key, label: h.label, estado, timestamp: historialMap[h.key] };
    });
  }

  get camionPosicionPct(): number {
    const cancelado = this.esCancelado(this.codigoEstadoActual());
    if (cancelado) return 0;
    const idx = this.indiceHitoActual(this.codigoEstadoActual());
    const total = this.hitos.length - 1;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, (idx / total) * 100));
  }

  /** Ventana estimada de entrega en texto. */
  get ventanaEntregaTexto(): string | null {
    const env = this.pedido?.pedidoEnvio;
    if (!env) return null;
    const desde = env.horaVentanaDesde;
    const hasta = env.horaVentanaHasta;
    if (desde && hasta) {
      return `Entrega aproximada entre ${this.soloHora(desde)} y ${this.soloHora(hasta)}`;
    }
    if (env.fechaProgramada) {
      return `Programado para ${this.formatearFecha(env.fechaProgramada)}`;
    }
    return null;
  }

  get etiquetaDemorado(): string | null {
    return this.esDemorado() ? 'Pedido demorado' : null;
  }

  // ---- helpers internos ----

  private codigoEstadoActual(): string {
    const env = this.pedido?.pedidoEnvio?.envioEstado;
    const codigo = (env?.codigo ?? env?.descripcion ?? this.pedido?.estado ?? '').toString().toLowerCase().trim();
    return codigo;
  }

  private indiceHitoActual(codigo: string): number {
    if (!codigo) return 0;
    for (let i = this.hitos.length - 1; i >= 0; i--) {
      if (this.hitos[i].codigos.some(c => codigo === c || codigo.includes(c))) {
        return i;
      }
    }
    return 0;
  }

  private esCancelado(codigo: string): boolean {
    return codigo.includes('cancel') || codigo.includes('rechaz');
  }

  private esDemorado(): boolean {
    const env = this.pedido?.pedidoEnvio;
    if (!env) return false;
    if ((env as any).demorado === true) return true;
    const esFinal = !!env.envioEstado?.esFinal;
    if (esFinal) return false;
    const fp = env.fechaProgramada ? Date.parse(env.fechaProgramada) : NaN;
    if (!Number.isFinite(fp)) return false;
    return fp < Date.now();
  }

  private mapearHistorial(): Partial<Record<TimelineNodo['key'], string>> {
    const result: Partial<Record<TimelineNodo['key'], string>> = {};
    const historial = this.pedido?.pedidoEnvio?.historial;
    if (!Array.isArray(historial)) return result;
    for (const h of historial) {
      const codigo = (h?.envioEstado?.codigo ?? h?.envioEstado?.descripcion ?? '').toString().toLowerCase().trim();
      const hito = this.hitos.find(x => x.codigos.some(c => codigo === c || codigo.includes(c)));
      if (hito && h?.creadoEn && !result[hito.key]) {
        result[hito.key] = this.formatearFecha(h.creadoEn);
      }
    }
    return result;
  }

  private soloHora(value: string): string {
    if (!value) return '';
    // value puede venir como 'HH:mm' o ISO. Tomar solo HH:mm.
    const m = value.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return value;
  }

  private formatearFecha(value: string): string {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString([], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
