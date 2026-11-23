import { useEffect, useRef, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';

type SocketSnapshot = {
  socket: Socket | null;
  isConnected: boolean;
};

let sharedSocket: Socket | null = null;
let sharedToken: string | null = null;
let sharedConnected = false;
let activeConsumers = 0;

let snapshot: SocketSnapshot = {
  socket: null,
  isConnected: false,
};

const listeners = new Set<() => void>();

const updateSnapshot = () => {
  snapshot = {
    socket: sharedSocket,
    isConnected: sharedConnected,
  };

  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

const getServerSnapshot = () => ({
  socket: null,
  isConnected: false,
});

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  return apiUrl.replace(/\/api\/?$/, '');
};

const disconnectSharedSocket = () => {
  if (!sharedSocket) return;

  sharedSocket.removeAllListeners();
  sharedSocket.disconnect();

  sharedSocket = null;
  sharedToken = null;
  sharedConnected = false;

  updateSnapshot();
};

const ensureSharedSocket = (token: string): Socket => {
  if (sharedSocket && sharedToken === token) {
    return sharedSocket;
  }

  disconnectSharedSocket();

  const socket = io(getSocketUrl(), {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    sharedConnected = true;
    updateSnapshot();
  });

  socket.on('disconnect', () => {
    sharedConnected = false;
    updateSnapshot();
  });

  socket.on('connect_error', (error) => {
    sharedConnected = false;
    updateSnapshot();
    console.warn('[socket.io] Error de conexión:', error.message);
  });

  sharedSocket = socket;
  sharedToken = token;
  sharedConnected = socket.connected;

  updateSnapshot();

  return socket;
};

export const useSocket = (token: string | null) => {
  const socketState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      socketRef.current = null;
      return;
    }

    activeConsumers += 1;

    const nextSocket = ensureSharedSocket(token);
    socketRef.current = nextSocket;

    return () => {
      activeConsumers = Math.max(0, activeConsumers - 1);

      if (activeConsumers === 0) {
        disconnectSharedSocket();
      }
    };
  }, [token]);

  useEffect(() => {
    socketRef.current = token ? socketState.socket : null;
  }, [token, socketState.socket]);

  return {
    socket: token ? socketState.socket : null,
    isConnected: token ? socketState.isConnected : false,
  };
};