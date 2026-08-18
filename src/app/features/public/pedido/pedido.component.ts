import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { Pedido } from '../../../models';

@Component({
  selector: 'app-pedido',
  standalone: false,
  templateUrl: './pedido.component.html',
  styleUrl: './pedido.component.scss'
})
export class PedidoComponent implements OnInit {
  preferenceId: string | null = null;
  apiKeyPublic: string | null = null;
  pedidoId = 1; // Reemplaza por el pedido real
  appId = 2; // Reemplaza por el appId real
  mensajePago: string | null = null;
  esperandoPago: boolean = false;
  resultadoPago: any = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    // Demo: productos, impuestos y cargos
    const productos = [
      { title: 'Producto demo', quantity: 1, unit_price: 100 }
    ];
    const impuestos: { nombre: string; valor: number; }[] = [];
    const cargos: { nombre: string; valor: number; }[] = [];
    // Objeto Pedido mínimo
    const pedido: Pedido = {
      id: 0,
      usuarioId: 1,
      items: [],
      estado: 'pendiente',
      total: 100,
      metodoPago: 'mercadopago'
    };
    this.esperandoPago = true;
    this.mensajePago = 'Aguarde, estamos procesando su pago...';
    this.api.confirmarPedido(productos, impuestos, cargos, pedido).subscribe({
      next: (pedido: any) => {
        const pedidoIdReal = pedido.id;
        this.api.getMercadoPagoPreference(pedidoIdReal, this.appId).subscribe({
          next: (data) => {
            this.preferenceId = data.preferenceId;
            this.apiKeyPublic = data.apiKeyPublic;
            this.initMercadoPagoWidget();
          }
        });
      },
      error: (err) => {
        this.esperandoPago = false;
        this.mensajePago = 'Ocurrió un error al confirmar el pedido.';
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
        },
        onSubmit: (data: any) => {
          // Aquí podrías mostrar el mensaje de espera si se requiere
          this.esperandoPago = true;
          this.mensajePago = 'Aguarde, estamos procesando su pago...';
        },
        onResult: (resultado: any) => {
          // Aquí se recibe la respuesta de la pasarela (simulado, depende del SDK)
          this.esperandoPago = false;
          this.resultadoPago = resultado;
          if (resultado && resultado.success) {
            this.mensajePago = resultado.mensaje || 'Pago aprobado y pedido confirmado';
          } else if (resultado && resultado.estado === 'rechazado') {
            this.mensajePago = resultado.mensaje || 'El pago fue rechazado por la pasarela';
          } else if (resultado && resultado.estado === 'pendiente') {
            this.mensajePago = resultado.mensaje || 'El pago está pendiente de confirmación';
          } else {
            this.mensajePago = 'No se pudo procesar el pago.';
          }
        }
      });
    }
  }
}
