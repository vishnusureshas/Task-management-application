import { useEffect, useRef, useState } from 'react';
import { getSocket, joinTaskRoom, leaveTaskRoom } from './socket.js';
import { TASK_EVENTS } from './taskEvents.js';

// Joins `task:{id}` rooms for the given ids and forwards the 9 plan
// events to onEvent(event, data). Handles leave on unmount/id change,
// re-join + onReconnect catch-up refetch on reconnect, and exposes the
// connection flag so pages can poll while disconnected (plan §6 rule 3).
export default function useTaskSocket({ taskIds = [], onEvent, onReconnect }) {
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;

  const [connected, setConnected] = useState(() => getSocket().connected);
  const idsKey = JSON.stringify([...taskIds].map(Number).sort((a, b) => a - b));

  useEffect(() => {
    const ids = JSON.parse(idsKey);
    const socket = getSocket();
    let cancelled = false;
    // First `connect` after mount is the initial connection (initial REST
    // fetch already covers state) — only later ones are reconnects.
    let isFirstConnect = !socket.connected;

    setConnected(socket.connected);
    ids.forEach((id) => {
      joinTaskRoom(id).catch(() => {});
    });

    const handlers = {};
    TASK_EVENTS.forEach((event) => {
      handlers[event] = (data) => {
        if (!cancelled) onEventRef.current?.(event, data);
      };
      socket.on(event, handlers[event]);
    });

    const handleConnect = () => {
      if (cancelled) return;
      setConnected(true);
      if (isFirstConnect) {
        isFirstConnect = false;
        return;
      }
      ids.forEach((id) => {
        joinTaskRoom(id).catch(() => {});
      });
      onReconnectRef.current?.();
    };
    const handleDisconnect = () => {
      if (!cancelled) setConnected(false);
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      cancelled = true;
      ids.forEach((id) => leaveTaskRoom(id));
      TASK_EVENTS.forEach((event) => socket.off(event, handlers[event]));
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [idsKey]);

  return { connected };
}
