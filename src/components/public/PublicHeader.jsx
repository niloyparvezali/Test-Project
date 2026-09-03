import React from 'react';
import { BRAND_NAME } from '../../config/brand';

export default function PublicHeader({ go }) {
  return (
    <header className="public-app-header">
      <div className="public-app-header-inner">
        <button
          className="public-app-brand"
          type="button"
          onClick={() => go('/')}
          aria-label={`${BRAND_NAME} home`}
        >
          <span className="public-app-brand-mark" aria-hidden="true">⚽</span>
          <span>{BRAND_NAME}</span>
        </button>
      </div>
    </header>
  );
}
