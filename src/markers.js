const Markers = (() => {
  const canvas=document.getElementById('markers'),ctx=canvas.getContext('2d');
  let hits=[],hover=null,lastTrail=0,trail=[],trailKey='';
  function drawIcon(type,x,y,size,rotation=0,alpha=1){const img=Icons.image(type);if(!img.complete||!img.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(x,y);ctx.rotate(rotation);ctx.drawImage(img,-size/2,-size/2,size,size);ctx.restore();}
  function render(now){
    const w=Globe.wrap.clientWidth,h=Globe.wrap.clientHeight,dpr=Math.min(devicePixelRatio,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);hits=[];
    const selected=UI.selectedMesh,occupied=new Set();let selectedHit=null;
    const all=[...Aircraft.meshes,...Vessels.meshes,...Satellites.meshes];
    for(const m of all){
      const p=Globe.project(m);if(!p)continue;
      const isSelected=m===selected,key=Math.floor(p.x/24)+':'+Math.floor(p.y/24);
      if(!isSelected&&occupied.has(key))continue;occupied.add(key);
      const ud=m.userData,type=ud.type==='air'?(ud.obj.military?'mil':'air'):ud.type;
      const hit={...p,mesh:m,type:ud.type,idx:ud.idx};
      hits.push(hit);
      if(isSelected){selectedHit=hit;continue;}
      drawIcon(type,p.x,p.y,ud.type==='sat'?18:21,heading(m,p),hover===m?1:.8);
    }
    if(selectedHit){
      const p=selectedHit,m=p.mesh,ud=m.userData,key=UI.selectionKey;
      if(key!==trailKey){trail=[];trailKey=key;}
      if(now-lastTrail>1000){trail.push(m.position.clone());if(trail.length>100)trail.shift();lastTrail=now;}
      ctx.strokeStyle='rgba(121,185,255,.6)';ctx.lineWidth=1.5;ctx.beginPath();let pen=false;
      for(const local of trail){const q=Globe.projectPosition(local);if(!q){pen=false;continue;}if(pen)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);pen=true;}ctx.stroke();
      const radius=24+Math.sin(now*.002)*2;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(now*.0002);ctx.strokeStyle='#80b9ff';ctx.lineWidth=1.4;ctx.setLineDash([12,8]);ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      drawIcon(ud.type==='air'?(ud.obj.military?'mil':'air'):ud.type,p.x,p.y,28,heading(m,p));
      const name=UI.selectedName;ctx.font='600 12px system-ui';const tw=ctx.measureText(name).width;
      const lx=Math.max(8,Math.min(w-tw-24,p.x-tw/2-10)),ly=Math.max(8,p.y-55);
      ctx.fillStyle='rgba(14,24,41,.94)';ctx.beginPath();ctx.roundRect(lx,ly,tw+20,25,6);ctx.fill();ctx.strokeStyle='rgba(128,185,255,.45)';ctx.stroke();ctx.fillStyle='#eef5ff';ctx.fillText(name,lx+10,ly+17);
      document.getElementById('track-state').textContent=Globe.following?'Following target':'Target selected';
    }else if(selected){document.getElementById('track-state').textContent='Target behind Earth or outside view';}
  }
  function heading(m,p){
    if(m.userData.type==='sat')return 0;
    const o=m.userData.obj,angle=(o.true_track??o.heading??o.course);
    if(!Number.isFinite(angle))return 0;
    const rad=angle*Math.PI/180,lat=o.lat+.08*Math.cos(rad),lon=o.lon+.08*Math.sin(rad)/Math.max(.01,Math.cos(o.lat*Math.PI/180));
    const q=Globe.projectPosition(Utils.ll2v3(lat,lon,m.position.length()));
    return q?Math.atan2(q.y-p.y,q.x-p.x)+Math.PI/2:0;
  }
  function pick(e){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    return hits.map(h=>({...h,d:Math.hypot(h.x-x,h.y-y)})).filter(h=>h.d<=16).sort((a,b)=>a.d-b.d||a.depth-b.depth)[0];}
  function init(){
    for(const t of ['sat','air','mil','ship'])Icons.image(t);
    Globe.canvas.addEventListener('click',e=>{if(!Globe.canPick)return;const h=pick(e);if(h)UI.select(h.type,h.idx);});
    Globe.canvas.addEventListener('pointermove',e=>{const h=pick(e);hover=h?.mesh||null;Globe.canvas.style.cursor=Globe.drag?'grabbing':h?'pointer':'grab';});
    Globe.canvas.addEventListener('pointerleave',()=>hover=null);
  }
  return {render,init,get hits(){return hits;}};
})();
