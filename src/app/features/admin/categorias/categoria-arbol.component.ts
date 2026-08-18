import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PermisosService } from '../../../permisos.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-categoria-arbol',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categoria-arbol.component.html',
  styleUrls: ['./categoria-arbol.component.scss']
})
export class CategoriaArbolComponent {
  @Input() categorias: any[] = [];
  @Input() parentId: number|null = null;
  @Input() nivel: number = 1;
  // Devuelve los hijos directos del parentId actual, ordenados por 'orden'.
  getHijos(): any[] {
    // Si la estructura es anidada (children), usar children; si es plana, usar parentId
    if (this.parentId == null) {
      // Raíz: mostrar solo los que no tienen parentId
      return this.categorias
        .filter(c => (c.parentId ?? null) === null)
        .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    // Buscar el nodo actual
    const nodo = this.categorias.find(c => c.id === this.parentId);
    if (nodo && Array.isArray(nodo.children) && nodo.children.length > 0) {
      // Si tiene children, devolverlos ordenados
      return nodo.children
        .map((child: any) => {
          // Si el hijo tiene children, asegurarse que estén presentes en la lista global para la recursividad
          if (child.children && child.children.length > 0) {
            // Si los hijos no están en this.categorias, agregarlos
            for (const subchild of child.children) {
              if (!this.categorias.find((c: any) => c.id === subchild.id)) {
                this.categorias.push(subchild);
              }
            }
          }
          return child;
        })
        .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    // Si no tiene children, buscar por parentId (estructura plana)
    return this.categorias
      .filter(c => (c.parentId ?? null) === this.parentId)
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
  }
  
  // Estado para ítem seleccionado
  selectedId: number|null = null;
  // Devuelve true si el nodo tiene hijos
  tieneHijos(cat: any): boolean {
    return this.categorias.some((c: any) => (c.parentId ?? null) === cat.id);
  }
  @Input() parent = false;
  @Input() plegadas: { [id: string]: boolean } = {};
  @Output() plegadasChange = new EventEmitter<{ [id: string]: boolean }>();
  @Output() seleccionar = new EventEmitter<any>();
  @Output() agregarSub = new EventEmitter<any>();
  @Output() editar = new EventEmitter<any>();
  @Output() eliminar = new EventEmitter<any>();
  @Output() moverArriba = new EventEmitter<any>();
  @Output() moverAbajo = new EventEmitter<any>();
  @Output() editarInline = new EventEmitter<any>();
  @Output() actualizarOrden = new EventEmitter<{ id: number, direccion: 'up' | 'down' }>();

    constructor(public permisosService: PermisosService) {}
    tienePermiso(alias: string): boolean {
    return this.permisosService.tienePermiso(alias);
  }
  onMoverArriba(cat: any) {
    this.moverArriba.emit(cat);
    // Emitir evento para actualizar orden
    this.actualizarOrden.emit({ id: cat.id, direccion: 'up' });
  }
   // Plegar recursivamente todos los descendientes de un nodo

  // Unificado: plegar o desplegar masivamente según el estado actual
  togglePlegadoMasivo(cat: any, event: Event) {
    event.stopPropagation();
    const ids = this.getAllDescendantIds(cat.id);
    const plegados = ids.filter(id => this.plegadas[id] !== false).length;
    const desplegados = ids.length - plegados;
    const plegar = desplegados > plegados; // Si hay más desplegados, plegar; si no, desplegar
    this.plegarRecursivo(cat.id, plegar);
    this.plegadasChange.emit(this.plegadas);
  }

  // Devuelve todos los ids de descendientes (incluido el propio)
  private getAllDescendantIds(parentId: number): number[] {
    const ids = [parentId];
    const hijos = this.categorias.filter(c => (c.parentId ?? null) === parentId);
    for (const hijo of hijos) {
      ids.push(...this.getAllDescendantIds(hijo.id));
    }
    return ids;
  }

  // Determina si la mayoría del subárbol está plegado (para el icono)
  isSubarbolMayormentePlegado(cat: any): boolean {
    const ids = this.getAllDescendantIds(cat.id);
    const plegados = ids.filter(id => this.plegadas[id] !== false).length;
    const desplegados = ids.length - plegados;
    return plegados >= desplegados;
  }

  private plegarRecursivo(parentId: number, plegar: boolean = true) {
    this.plegadas[parentId] = plegar;
    const hijos = this.categorias.filter(c => (c.parentId ?? null) === parentId);
    for (const hijo of hijos) {
      this.plegarRecursivo(hijo.id, plegar);
    }
  }

    // Recibe cambios de plegadas de hijos y actualiza el estado local
  onPlegadasChange(plegadasHijo: { [id: string]: boolean }) {
    // Solo actualiza los nodos hijos, nunca el propio
    for (const key of Object.keys(plegadasHijo)) {
      if (plegadasHijo[key] !== this.plegadas[key]) {
        this.plegadas[key] = plegadasHijo[key];
      }
    }
    this.plegadasChange.emit(this.plegadas);
  }
  onMoverAbajo(cat: any) {
    this.moverAbajo.emit(cat);
    // Emitir evento para actualizar orden
    this.actualizarOrden.emit({ id: cat.id, direccion: 'down' });
  }

  // Estado de plegado por id de categoría
  // Devuelve la cantidad de hijos directos de una categoría (en el contexto actual)
  getCantidadHijos(cat: any): number {
    if (Array.isArray(cat.children)) {
      return cat.children.length;
    }
    return this.categorias.filter((c: any) => (c.parentId ?? null) === cat.id).length;
  }

  // Devuelve los hijos directos de un id dado (usado solo para recursividad interna)
  getHijosDe(parentId: number|null): any[] {
    const nodo = this.categorias.find(c => c.id === parentId);
    if (nodo && Array.isArray(nodo.children) && nodo.children.length > 0) {
      return nodo.children.sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
    }
    return this.categorias
      .filter((c: any) => (c.parentId ?? null) === parentId)
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
  }
 
  // Estado para mostrar el formulario de subcategoría en un nodo específico
  subFormOpen: { [id: string]: boolean } = {};
  subFormNombre: { [id: string]: string } = {};
  subFormDescripcion: { [id: string]: string } = {};
  subFormCodInterno: { [id: string]: string } = {};
  subFormImagen: { [id: string]: string } = {};
  editFormOpen: { [id: string]: boolean } = {};
  editFormNombre: { [id: string]: string } = {};
  editFormDescripcion: { [id: string]: string } = {};
  editFormCodInterno: { [id: string]: string } = {};
  editFormImagen: { [id: string]: string } = {};
  editFormUrl: { [id: string]: string } = {};

  private plegadasInicializadas = false;
  ngOnChanges() {
    if (this.categorias && Array.isArray(this.categorias)) {
      // Log de depuración: mostrar id, nombre y parentId de cada categoría
      // No sobrescribir plegadas si ya viene del padre (mantener estado)
      if (!this.plegadas || Object.keys(this.plegadas).length === 0) {
        this.plegadas = {};
        this.categorias.forEach((cat: any) => {
          this.plegadas[cat.id] = true;
        });
      }
      this.categorias.forEach((cat: any) => {
        this.subFormOpen[cat.id] = false;
        this.subFormNombre[cat.id] = '';
        this.subFormDescripcion[cat.id] = '';
        this.subFormCodInterno[cat.id] = '';
        this.subFormImagen[cat.id] = '';
        this.editFormOpen[cat.id] = false;
        this.editFormNombre[cat.id] = '';
        this.editFormDescripcion[cat.id] = '';
        this.editFormCodInterno[cat.id] = '';
        this.editFormImagen[cat.id] = '';
        this.editFormUrl[cat.id] = '';
      });
      this.plegadasInicializadas = true;
    }
  }

  onSeleccionar(cat: any) {
    this.selectedId = cat.id;
    this.seleccionar.emit(cat);
  }
  onAgregarSub(cat: any) {
    if (!cat || !cat.id) return;
    this.subFormOpen[cat.id] = true;
    this.subFormNombre[cat.id] = '';
    this.subFormDescripcion[cat.id] = '';
    this.subFormCodInterno[cat.id] = '';
    this.subFormImagen[cat.id] = '';
    // Sugerir el próximo valor de orden automáticamente
    const proximoOrden = this.getProximoOrden(cat.id);
    this.subFormCodInterno[cat.id] = '';
    this.subFormOrden = this.subFormOrden || {};
    this.subFormOrden[cat.id] = proximoOrden;
  }
  // Para almacenar el valor sugerido de orden en el formulario de subcategoría
  subFormOrden: { [id: string]: number } = {};


  onGuardarEdit(cat: any) {
    if (!cat || !cat.id) return;
    const nombre = (this.editFormNombre[cat.id] ?? '').toString().trim();
    const descripcion = (this.editFormDescripcion[cat.id] ?? '').toString().trim();
    let codInterno = (this.editFormCodInterno[cat.id] ?? '').toString().trim();
    const imagen = (this.editFormImagen[cat.id] ?? '').toString().trim();
    const url = (this.editFormUrl[cat.id] ?? '').toString().trim();
    if (!nombre) return;
    if (!codInterno) codInterno = '0';
    this.editarInline.emit({ ...cat, nombre, descripcion, codInterno, imagen, url });
    this.editFormOpen[cat.id] = false;
    this.editFormNombre[cat.id] = '';
    this.editFormDescripcion[cat.id] = '';
    this.editFormCodInterno[cat.id] = '';
    this.editFormImagen[cat.id] = '';
    this.editFormUrl[cat.id] = '';
  }

  onCancelarEdit(cat: any) {
    if (!cat || !cat.id) return;
    this.editFormOpen[cat.id] = false;
    this.editFormNombre[cat.id] = '';
    this.editFormDescripcion[cat.id] = '';
    this.editFormCodInterno[cat.id] = '';
    this.editFormImagen[cat.id] = '';
  }

  onGuardarSub(cat: any) {
   // Usar la variable global appIdActual

    if (!cat || !cat.id) return;
    const nombre = (this.subFormNombre[cat.id] || '').toString().trim();
    const descripcion = (this.subFormDescripcion[cat.id] || '').toString().trim();
    let codInterno = (this.subFormCodInterno[cat.id] || '').toString().trim();
    const imagen = (this.subFormImagen[cat.id] || '').toString().trim();
    const orden = this.subFormOrden[cat.id] || this.getProximoOrden(cat.id);
    if (!nombre) return;
    if (!codInterno) codInterno = '0';
    this.agregarSub.emit({ parent: cat, nombre, descripcion, codInterno, imagen, orden });
    this.subFormOpen[cat.id] = false;
    this.subFormNombre[cat.id] = '';
    this.subFormDescripcion[cat.id] = '';
    this.subFormCodInterno[cat.id] = '';
    this.subFormImagen[cat.id] = '';
    this.subFormOrden[cat.id] = this.getProximoOrden(cat.id);
  }

  onCancelarSub(cat: any) {
    if (!cat || !cat.id) return;
    this.subFormOpen[cat.id] = false;
    this.subFormNombre[cat.id] = '';
    this.subFormDescripcion[cat.id] = '';
  }
  onEditar(cat: any) {
    if (!cat || !cat.id) return;
    this.editFormOpen[cat.id] = true;
    this.editFormNombre[cat.id] = cat.nombre || '';
    this.editFormDescripcion[cat.id] = cat.descripcion || '';
    this.editFormCodInterno[cat.id] = cat.codInterno || '';
    this.editFormImagen[cat.id] = cat.imagen || '';
    this.editFormUrl[cat.id] = cat.url || '';
  }
  onEliminar(cat: any) { this.eliminar.emit(cat); }

  togglePlegada(cat: any) {
    if (!cat || !cat.id) return;
    // Cambia solo el estado de la categoría clickeada
    this.plegadas[cat.id] = !this.plegadas[cat.id];
    this.selectedId = cat.id;
    // Si se está cerrando (plegando), plegar recursivamente todos los descendientes
    if (this.plegadas[cat.id]) {
      this.plegarDescendientes(cat.id);
    }
    // Emitir solo el cambio de este nodo
    const cambio = { [cat.id]: this.plegadas[cat.id] };
    this.plegadasChange.emit(cambio);
  }

  // Plega recursivamente todos los descendientes de un nodo
  plegarDescendientes(parentId: number) {
    const hijos = this.getHijosDe(parentId);
    for (const hijo of hijos) {
      this.plegadas[hijo.id] = true;
      if (this.getCantidadHijos(hijo) > 0) {
        this.plegarDescendientes(hijo.id);
      }
    }
  }



  isPlegada(cat: any): boolean {
    return !!cat && !!cat.id && this.plegadas[cat.id];
  }

  // Devuelve el próximo valor de orden para los hijos de un parentId
  getProximoOrden(parentId: number|null): number {
    const hijos = this.categorias.filter((c: any) => (c.parentId ?? null) === parentId);
    if (hijos.length === 0) return 1;
    return Math.max(...hijos.map((c: any) => c.orden ?? 0)) + 1;
  }
}
