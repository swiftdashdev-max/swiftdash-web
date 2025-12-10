'use client';

import React from 'react';

interface DriverMarkerProps {
  driverName: string;
  avatarUrl: string | null;
  heading?: number; // 0-360 degrees
  isOnline: boolean;
  lastUpdateSeconds: number;
  speed?: number; // km/h
  onClick?: () => void;
}

/**
 * Custom driver marker for Mapbox map
 * Shows driver profile picture with rotation and status indicators
 */
export function DriverMarker({
  driverName,
  avatarUrl,
  heading = 0,
  isOnline,
  lastUpdateSeconds,
  speed,
  onClick,
}: DriverMarkerProps) {
  // Get initials from driver name
  const getInitials = (name: string): string => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Determine border color based on status
  const getBorderColor = (): string => {
    if (!isOnline || lastUpdateSeconds > 30) return '#ef4444'; // red - offline/stale
    if (speed && speed > 5) return '#10b981'; // green - moving
    return '#f59e0b'; // yellow - online but idle
  };

  // Generate background color from name (consistent per driver)
  const getBackgroundColor = (name: string): string => {
    const colors = [
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#f97316', // orange
      '#14b8a6', // teal
      '#6366f1', // indigo
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const borderColor = getBorderColor();
  const shouldPulse = isOnline && lastUpdateSeconds <= 10;

  return (
    <div
      className="driver-marker-container"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        position: 'relative',
        width: '48px',
        height: '48px',
      }}
    >
      {/* Outer pulsing border */}
      <div
        className={shouldPulse ? 'pulse-ring' : ''}
        style={{
          position: 'absolute',
          top: '-4px',
          left: '-4px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          border: `3px solid ${borderColor}`,
          opacity: shouldPulse ? 0.6 : 1,
        }}
      />

      {/* Main marker circle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: `3px solid ${borderColor}`,
          backgroundColor: 'white',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.2s ease',
          transform: 'scale(1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={driverName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              // Fallback to initials if image fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          // Fallback to initials
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: getBackgroundColor(driverName),
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {getInitials(driverName)}
          </div>
        )}
      </div>

      {/* Direction arrow (rotates based on heading) */}
      {heading !== undefined && (
        <div
          style={{
            position: 'absolute',
            top: '-8px',
            left: '50%',
            transform: `translateX(-50%) rotate(${heading}deg)`,
            transformOrigin: 'center bottom',
            transition: 'transform 0.5s ease-out',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: `12px solid ${borderColor}`,
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Speed badge (if moving) */}
      {speed && speed > 5 && (
        <div
          style={{
            position: 'absolute',
            bottom: '-8px',
            right: '-8px',
            backgroundColor: '#10b981',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {Math.round(speed)} km/h
        </div>
      )}

      {/* Pulse animation styles */}
      <style jsx>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.3;
          }
          100% {
            transform: scale(1);
            opacity: 0.6;
          }
        }

        .pulse-ring {
          animation: pulse-ring 2s ease-out infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Helper function to create a DOM element for Mapbox marker
 * Renders React component into a div that Mapbox can use
 */
export function createDriverMarkerElement(props: DriverMarkerProps): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'driver-marker-wrapper';
  
  // We'll render the React component using ReactDOM in the tracking page
  // This function just creates the container element
  
  return el;
}
