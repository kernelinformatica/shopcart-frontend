import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io(environment.apiUrl); // Ajusta la URL si tu backend está en otro host/puerto
  }

  onRatingUpdated(): Observable<{ productoId: number, global: number }> {
    return new Observable(observer => {
      this.socket.on('ratingUpdated', (data: { productoId: number, global: number }) => {
        observer.next(data);
      });
    });
  }
}
