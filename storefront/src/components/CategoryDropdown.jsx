import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Filter, ChevronRight } from 'lucide-react';

const categoryData = {
  'Optics': ['LEDs', 'Displays', 'Sensors'],
  'Connectors': ['Headers', 'Plugs', 'Sockets'],
  'Electromechanical': ['Switches', 'Relays', 'Motors'],
  'Semiconductors': ['Diodes', 'Transistors', 'ICs'],
  'Passives': ['Resistors', 'Capacitors', 'Inductors']
};

export default function CategoryDropdown({ onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activePrimary, setActivePrimary] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setActivePrimary(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrimaryClick = (cat) => {
    setActivePrimary(activePrimary === cat ? null : cat);
  };

  const handleCategorySelect = (primary, secondary) => {
    const label = secondary ? `${primary} > ${secondary}` : primary;
    setSelectedCategory(label);
    if (onSelect) onSelect(label);
    setIsOpen(false);
    setActivePrimary(null);
  };

  return (
    <div className="category-dropdown" ref={dropdownRef}>
      <button 
        className={`dropdown-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setActivePrimary(null);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Filter size={18} className="filter-icon" />
        <span className="selected-category">{selectedCategory}</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu glass animate-fade-in">
          <div 
            className="dropdown-item" 
            onClick={() => {
              setSelectedCategory('All Categories');
              if (onSelect) onSelect('All Categories');
              setIsOpen(false);
            }}
          >
            All Categories
          </div>
          <div className="dropdown-divider" />
          {Object.keys(categoryData).map((primary) => (
            <div 
              key={primary} 
              className={`dropdown-item has-submenu ${activePrimary === primary ? 'active' : ''}`}
              onMouseEnter={() => setActivePrimary(primary)}
            >
              <span onClick={() => handleCategorySelect(primary)}>{primary}</span>
              <ChevronRight size={14} className="submenu-chevron" />
              
              {activePrimary === primary && (
                <div className="submenu glass animate-slide-in">
                   {categoryData[primary].map((secondary) => (
                     <div 
                       key={secondary} 
                       className="dropdown-item"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleCategorySelect(primary, secondary);
                       }}
                     >
                       {secondary}
                     </div>
                   ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
