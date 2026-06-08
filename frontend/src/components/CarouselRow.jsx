import React, { useRef } from 'react';
import './CarouselRow.css';

export default function CarouselRow({ title, items, onSelect, onFocusItem, isChannel = false }) {
  const rowRef = useRef(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="carousel-row-container">
      <h2 className="carousel-title">{title}</h2>
      <div className="carousel-scroll" ref={rowRef}>
        {items.map((item, index) => {
          const image = item.logo || item.poster_path || '';
          const name = item.name || item.title || 'Contenido';
          
          return (
            <div 
              key={item.id || index} 
              className={`carousel-item ${isChannel ? 'channel-card-style' : 'vod-card-style'}`}
              tabIndex="0"
              onClick={() => onSelect(item)}
              onFocus={() => {
                if (onFocusItem) onFocusItem(item);
              }}
            >
              <div className="item-image-wrapper">
                {image ? (
                  <img src={image} alt={name} className="item-image" loading="lazy" />
                ) : (
                  <div className="item-placeholder">{name.substring(0, 2).toUpperCase()}</div>
                )}
              </div>
              <div className="item-title">{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
