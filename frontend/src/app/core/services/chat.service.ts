import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Thread, PaginatedResponse } from '../../models/thread.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getThreads(page = 1, pageSize = 20, platform?: string): Observable<PaginatedResponse<Thread>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (platform) {
      params = params.set('platform', platform);
    }

    return this.http.get<PaginatedResponse<Thread>>(`${this.apiUrl}/chats`, { params });
  }

  getThreadById(threadId: string): Observable<Thread> {
    return this.http.get<Thread>(`${this.apiUrl}/chats/${threadId}`);
  }
}
