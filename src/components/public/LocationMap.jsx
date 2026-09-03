import React from 'react';
import { MapPin } from 'lucide-react';
import { displayBrand } from '../../config/brand';

export default function LocationMap({ name = '', address = '' }) {
  const locationName = displayBrand(name);
  const cleanAddress = String(address || '').trim();
  const hasLocation = Boolean(cleanAddress || String(name || '').trim());

  return (
    <div
      className={`bt-location-visual bt-decorative-map ${hasLocation ? '' : 'bt-decorative-map-empty'}`}
      role="img"
      aria-label={hasLocation ? `${locationName}${cleanAddress ? `, ${cleanAddress}` : ''}` : 'Location details coming soon'}
    >
      {hasLocation ? (
        <>
          <div className="bt-map-art" aria-hidden="true">
            <span className="bt-map-road bt-map-road-a" />
            <span className="bt-map-road bt-map-road-b" />
            <span className="bt-map-road bt-map-road-c" />
            <span className="bt-map-road bt-map-road-d" />
            <span className="bt-map-road bt-map-road-e" />
            <span className="bt-map-road bt-map-road-f" />
            <span className="bt-map-block bt-map-block-a" />
            <span className="bt-map-block bt-map-block-b" />
            <span className="bt-map-block bt-map-block-c" />
            <span className="bt-map-block bt-map-block-d" />
            <span className="bt-map-block bt-map-block-e" />
            <span className="bt-map-block bt-map-block-f" />
            <span className="bt-map-waterline" />
            <span className="bt-map-glow" />
          </div>

          <div className="bt-map-marker-wrap">
            <span className="bt-map-marker-pulse" aria-hidden="true" />
            <span className="bt-map-marker">
              <span className="bt-map-marker-core"><MapPin aria-hidden="true" /></span>
            </span>
          </div>

          <div className="bt-map-place-label">
            <strong>{locationName}</strong>
            {cleanAddress && <span>{cleanAddress}</span>}
          </div>

          <span className="bt-map-ui bt-map-ui-one" aria-hidden="true" />
          <span className="bt-map-ui bt-map-ui-two" aria-hidden="true" />
          <span className="bt-map-ui bt-map-ui-three" aria-hidden="true" />
        </>
      ) : (
        <div className="bt-location-map-empty bt-location-map-empty--full" role="status">
          <strong>LOCATION DETAILS COMING SOON</strong>
        </div>
      )}
    </div>
  );
}
