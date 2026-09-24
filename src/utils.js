// ═══════════════════════════════════════════════════════════
//  GODS EYE — UTILITIES
//  Shared helper functions
// ═══════════════════════════════════════════════════════════

const Utils = {
  escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  },
  ll2v3(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  },

  pad(x) {
    return String(x).padStart(2, '0');
  },

  formatUTC() {
    const n = new Date();
    return `${Utils.pad(n.getUTCHours())}:${Utils.pad(n.getUTCMinutes())}:${Utils.pad(n.getUTCSeconds())} UTC`;
  },

  // Segment/sphere intersection, not a z-hemisphere approximation: high orbit
  // objects remain visible above the limb, but no object can be picked through Earth.
  isOccluded(position, cameraPosition, radius = 1) {
    const dx = position.x-cameraPosition.x, dy=position.y-cameraPosition.y, dz=position.z-cameraPosition.z;
    const a=dx*dx+dy*dy+dz*dz;
    if (!a) return false;
    const b=2*(cameraPosition.x*dx+cameraPosition.y*dy+cameraPosition.z*dz);
    const c=cameraPosition.lengthSq()-radius*radius;
    const d=b*b-4*a*c;
    if(d<0)return false;
    const t=(-b-Math.sqrt(d))/(2*a);
    return t>0 && t<1-1e-6;
  },
  projectVisible(position, camera, width, height) {
    if(Utils.isOccluded(position,camera.position))return null;
    const p=position.clone().project(camera);
    if(p.z < -1 || p.z > 1 || Math.abs(p.x)>1.05 || Math.abs(p.y)>1.05)return null;
    return {x:(p.x*.5+.5)*width,y:(-.5*p.y+.5)*height,depth:position.distanceTo(camera.position)};
  },
  safeURL(value) {
    try { const u=new URL(value); return u.protocol==='https:' ? u.href : ''; } catch {return '';}
  },
};
