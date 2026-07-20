import React from 'react';
import { Users, Search, Megaphone, User } from 'lucide-react';

export default function ChatSidebar({ 
  users, 
  activeChat, 
  setActiveChat, 
  isAdminOrManager, 
  broadcastOptions, 
  setBroadcastOptions,
  formatImageUrl,
  getInitials 
}) {
  return (
    <div className="chat-sidebar" style={{ 
      width: '320px', 
      borderRight: '1px solid var(--border-light)', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--bg-main)'
    }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-surface-secondary)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
          <Users size={18} color="var(--primary-blue)" /> Staff Members
        </h2>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input 
            type="text" 
            placeholder="Filter names..."
            style={{ 
              width: '100%', 
              padding: '7px 12px 7px 32px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-light)', 
              background: 'var(--bg-surface)', 
              outline: 'none', 
              color: 'var(--text-main)', 
              fontSize: '13px',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
          />
        </div>
      </div>
      
      <div className="chat-contacts custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: '12px' }}>
        
        <div 
          onClick={() => setActiveChat('global')}
          style={{
            padding: '12px',
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: activeChat === 'global' ? 'var(--bg-surface)' : 'transparent',
            border: `1px solid ${activeChat === 'global' ? 'var(--primary-blue)' : 'transparent'}`,
            marginBottom: activeChat === 'global' && isAdminOrManager ? '8px' : '16px',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
             <Megaphone size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>Global Updates</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Company-wide broadcasts</div>
          </div>
        </div>

        {isAdminOrManager && activeChat === 'global' && (
           <div style={{ padding: '16px', margin: '0 8px 16px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
             <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Megaphone size={14} /> Broadcast Tools
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                 <input 
                   type="checkbox" 
                   checked={broadcastOptions.isPinned} 
                   onChange={(e) => setBroadcastOptions(prev => ({ ...prev, isPinned: e.target.checked }))} 
                   style={{ accentColor: 'var(--primary-blue)', cursor: 'pointer', width: '16px', height: '16px' }}
                 />
                 Pin Announcement
               </label>
               
               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                 <input 
                   type="checkbox" 
                   checked={broadcastOptions.sendEmail} 
                   onChange={(e) => setBroadcastOptions(prev => ({ ...prev, sendEmail: e.target.checked }))}
                   style={{ accentColor: 'var(--primary-blue)', cursor: 'pointer', width: '16px', height: '16px' }}
                 />
                 Alert via Email
               </label>

               <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                 <input 
                   type="checkbox" 
                   checked={broadcastOptions.sendSms} 
                   onChange={(e) => setBroadcastOptions(prev => ({ ...prev, sendSms: e.target.checked }))}
                   style={{ accentColor: 'var(--primary-blue)', cursor: 'pointer', width: '16px', height: '16px' }}
                 />
                 Alert via SMS
               </label>
             </div>
           </div>
        )}

        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '8px' }}>
          Direct Messages
        </div>

        {users.map(u => (
          <div 
            key={u.id}
            onClick={() => setActiveChat(u.id)}
            style={{
              padding: '12px',
              borderRadius: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: activeChat === u.id ? 'var(--bg-surface)' : 'transparent',
              border: `1px solid ${activeChat === u.id ? 'var(--primary-blue)' : 'transparent'}`,
              transition: 'all 0.2s',
              marginBottom: '4px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--secondary-blue)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', position: 'relative' }}>
              {u.profile_image ? (
                <img src={formatImageUrl(u.profile_image)} alt={u.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                getInitials(u)
              )}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', border: '2px solid var(--bg-main)' }}></div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{u.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</div>
            </div>
            {u.unread_count > 0 && (
              <div style={{ background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '10px' }}>
                {u.unread_count}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
