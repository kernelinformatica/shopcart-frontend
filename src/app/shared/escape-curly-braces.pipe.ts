import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'escapeCurlyBraces'
})
export class EscapeCurlyBracesPipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value.replace(/\{/g, '{{ "{" }}').replace(/\}/g, '{{ "}" }}');
  }
}
