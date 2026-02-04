export interface Message {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}
