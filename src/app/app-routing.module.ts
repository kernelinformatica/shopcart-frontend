import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './features/public/dashboard/dashboard.component';
import { StoreLayoutComponent } from './layout/store-layout.component';
import { authGuard } from './core/auth.guard';
import { ProductoCategoriaProductosComponent } from './features/public/productocategoria/productocategoria-productos.component';
import { ProductoListComponent } from './features/public/producto/producto-list/producto-list.component';

export const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule) },
  {
    path: '',
    component: StoreLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      
      { path: 'empresas', loadChildren: () => import('./features/public/empresa/empresa.module').then(m => m.EmpresaModule) },
      { path: 'usuarios', loadChildren: () => import('./features/public/usuario/usuario.module').then(m => m.UsuarioModule) },
      { path: 'productos', loadChildren: () => import('./features/public/producto/producto.module').then(m => m.ProductoModule) },
      { path: 'rubros', loadChildren: () => import('./features/public/rubro/rubro.module').then(m => m.RubroModule) },
      { path: 'productoscategoria', loadChildren: () => import('./features/public/productocategoria/productocategoria.module').then(m => m.ProductoCategoriaModule) },
      { path: 'categorias/:categoriaSlug', loadChildren: () => import('./features/public/productocategoria/productocategoria.module').then(m => m.ProductoCategoriaModule) },
      { path: 'carrito', loadChildren: () => import('./features/public/carrito/carrito.module').then(m => m.CarritoModule) },
      { path: 'pedidos', loadChildren: () => import('./features/public/pedido/pedido.module').then(m => m.PedidoModule) },
      { path: 'ofertas', redirectTo: 'productos-en-oferta', pathMatch: 'full' },
      { path: 'productos-en-oferta', loadComponent: () => import('./features/public/ofertas/ofertas.component').then(m => m.OfertasComponent) },
      { path: 'favoritos', loadComponent: () => import('./features/public/favoritos/favoritos.component').then(m => m.FavoritosComponent) },
      { path: 'promociones', loadChildren: () => import('./features/public/promocion/promocion.module').then(m => m.PromocionModule) },
      { path: 'tarjetas', loadChildren: () => import('./features/public/tarjeta/tarjeta.module').then(m => m.TarjetaModule) },
      { path: 'cuenta-corriente', loadChildren: () => import('./features/public/cuenta-corriente/cuenta-corriente.module').then(m => m.CuentaCorrienteModule) },
      { path: 'admin', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule) },
      { path: 'todos-los-productos', component: ProductoListComponent, data: { mostrarTodos: true } },
      { path: ':rubroSlug/:subrubroSlug', component: ProductoCategoriaProductosComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
