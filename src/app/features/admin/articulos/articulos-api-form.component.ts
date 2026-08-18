import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-articulos-api-form',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="container py-3 articulos-api-page">
      <div class="hero-panel mb-4">
        <div>
          <p class="eyebrow mb-2">Administracion de articulos</p>
          <h2 class="mb-2"><i class="bi bi-gear-fill"></i> Configuracion API</h2>
          <p class="text-muted mb-0">
            Esta pantalla queda preparada para configurar la integracion administrativa de articulos por API.
          </p>
        </div>
        <div class="hero-actions">
          <a
            class="icon-action-btn icon-action-btn-light"
            routerLink="/admin/articulos"
            title="Volver al listado"
            aria-label="Volver al listado"
          >
            <i class="bi bi-arrow-left" aria-hidden="true"></i>
            <span class="visually-hidden">Volver al listado</span>
          </a>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-4">
          <h5 class="mb-2">Configuracion API</h5>
          <p class="text-muted mb-0">
            Este espacio queda preparado para configurar una API administrativa de carga masiva por llamadas. Lo vemos en la siguiente iteracion, con el contrato final del backend.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .articulos-api-page .hero-panel {
      padding: 1.5rem;
      border-radius: 1.25rem;
      background: var(--gradient-global);
      color: #141414;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
      box-shadow: 0 1rem 2rem rgba(15, 23, 42, 0.18);
    }

    .articulos-api-page .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.72rem;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.8);
    }

    .articulos-api-page .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .articulos-api-page .icon-action-btn {
      width: 3rem;
      height: 3rem;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.4);
      background: rgba(255, 255, 255, 0.1);
      color: #1d1d1d;
      text-decoration: none;
      box-shadow: 0 0.5rem 1rem rgba(15, 23, 42, 0.12);
      transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
    }

    .articulos-api-page .icon-action-btn:hover,
    .articulos-api-page .icon-action-btn:focus-visible {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.18);
      box-shadow: 0 0.75rem 1.2rem rgba(15, 23, 42, 0.18);
      outline: none;
    }

    .articulos-api-page .icon-action-btn-light {
      background: #ffffff;
      color: #1f2937;
      border-color: #ffffff;
    }

    .articulos-api-page .icon-action-btn-light:hover,
    .articulos-api-page .icon-action-btn-light:focus-visible {
      background: #f8fafc;
      color: #111827;
    }
  `]
})
export class ArticulosApiFormComponent {}