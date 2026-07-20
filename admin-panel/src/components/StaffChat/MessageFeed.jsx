import React from 'react';
import { Loader, MapPin, CheckCheck, Check, ChevronLeft, Paperclip } from 'lucide-react';

export default function MessageFeed({ 
  loading, 
  messages, 
  currentUser, 
  activeChat, 
  isAdminOrManager, 
  pinnedMessages, 
  togglePin, 
  formatImageUrl, 
  setReplyTo, 
  chatContainerRef, 
  handleScroll, 
  messagesEndRef 
}) {
  return (
    <div 
      className="chat-feed custom-scrollbar" 
      ref={chatContainerRef}
      onScroll={handleScroll}
      style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}
    >
      {loading && messages.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader className="spin" color="var(--primary-blue)" /></div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>No messages yet. Start the conversation!</div>
      ) : (
        messages.map((msg) => {
          const isMine = parseInt(msg.sender_id) === parseInt(currentUser.id);
          
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', gap: '12px', maxWidth: '85%', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                
                {!isMine && (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--secondary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                     {msg.profile_image ? <img src={msg.profile_image} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (msg.avatar_text || msg.sender_name.slice(0, 2).toUpperCase())}
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {!isMine && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px' }}>{msg.sender_name}</div>}
                  
                  <div className="message-bubble-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexDirection: isMine ? 'row-reverse' : 'row', width: '100%' }}>
                    <div style={{ 
                      padding: '10px 14px', 
                      background: isMine ? 'var(--primary-blue)' : 'var(--bg-surface-secondary)', 
                      color: isMine ? 'white' : 'var(--text-main)',
                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                      border: isMine ? 'none' : '1px solid var(--border-light)',
                      position: 'relative',
                      wordBreak: 'break-word',
                      flex: 1
                    }}>
                      {/* Quoted Message */}
                      {msg.reply_to_id && (
                        <div style={{ 
                          background: isMine ? 'rgba(255,255,255,0.15)' : 'var(--bg-main)', 
                          padding: '8px 12px', 
                          borderRadius: '8px', 
                          borderLeft: '4px solid ' + (isMine ? 'white' : 'var(--primary-blue)'),
                          marginBottom: '10px',
                          fontSize: '12px',
                          opacity: 0.95
                        }}>
                          <div style={{ fontWeight: 800, marginBottom: '2px', color: isMine ? 'white' : 'var(--primary-blue)' }}>{msg.reply_to_name}</div>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.reply_to_message}</div>
                        </div>
                      )}

                      {msg.is_pinned == 1 && (
                        <div style={{ position: 'absolute', top: '-10px', right: isMine ? 'auto' : '-10px', left: isMine ? '-10px' : 'auto', background: 'var(--bg-surface)', padding: '2px', borderRadius: '50%', border: '1px solid var(--border-light)' }}>
                          <MapPin size={14} color="#ef4444" fill="#ef4444" />
                        </div>
                      )}
                      
                      {msg.attachment_url && (
                        <div style={{ marginBottom: '8px', maxWidth: '300px', borderRadius: '8px', overflow: 'hidden' }}>
                          {msg.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i) != null ? (
                            <a href={formatImageUrl(msg.attachment_url)} target="_blank" rel="noopener noreferrer">
                              <img src={formatImageUrl(msg.attachment_url)} alt="Attachment" style={{ width: '100%', height: 'auto', display: 'block' }} />
                            </a>
                          ) : (
                            <a href={formatImageUrl(msg.attachment_url)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isMine ? 'white' : 'var(--primary-blue)', textDecoration: 'underline' }}>
                              <Paperclip size={16} /> View Attachment
                            </a>
                          )}
                        </div>
                      )}
                      
                      {msg.message}
                    </div>

                    <button 
                      onClick={() => setReplyTo({ id: msg.id, message: msg.message, name: msg.sender_name })}
                      style={{ 
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '50%', 
                        width: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        opacity: 0.6,
                        flexShrink: 0
                      }}
                      title="Reply"
                    >
                      <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', marginRight: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    
                    {isMine && activeChat !== 'global' && (
                      msg.is_read == 1 ? <CheckCheck size={14} color="#3b82f6" /> : <Check size={14} />
                    )}

                    {isAdminOrManager && activeChat === 'global' && msg.is_pinned == 0 && (
                      <span onClick={() => togglePin(msg.id, 0)} style={{ cursor: 'pointer', color: 'var(--primary-blue)', marginLeft: '8px' }}>Pin Message</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
