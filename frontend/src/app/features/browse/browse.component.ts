import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ChatService } from '../../core/services/chat.service';
import { Thread } from '../../models/thread.model';

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './browse.component.html',
  styleUrls: ['./browse.component.scss']
})
export class BrowseComponent implements OnInit {
  threads: Thread[] = [];
  currentPage = 1;
  pageSize = 20;
  isLoading = false;
  hasMore = true;
  selectedPlatform?: string;
  platforms: string[] = [];
  totalItems = 0;

  constructor(
    private chatService: ChatService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadThreads();
  }

  loadThreads(): void {
    if (this.isLoading || !this.hasMore) {
      return;
    }

    this.isLoading = true;

    this.chatService.getThreads(
      this.currentPage,
      this.pageSize,
      this.selectedPlatform
    ).subscribe({
      next: (response) => {
        this.threads = [...this.threads, ...response.items];
        this.totalItems = response.totalItems;
        this.currentPage++;
        this.hasMore = this.threads.length < response.totalItems;
        this.isLoading = false;

        // Extract unique platforms from loaded threads
        this.updatePlatforms();
      },
      error: (error) => {
        console.error('Error loading threads:', error);
        this.isLoading = false;
      }
    });
  }

  loadMoreThreads(): void {
    this.loadThreads();
  }

  onPlatformChange(): void {
    // Reset state and reload from beginning
    this.threads = [];
    this.currentPage = 1;
    this.hasMore = true;
    this.loadThreads();
  }

  viewThread(threadId: string): void {
    this.router.navigate(['/chat', threadId]);
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    if (this.isLoading || !this.hasMore) {
      return;
    }

    const scrollPosition = window.pageYOffset + window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    // Load more when within 500px of bottom
    if (documentHeight - scrollPosition < 500) {
      this.loadMoreThreads();
    }
  }

  private updatePlatforms(): void {
    const uniquePlatforms = new Set<string>();
    this.threads.forEach(thread => uniquePlatforms.add(thread.platform));
    this.platforms = Array.from(uniquePlatforms).sort();
  }

  truncateTitle(title: string, maxLength = 100): string {
    if (title.length <= maxLength) {
      return title;
    }
    return title.substring(0, maxLength) + '...';
  }
}
