/* Solid Earth scene. All objects share this root transform and projection. */
const Globe = (() => {
  let renderer, scene, camera, root, earth, clouds, material;
  let satGroup, airGroup, shipGroup, trailGroup, labelGroup, bracketGroup;
  let rotX = .25, rotY = -1.8, zoom = 3.5, autoRot = true, drag = false;
  let followTarget = null, following = false, recon = false, frame = 0;
  let pointer = null, clickSuppressedUntil = 0;
  const canvas = document.getElementById('gc');
  const wrap = document.getElementById('gw');
  const world = new THREE.Vector3();
  function fitDistance() {
    const vfov = Math.PI / 4;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (wrap.clientWidth / Math.max(1,wrap.clientHeight)));
    return 1.16 / Math.sin(Math.min(vfov, hfov) / 2);
  }
  function init() {
    renderer = new THREE.WebGLRenderer({canvas, antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x070b13);
    scene = new THREE.Scene();
    root = new THREE.Group(); scene.add(root);
    camera = new THREE.PerspectiveCamera(45, 1, .05, 1000);
    camera.position.z = zoom;
    const loader = new THREE.TextureLoader();
    const fallback = makeFallbackEarthTexture();
    const day = fallback.clone();
    const night = fallback.clone();
    loader.load(CONFIG.textures.day, tex => { material.uniforms.day.value = tex; });
    loader.load(CONFIG.textures.night, tex => { material.uniforms.night.value = tex; });
    day.anisotropy = renderer.capabilities.getMaxAnisotropy();
    material = new THREE.ShaderMaterial({
      depthWrite:true, depthTest:true, transparent:false,
      uniforms:{day:{value:day},night:{value:night},sun:{value:new THREE.Vector3(1,.2,1).normalize()},recon:{value:0}},
      vertexShader:`varying vec2 vUv; varying vec3 vNormal;
        void main(){vUv=uv;vNormal=mat3(modelMatrix)*normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D day;uniform sampler2D night;uniform vec3 sun;uniform float recon;varying vec2 vUv;varying vec3 vNormal;
        void main(){float d=dot(normalize(vNormal),sun);float light=smoothstep(-.2,.3,d);
        vec3 a=texture2D(day,vUv).rgb;vec3 b=texture2D(night,vUv).rgb;
        vec3 c=mix(a*.16+b*.85,a*(.7+.3*max(d,0.)),light);
        float l=dot(c,vec3(.2126,.7152,.0722));c=mix(c,mix(c,vec3(l*.7,l*.98,l*1.1),.7),recon);
        gl_FragColor=vec4(c,1.);}`
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1,96,64),material);root.add(earth);
    const cloudMat = new THREE.MeshBasicMaterial({transparent:true,opacity:.13,depthWrite:false});
    loader.load(CONFIG.textures.clouds, tex => { cloudMat.map = tex; cloudMat.needsUpdate = true; });
    clouds = new THREE.Mesh(new THREE.SphereGeometry(1.004,64,32),cloudMat);root.add(clouds);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.025,64,32),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.BackSide,
      vertexShader:`varying vec3 n;varying vec3 p;void main(){n=normalize(normalMatrix*normal);p=(modelViewMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*vec4(p,1.);}`,
      fragmentShader:`varying vec3 n;varying vec3 p;void main(){float glow=pow(max(0.,1.-abs(dot(normalize(n),normalize(-p)))),3.);gl_FragColor=vec4(.17,.42,.8,glow*.5);}`
    }));root.add(atmosphere);
    satGroup = new THREE.Group();airGroup = new THREE.Group();shipGroup = new THREE.Group();
    trailGroup = new THREE.Group();labelGroup = new THREE.Group();bracketGroup = new THREE.Group();
    root.add(satGroup,airGroup,shipGroup,trailGroup,labelGroup,bracketGroup);
    resize(); zoom=fitDistance();
    new ResizeObserver(resize).observe(wrap);
    setupControls();
  }
  function makeFallbackEarthTexture() {
    const c=document.createElement('canvas'); c.width=1024; c.height=512;
    const x=c.getContext('2d'); x.fillStyle='#164b82'; x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#2c6f55';
    const land=[[-.76,.18,.18,.34],[-.54,.38,.14,.2],[-.42,.12,.08,.24],[-.1,.12,.17,.18],[.1,.16,.14,.24],[.27,.06,.09,.16],[.48,.25,.23,.2],[.7,.02,.13,.24]];
    land.forEach(([cx,cy,rx,ry])=>{x.beginPath();x.ellipse((cx+.5)*c.width,(cy+.5)*c.height,rx*c.width,ry*c.height,0,0,Math.PI*2);x.fill();});
    x.strokeStyle='rgba(126,201,232,.18)';x.lineWidth=1;
    for(let i=1;i<12;i++){x.beginPath();x.moveTo(i*c.width/12,0);x.lineTo(i*c.width/12,c.height);x.stroke();}
    for(let i=1;i<6;i++){x.beginPath();x.moveTo(0,i*c.height/6);x.lineTo(c.width,i*c.height/6);x.stroke();}
    const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t;
  }
  function resize(){if(!renderer)return;const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function setupControls(){
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};drag=true;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!pointer)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
      if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>5){autoRot=false;following=false;clickSuppressedUntil=performance.now()+250;}
      rotY+=dx*.005;rotX=Math.max(-Math.PI/2,Math.min(Math.PI/2,rotX+dy*.005));pointer.x=e.clientX;pointer.y=e.clientY;
    });
    const end=()=>{pointer=null;drag=false;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(1.18,Math.min(18,zoom+e.deltaY*.002));},{passive:false});
  }
  function track(object){followTarget=object;following=!!object;autoRot=false;
    if(object)zoom=Math.max(fitDistance(),object.position.length()+1.6);
  }
  function setFollowing(v){following=v&&!!followTarget;autoRot=false;}
  function reset(){followTarget=null;following=false;autoRot=true;zoom=fitDistance();rotX=.25;rotY=-1.8;}
  function render(dt=.016){
    frame++;
    if(following&&followTarget){
      const p=followTarget.position,r=p.length();
      const tx=Math.asin(p.y/r),ty=Math.atan2(-p.z,p.x)*-1-Math.PI/2;
      const k=1-Math.exp(-dt*5);rotX+=(tx-rotX)*k;
      rotY+=Math.atan2(Math.sin(ty-rotY),Math.cos(ty-rotY))*k;
    } else if(autoRot&&!drag)rotY+=dt*.025;
    root.rotation.set(rotX,rotY,0,'XYZ');
    camera.position.z=zoom;camera.updateMatrixWorld();root.updateMatrixWorld(true);
    const now=new Date(),hour=now.getUTCHours()+now.getUTCMinutes()/60;
    // Approximate solar longitude for the day/night terminator.
    const solarLongitude=(180-hour*15)*Math.PI/180;
    material.uniforms.sun.value.set(Math.cos(solarLongitude),.1,-Math.sin(solarLongitude)).normalize().applyEuler(root.rotation);
    material.uniforms.recon.value+=(Number(recon)-material.uniforms.recon.value)*Math.min(1,dt*4);
    renderer.render(scene,camera);
  }
  function project(object){
    if(!object||!object.visible||!object.parent?.visible)return null;
    object.getWorldPosition(world);
    return Utils.projectVisible(world,camera,wrap.clientWidth,wrap.clientHeight);
  }
  function projectPosition(local){return Utils.projectVisible(local.clone().applyMatrix4(root.matrixWorld),camera,wrap.clientWidth,wrap.clientHeight);}
  function enterGodView(){recon=true;}function exitGodView(){recon=false;}
  return {init,render,resize,project,projectPosition,track,setFollowing,reset,enterGodView,exitGodView,fitDistance,
    get scene(){return scene;},get camera(){return camera;},get canvas(){return canvas;},get wrap(){return wrap;},
    get satGroup(){return satGroup;},get airGroup(){return airGroup;},get shipGroup(){return shipGroup;},get trailGroup(){return trailGroup;},get labelGroup(){return labelGroup;},get bracketGroup(){return bracketGroup;},
    get rotX(){return rotX;},set rotX(v){rotX=v;},get rotY(){return rotY;},set rotY(v){rotY=v;},
    get zoom(){return zoom;},set zoom(v){zoom=Math.max(1.18,Math.min(18,v));},
    get autoRot(){return autoRot;},set autoRot(v){autoRot=v;},get drag(){return drag;},get following(){return following;},
    get canPick(){return !drag&&performance.now()>clickSuppressedUntil;},get frame(){return frame;},get godMode(){return recon;}
  };
})();
