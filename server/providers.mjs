// Provider validation is shared by the server and deterministic tests.
export function providerTime(value){
  if(typeof value!=='string')return NaN;
  const normalized=value.trim().replace(' +0000 UTC','Z').replace(' UTC','Z').replace(' ','T');
  return Date.parse(normalized)/1000;
}
export function normalizeAIS(data,now=Date.now()/1000){
  const type=data?.MessageType;if(!['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport'].includes(type))return null;
  const p=data.Message?.[type],m=data.MetaData;
  if(!p||!m||p.Valid===false)return null;
  const lat=p.Latitude??m.latitude??m.Latitude,lon=p.Longitude??m.longitude??m.Longitude;
  const mmsi=String(m.MMSI??p.UserID??'');
  // AISStream's metadata may omit a provider timestamp. In that case the
  // server receipt is the honest freshness boundary for the displayed data.
  const parsedTime=providerTime(m.time_utc);const observedAt=Number.isFinite(parsedTime)?parsedTime:now;
  if(!/^\d{9}$/.test(mmsi)||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  if(!Number.isFinite(observedAt)||observedAt>now+30||now-observedAt>600)return null;
  return {mmsi,name:String(m.ShipName||'').trim()||'Vessel '+mmsi,lat,lon,
    speed:Number.isFinite(p.Sog)&&p.Sog<102.3?p.Sog:null,
    course:Number.isFinite(p.Cog)&&p.Cog<360?p.Cog:null,
    heading:Number.isFinite(p.TrueHeading)&&p.TrueHeading<360?p.TrueHeading:null,
    observedAt,timestampSource:'provider receipt',source:'AISStream'};
}
export function validBoxes(raw){const boxes=JSON.parse(raw);if(!Array.isArray(boxes)||!boxes.length||boxes.length>10)throw Error('Invalid AIS_BOUNDING_BOXES');for(const b of boxes){if(!Array.isArray(b)||b.length!==2||b.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||Math.abs(p[0])>90||Math.abs(p[1])>180))throw Error('Invalid AIS bounding coordinates');}return boxes;}
