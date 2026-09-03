import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BRAND_NAME } from '../../config/brand';

export default function PublicFooter({ go }) {
  return (
    <footer className="bt-footer">
      <div className="container-public bt-footer-inner">
        <div>
          <strong>{BRAND_NAME}</strong>
          <span>Football sessions made simple for players and teams.</span>
        </div>
        <button type="button" onClick={() => go('/book')}>
          Book a slot <ArrowRight aria-hidden="true" />
        </button>
        <span>© {new Date().getFullYear()} {BRAND_NAME}</span>
      </div>
    </footer>
  );
}
