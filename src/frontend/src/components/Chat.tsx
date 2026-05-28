// src/components/Chat.tsx
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import moment from 'moment';
import { sendMessageStream, getConversations, getConversationMessages } from '../services/api';
import './Chat.css';


// 消息类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// 会话类型
interface Conversation {
  id: string;
  title: string;
  created_at: number;
}

// 预设推荐问题
const SUGGESTED_QUESTIONS = [
  "如何开始创建Roblox游戏？",
  "帮我整理50个英语日常交流中最常用的短句",
  "推荐几个Docker容器管理工具",
  "怎样通过笔记构建个人知识体系？",
  "指导我用Notion搭建资源库",
];

export const Chat: React.FC = () => {
  // 状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [useRag, setUseRag] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(scrollToBottom, [messages]);

  // 加载会话列表
  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const data = await getConversations();
      // 确保 data 是数组
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('加载会话列表失败', err);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  // 加载特定会话的消息
  const loadConversationMessages = async (convId: string) => {
    try {
      const data = await getConversationMessages(convId);
      const formattedMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.created_at,
      }));
      setMessages(formattedMessages);
      setCurrentConversationId(convId);
      setShowSuggestions(formattedMessages.length === 0);
    } catch (err) {
      console.error('加载消息失败', err);
    }
  };

  // 初始化加载会话列表
  useEffect(() => {
    loadConversations();
  }, []);

  // 刷新左侧列表（新对话后调用）
  const refreshConversationList = () => {
    loadConversations();
  };

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    // 占位助手消息
    const assistantPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, assistantPlaceholder]);

    let fullReply = '';
    sendMessageStream(
      content.trim(),
      currentConversationId,
      useRag,
      (chunk) => {
        fullReply += chunk;
        setMessages(prev => {
          return prev.map(msg =>
            msg.id === assistantPlaceholder.id ? { ...msg, content: fullReply } : msg
          )
        });
      },
      async (finalReply) => {
        setIsLoading(false);
        // 刷新左侧会话列表（新会话会出现）
        await refreshConversationList();
        // 如果没有当前会话ID，则选中最新会话（简单处理）
        if (!currentConversationId && conversations.length > 0) {
          const latest = conversations[0];
          if (latest) setCurrentConversationId(latest.id);
        }
      },
      (err) => {
        console.error(err);
        setIsLoading(false);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantPlaceholder.id
              ? { ...msg, content: `❌ 出错：${err.message}` }
              : msg
          )
        );
      }
    );
  };

  // 新建对话
  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowSuggestions(true);
    setIsLoading(false);
    inputRef.current?.focus();
  };

  // 点击历史会话
  const handleSelectConversation = (convId: string) => {
    if (convId === currentConversationId) return;
    loadConversationMessages(convId);
  };

  // 处理推荐问题点击
  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="app-layout">
      {/* 全宽顶部栏 */}
      <header className="global-header">
        <div className="header-left">
          <h1>来聊吧</h1>
          {/* <span className="model-badge">DeepSeek</span> */}
        </div>
        <div className="header-right">
          <label className="rag-switch">
            <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
            <span>📚 知识库增强</span>
          </label>
          <button onClick={handleNewChat} className="new-chat-btn">
            ➕ 新对话
          </button>
        </div>
      </header>

      {/* 主体：左侧边栏 + 右侧聊天区 */}
      <div className="main-layout">
        {/* 左侧历史栏（无新建按钮） */}
        <aside className="sidebar">
          <div className="conversation-list">
            {loadingConversations && <div className="loading-text">加载中...</div>}
            {!loadingConversations && conversations.length === 0 && (
              <div className="empty-text">暂无历史对话</div>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''}`}
                onClick={() => handleSelectConversation(conv.id)}
              >
                <div className="conv-title">{conv.title || '新对话'}</div>
                <div className="conv-date">{moment(conv.created_at * 1000).format('YYYY-MM-DD HH:mm:ss')}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧聊天区域 */}
        <div className="chat-container">
          <div className="messages-area">
            {messages.length === 0 ? (
              // 欢迎界面 + 推荐问题
              <div className="welcome-screen">
                <div className="welcome-avatar">🤖</div>
                <h2>你好，我是 AI 助手</h2>
                <p className="welcome-sub">我可以帮你解答问题、整理信息、提供创意</p>
                <div className="suggestions-grid">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <button key={idx} className="suggestion-btn" onClick={() => handleSuggestionClick(q)}>
                      {q}
                    </button>
                  ))}
                </div>
                <div className="info-note">内容由 AI 生成，请仔细甄别</div>
              </div>
            ) : (
              // 消息列表
              <div className="messages-list">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                  >
                    <div className="message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
                    <div className="message-content">
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown>{msg.content || ' '}</ReactMarkdown>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      {msg.role === 'assistant' && msg.content === '' && isLoading && (
                        <span className="typing-indicator">···</span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="input-area">
            <div className="input-container">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && sendMessage(input)}
                placeholder="输入你的问题..."
                disabled={isLoading}
                className="chat-input"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="send-btn"
              >
                {isLoading ? '⏳' : '📤'}
              </button>
            </div>
            <div className="input-hint">AI 生成内容仅供参考，请谨慎甄别</div>
          </div>
        </div>
      </div>
    </div>
  );
};