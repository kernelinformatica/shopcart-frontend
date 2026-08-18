import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from './../../../api.service';

@Component({
  selector: 'app-pedido-detalle',
  imports: [],
  templateUrl: './pedido-detalle.component.html',
  styleUrl: './pedido-detalle.component.scss'
})
export class PedidoDetalleComponent implements OnInit {
  preferenceId: string | null = null;
  apiKeyPublic: string | null = null;
  pedidoId: number | null = null;
  appId = 2; // Reemplaza por el appId real o toma de contexto

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.pedidoId = +params['pedidoId'];
      if (this.pedidoId) {
        this.api.getMercadoPagoPreference(this.pedidoId, this.appId).subscribe({
          next: (data) => {
            this.preferenceId = data.preferenceId;
            this.apiKeyPublic = data.apiKeyPublic;
            this.initMercadoPagoWidget();
          }
        });
      }
    });
  }

  initMercadoPagoWidget() {
    if (!this.apiKeyPublic || !this.preferenceId) return;
    if (!document.getElementById('mp-script')) {
      const script = document.createElement('script');
      script.id = 'mp-script';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        this.renderMercadoPagoCheckout();
      };
      document.body.appendChild(script);
    } else {
      this.renderMercadoPagoCheckout();
    }
  }

  renderMercadoPagoCheckout() {
    // @ts-ignore
    if (window.MercadoPago) {
      // @ts-ignore
      const mp = new window.MercadoPago(this.apiKeyPublic);
      mp.checkout({
        preference: {
          id: this.preferenceId
        },
        render: {
          container: '#mercadoPagoEmbed',
          label: 'Pagar con Mercado Pago'
        }
      });
    }
  }
}
