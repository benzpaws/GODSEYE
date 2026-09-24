/* Public settings only. API credentials belong on the feed server. */
window.GODS_EYE_FEEDS = {
  apiBase: '', // Example: https://your-feed-server.example.com (no trailing slash)
  aircraftRefreshMs: 90000,
  vesselsRefreshMs: 15000,
  newsRefreshMs: 300000,
  cameras: [] // {name:'Harbor', type:'youtube'|'video'|'image'|'embed', url:'https://...'}
};
