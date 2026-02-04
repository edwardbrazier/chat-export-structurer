import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MarkdownModule } from 'ngx-markdown';
import { ChatService } from '../../core/services/chat.service';
import { Thread, Message } from '../../models/thread.model';

@Component({
  selector: 'app-chat-viewer',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MarkdownModule,
  ],
  templateUrl: './chat-viewer.component.html',
  styleUrls: ['./chat-viewer.component.scss']
})
export class ChatViewerComponent implements OnInit {
  thread: Thread | null = null;
  isLoading = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService
  ) {}

  ngOnInit(): void {
    const threadId = this.route.snapshot.paramMap.get('id');
    if (threadId) {
      this.loadThread(threadId);
    }
  }

  loadThread(threadId: string): void {
    this.isLoading = true;
    this.error = null;

    this.chatService.getThreadById(threadId).subscribe({
      next: (thread) => {
        this.thread = thread;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading thread:', error);
        this.error = 'Failed to load conversation';
        this.isLoading = false;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  isUser(message: Message): boolean {
    return message.role === 'user';
  }

  isAssistant(message: Message): boolean {
    return message.role === 'assistant';
  }
}
