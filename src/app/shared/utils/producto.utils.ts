import { environment } from '../../../environments/environment';

/**
 * Devuelve true si el producto tiene impuestos cargados (modeloImputacion o modeloImputaciones no vacío)
 */
export function productoTieneImpuestos(producto: any): boolean {
  if (!producto) return false;
  const imps = producto.modeloImputacion || producto.modeloImputaciones;
  return Array.isArray(imps) && imps.length > 0;
}
export function tienePrecioDisponible(producto: any): boolean {
  if (!producto) {
    return false;
  }

  const valoresPosibles = [
    producto.precio,
    producto.precioLista,
    producto.precio_lista,
    producto.precioDescuento,
    producto.precio_descuento,
    producto.mejorPrecioPromoCalculado,
    producto.precioFinal,
    producto.precio_final,
    producto.precioBase,
    producto.precio_base
  ];

  return valoresPosibles.some((valor) => {
    if (valor === null || valor === undefined) {
      return false;
    }
    if (typeof valor === 'string') {
      return valor.trim().length > 0;
    }
    return true;
  });
}

export function filtrarProductosConPrecio<T = any>(productos: T[] | null | undefined): T[] {
  if (!Array.isArray(productos)) {
    return [];
  }
  return productos.filter((producto) => tienePrecioDisponible(producto));
}

export function resolveBackendMediaUrl(url: unknown): string {
  const value = String(url ?? '').trim();
  if (!value) {
    return '';
  }

  if (/^(?:https?:|blob:|data:)/i.test(value) || value.startsWith('assets/')) {
    return value;
  }

  const baseUrl = String(environment.urlMultimedia ?? environment.apiUrlBackend ?? '').trim().replace(/\/$/, '');
  if (!baseUrl) {
    return value;
  }

  if (value.startsWith('/')) {
    return `${baseUrl}${value}`;
  }

  return `${baseUrl}/${value}`;
}

/**
 * Devuelve una URL resolvible para el logo/imagen de una marca.
 * - Si `entity.media` existe y apunta a una URL (o ruta relativa), la resuelve con `resolveBackendMediaUrl`.
 * - Si `media` es string que ya es absoluta/assets/data/blob, se devuelve tal cual.
 * - Si no hay `media`, devuelve campos legacy (logo, imagen, logoUrl...) sin resolver (puede ser un nombre de archivo que los componentes manejan).
 */
export function resolveMarcaLogo(entity: any): string {
  if (!entity) return '';
  // Prefer explicit absolute/hosted media URL when provided by backend
  const mediaUrl = String(entity?.mediaUrl ?? entity?.media_url ?? '').trim();
  if (mediaUrl) {
    if (/^(?:https?:|blob:|data:)/i.test(mediaUrl) || mediaUrl.startsWith('assets/')) return mediaUrl;
    return resolveBackendMediaUrl(mediaUrl);
  }

  const media = entity?.media;
  if (media) {
    if (typeof media === 'string') {
      const v = String(media || '').trim();
      if (!v) return '';
      if (/^(?:https?:|blob:|data:)/i.test(v) || v.startsWith('assets/')) return v;
      return resolveBackendMediaUrl(v);
    }
    if (typeof media === 'object') {
      const url = String(media.url || media.path || media.src || media.filename || media.fileName || media.urlPath || '').trim();
      if (!url) return '';
      if (/^(?:https?:|blob:|data:)/i.test(url) || url.startsWith('assets/')) return url;
      return resolveBackendMediaUrl(url);
    }
  }

  // Legacy fields: return raw value (components decide if prefix/resolve is necessary)
  const legacy = String(
    entity?.logo ??
    entity?.logoUrl ??
    entity?.logo_url ??
    entity?.imagen ??
    entity?.imagenLogo ??
    entity?.imagen_logo ??
    entity?.logoMarca ??
    entity?.logo_marca ??
    entity?.marcaLogo ??
    entity?.marca_logo ??
    ''
  ).trim();
  return legacy;
}

/** Extrae el valor 'crudo' del logo (sin resolver URLs). Útil para generar keys/caches. */
export function extractMarcaLogoValue(entity: any): string {
  if (!entity) return '';
  if (entity?.media) {
    const m = entity.media;
    if (typeof m === 'string') return String(m).trim();
    if (m && typeof m === 'object') return String(m.url || m.path || m.src || m.filename || m.fileName || m.urlPath || '').trim();
  }
  return String(
    entity?.logo ??
    entity?.logoUrl ??
    entity?.logo_url ??
    entity?.imagen ??
    entity?.imagenLogo ??
    entity?.imagen_logo ??
    entity?.logoMarca ??
    entity?.logo_marca ??
    entity?.marcaLogo ??
    entity?.marca_logo ??
    ''
  ).trim();
}

export function normalizarMultimediaProducto<T>(payload: T): T {
  return normalizarValorProducto(payload);
}

function normalizarValorProducto<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizarValorProducto(item)) as T;
  }

  if (!esObjetoPlano(value)) {
    return value;
  }

  const normalized: Record<string, any> = { ...(value as Record<string, any>) };

  for (const [key, nestedValue] of Object.entries(normalized)) {
    if (Array.isArray(nestedValue) || esObjetoPlano(nestedValue)) {
      normalized[key] = normalizarValorProducto(nestedValue);
    }
  }

  if (pareceProducto(normalized)) {
    if ('imagen' in normalized) {
      normalized['imagen'] = resolveBackendMediaUrl(normalized['imagen']);
    }
    if ('imagenPrincipal' in normalized) {
      normalized['imagenPrincipal'] = resolveBackendMediaUrl(normalized['imagenPrincipal']);
    }
    if ('imagenUrl' in normalized) {
      normalized['imagenUrl'] = resolveBackendMediaUrl(normalized['imagenUrl']);
    }
    if (Array.isArray(normalized['imagenesRelacionadas'])) {
      normalized['imagenesRelacionadas'] = normalized['imagenesRelacionadas']
        .map((item: unknown) => resolveBackendMediaUrl(item))
        .filter((item: string) => !!item);
    }
    if (Array.isArray(normalized['productoMedia'])) {
      normalized['productoMedia'] = normalized['productoMedia'].map((media: any) => normalizarMediaProducto(media));
    }
    if (Array.isArray(normalized['imagenes'])) {
      normalized['imagenes'] = normalized['imagenes'].map((item: any) => {
        if (typeof item === 'string') {
          return resolveBackendMediaUrl(item);
        }
        return normalizarMediaProducto(item);
      });
    }

    if (!normalized['imagen']) {
      const imagenDesdeMedia = Array.isArray(normalized['productoMedia'])
        ? normalized['productoMedia'].find((media: any) => media?.url)?.url
        : '';
      const imagenDesdeImagenes = Array.isArray(normalized['imagenes'])
        ? normalized['imagenes'].find((media: any) => (typeof media === 'string' ? media : media?.url))
        : '';
      normalized['imagen'] =
        normalized['imagenUrl'] ||
        normalized['imagenPrincipal'] ||
        imagenDesdeMedia ||
        (typeof imagenDesdeImagenes === 'string' ? imagenDesdeImagenes : imagenDesdeImagenes?.url) ||
        '';
    }
  }

  return normalized as T;
}

function normalizarMediaProducto(media: any): any {
  if (!esObjetoPlano(media)) {
    return media;
  }

  const normalized = { ...media };
  if ('url' in normalized) {
    normalized['url'] = resolveBackendMediaUrl(normalized['url']);
  }
  return normalized;
}

function pareceProducto(value: Record<string, any>): boolean {
  const hasImageField = 'imagen' in value || 'imagenPrincipal' in value || 'imagenUrl' in value || 'productoMedia' in value || 'imagenes' in value;
  const hasProductHint = 'precio' in value || 'precioLista' in value || 'stock' in value || 'marca' in value || 'subcategoria' in value || 'codigo_barra' in value || 'cantidadVentas' in value || 'masVendido' in value;
  return hasImageField && hasProductHint;
}

function esObjetoPlano(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}



