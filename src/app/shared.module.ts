import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ProductoItemMiniComponent } from './shared/components/producto-item-mini';
import { ImportePipe } from './shared/pipes/importe.pipe';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ProductoItemMiniComponent,
    ImportePipe
  ],
  exports: [
    ReactiveFormsModule,
    ProductoItemMiniComponent,
    ImportePipe
  ]
})
export class SharedModule { }
