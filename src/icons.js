/* Original, resolution-independent pictograms; identical in lists and on Earth. */
const Icons = (() => {
  const paths={
    sat:'<g transform="rotate(-35 16 16)"><rect x="3" y="11" width="7" height="12" rx="1.5" fill="#4f94ef"/><rect x="22" y="11" width="7" height="12" rx="1.5" fill="#4f94ef"/><path d="M6.5 11v12M25.5 11v12M3 17h7m12 0h7M9 16h14" stroke="#b6daff" stroke-width="1"/><rect x="11" y="10" width="10" height="14" rx="2" fill="#eaf3ff"/><path d="M12 7q4 6 8 0M16 7V3" fill="none" stroke="#eaf3ff" stroke-width="2"/><circle cx="16" cy="18" r="2" fill="#7693b8"/></g>',
    air:'<path d="M16 2c-1.2 0-2 2-2 4v7L3 20v3l11-4v7l-4 3v2l6-2 6 2v-2l-4-3v-7l11 4v-3l-11-7V6c0-2-.8-4-2-4Z" fill="#e5f3ff"/><path d="M16 4v21" stroke="#62bcf4" stroke-width="1.5"/>',
    mil:'<path d="m16 1 3 12 11 12-1 3-9-4-1 4 4 3h-6l-1-2-1 2H9l4-3-1-4-9 4-1-3 11-12Z" fill="#efbb74"/><path d="M16 7v18m-3-7h6" stroke="#754b25" stroke-width="1.3"/>',
    ship:'<path d="m4 17 12-5 12 5-4 9H8Z" fill="#7adecf"/><path d="M10 14V7h12v8M14 7V3h4v4" fill="#e0f4f4" stroke="#e0f4f4" stroke-width="2"/><path d="M16 17v8M2 29q4-4 8 0 4-4 8 0 4-4 8 0" fill="none" stroke="#47a9bd" stroke-width="2"/>',
    camera:'<rect x="3" y="8" width="26" height="19" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="17" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m10 8 2-4h8l2 4" fill="none" stroke="currentColor" stroke-width="2"/>',
    news:'<rect x="4" y="4" width="24" height="24" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 10h14M9 16h5m4 0h5M9 22h14" stroke="currentColor" stroke-width="2"/>',
    globe:'<circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="5" ry="12" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 16h24" stroke="currentColor" stroke-width="1.6"/>'
  };
  function svg(type,size=24){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${paths[type]||paths.sat}</svg>`;}
  const images={};
  function image(type){if(!images[type]){const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,64));images[type]=img;}return images[type];}
  return {svg,image};
})();
