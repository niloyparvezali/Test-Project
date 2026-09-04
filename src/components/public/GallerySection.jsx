import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react';

export default function GallerySection({ gallery = [] }) {
  const [failed, setFailed] = useState([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems = useMemo(
    () => gallery.filter(item => item && !failed.includes(item.id)),
    [gallery, failed]
  );
  const visible = allItems.slice(0, 3);
  const selected = allItems[selectedIndex] || null;

  useEffect(() => {
    if (!viewerOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const onKeyDown = e => {
      if (e.key === 'Escape') setViewerOpen(false);
      if (e.key === 'ArrowLeft') setSelectedIndex(current => (current - 1 + allItems.length) % allItems.length);
      if (e.key === 'ArrowRight') setSelectedIndex(current => (current + 1) % allItems.length);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [viewerOpen, allItems.length]);

  useEffect(() => {
    if (selectedIndex >= allItems.length) {
      setSelectedIndex(Math.max(0, allItems.length - 1));
    }
  }, [allItems.length, selectedIndex]);

  const openViewer = index => {
    if (!allItems.length) return;
    setSelectedIndex(Math.max(0, Math.min(index, allItems.length - 1)));
    setViewerOpen(true);
  };

  const previous = () => setSelectedIndex(current => (current - 1 + allItems.length) % allItems.length);
  const next = () => setSelectedIndex(current => (current + 1) % allItems.length);

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
            {allItems.length > 0 && (
              <button
                type="button"
                className="bt-text-btn bt-gallery-view-all"
                onClick={() => openViewer(0)}
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
                onClick={() => openViewer(allItems.findIndex(entry => entry.id === item.id))}
                aria-label={`View venue photo ${index + 1}`}
              >
                <img
                  src={item.url}
                  alt={item.alt || 'Bason Turf City venue'}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                    setFailed(current => (current.includes(item.id) ? current : [...current, item.id]));
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

      {viewerOpen && selected && (
        <div
          className="bt-gallery-viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Bason Turf City gallery"
          onMouseDown={e => e.target === e.currentTarget && setViewerOpen(false)}
        >
          <div className="bt-gallery-viewer-shell">
            <div className="bt-gallery-viewer-head">
              <button
                type="button"
                className="bt-gallery-back"
                onClick={() => setViewerOpen(false)}
                aria-label="Close gallery"
              >
                <ArrowLeft aria-hidden="true" />
                <span>Gallery</span>
              </button>

              {allItems.length > 1 && (
                <span className="bt-gallery-counter" aria-live="polite">
                  {selectedIndex + 1} / {allItems.length}
                </span>
              )}

              <button
                type="button"
                className="bt-icon-btn bt-gallery-close"
                onClick={() => setViewerOpen(false)}
                aria-label="Close gallery"
              >
                <X />
              </button>
            </div>

            <div
              className="bt-gallery-viewer-stage"
              onTouchStart={e => {
                e.currentTarget.dataset.touchStartX = String(e.touches[0].clientX);
              }}
              onTouchEnd={e => {
                const startX = Number(e.currentTarget.dataset.touchStartX || 0);
                const endX = e.changedTouches[0].clientX;
                const distance = endX - startX;
                if (Math.abs(distance) < 45 || allItems.length < 2) return;
                if (distance < 0) next();
                else previous();
                delete e.currentTarget.dataset.touchStartX;
              }}
            >
              <button
                type="button"
                className="bt-gallery-nav bt-gallery-nav-prev"
                onClick={previous}
                disabled={allItems.length < 2}
                aria-label="Previous image"
              >
                <ArrowLeft />
              </button>

              <img
                key={selected.id}
                className="bt-gallery-viewer-image"
                src={selected.url}
                alt={selected.alt || 'Bason Turf City venue'}
                loading="eager"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  setFailed(current => (current.includes(selected.id) ? current : [...current, selected.id]));
                }}
              />

              <button
                type="button"
                className="bt-gallery-nav bt-gallery-nav-next"
                onClick={next}
                disabled={allItems.length < 2}
                aria-label="Next image"
              >
                <ArrowRight />
              </button>
            </div>

            {allItems.length > 1 && (
              <div className="bt-gallery-thumbnails" aria-label="Gallery thumbnails">
                {allItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`bt-gallery-thumb${index === selectedIndex ? ' is-active' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                    aria-label={`View gallery image ${index + 1}`}
                    aria-current={index === selectedIndex ? 'true' : undefined}
                  >
                    <img
                      src={item.url}
                      alt=""
                      loading={Math.abs(index - selectedIndex) <= 2 ? 'eager' : 'lazy'}
                      onError={e => {
                        e.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
