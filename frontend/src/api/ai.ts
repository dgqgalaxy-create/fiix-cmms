import api from './axios';

export interface AIStatus {
  enabled: boolean;
  hasKey: boolean;
  model: string;
  fallbackModel?: string | null;
  provider: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIToolUsage {
  name: string;
  args: Record<string, unknown>;
}

export interface AIChatResponse {
  success: boolean;
  reply: string;
  toolsUsed: AIToolUsage[];
  model: string;
  provider: string;
}

export const getAIStatus = async (): Promise<AIStatus> => {
  const response = await api.get('/ai/status', { timeout: 15_000 });
  return response.data as AIStatus;
};

export const sendAIMessage = async (messages: AIChatMessage[]): Promise<AIChatResponse> => {
  const response = await api.post(
    '/ai/chat',
    { messages },
    {
      // El backend espera hasta 45 s al proveedor; damos margen para la red.
      timeout: 65_000
    }
  );
  return response.data as AIChatResponse;
};
