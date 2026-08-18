export const loginForm = () => new FormGroup({
  email: new FormControl('', [Validators.required, Validators.email]),
  password: new FormControl('', [Validators.required, Validators.minLength(6)]),
});
import { FormGroup, FormControl, Validators } from '@angular/forms';

export const empresaForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required]),
  descripcion: new FormControl(''),
  direccion: new FormControl(''),
  telefono: new FormControl(''),
  email: new FormControl('', [Validators.email]),
});

export const usuarioForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required, Validators.maxLength(50)]),
  apellido: new FormControl('', [Validators.required, Validators.maxLength(50)]),
  telefono: new FormControl('', [
    Validators.required,
    Validators.pattern(/^\d{10}$/)
  ]),
  direccion: new FormControl('', [Validators.required]),
  localidad: new FormControl('', [Validators.required]),
  email: new FormControl('', [Validators.required, Validators.email]),
  password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  repeatPassword: new FormControl('', [Validators.required]),
  opciones: new FormControl('', [Validators.pattern(/^\d{5}$/)]),
  empresaId: new FormControl(null),
  rol: new FormControl('usuario', [Validators.required]),
});

export const productoForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required]),
  descripcion: new FormControl(''),
  precio: new FormControl(0, [Validators.required, Validators.min(0)]),
  stock: new FormControl(0, [Validators.required, Validators.min(0)]),
  empresaId: new FormControl(null, [Validators.required]),
  rubroId: new FormControl(null, [Validators.required]),
  subcategoriaId: new FormControl(null),
});

export const rubroForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required]),
  empresaId: new FormControl(null, [Validators.required]),
});

export const subcategoriaForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required]),
  categoriaId: new FormControl(null, [Validators.required]),
});

// Alias para migración: productoCategoriaForm
export const productoCategoriaForm = subcategoriaForm;

export const promocionForm = () => new FormGroup({
  nombre: new FormControl('', [Validators.required]),
  descripcion: new FormControl(''),
  descuentoPorcentaje: new FormControl(0),
  descuentoFijo: new FormControl(0),
  productoIds: new FormControl([]),
  rubroIds: new FormControl([]),
  empresaIds: new FormControl([]),
  activa: new FormControl(true),
});

export const tarjetaForm = () => new FormGroup({
  numero: new FormControl('', [Validators.required]),
  nombreTitular: new FormControl('', [Validators.required]),
  vencimiento: new FormControl('', [Validators.required]),
  cvv: new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(4)]),
});
