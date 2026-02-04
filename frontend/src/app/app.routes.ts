import { Routes } from '@angular/router';
import { SearchComponent } from './features/search/search.component';
import { ChatViewerComponent } from './features/chat-viewer/chat-viewer.component';

export const routes: Routes = [
  { path: '', component: SearchComponent },
  { path: 'chat/:id', component: ChatViewerComponent },
  { path: '**', redirectTo: '' }
];
