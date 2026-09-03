import React, { useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';

export default function GallerySection({ gallery = [] }) {
  const [failed, setFailed] = useState([]);
  const [selected, setSelected] = useState(null);
  const visible = gallery.filter(item => item && !failed.includes(item.id)).slice(0, 3);

  return (
    <section id="gallery" className="bt-section bt-gallery-section">
      <div className="container-public">
        <div className="bt-section-label-row">
          <span className="bt-eyebrow">TURF GALLERY</span>
          <span className="bt-section-rule" />
        </div>

        <div className="bt-gallery-head">
          <div>
            <h2>See the pitch, the atmosphere, and the space where your next match will take place.</h2>
            {visible.length > 0 && (
              <button
                type="button"
                className="bt-text-btn bt-gallery-view-all"
                onClick={() => setSelected(visible[0])}
              >
                View Gallery <ArrowUpRight aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {visible.length ? (
          <div className="bt-gallery-grid">
            {visible.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={`bt-gallery-cell bt-gallery-cell-${index + 1}`}
                onClick={() => setSelected(item)}
                aria-label={`View venue photo ${index + 1}`}
              >
                <img
                  src={item.url}
                  alt={item.alt || 'Bason Turf City venue'}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                    setFailed(x => (x.includes(item.id) ? x : [...x, item.id]));
                  }}
                />
                <span aria-hidden="true"><ArrowUpRight /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bt-empty-block">Coming Soon…</div>
        )}
      </div>

      {selected && (
        <div
          className="bt-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image"
          onMouseDown={e => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="bt-lightbox-card">
            <button type="button" className="bt-icon-btn" aria-label="Close image" onClick={() => setSelected(null)}>
              <X />
            </button>
            <img src={selected.url} alt={selected.alt || 'Bason Turf City venue'} />
          </div>
        </div>
      )}
    </section>
  );
}
