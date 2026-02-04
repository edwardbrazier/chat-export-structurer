import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SearchRequest, SearchResponse } from '../../models/thread.model';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  search(request: SearchRequest): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/search`, request);
  }

  keywordSearch(request: Omit<SearchRequest, 'mode'>): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/search/keyword`, request);
  }

  semanticSearch(request: Omit<SearchRequest, 'mode'>): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${this.apiUrl}/search/semantic`, request);
  }
}
