import { useEffect, useRef } from 'react';
import { socket, ensureSocketConnected } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../api/chat';

/**
 * ACK global de entrega: confirma chat_delivered aunque no estés en Mensajes.
 * Independiente del banner/toast (Layout remonta por ruta; este hook va en Layout).
 */
export function useChatDeliveryAck() {
  const { user } = useAuth();
  const myIdRef = useRef<string | undefined>(undefined);
  myIdRef.current = user?.id || user?.userId;

  useEffect(() => {
    const myId = myIdRef.current;
    if (!myId) return;

    ensureSocketConnected();

    const onMsg = (payload: { conversation_id: string; message: ChatMessage }) => {
      if (!payload?.conversation_id || !payload.message?.id) return;
      if (payload.message.author_id === myIdRef.current) return;
      if (payload.message.is_deleted) return;
      socket.emit('chat_delivered', {
        conversation_id: payload.conversation_id,
        message_id: payload.message.id,
      });
    };

    const onConnect = () => ensureSocketConnected();

    socket.on('chat_message', onMsg);
    socket.on('connect', onConnect);
    return () => {
      socket.off('chat_message', onMsg);
      socket.off('connect', onConnect);
    };
  }, [Boolean(user?.id || user?.userId)]);
}
