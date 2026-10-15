import { useEffect, useState } from 'react';
import type { Message } from '../../server/store';

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/emulator/ws`);
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => setMessages(JSON.parse(event.data).messages);
      socket.onclose = () => {
        setConnected(false);
        retry = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => {
      clearTimeout(retry);
      socket.onclose = null;
      socket.close();
    };
  }, []);

  return { messages, connected };
}
