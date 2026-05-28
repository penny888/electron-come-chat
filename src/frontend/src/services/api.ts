// API service
// 生产环境下，Electron 主进程会启动后端服务在 localhost:3000
const API_BASE = import.meta.env.PROD 
  ? 'http://localhost:3000/api'   // 生产环境
  : '/api';                        // 开发环境（走 Vite 代理）


// 新增：获取用户的所有会话列表
export async function getConversations() {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json(); // 返回 [{ id, title, updated_at }]
}

// 新增：获取某个会话的完整消息历史
export async function getConversationMessages(conversationId: string) {
  const res = await fetch(`${API_BASE}/chat/history/${conversationId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json(); // 返回 { messages: [...] }
}



// 流式请求使用EventSource
export function sendMessageStream(
  message: string,
  conversationId: string | null,
  useRag: boolean,
  onChunk: (chunk: string) => void,
  onDone: (fullReply: string) => void,
  onError: (err: any) => void
) {
  // 注意：POST SSE 不能用EventSource，这里用fetch读取ReadableStream
  fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId, useRag }),
  }).then(async (response) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.chunk) onChunk(data.chunk);
          if (data.done) onDone(data.fullReply);
          if (data.error) onError(data.error);
        }
      }
    }
  }).catch(onError);
}