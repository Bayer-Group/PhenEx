import { api } from '../httpClient';

export interface ChatSession {
  id: string;
  user_id: string;
  study_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  first_message: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  study_id: string | null;
  role: 'user' | 'assistant';
  text: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export async function createChatSession(params: {
  study_id?: string;
  title?: string;
  session_id?: string;
}): Promise<ChatSession> {
  const response = await api.post('/chat/sessions', params);
  return response.data;
}

export async function getChatSessions(study_id?: string): Promise<ChatSession[]> {
  const response = await api.get('/chat/sessions', { params: study_id ? { study_id } : {} });
  return response.data;
}

export async function getChatMessages(session_id: string): Promise<ChatMessage[]> {
  const response = await api.get(`/chat/sessions/${session_id}/messages`);
  return response.data;
}

export async function addChatMessage(
  session_id: string,
  body: { study_id?: string; role: 'user' | 'assistant'; text: string; metadata?: Record<string, unknown> }
): Promise<ChatMessage> {
  const response = await api.post(`/chat/sessions/${session_id}/messages`, body);
  return response.data;
}

export async function updateChatSessionTitle(session_id: string, title: string): Promise<void> {
  await api.patch(`/chat/sessions/${session_id}`, { title });
}

export async function deleteChatSession(session_id: string): Promise<void> {
  await api.delete(`/chat/sessions/${session_id}`);
}
