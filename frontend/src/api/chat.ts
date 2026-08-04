import api, { BACKEND_URL } from './axios';

export interface ChatUser {
  id: string;
  name: string;
  role: string;
  is_active?: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  author?: { id: string; name: string; role: string };
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  participants: Array<{
    user_id: string;
    joined_at: string;
    last_read_at?: string | null;
    user?: ChatUser;
  }>;
  last_message?: {
    id: string;
    body: string;
    author_id: string;
    author?: { id: string; name: string; role: string };
    created_at: string;
    attachment_url?: string | null;
  } | null;
  unread_count: number;
}

export const getChatUnreadSummary = async (): Promise<{ unread_total: number }> => {
  const res = await api.get('/chat/summary');
  return res.data;
};

export const listConversations = async (): Promise<ChatConversation[]> => {
  const res = await api.get('/chat/conversations');
  return res.data;
};

export const createDirectConversation = async (userId: string): Promise<ChatConversation> => {
  const res = await api.post('/chat/conversations/direct', { user_id: userId });
  return res.data;
};

export const createGroupConversation = async (
  title: string,
  userIds: string[]
): Promise<ChatConversation> => {
  const res = await api.post('/chat/conversations/group', { title, user_ids: userIds });
  return res.data;
};

export const addGroupParticipants = async (
  conversationId: string,
  userIds: string[]
): Promise<ChatConversation> => {
  const res = await api.post(`/chat/conversations/${conversationId}/participants`, {
    user_ids: userIds,
  });
  return res.data;
};

export const listMessages = async (
  conversationId: string,
  cursor?: string
): Promise<ChatMessage[]> => {
  const res = await api.get(`/chat/conversations/${conversationId}/messages`, {
    params: cursor ? { cursor } : undefined,
  });
  return res.data;
};

export const sendChatMessage = async (
  conversationId: string,
  data: { body?: string; attachment?: File | null }
): Promise<ChatMessage> => {
  const form = new FormData();
  if (data.body) form.append('body', data.body);
  if (data.attachment) form.append('attachment', data.attachment);
  const res = await api.post(`/chat/conversations/${conversationId}/messages`, form);
  return res.data;
};

export const markConversationRead = async (conversationId: string): Promise<void> => {
  await api.post(`/chat/conversations/${conversationId}/read`);
};

export const chatAttachmentUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
};
