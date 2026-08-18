import { TestBed } from '@angular/core/testing';
import { ListasPreciosAdminComponent } from './listas-precios-admin.component';
import { ApiAdminService } from '../../../api-admin.service';
import { of } from 'rxjs';

describe('ListasPreciosAdminComponent (basic)', () => {
  let apiStub: Partial<ApiAdminService>;

  beforeEach(async () => {
    apiStub = {
      getListasPrecios: () => of([]),
      getPreciosPorLista: () => of([]),
      getCanales: () => of([]),
      getProductos: () => of([])
    } as any;

    await TestBed.configureTestingModule({
      imports: [ListasPreciosAdminComponent],
      providers: [{ provide: ApiAdminService, useValue: apiStub }]
    }).compileComponents();
  });

  it('should create component', () => {
    const fixture = TestBed.createComponent(ListasPreciosAdminComponent as any);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
