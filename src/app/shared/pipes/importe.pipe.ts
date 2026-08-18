import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'importe',
  standalone: true
})
export class ImportePipe implements PipeTransform {
  transform(value: number | string | null | undefined, decimals = 2, locale = 'es-AR'): string {
    if (value === null || value === undefined || value === '') return '-';
    // Normalize string input with comma decimal
    const raw = typeof value === 'string' ? value.replace(/\s/g, '') : String(value);
    const num = Number(raw.toString().replace(/,/g, '.'));
    if (isNaN(num)) return String(value);
    try {
      return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
    } catch (e) {
      // Fallback
      return num.toFixed(decimals);
    }
  }
}
