import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { SearchService } from '../../core/services/search.service';
import { ThreadResult } from '../../models/thread.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  query = '';
  searchMode: 'keyword' | 'semantic' | 'hybrid' = 'hybrid';
  results: ThreadResult[] = [];
  isLoading = false;
  executionTime = 0;

  constructor(
    private searchService: SearchService,
    private router: Router
  ) {}

  ngOnInit(): void {}

  onSearch(): void {
    if (!this.query.trim()) {
      return;
    }

    this.isLoading = true;

    this.searchService.search({
      query: this.query,
      mode: this.searchMode,
      limit: 10,
    }).subscribe({
      next: (response) => {
        this.results = response.results;
        this.executionTime = response.metadata.executionTimeMs;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Search error:', error);
        this.isLoading = false;
      }
    });
  }

  viewThread(threadId: string): void {
    this.router.navigate(['/chat', threadId]);
  }

  onBrowse(): void {
    this.router.navigate(['/browse']);
  }

  getMatchSourceColor(source: string): string {
    switch (source) {
      case 'keyword': return 'primary';
      case 'semantic': return 'accent';
      case 'both': return 'warn';
      default: return '';
    }
  }

  truncatePreview(text: string, maxLength = 200): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}
