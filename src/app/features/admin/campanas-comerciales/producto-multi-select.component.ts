import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiAdminService } from '../../../api-admin.service';
import { Producto } from '../../../models';

@Component({
  selector: 'app-producto-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="product-multi">
    <div class="row g-2 align-items-center mb-2">
      <div class="col-8">
        <input class="form-control" placeholder="Buscar productos por nombre" [(ngModel)]="q" (keyup.enter)="search()" />
      </div>
      <div class="col-4 d-flex gap-2">
        <button class="btn btn-outline-primary w-100" (click)="search()">Buscar</button>
        <button class="btn btn-outline-secondary w-100" (click)="clear()">Limpiar</button>
      </div>
    </div>

    <div *ngIf="loading" class="text-muted">Buscando...</div>

    <div *ngIf="!loading">
      <div *ngIf="items.length === 0" class="text-muted">Sin resultados</div>
      <div class="list-group">
        <label class="list-group-item d-flex align-items-center" *ngFor="let it of items">
          <input class="form-check-input me-2" type="checkbox" [checked]="isSelected(it.id)" (change)="toggle(it.id, $any($event.target).checked)" />
          <div>
            <div class="fw-semibold">{{ it.nombre }}</div>
            <small class="text-muted">ID: {{ it.id }} — {{ it.marca?.nombre || '' }}</small>
          </div>
        </label>
      </div>

      <div class="d-flex justify-content-between align-items-center mt-2">
        <small class="text-muted">{{ total ? ("Total: " + total) : '' }}</small>
        <div>
          <button class="btn btn-sm btn-outline-secondary me-2" [disabled]="page<=1" (click)="goto(page-1)">Anterior</button>
          <button class="btn btn-sm btn-outline-secondary" [disabled]="(page*pageSize)>=total" (click)="goto(page+1)">Siguiente</button>
        </div>
      </div>

      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary" (click)="apply()">Asignar seleccionados</button>
        <button class="btn btn-outline-danger" (click)="clearSelection()">Limpiar selección</button>
      </div>
    </div>
  </div>
  `
})
export class ProductoMultiSelectComponent implements OnInit {
  @Input() selected: number[] = [];
  @Output() change = new EventEmitter<number[]>();

  q = '';
  items: Producto[] = [];
  loading = false;
  page = 1;
  pageSize = 12;
  total = 0;
  private selectedSet = new Set<number>();

  constructor(private api: ApiAdminService) {}

  ngOnInit(): void {
    (this.selected || []).forEach(id => this.selectedSet.add(id));
    this.search();
  }

  search(): void {
    this.loading = true;
    const params: any = { page: this.page, pageSize: this.pageSize };
    if (this.q && this.q.trim()) params.nombre = this.q.trim();
    this.api.getProductos(params).subscribe({ next: (r: any) => {
      // ApiAdminService normaliza la respuesta a { items, total, page, pageSize }
      if (Array.isArray(r)) {
        this.items = r as Producto[];
        this.total = r.length;
      } else {
        this.items = (r.items || []) as Producto[];
        this.total = r.total || 0;
        this.page = r.page || this.page;
        this.pageSize = r.pageSize || this.pageSize;
      }
      this.loading = false;
    }, error: () => { this.loading = false; }});
  }

  isSelected(id: number): boolean { return this.selectedSet.has(id); }

  toggle(id: number, on: any) {
    const isOn = !!on;
    if (isOn) this.selectedSet.add(id); else this.selectedSet.delete(id);
  }

  apply() { this.change.emit(Array.from(this.selectedSet)); }

  clear() { this.q = ''; this.items = []; this.total = 0; this.page = 1; this.change.emit([]); this.selectedSet.clear(); }

  clearSelection() { this.selectedSet.clear(); this.change.emit([]); }

  goto(p: number) { if (p<1) return; this.page = p; this.search(); }
}
