import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnInit, OnDestroy {
  @Input('appTooltip') title = '';
  private tooltip: any;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    try {
      const win: any = window as any;
      const TooltipCtor = win.bootstrap?.Tooltip || (typeof (globalThis as any).bootstrap !== 'undefined' ? (globalThis as any).bootstrap.Tooltip : undefined);
      const tooltipTitle = this.title || this.el.nativeElement.getAttribute('title') || '';
      if (TooltipCtor) {
        this.tooltip = new TooltipCtor(this.el.nativeElement, { title: tooltipTitle, trigger: 'hover focus' });
      } else if (tooltipTitle) {
        this.el.nativeElement.setAttribute('title', tooltipTitle);
      }
    } catch (e) {
      // fallback: nothing
    }
  }

  ngOnDestroy(): void {
    try {
      if (this.tooltip && typeof this.tooltip.dispose === 'function') this.tooltip.dispose();
    } catch {}
  }
}
