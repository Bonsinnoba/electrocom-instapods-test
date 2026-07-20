import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, ChevronRight, Building2, Store, ArrowRight } from 'lucide-react';
import { fetchPickupLocations } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function MapCard() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBranch, setActiveBranch] = useState(null);

  // Main store location
  const mainStore = {
    id: 'main-store',
    city: 'Accra',
    address: 'Madina, Accra, Ghana',
    label: 'Main Store',
    isMainStore: true
  };

  useEffect(() => {
    const loadLocations = async () => {
      setLoading(true);
      try {
        const data = await fetchPickupLocations();
        const pickupBranches = data.map(loc => ({
          id: loc.id,
          city: loc.city || 'Unknown',
          address: loc.address,
          label: 'Pickup Location',
          isPickupLocation: true,
          fee: loc.fee
        }));
        setBranches([mainStore, ...pickupBranches]);
        setActiveBranch(mainStore);
      } catch (error) {
        console.error('Failed to load pickup locations:', error);
        // Fallback to main store only
        setBranches([mainStore]);
        setActiveBranch(mainStore);
      } finally {
        setLoading(false);
      }
    };
    loadLocations();
  }, []);

  const googleMapsUrl = activeBranch 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeBranch.address)}`
    : '';

  const handleBranchClick = (branch) => {
    setActiveBranch(branch);
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.address)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="map-fallback-card glass" style={{
        width: '100%',
        minHeight: '520px',
        borderRadius: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-main) 100%)',
        border: '1px solid var(--border-light)',
        padding: '32px'
      }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading locations...</div>
      </div>
    );
  }

  return (
    <div className="map-fallback-card glass" style={{
      width: '100%',
      minHeight: '520px',
      borderRadius: '24px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-main) 100%)',
      border: '1px solid var(--border-light)',
      padding: '32px',
      textAlign: 'center',
      position: 'relative'
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '20px',
        background: 'rgba(59, 130, 246, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--primary-blue)',
        margin: '0 auto 16px'
      }}>
        <MapPin size={32} />
      </div>

      <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)' }}>Our Locations</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px' }}>
        Select a location to open in Google Maps
      </p>

      {/* Branch Selector */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        width: '100%', 
        marginBottom: '24px'
      }}>
        {branches.map(branch => (
          <div 
            key={branch.id}
            onClick={() => handleBranchClick(branch)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '16px',
              borderRadius: '16px',
              background: activeBranch.id === branch.id ? 'var(--bg-surface)' : 'rgba(0,0,0,0.02)',
              border: activeBranch.id === branch.id ? '2.5px solid var(--primary-blue)' : '1px solid var(--border-light)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
              position: 'relative'
            }}
          >
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '12px', 
              background: activeBranch.id === branch.id 
                ? (branch.isMainStore ? 'var(--primary-blue)' : 'var(--primary-gold)') 
                : 'var(--bg-main)',
              color: activeBranch.id === branch.id ? 'white' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {branch.isMainStore ? <Store size={20} /> : <Building2 size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: activeBranch.id === branch.id ? (branch.isMainStore ? 'var(--primary-blue)' : 'var(--primary-gold)') : 'var(--text-main)' }}>
                {branch.city}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                {branch.label} <ExternalLink size={10} />
              </div>
            </div>
            <ChevronRight size={18} color={activeBranch.id === branch.id ? (branch.isMainStore ? "var(--primary-blue)" : "var(--primary-gold)") : "var(--border-light)"} />
          </div>
        ))}
      </div>

      {/* View Full Map Button */}
      <button
        onClick={() => navigate('/locations')}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--primary-blue), #2563eb)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)';
          e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        View Full Map <ArrowRight size={16} />
      </button>

      {/* Decorative Background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.03,
        pointerEvents: 'none',
        zIndex: -1,
        background: 'radial-gradient(circle at 2px 2px, var(--text-muted) 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }}></div>
    </div>
  );
}
