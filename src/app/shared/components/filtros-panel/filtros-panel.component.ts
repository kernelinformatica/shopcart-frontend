import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-filtros-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filtros-panel.component.html',
  styleUrls: ['./filtros-panel.component.scss']
})
export class FiltrosPanelComponent {
  @Input() filtroNombre: string = '';
  @Input() precioMinFiltro: number | null = null;
  @Input() precioMaxFiltro: number | null = null;
  @Input() marcasDisponibles: string[] = [];
  @Input() marcasSeleccionadas: Record<string, boolean> = {};
  @Input() categoriasDisponibles: string[] = [];
  @Input() categoriasSeleccionadas: Record<string, boolean> = {};
  @Input() filtrosColapsados: boolean = false;
  @Input() hayFiltrosActivos: boolean = false;

  @Output() filtroNombreChange = new EventEmitter<string>();
  @Output() precioMinFiltroChange = new EventEmitter<number | null>();
  @Output() precioMaxFiltroChange = new EventEmitter<number | null>();
  @Output() marcasSeleccionadasChange = new EventEmitter<Record<string, boolean>>();
  @Output() categoriasSeleccionadasChange = new EventEmitter<Record<string, boolean>>();
  @Output() limpiarFiltros = new EventEmitter<void>();
  @Output() toggleFiltrosColapsados = new EventEmitter<void>();

  onFiltroNombreInput(value: string) {
    this.filtroNombreChange.emit(value);
  }
  onPrecioMinInput(value: string) {
    const num = value ? Number(value) : null;
    this.precioMinFiltroChange.emit(Number.isFinite(num) ? num : null);
  }
  onPrecioMaxInput(value: string) {
    const num = value ? Number(value) : null;
    this.precioMaxFiltroChange.emit(Number.isFinite(num) ? num : null);
  }
  onMarcaChange(marca: string, checked: any) {
    const nuevo = { ...this.marcasSeleccionadas, [marca]: !!checked };
    this.marcasSeleccionadasChange.emit(nuevo);
  }
  onCategoriaChange(categoria: string, checked: any) {
    const nuevo = { ...this.categoriasSeleccionadas, [categoria]: !!checked };
    this.categoriasSeleccionadasChange.emit(nuevo);
  }
}
