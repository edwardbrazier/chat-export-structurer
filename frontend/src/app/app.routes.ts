import { Routes } from '@angular/router';
import { SearchComponent } from './features/search/search.component';
import { BrowseComponent } from './features/browse/browse.component';
import { ChatViewerComponent } from './features/chat-viewer/chat-viewer.component';

export const routes: Routes = [
  { path: '', component: SearchComponent },
  { path: 'browse', component: BrowseComponent },
  { path: 'chat/:id', component: ChatViewerComponent },
  { path: '**', redirectTo: '' }
];
