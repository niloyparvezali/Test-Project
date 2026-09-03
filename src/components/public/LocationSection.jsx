import React from 'react';
import { ExternalLink, MapPin, MessageCircle, Phone } from 'lucide-react';
import LocationMap from './LocationMap';

function whatsappUrl(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.startsWith('00')
    ? digits.slice(2)
    : digits.startsWith('0')
      ? `880${digits.slice(1)}`
      : digits;
  return normalized ? `https://wa.me/${normalized}` : '';
}

export default function LocationSection({ turf = {} }) {
  const phone = String(turf.phone || '').trim();
  const whatsapp = String(turf.whatsapp || '').trim();
  const address = String(turf.address || '').trim();
  const maps = String(turf.mapsUrl || '').trim();
  const note = String(turf.locationNote || '').trim();

  const hasContact = Boolean(phone || whatsapp);
  const hasLocation = Boolean(address || note || maps);

  if (!hasContact && !hasLocation) return null;

  return (
    <section className="bt-section bt-location-section" id="contact-location" aria-labelledby="contact-location-title">
      <div className="container-public bt-location-grid">
        <div className="bt-contact-location-copy">
          <span className="bt-eyebrow">CONTACT &amp; LOCATION</span>
          <h2 id="contact-location-title">Contact the venue or get directions.</h2>
          <p className="bt-muted-copy bt-location-intro">
            For bookings, directions, or general enquiries, use the contact details below.
          </p>

          {hasContact && (
            <div className="bt-contact-tiles" aria-label="Venue contact options">
              {phone && (
                <a className="bt-contact-tile" href={`tel:${phone}`}>
                  <Phone aria-hidden="true" />
                  <span>
                    <small>Call</small>
                    <strong>{phone}</strong>
                  </span>
                </a>
              )}
              {whatsapp && (
                <a
                  className="bt-contact-tile"
                  href={whatsappUrl(whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  <span>
                    <small>WhatsApp</small>
                    <strong>{whatsapp}</strong>
                  </span>
                </a>
              )}
            </div>
          )}

          {hasLocation && (
            <div className="bt-location-block">
              <span className="bt-location-label">LOCATION</span>
              {(address || note) && (
                <div className="bt-address-row">
                  <MapPin aria-hidden="true" />
                  <div>
                    {address && <strong>{address}</strong>}
                    {note && <p>{note}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {hasLocation && (
          <div className="bt-location-map-column">
            <LocationMap name={turf.name} address={address} />

            {maps && (
              <a className="bt-btn bt-btn-primary bt-map-action" href={maps} target="_blank" rel="noreferrer">
                Open in Google Maps <ExternalLink aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
