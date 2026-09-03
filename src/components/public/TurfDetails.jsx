import React from 'react';
import { displayBrand } from '../../config/brand';
import { getOperatingInterval, timeLabel } from '../../utils/dateUtils';

function clean(value) {
  return String(value ?? '').trim();
}

function valueOrComingSoon(value) {
  return clean(value) || 'Coming Soon…';
}

function operatingHoursLabel(settings = {}) {
  const opening = clean(settings.openingTime);
  const closing = clean(settings.closingTime);
  if (!opening || !closing) return '';
  if (
    opening === closing ||
    (opening === '00:00' && (closing === '24:00' || closing === '00:00'))
  ) {
    return '24 Hours';
  }
  const interval = getOperatingInterval('2000-01-01', opening, closing);
  return `${timeLabel(interval.startTime)} — ${timeLabel(interval.endTime)}${interval.startDate !== interval.endDate ? ' (next day)' : ''}`;
}

function turfSizeLabel(value) {
  const raw = clean(value);
  if (!raw) return 'Coming Soon…';

  const numeric = Number(raw.replace(/,/g, '').replace(/sq\.?\s*ft|sqft|square\s*feet/gi, '').trim());
  if (Number.isFinite(numeric)) {
    return `${numeric.toLocaleString('en-US')} sq ft`;
  }

  const withoutUnit = raw
    .replace(/\s*(sq\.?\s*ft|sqft|square\s*feet)\s*$/i, '')
    .trim();

  const parsed = Number(withoutUnit.replace(/,/g, ''));
  if (Number.isFinite(parsed)) {
    return `${parsed.toLocaleString('en-US')} sq ft`;
  }

  return raw;
}

export default function TurfDetails({ turf = {}, settings = {} }) {
  const identityFacts = [
    ['Turf Name', valueOrComingSoon(displayBrand(turf.name))],
    ['Owner', valueOrComingSoon(turf.ownerName)],
  ];

  const operationalFacts = [
    ['Operating Hours', valueOrComingSoon(operatingHoursLabel(settings))],
    ['Session Length', settings.slotDuration ? `${settings.slotDuration} Minutes` : 'Coming Soon…'],
    ['Turf Size', turfSizeLabel(turf.turfSize)],
  ];

  return (
    <section className="bt-section bt-details-section" aria-labelledby="details-title">
      <div className="container-public">
        <div className="bt-section-label-row">
          <span className="bt-eyebrow">ESSENTIAL TURF FACTS</span>
          <span className="bt-section-rule" />
        </div>

        <div className="bt-details-head">
          <h2 id="details-title">Key information about the venue.</h2>
        </div>

        <div className="bt-detail-grid bt-detail-grid-identity">
          {identityFacts.map(([label, value]) => (
            <div className="bt-detail" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div className="bt-detail-grid bt-detail-grid-operational">
          {operationalFacts.map(([label, value], index) => (
            <div className={`bt-detail ${index === 0 ? 'bt-detail-full' : ''}`} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
