import React from 'react';
import './HeroBanner.css';

export default function HeroBanner({ featuredContent, onPlay }) {
  if (!featuredContent) return null;

  const bgImage = featuredContent.backdrop_path || featuredContent.poster_path || featuredContent.logo || '';
  const title = featuredContent.title || featuredContent.name || 'Contenido Destacado';
  const description = featuredContent.overview || featuredContent.group || 'Disfruta del mejor entretenimiento en Intertel-TV.';

  return (
    <div className="hero-banner" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="hero-overlay">
        <div className="hero-content">
          <h1 className="hero-title">{title}</h1>
          <p className="hero-description">{description}</p>
          <div className="hero-actions">
            <button className="hero-btn-play" tabIndex="0" onClick={() => onPlay(featuredContent)}>
              <span className="icon">▶</span> Reproducir
            </button>
            <button className="hero-btn-info" tabIndex="0">
              Más información
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
