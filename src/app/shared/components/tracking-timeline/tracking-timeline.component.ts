import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrackingEvento {
  fecha: string; // timestamp ISO
  // Puede ser string (código) o un objeto con nombre/descripcion/codigo
  estado: string | { nombre?: string; descripcion?: string; codigo?: string };
  nombre?: string;
  descripcion?: string;
  comentario?: string; // Mensaje amigable
  detalle?: string;    // Texto técnico
}

@Component({
  selector: 'app-tracking-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracking-timeline.component.html',
  styleUrls: ['./tracking-timeline.component.scss']
})
export class TrackingTimelineComponent {
  @Input() historial: TrackingEvento[] = [];
  @Input() estadoActual: string = '';

  // Helper seguro para obtener string del estado
  getEstadoTexto(estado: string | { nombre?: string; descripcion?: string; codigo?: string } | undefined, descripcion?: string): string {
    if (!estado) return descripcion || '';
    if (typeof estado === 'object') {
      return estado.nombre || estado.descripcion || estado.codigo || descripcion || '';
    }
    return descripcion || estado;
  }

  // Helper para evitar errores de undefined en el template
  estadoIncluye(estado: string | { nombre?: string; descripcion?: string; codigo?: string } | undefined, texto: string): boolean {
    let valor = '';
    if (!estado) return false;
    if (typeof estado === 'object') {
      valor = estado.nombre || estado.descripcion || estado.codigo || '';
    } else {
      valor = estado;
    }
    return valor.toLowerCase().includes(texto);
  }
}
