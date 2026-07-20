import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin, Navigation, Search, Building2, Store, ExternalLink, X } from 'lucide-react';
import { fetchPickupLocations } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for different location types
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: white;
        font-size: 14px;
        font-weight: bold;
      ">📍</div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const mainStoreIcon = createCustomIcon('#3B82F6'); // Blue for main store
const pickupIcon = createCustomIcon('#F59E0B'); // Orange for pickup locations

// Component to fit map bounds to all markers
function MapBounds({ markers }) {
  const map = useMap();
  
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [markers, map]);
  
  return null;
}

export default function Locations() {
  const { formatPrice } = useSettings();
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  // Main store location (hardcoded for now - could be moved to site settings)
  const mainStore = {
    id: 'main-store',
    name: 'Main Store',
    address: 'Madina, Accra, Ghana',
    city: 'Accra',
    lat: 5.6833, // Approximate coordinates for Madina, Accra
    lng: -0.1667,
    isMainStore: true,
    fee: 0
  };

  useEffect(() => {
    const loadLocations = async () => {
      setLoading(true);
      try {
        const data = await fetchPickupLocations();
        // Use coordinates from the API response
        const locationsWithCoords = data.map((loc) => ({
          ...loc,
          lat: loc.latitude ? parseFloat(loc.latitude) : null,
          lng: loc.longitude ? parseFloat(loc.longitude) : null,
          isPickupLocation: true
        })).filter(loc => loc.lat !== null && loc.lng !== null); // Only include locations with valid coordinates
        setPickupLocations(locationsWithCoords);
      } catch (error) {
        console.error('Failed to load pickup locations:', error);
      } finally {
        setLoading(false);
      }
    };
    loadLocations();
  }, []);

  const allLocations = useMemo(() => {
    return [mainStore, ...pickupLocations];
  }, [pickupLocations]);

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return allLocations;
    const query = searchQuery.toLowerCase();
    return allLocations.filter(loc => 
      loc.name.toLowerCase().includes(query) ||
      loc.city.toLowerCase().includes(query) ||
      loc.address.toLowerCase().includes(query)
    );
  }, [allLocations, searchQuery]);

  const handleLocationClick = (location) => {
    setSelectedLocation(location);
    setMapKey(prev => prev + 1); // Force map re-render to pan to location
  };

  const openInGoogleMaps = (address) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getDirections = (address) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="page-shell" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="loading-state">Loading locations...</div>
      </div>
    );
  }

  return (
    <div className="page-shell animate-fade-in">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Our Locations</h1>
        <p className="page-subtitle">Find our main store and pickup locations near you</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <Search 
            size={20} 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} 
          />
          <input
            type="text"
            placeholder="Search by city, name, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px 14px 48px',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              background: 'var(--bg-surface)',
              fontSize: '15px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary-blue)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                padding: '4px'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Map and List Layout */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr',
          gap: '24px',
          minHeight: '600px'
        }}>
          {/* Map */}
          <div style={{ 
            borderRadius: '16px', 
            overflow: 'hidden',
            border: '1px solid var(--border-light)',
            height: '500px'
          }}>
            <MapContainer
              key={mapKey}
              center={[mainStore.lat, mainStore.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredLocations.map((location) => (
                <Marker
                  key={location.id}
                  position={[location.lat, location.lng]}
                  icon={location.isMainStore ? mainStoreIcon : pickupIcon}
                  eventHandlers={{
                    click: () => setSelectedLocation(location)
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: '200px' }}>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                        {location.isMainStore && <Store size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                        {location.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        {location.address}
                      </div>
                      {location.isPickupLocation && (
                        <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                          <strong>Pickup Fee:</strong> {formatPrice(Number(location.fee || 0))}
                        </div>
                      )}
                      <button
                        onClick={() => getDirections(location.address)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#3B82F6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Navigation size={12} />
                        Get Directions
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
              
              <MapBounds markers={filteredLocations.map(loc => ({ lat: loc.lat, lng: loc.lng }))} />
            </MapContainer>
          </div>

          {/* Location List */}
          <div style={{ 
            display: 'grid', 
            gap: '12px',
            maxHeight: '500px',
            overflowY: 'auto'
          }}>
            {filteredLocations.length === 0 ? (
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: 'var(--text-muted)',
                background: 'var(--bg-main)',
                borderRadius: '12px'
              }}>
                No locations found matching your search.
              </div>
            ) : (
              filteredLocations.map((location) => (
                <div
                  key={location.id}
                  onClick={() => handleLocationClick(location)}
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: selectedLocation?.id === location.id 
                      ? 'var(--bg-surface)' 
                      : 'var(--bg-main)',
                    border: selectedLocation?.id === location.id 
                      ? '2px solid var(--primary-blue)' 
                      : '1px solid var(--border-light)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: location.isMainStore 
                        ? 'var(--primary-blue)' 
                        : 'var(--primary-gold)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {location.isMainStore ? <Store size={20} /> : <Building2 size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '16px' }}>
                          {location.name}
                        </span>
                        {location.isMainStore && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'var(--primary-blue)',
                            color: 'white',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 700
                          }}>
                            MAIN STORE
                          </span>
                        )}
                        {location.isPickupLocation && (
                          <span style={{
                            padding: '2px 8px',
                            background: 'var(--primary-gold)',
                            color: 'white',
                            borderRadius: '10px',
                            fontSize: '10px',
                            fontWeight: 700
                          }}>
                            PICKUP
                          </span>
                        )}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <MapPin size={13} />
                        {location.address}
                      </div>
                    </div>
                  </div>
                  
                  {location.isPickupLocation && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--text-muted)',
                      paddingLeft: '52px'
                    }}>
                      <strong>Pickup Fee:</strong> {formatPrice(Number(location.fee || 0))}
                    </div>
                  )}

                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    paddingLeft: '52px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        getDirections(location.address);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        background: 'var(--primary-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Navigation size={14} />
                      Directions
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInGoogleMaps(location.address);
                      }}
                      style={{
                        padding: '10px 16px',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ExternalLink size={14} />
                      Google Maps
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .locations-grid {
            grid-template-columns: 1.5fr 1fr !important;
          }
        }
        
        .custom-marker {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .leaflet-popup-content {
          margin: 12px 16px;
        }
      `}</style>
    </div>
  );
}
