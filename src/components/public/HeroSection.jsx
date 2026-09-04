import React from 'react';
import { ArrowRight } from 'lucide-react';
import { displayBrand } from '../../config/brand';

export default function HeroSection({ turf, gallery, go }) {
  const image = gallery.find(Boolean);

  return (
    <section className="bt-hero" aria-labelledby="home-hero-title">
      <div className="bt-hero-grid" aria-hidden="true" />
      <div className="bt-hero-inner container-public">
        <div className="bt-hero-copy">
          <span className="bt-eyebrow">WELCOME TO</span>
          <h1 id="home-hero-title">{displayBrand(turf.name)}</h1>
          <p>
            A dedicated football venue for players, teams, and local football communities. Book your session, bring your squad, and make the most of every minute on the pitch.
          </p>
          <div className="bt-hero-actions">
            <button className="bt-btn bt-btn-primary" type="button" onClick={() => go('/book')}>
              Book Your Slot <ArrowRight aria-hidden="true" />
            </button>
            <button
              className="bt-text-btn"
              type="button"
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Explore the Turf <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="bt-hero-media">
          {image ? (
            <img
              src={image.url}
              alt={image.alt || 'TestWeb Turf football turf'}
              loading="eager"
            />
          ) : (
            <div className="bt-image-fallback" role="img" aria-label="Football turf visual">
              <span aria-hidden="true">⚽</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
