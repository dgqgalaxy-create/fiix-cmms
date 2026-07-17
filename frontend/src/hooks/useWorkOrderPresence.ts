import { useEffect, useState } from 'react';
import { socket } from '../api/socket';
import { useAuth } from '../context/AuthContext';

export type WoPresenceEditor = { userId: string; name: string } | null;

export type WoPresenceState = {
  editor: WoPresenceEditor;
  viewers: { userId: string; name: string }[];
  /** True while we own the edit lock (or no remote editor yet and we joined). */
  canEdit: boolean;
  remoteEditorName: string | null;
};

const HEARTBEAT_MS = 15_000;

export function useWorkOrderPresence(workOrderId: string | null | undefined, isOpen: boolean): WoPresenceState {
  const { user } = useAuth();
  const myId = user?.userId;
  const [editor, setEditor] = useState<WoPresenceEditor>(null);
  const [viewers, setViewers] = useState<{ userId: string; name: string }[]>([]);

  useEffect(() => {
    if (!isOpen || !workOrderId || !myId) {
      setEditor(null);
      setViewers([]);
      return;
    }

    const payload = { workOrderId };

    const onPresence = (data: {
      workOrderId: string;
      editor: WoPresenceEditor;
      viewers: { userId: string; name: string }[];
    }) => {
      if (data.workOrderId !== workOrderId) return;
      setEditor(data.editor);
      setViewers(data.viewers || []);
    };

    const join = () => {
      socket.emit('wo:join', payload);
    };

    join();
    socket.on('wo:presence', onPresence);
    socket.on('connect', join);

    const heartbeat = window.setInterval(() => {
      if (socket.connected) {
        socket.emit('wo:heartbeat', payload);
      }
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(heartbeat);
      socket.off('wo:presence', onPresence);
      socket.off('connect', join);
      socket.emit('wo:leave', payload);
      setEditor(null);
      setViewers([]);
    };
  }, [isOpen, workOrderId, myId]);

  const canEdit = !editor || (!!myId && editor.userId === myId);
  const remoteEditorName = editor && myId && editor.userId !== myId ? editor.name : null;

  return { editor, viewers, canEdit, remoteEditorName };
}
