// Public service address, not a credential. GitHub Pages serves only static files.
export function roomApiBase(location){
  return location.hostname==='nornttyy.github.io'
    ? 'https://cozy-blue-island.flowy-fern-2870.chatgpt.site/api/rooms'
    : '/api/rooms';
}
