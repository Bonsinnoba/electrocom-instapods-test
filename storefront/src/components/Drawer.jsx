import React from 'react';
import { X } from 'lucide-react';

export default function Drawer({ id, title, isOpen, onClose, children }) {
  return (
    <>
      <div 
        className={`drawer-backdrop ${isOpen ? 'active' : ''}`} 
        id={`${id}-backdrop`} 
        onClick={onClose}
      ></div>
      <div className={`drawer ${isOpen ? 'active' : ''}`} id={id}>
        <div className="drawer-header">
          <h2>{title}</h2>
          <div className="drawer-close" onClick={onClose} data-tooltip="Close" data-tooltip-pos="bottom">
            <X size={20} />
          </div>
        </div>
        <div className="drawer-body">
          {children}
        </div>
      </div>
    </>
  );
}
