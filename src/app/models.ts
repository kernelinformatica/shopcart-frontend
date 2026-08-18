// Refleja la tabla promocionAccion de la base de datos
export interface PromocionAccion {
  id: number;
  promocionId: number;
  appId: number;
  tipoAccion: string;
  valor: number; // decimal(10,2)
  valorExtra: number; // decimal(10,2)
  detalle?: string | null;
}
// Modelos para las entidades principales de SuperShopCart

export interface ProductoMedia {
  id?: number;
  url: string;
  descripcion?: string | null;
  orden?: number | null;
  mediaId?: number; // Foreign key a Media
  media?: Media | null;
}

// Entidad global para multimedia
export interface Media {
  id: number;
  nombre: string;
  descripcion?: string;
  extension?: string;
}
export interface Subcategoria {
  id: number;
  nombre: string;
  categoria?: { id: number; nombre: string };
}

export interface Empresa {
  id: number;
  nombre: string;
  codigo?: string;
  apps?: App[]; // Agregado para corregir error TS2339
}

export interface App {
  id: number;
  nombre: string;
  logo?: string;
  media?: any;
}

export interface ListaPrecio {
  id: number;
  nombre: string;
  estado: 'activa' | 'inactiva';
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  observaciones?: string;
  canal?:Canal;
  productosCount?: number; // Agregado para mostrar la cantidad de productos asociados a la lista
}

export interface PrecioProducto {
  id: number;
  precio: number;
  preciocompra?: number;
  margen?: number;
  observaciones?: string;
  vigenciadesde?: string;
  vigenciahasta?: string;
  producto?: Producto;
  listaprecio?: ListaPrecio;   // ✅ canal está dentro de listaPrecio
  moneda?: Monedas;
}
export interface Monedas {
  id: number;
  nombre: string;
  codigoISO: string;
  simbolo: string;
  estado: number;
}
export interface Canal {
  id: number;
  nombre: string;
  descripcion: string;
  estado: boolean;
}
export interface Producto {
categoria: any;
    cantidad?: number;
    precioConfig?: any; // Agregado para evitar error TS2339, el backend devuelve un campo precioConfig que es un array de precios asociados al producto
    modeloImputacion?: Array<{
    precio_sin_impuestos?: number;
    id: number;
    nombre: string;
    tipo: string;
    valor: string | number;
    aplica?: string;
    activo?: boolean;
    baja?: boolean;
    fecha_inicio?: string;
    fecha_fin?: string;
    prioridad?: number;
    descripcion?: string;
    
   
  }>; 
 
  mejorPrecioPromoCalculado: undefined;
  id: number;
  nombre: string;
  descripcion?: string;
  descripcion_larga?: string;
  codigo_barra?: string;
  codigo_qr?: string;
  marca?: any; // Puede ser objeto
  modelo?: string;
  unidad_medida?: string;
  contenido_neto?: string;
  canalId?: number;
  imagen?: string;
  imagenPrincipal?: string;
  imagenesRelacionadas?: string[];
  imagenes?: ProductoMedia[];
  productoMedia?: ProductoMedia[]; // Agregado para evitar error TS2339
  estado: 'activo' | 'inactivo';
  baja : boolean;
  activo: boolean;
  fecha_alta?: string;
  fecha_baja?: string;
  subcategoria?: Subcategoria;
  rubro?: { id: number; nombre: string };
  empresa?: Empresa;
  apps?: App[];
  stock?: number | string;
  precios?: PrecioProducto[];
  listaPrecio?: ListaPrecio;
  precio?: number | undefined;
  precioCompra?: number;
  margen?: number;
  precioLista?: number;
  precio_lista?: number;
  precioFinal?: number;
  precioBase?: number;
  precio_base?: number;
  precioConImpuestos?: number;
  precio_con_impuestos?: number;
  precioUnitario?: number;
  precio_unitario?: number;
  precioVisual?: number;
  precio_visual?: number;
  promociones?: Promocion[];
  observaciones?: string;
  // Propiedades para frontend (descuentos/promos aplicadas)
  precioDescuento?: number;
  promocionAplicada?: any;
  /**
   * Info de cuotas sin interés (agregado dinámicamente al agregar al carrito)
   */
  infoCuotas?: {
    cuotas: number;
    banco?: string;
    descripcion?: string;
  };

  // Nuevos campos del backend
  cantidadVentas?: number;
  masVendido?: boolean;
}

export interface Rubro {
  id: number;
  nombre: string;
  empresaId: number;
  subcategorias?: Subcategoria[];
}
export interface Campana {
  id: number;
  nombre: string;
  descripcion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  activa?: boolean;
  enSlide?: boolean;
  imagenSlide?: string;
  productos?: Producto[];
  acciones?: any[];
  condiciones?: any[];
  tipoId: number | null; 
}

export interface PromocionTipo {
  id: number;
  appId: number;
  nombre: string;   // Ej: "Por cantidad", "Por porcentaje"
  alias: string;    // Ej: "cantidad", "porcentaje"
  descripcion?: string;
  activo: number;
}








export interface CarritoItem {
  id?: number;
  producto: Producto;
  cantidad: number;
  precioBase?: number | string;
  precio_base?: number | string;
  precioConImpuestos?: number | string;
  precio_con_impuestos?: number | string;
  precioUnitario?: number | string;
  precio_unitario?: number | string;
  precioTotal?: number | string;
  total?: number | string;
  subtotal?: number | string;
  importe?: number | string;
  mediosPago?: any[]; // Agregado para mostrar medios de pago por item
}

export interface Carrito {
  items: CarritoItem[];
  promocionesAplicadas?: Promocion[];
  total: number;
  metodoPago: string;
  medioPagoReferencia?: string;
  tarjetaId?: number;
}

export interface PedidoItemPayload {
  productoId: number;
  cantidad: number;
  precioFinal: number;
}

export interface Pedido {
  id: number;
  usuarioId: number;
  items: CarritoItem[];
  estado: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  total: number;
  promocionesAplicadas?: Promocion[];
  metodoPago: string;
  medioPagoReferencia?: string;
  tarjetaId?: number;
  repartidorId?: number;
  ubicacionActual?: string;
  tipoEntrega?: 'retiro' | 'domicilio' | 'programado' | string;
  costoEnvio?: number;
  usuarioDireccionId?: number;
  entregaOpcionId?: number;
  pedidoEnvio?: PedidoEnvio;
  cuponCodigo?: string;
  notas?: string;
  createdAt?: string;
  updatedAt?: string;
  preferenceId?: string; // Mercado Pago preference id
}

// Refleja la tabla promocion de la base de datos
export interface Promocion {
  id: number;
  appId?: number | null;
  tipoId?: number | null;
  nombre?: string | null;
  descripcion?: string | null;
  fechaInicio?: string | null; // date (YYYY-MM-DD)
  fechaFin?: string | null;    // date (YYYY-MM-DD)
  condiciones?: any;           // json
  imagenSlide?: string | null;
  imagenesSlide?: Array<{
    id: number | string;
    url: string;
    orden?: number;
    nombreOriginal?: string;
    alias?: string;
  }>;
  enSlide?: boolean | number;  // tinyint(1)
  activa?: boolean | number;   // tinyint(1)
  acciones?: PromocionAccion[];
  // Extras para compatibilidad frontend
  [key: string]: any;
}

export interface Tarjeta {
  id: number;
  usuarioId: number;
  numero: string;
  nombreTitular: string;
  vencimiento: string;
  cvv: string;
  tarjetaTipoId?: number;
  tarjetaTipo?: { id: number; nombre: string; descripcion?: string; alias?: string };
}

export interface FormaPago {
pasarelaPago: any;
  id: number;
  appId: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  orden?: number;
  activo: boolean;
  requiereReferencia?: boolean;
  permiteCuotas?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  tarjetasAsociadas?: any[];
}


export interface Rol {
  id: number;
  alias: string;
  nombre: string;
  descripcion?: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email?: string;
  rol: Rol;
  // Agrega aquí otros campos relevantes
}

export interface Provincia {
  id: number;
  nombre: string;
  codigoPais?: string;
  codigoIndec?: string;
}

export interface Localidad {
  id: number;
  nombre: string;
  codigoPostal?: string;
  provinciaId?: number;
  provincia?: Provincia;
}

export type PrecisionGeo = 'exacta' | 'aproximada' | 'manual';

export interface UsuarioDireccion {
  id: number;
  appId: number;
  usuarioId: number;
  alias?: string;
  receptorNombre?: string;
  receptorTelefono?: string;
  calle: string;
  numero?: string;
  piso?: string;
  departamento?: string;
  entreCalles?: string;
  referencia?: string;
  codigoPostal?: string;
  localidadId: number;
  provinciaId?: number;
  localidad?: Localidad;
  provincia?: Provincia;
  latitud?: number;
  longitud?: number;
  precisionGeo?: PrecisionGeo;
  esPrincipal?: boolean;
  activo?: boolean;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface EntregaTipo {
  id: number;
  appId: number;
  codigo: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EntregaOpcion {
  id: number;
  appId: number;
  entregaTipoId: number;
  entregaTipo?: EntregaTipo;
  nombre: string;
  descripcion?: string;
  costoBase: number;
  costoPorPedido?: number;
  costoPorKm?: number;
  tiempoEstimadoMinutos?: number;
  tiempoMinHoras?: number;
  tiempoMaxHoras?: number;
  radioCoberturaKm?: number;
  requiereHorario?: boolean;
  horaInicio?: string;
  horaFin?: string;
  permiteProgramar?: boolean;
  habilitada: boolean;
  createdAt?: string;
  updatedAt?: string;
  cobertura?: Localidad[];
}

export interface EntregaOpcionLocalidad {
  entregaOpcionId: number;
  localidadId: number;
  localidad?: Localidad;
}

export interface EnvioEstado {
  id: number;
  appId: number;
  codigo: string;
  descripcion?: string;
  orden?: number;
  esFinal: boolean;
  activo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PedidoEnvioEstadoHistorial {
  id: number;
  pedidoEnvioId: number;
  envioEstadoId: number;
  envioEstado?: EnvioEstado;
  usuarioSistemaId?: number;
  observacion?: string;
  creadoEn?: string;
}

export interface PedidoEnvio {
  id: number;
  pedidoId: number;
  appId: number;
  usuarioDireccionId: number;
  usuarioDireccion?: UsuarioDireccion;
  entregaOpcionId: number;
  entregaOpcion?: EntregaOpcion;
  envioEstadoId: number;
  envioEstado?: EnvioEstado;
  costo: number;
  costoCliente?: number;
  distanciaKm?: number;
  fechaProgramada?: string;
  horaVentanaDesde?: string;
  horaVentanaHasta?: string;
  trackingCodigo?: string;
  observaciones?: string;
  latitudDestino?: number;
  longitudDestino?: number;
  metadata?: PedidoEnvioMetadata | null;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  historial?: PedidoEnvioEstadoHistorial[];
}

export interface PedidoEnvioPricingMetadata {
  distanciaKm?: number;
  costoBase?: number;
  costoPorPedido?: number;
  costoPorKm?: number;
  costoAplicado?: number;
  moneda?: string;
}

export interface PedidoEnvioMetadata {
  pricing?: PedidoEnvioPricingMetadata;
  [key: string]: unknown;
}

type UsuarioDireccionPayloadBase = Omit<
  UsuarioDireccion,
  'id' | 'usuarioId' | 'appId' | 'localidad' | 'provincia' | 'fechaCreacion' | 'fechaActualizacion'
> & {
  geocode?: boolean;
};

export type CrearUsuarioDireccionPayload = UsuarioDireccionPayloadBase;

export type ActualizarUsuarioDireccionPayload = Partial<UsuarioDireccionPayloadBase>;

export interface CotizacionEntregaRequest {
  usuarioDireccionId?: number;
  latitud?: number;
  longitud?: number;
  distanciaKm?: number;
}

export interface CotizacionEntregaResponse {
  costo: number;
  costoCliente?: number;
  distanciaKm?: number;
  etaMinutos?: number;
  etaMaxima?: number | string;
  tiempoEstimadoHoras?: number;
  horaVentanaDesde?: string;
  horaVentanaHasta?: string;
fechaProgramada?: string;
  moneda? : string;
  metadata?: {
    pricing?: PedidoEnvioPricingMetadata;
    [key: string]: unknown;
  };
}

export interface OrigenEnvioApp {
  latitudOrigen: number;
  longitudOrigen: number;
}

export interface UpdateOrigenEnvioAppPayload {
  latitudOrigen: number;
  longitudOrigen: number;
}

export interface PedidoEnvioPayload {
  usuarioDireccionId: number;
  entregaOpcionId: number;
  costo: number;
  distanciaKm?: number;
  fechaProgramada?: string;
  horaVentanaDesde?: string;
  horaVentanaHasta?: string;
  trackingCodigo?: string;
  observaciones?: string;
}

export interface PedidoEnvioEstadoCambioPayload {
  envioEstadoCodigo: string;
  observacion?: string;
}
