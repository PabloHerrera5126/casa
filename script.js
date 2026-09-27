"use strict";

if (typeof THREE === "undefined") { alert("No se pudo cargar Three.js. Revisa tu conexión a Internet."); throw new Error("Three.js no disponible"); }

const canvas = document.getElementById("canvas");
if (!canvas) throw new Error("No se encontró el canvas");

let scene, camera, renderer, clock;
let modoExploracion = false, pisoActual = 1;
const teclas = { KeyW:false, KeyA:false, KeyS:false, KeyD:false, ShiftLeft:false, ShiftRight:false };
const velocidadCaminar = 4.2, velocidadCorrer = 7.0;
let yaw = 0, pitch = 0;
const sensibilidad = 0.002;
const colliders = [];
let gato, gatoObjetivo = new THREE.Vector3(0,0,0), gatoEsperando = 0;

const casa = new THREE.Group();
const interior = new THREE.Group();
const exterior = new THREE.Group();
const muebles = new THREE.Group();
const decoracion = new THREE.Group();
const vegetacion = new THREE.Group();
const materiales = {};

init();

function init(){
  crearEscena(); crearCamara(); crearRenderer(); crearLuces(); crearMateriales();
  crearEntorno(); crearCasaExterior();
  crearInteriorPrimerPiso(); crearInteriorSegundoPiso(); crearEscaleras();
  crearPiscina(); crearJardin(); crearParqueadero(); crearDecoracionExterior();
  crearMueblesPrimerPiso(); crearMueblesSegundoPiso();
  crearBanoSocial(); crearBanoPrincipal();
  agregarRodapiesGlobal();
  crearIluminacionInterior();
  crearGato();
  configurarEventos(); configurarBotones();
  colocarCamaraExterior(); iniciarCarga(); animate();
}

function crearEscena(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 55, 150);
  scene.add(casa);
  casa.add(exterior); casa.add(interior); casa.add(muebles); casa.add(decoracion); casa.add(vegetacion);
}

function crearCamara(){
  camera = new THREE.PerspectiveCamera(65, window.innerWidth/window.innerHeight, 0.1, 250);
  camera.position.set(30,15,32);
}

function crearRenderer(){
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:"high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
}

function crearLuces(){
  const sol = new THREE.DirectionalLight(0xffffff,3);
  sol.position.set(30,45,20); sol.castShadow = true;
  sol.shadow.mapSize.width = 2048; sol.shadow.mapSize.height = 2048;
  sol.shadow.camera.left=-60; sol.shadow.camera.right=60; sol.shadow.camera.top=60; sol.shadow.camera.bottom=-60;
  scene.add(sol);
  scene.add(new THREE.HemisphereLight(0xdff4ff,0x5c7654,1.8));
  const relleno = new THREE.DirectionalLight(0xfff4dc,0.8);
  relleno.position.set(-30,15,-25); scene.add(relleno);
}

/* ================= TEXTURAS PROCEDURALES (sin imágenes externas) ================= */
function crearTexturaRuido(colorBase, intensidad=14, tamano=256){
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamano;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = colorBase;
  ctx.fillRect(0,0,tamano,tamano);
  const img = ctx.getImageData(0,0,tamano,tamano);
  for(let i=0;i<img.data.length;i+=4){
    const n = (Math.random()-0.5)*intensidad;
    img.data[i]   = Math.min(255,Math.max(0,img.data[i]+n));
    img.data[i+1] = Math.min(255,Math.max(0,img.data[i+1]+n));
    img.data[i+2] = Math.min(255,Math.max(0,img.data[i+2]+n));
  }
  ctx.putImageData(img,0,0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function crearTexturaMadera(colorBase, colorVeta, tamano=256){
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamano;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = colorBase;
  ctx.fillRect(0,0,tamano,tamano);
  for(let i=0;i<22;i++){
    ctx.strokeStyle = colorVeta;
    ctx.globalAlpha = 0.12 + Math.random()*0.18;
    ctx.lineWidth = 1 + Math.random()*2;
    ctx.beginPath();
    let y = (i/22)*tamano + (Math.random()-0.5)*5;
    ctx.moveTo(0,y);
    for(let x=0;x<=tamano;x+=14){ y += (Math.random()-0.5)*2; ctx.lineTo(x,y); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
function crearTexturaBaldosa(colorBase, colorLinea, divisiones=4, tamano=256){
  const cv = document.createElement("canvas");
  cv.width = cv.height = tamano;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = colorBase;
  ctx.fillRect(0,0,tamano,tamano);
  ctx.strokeStyle = colorLinea;
  ctx.lineWidth = 3;
  const paso = tamano/divisiones;
  for(let i=0;i<=divisiones;i++){
    ctx.beginPath(); ctx.moveTo(i*paso,0); ctx.lineTo(i*paso,tamano); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,i*paso); ctx.lineTo(tamano,i*paso); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function crearMateriales(){
  const M = THREE.MeshStandardMaterial, P = THREE.MeshPhysicalMaterial;

  const texPared = crearTexturaRuido("#f3f1eb",12); texPared.repeat.set(5,3);
  materiales.pared = new M({color:0xffffff, roughness:.88, map:texPared, bumpMap:texPared, bumpScale:0.012});

  const texParedOsc = crearTexturaRuido("#555d64",10); texParedOsc.repeat.set(5,3);
  materiales.paredOscura = new M({color:0xffffff, roughness:.82, map:texParedOsc, bumpMap:texParedOsc, bumpScale:0.012});

  materiales.blanco = new M({color:0xffffff, roughness:.75});
  materiales.negro = new M({color:0x20252a, roughness:.35});

  const texMadera = crearTexturaMadera("#8a542c","#5c3a1e"); texMadera.repeat.set(2,2);
  materiales.madera = new M({color:0xffffff, roughness:.55, map:texMadera, bumpMap:texMadera, bumpScale:0.02});

  const texMaderaClara = crearTexturaMadera("#c1844d","#8a5c34"); texMaderaClara.repeat.set(2,2);
  materiales.maderaClara = new M({color:0xffffff, roughness:.55, map:texMaderaClara, bumpMap:texMaderaClara, bumpScale:0.02});

  const texPisoExt = crearTexturaBaldosa("#c9c1b5","#a89f92",8); texPisoExt.repeat.set(5,3);
  materiales.piso = new M({color:0xffffff, roughness:.7, map:texPisoExt});

  const texPisoMadera = crearTexturaMadera("#9a6b43","#6b4526"); texPisoMadera.repeat.set(7,5);
  materiales.pisoMadera = new M({color:0xffffff, roughness:.55, map:texPisoMadera, bumpMap:texPisoMadera, bumpScale:0.015});
  materiales.vidrio = new P({color:0x6fc7e8, transparent:true, opacity:.38, roughness:.05, metalness:.1, transmission:.2});
  materiales.metal = new M({color:0x555b61, metalness:.75, roughness:.25});
  materiales.blancoMetal = new M({color:0xdfe3e6, metalness:.7, roughness:.25});
  materiales.verde = new M({color:0x2f8f46, roughness:.95});
  materiales.verdeClaro = new M({color:0x55aa50, roughness:.95});
  materiales.agua = new P({color:0x18bde8, transparent:true, opacity:.78, roughness:.08, metalness:.05, transmission:.15});
  materiales.blancoPiscina = new M({color:0xf2f2ed, roughness:.5});
  materiales.rojo = new M({color:0xb91c1c, roughness:.55});
  materiales.dorado = new M({color:0xd4af37, metalness:.8, roughness:.25});
  materiales.negroBrillo = new M({color:0x111111, metalness:.8, roughness:.15});
  materiales.rosa = new M({color:0xe8a0bf, roughness:.7});
  materiales.rosaClaro = new M({color:0xf4cfe0, roughness:.75});
  materiales.azulNino = new M({color:0x3b82c4, roughness:.7});
  const texCeramica = crearTexturaBaldosa("#f6f6f2","#dcdcd6",6); texCeramica.repeat.set(2,2);
  materiales.ceramica = new M({color:0xffffff, roughness:.3, map:texCeramica});
  materiales.negroMoto = new M({color:0x161616, metalness:.6, roughness:.3});
  materiales.rojoMoto = new M({color:0xc21e2c, metalness:.4, roughness:.3});
  materiales.gato = new M({color:0xe08a3c, roughness:.85});
  materiales.gatoBlanco = new M({color:0xfbf7ef, roughness:.85});
}

function cubo(x,y,z,ancho,alto,profundidad,material,grupo=exterior,colision=false){
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho,alto,profundidad), material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true;
  grupo.add(mesh);
  if(colision) agregarColision(x,y,z,ancho,alto,profundidad);
  return mesh;
}
function cilindro(x,y,z,radio,alto,material,grupo=decoracion){
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radio,radio,alto,24), material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; grupo.add(mesh); return mesh;
}
function esfera(x,y,z,radio,material,grupo=decoracion){
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radio,20,16), material);
  mesh.position.set(x,y,z); mesh.castShadow=true; grupo.add(mesh); return mesh;
}
function agregarColision(x,y,z,ancho,alto,profundidad){
  colliders.push({minX:x-ancho/2,maxX:x+ancho/2,minY:y-alto/2,maxY:y+alto/2,minZ:z-profundidad/2,maxZ:z+profundidad/2});
}

/* Rodapié (zócalo) automático: recorre las paredes ya construidas y les pone
   una franja baja en la base, con un color ligeramente distinto de la pared,
   igual que un zócalo real de madera o PVC. Ignora pisos y objetos bajos. */
function agregarRodapiesGlobal(){
  const materialRodapie = new THREE.MeshStandardMaterial({color:0xffffff, roughness:.45});
  colliders.forEach(c=>{
    const alto = c.maxY - c.minY;
    if(alto < 1.5) return;
    const ancho = (c.maxX - c.minX) + 0.05;
    const profundidad = (c.maxZ - c.minZ) + 0.05;
    const cx = (c.minX + c.maxX)/2;
    const cz = (c.minZ + c.maxZ)/2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(ancho, 0.16, profundidad), materialRodapie);
    mesh.position.set(cx, c.minY + 0.1, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    decoracion.add(mesh);
  });
}

function crearEntorno(){
  cubo(0,-0.35,0,100,0.5,100,new THREE.MeshStandardMaterial({color:0x4d963f,roughness:1}),exterior,false);
  cubo(0,-0.08,20,5,0.12,28,new THREE.MeshStandardMaterial({color:0xb8b5ad,roughness:.9}),exterior);
  cubo(0,0.01,10,8,0.08,5,new THREE.MeshStandardMaterial({color:0xd5d1c9,roughness:.9}),exterior);
}

function crearCasaExterior(){
  cubo(0,0,0,20,0.35,12,materiales.piso,exterior,true);
  cubo(-9.7,2.2,0,0.6,4.4,12,materiales.pared,exterior,true);
  cubo(9.7,2.2,0,0.6,4.4,12,materiales.pared,exterior,true);
  cubo(0,2.2,-5.7,19.4,4.4,0.6,materiales.pared,exterior,true);
  crearFachadaFrontal();
  crearSegundoPisoExterior();
  cubo(0,8.9,0,20.5,0.5,12.5,materiales.negro,exterior);
}

function crearFachadaFrontal(){
  cubo(-7.5,2.2,5.7,4.5,4.4,0.6,materiales.pared,exterior,true);
  cubo(7.5,2.2,5.7,4.5,4.4,0.6,materiales.pared,exterior,true);
  cubo(0,4.2,5.7,10.5,0.4,0.6,materiales.pared,exterior,true);
  crearPuerta(0,2,5.45);
  ventanaGrande(-5,2.3,5.35,3.8,3);
  ventanaGrande(5,2.3,5.35,3.8,3);
}

function crearSegundoPisoExterior(){
  cubo(0,4.45,0,19.4,0.35,11.4,materiales.negro,exterior);
  cubo(-9.7,6.65,0,0.6,4.2,11.4,materiales.paredOscura,exterior,true);
  cubo(9.7,6.65,0,0.6,4.2,11.4,materiales.paredOscura,exterior,true);
  cubo(0,6.65,-5.7,19.4,4.2,0.6,materiales.paredOscura,exterior,true);
  cubo(-7.2,6.65,5.7,5.4,4.2,0.6,materiales.paredOscura,exterior,true);
  cubo(7.2,6.65,5.7,5.4,4.2,0.6,materiales.paredOscura,exterior,true);
  cubo(0,8.5,5.7,9,0.5,0.6,materiales.paredOscura,exterior,true);
  ventanaGrande(-4,6.6,5.35,4,2.6);
  ventanaGrande(4,6.6,5.35,4,2.6);
  cubo(0,4.6,7,8,0.25,2.5,materiales.madera,exterior);
  [-4,-2,0,2,4].forEach(x=>cubo(x,5.35,8.15,0.12,1.2,0.12,materiales.metal,exterior));
  cubo(0,5.9,8.15,8,0.12,0.12,materiales.metal,exterior);
}

function ventanaGrande(x,y,z,ancho,alto){
  cubo(x,y,z,ancho,alto,0.08,materiales.vidrio,decoracion);
  cubo(x-ancho/2,y,z-0.07,0.12,alto+0.15,0.15,materiales.negro,decoracion);
  cubo(x+ancho/2,y,z-0.07,0.12,alto+0.15,0.15,materiales.negro,decoracion);
  cubo(x,y-alto/2,z-0.07,ancho+0.15,0.12,0.15,materiales.negro,decoracion);
  cubo(x,y+alto/2,z-0.07,ancho+0.15,0.12,0.15,materiales.negro,decoracion);
  cubo(x,y,z-0.1,0.08,alto,0.1,materiales.negro,decoracion);
  cubo(x,y,z-0.11,ancho,0.08,0.1,materiales.negro,decoracion);
}

function crearPuerta(x,y,z){
  cubo(x,y,z,2.5,4,0.25,materiales.madera,decoracion);
  cilindro(x+0.8,y,z-0.18,0.06,0.06,materiales.dorado,decoracion);
}

function crearInteriorPrimerPiso(){
  cubo(0,0.2,0,18.8,0.12,11,materiales.pisoMadera,interior);
  cubo(-1.5,2.1,0.5,0.18,3.8,5.0,materiales.pared,interior,true);
  cubo(-5.8,2.1,-3,7.5,3.8,0.18,materiales.pared,interior,true);
  cubo(5.2,2.1,-1,0.18,3.8,4.0,materiales.pared,interior,true);
  cubo(-5.8,2.1,1.9,5.8,3.8,0.18,materiales.pared,interior,true);
  crearArcoInterior(1.5,2.2,0.5);
}
function crearArcoInterior(x,y,z){
  cubo(x-3,y,z,0.2,3.8,4,materiales.pared,interior,true);
  cubo(x+3,y,z,0.2,3.8,4,materiales.pared,interior,true);
}

function crearInteriorSegundoPiso(){
  cubo(0,4.7,0,18.8,0.12,11,materiales.pisoMadera,interior);
  cubo(-4.5,6.6,0,0.18,3.6,8,materiales.pared,interior,true);
  cubo(2.5,6.6,0,0.18,3.6,8,materiales.pared,interior,true);
  cubo(0,6.6,-4,4.8,3.6,0.18,materiales.pared,interior,true);
  cubo(0,6.6,2.8,8,3.6,0.18,materiales.pared,interior,true);
  /* separación baño principal, deja paso libre */
  cubo(4.7,6.6,-3,0.18,3.6,4.8,materiales.pared,interior,true);
}

function crearEscaleras(){
  const grupo = new THREE.Group();
  grupo.position.set(7,0,0);
  interior.add(grupo);
  for(let i=0;i<12;i++){
    const escalon = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.28,0.65), materiales.piso);
    escalon.position.set(0, 0.3+i*0.32, 3.5-i*0.48);
    escalon.castShadow=true; escalon.receiveShadow=true;
    grupo.add(escalon);
  }
  cilindro(5.8,2.1,1,0.06,3.8,materiales.metal,decoracion);
  cilindro(8.2,2.1,1,0.06,3.8,materiales.metal,decoracion);
}

function crearPiscina(){
  cubo(0,0.05,-13,14,0.25,7,materiales.blancoPiscina,exterior);
  cubo(0,0.22,-13,12.8,0.15,5.8,materiales.agua,exterior);
  cubo(-7,0.3,-13,0.4,0.3,7,materiales.blancoPiscina,exterior);
  cubo(7,0.3,-13,0.4,0.3,7,materiales.blancoPiscina,exterior);
  cubo(0,0.3,-16.5,14,0.3,0.4,materiales.blancoPiscina,exterior);
  cubo(0,0.3,-9.5,14,0.3,0.4,materiales.blancoPiscina,exterior);
  /* camastros */
  [-4,4].forEach(x=>{
    cubo(x,0.3,-8.6,1.8,0.15,0.7,materiales.blanco,decoracion);
    cubo(x,0.65,-8.9,1.8,0.15,0.4,materiales.blanco,decoracion);
  });
}

function crearJardin(){
  const posiciones = [[-16,-12,1.5],[16,-12,1.5],[-16,8,1.3],[16,8,1.3],[-17,0,1],[17,0,1]];
  posiciones.forEach(p=>crearArbol(p[0],p[1],p[2]));
  for(let x=-15;x<=15;x+=3) crearArbusto(x,7);
}
function crearArbol(x,z,escala=1){
  cilindro(x,1.7*escala,z,0.35*escala,3.4*escala,materiales.madera,vegetacion);
  esfera(x,4*escala,z,2.1*escala,materiales.verde,vegetacion);
  esfera(x-1,4.4*escala,z,1.5*escala,materiales.verdeClaro,vegetacion);
  esfera(x+1,4.2*escala,z+0.5,1.4*escala,materiales.verde,vegetacion);
}
function crearArbusto(x,z){
  esfera(x,0.8,z,0.8,materiales.verde,vegetacion);
  esfera(x+0.7,0.75,z,0.7,materiales.verdeClaro,vegetacion);
}

function crearParqueadero(){
  /* Garaje / cochera */
  cubo(-7,0.08,8.5,5,0.12,5,materiales.negro,exterior);
  cubo(-7,4.4,8.5,5.5,0.3,5.5,materiales.negro,exterior);
  cubo(-9.3,2.2,6.5,0.35,4.4,0.35,materiales.blanco,exterior);
  cubo(-4.7,2.2,6.5,0.35,4.4,0.35,materiales.blanco,exterior);
  crearCarro(-7,8.5);
  /* Zona de parqueo adicional para la moto, junto a la cochera */
  cubo(-2.3,0.06,8.5,2.6,0.1,4.4,new THREE.MeshStandardMaterial({color:0x3a3f45,roughness:.9}),exterior);
  crearMoto(-2.3,8.5);
}

function crearCarro(x,z){
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.65,1.8), materiales.negroBrillo);
  cuerpo.position.y=0.65; cuerpo.castShadow=true; grupo.add(cuerpo);
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(2,0.7,1.5), materiales.vidrio);
  cabina.position.set(0,1.15,0); grupo.add(cabina);
  const ruedas=[[-1.3,0.45,-0.9],[1.3,0.45,-0.9],[-1.3,0.45,0.9],[1.3,0.45,0.9]];
  ruedas.forEach(p=>{
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.25,20), materiales.negroBrillo);
    rueda.rotation.z=Math.PI/2; rueda.position.set(p[0],p[1],p[2]); rueda.castShadow=true; grupo.add(rueda);
  });
  grupo.position.set(x,0,z);
  exterior.add(grupo);
}

function crearMoto(x,z){
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.28,0.35), materiales.rojoMoto);
  cuerpo.position.set(0,0.62,0); cuerpo.castShadow=true; grupo.add(cuerpo);
  const tanque = new THREE.Mesh(new THREE.SphereGeometry(0.3,16,12), materiales.rojoMoto);
  tanque.scale.set(1.3,0.8,0.7); tanque.position.set(0.15,0.85,0); grupo.add(tanque);
  const asiento = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.12,0.32), materiales.negroMoto);
  asiento.position.set(-0.35,0.9,0); grupo.add(asiento);
  const manubrio = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,0.7,8), materiales.negroMoto);
  manubrio.rotation.z=Math.PI/2; manubrio.position.set(0.75,1.05,0); grupo.add(manubrio);
  const horquilla = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.75,8), materiales.metal);
  horquilla.rotation.z=Math.PI/7; horquilla.position.set(0.7,0.55,0); grupo.add(horquilla);
  [[0.72,0.32,0],[-0.55,0.32,0]].forEach(p=>{
    const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.32,0.09,10,20), materiales.negroMoto);
    rueda.position.set(p[0],p[1],p[2]); rueda.castShadow=true; grupo.add(rueda);
  });
  grupo.position.set(x,0,z);
  grupo.rotation.y = Math.PI/2;
  exterior.add(grupo);
}

function crearDecoracionExterior(){
  crearMaceta(-11,0,4); crearMaceta(11,0,4);
  crearLamparaExterior(-5,3.2,5.1); crearLamparaExterior(5,3.2,5.1);
}
function crearMaceta(x,y,z){
  cilindro(x,0.45,z,0.55,0.8,materiales.rojo,decoracion);
  esfera(x,1.4,z,1,materiales.verde,decoracion);
}
function crearLamparaExterior(x,y,z){
  const luz = new THREE.PointLight(0xffd58a,1.5,7);
  luz.position.set(x,y,z); exterior.add(luz);
  esfera(x,y,z,0.15,materiales.dorado,decoracion);
}

/* ================= MUEBLES PRIMER PISO ================= */
function crearMueblesPrimerPiso(){ crearSala(); crearComedor(); crearCocina(); crearEstudio(); crearAltar(); }

function crearSala(){
  crearSofa(-5,2.5);
  cubo(-5,0.55,0.3,2.5,0.25,1.3,materiales.maderaClara,muebles);
  cubo(-5,2.2,4.8,4,2.2,0.15,materiales.negroBrillo,muebles);
  cubo(-5,0.65,4.3,5,0.7,0.7,materiales.madera,muebles);
  cubo(-5,4.86,2.3,4.6,0.03,3.2,materiales.rojo,muebles); /* alfombra */
  cubo(-8.6,3.5,2.5,0.05,1.2,1.6,materiales.madera,decoracion); /* cuadro decorativo */
}
function crearSofa(x,z){
  cubo(x,0.75,z,4.5,0.8,1.5,materiales.paredOscura,muebles);
  cubo(x,1.45,z+0.55,4.5,1.1,0.35,materiales.paredOscura,muebles);
  cubo(x-2,1.1,z,0.35,1.4,1.6,materiales.paredOscura,muebles);
  cubo(x+2,1.1,z,0.35,1.4,1.6,materiales.paredOscura,muebles);
}

function crearComedor(){
  cubo(2.5,1,1,3.5,0.25,1.8,materiales.madera,muebles);
  const patas=[[1.2,0.5,0.4],[3.8,0.5,0.4],[1.2,0.5,1.6],[3.8,0.5,1.6]];
  patas.forEach(p=>cubo(p[0],p[1],p[2],0.18,1,0.18,materiales.metal,muebles));
  crearSilla(0.5,1); crearSilla(4.5,1); crearSilla(2.5,-0.4); crearSilla(2.5,2.4);
  cilindro(2.5,1.9,1,0.08,0.5,materiales.dorado,decoracion); /* candelabro colgante simple */
}
function crearSilla(x,z){
  cubo(x,0.7,z,0.8,0.15,0.8,materiales.maderaClara,muebles);
  cubo(x,1.35,z+0.3,0.8,1.2,0.15,materiales.maderaClara,muebles);
}

function crearCocina(){
  cubo(6.8,1.05,-3.8,4.5,0.2,0.8,materiales.blanco,muebles);
  for(let x=5;x<=8.5;x+=1.15) cubo(x,0.55,-3.8,0.9,1,0.7,materiales.madera,muebles);
  for(let x=5;x<=8.5;x+=1.15) cubo(x,2.8,-3.8,0.9,1.4,0.5,materiales.blanco,muebles);
  cubo(8.5,1.6,-1.5,1.1,2.8,1,materiales.blancoMetal,muebles); /* nevera futurista */
  cubo(8.5,1.6,-0.95,0.05,1.6,0.6,materiales.negroBrillo,decoracion); /* panel táctil nevera */
  cubo(6,1.35,-3.8,1,1.4,0.75,materiales.negroBrillo,muebles); /* horno */
  cubo(6.2,1,-1.7,2.8,0.2,1.3,materiales.blanco,muebles); /* isla */
  cubo(6.2,1.62,-1.7,2.8,0.05,1.3,materiales.negroBrillo,decoracion); /* cubierta cristal isla */
  crearSillaAlta(5.5,-0.6); crearSillaAlta(6.8,-0.6);
  const luzIsla = new THREE.PointLight(0x9ad9ff,0.8,4); luzIsla.position.set(6.2,2.6,-1.7); interior.add(luzIsla); /* luz led futurista */
  cilindro(9,2.4,-3.8,0.06,3.6,materiales.metal,decoracion); /* extractor */
  cubo(9,4.1,-3.8,0.9,0.3,0.9,materiales.negroBrillo,decoracion);
}
function crearSillaAlta(x,z){
  cilindro(x,0.65,z,0.28,1.1,materiales.metal,muebles);
  cilindro(x,1.35,z,0.45,0.12,materiales.maderaClara,muebles);
}

function crearEstudio(){
  cubo(-7,1,-1.2,3.5,0.25,1.2,materiales.madera,muebles);
  cubo(-7,1.9,-1.2,1.5,1,0.12,materiales.negro,muebles);
  crearSilla(-7,0.2);
  for(let y=1;y<=3.5;y+=0.8) cubo(-8.8,y,-3.8,0.35,0.12,3,materiales.madera,muebles);
}

function crearAltar(){
  cubo(-5.8,1,3.5,2.8,1.7,0.6,materiales.madera,muebles);
  cubo(-5.8,3,3.15,0.22,2,0.18,materiales.dorado,decoracion);
  cubo(-5.8,3.35,3.15,1.15,0.22,0.18,materiales.dorado,decoracion);
  crearVela(-6.6,2); crearVela(-5,2);
  cubo(-5.8,4.86,3.5,2.6,0.03,2,materiales.maderaClara,muebles); /* alfombra oración */
}
function crearVela(x,z){
  cilindro(x,1.95,z,0.12,0.6,materiales.blanco,decoracion);
  esfera(x,2.35,z,0.12,materiales.dorado,decoracion);
}

/* ================= BAÑO SOCIAL (primer piso) ================= */
function crearBanoSocial(){
  /* Nicho junto a la escalera, x ~ 8.5-9.5, z ~ 2 a 4.8 */
  cubo(8.5,2.1,4.9,2,3.8,0.18,materiales.blanco,interior,true);
  cubo(9.55,2.1,3,0.18,3.8,3.8,materiales.blanco,interior,true);
  cubo(8.6,0.26,3,1.8,0.1,3.6,materiales.ceramica,interior);
  crearInodoro(9.1,0,4.1);
  crearLavamanos(8.1,0,2.2, decoracion);
  cubo(8.1,1.5,1.9,0.7,0.7,0.05,materiales.vidrio,decoracion); /* espejo */
  const luzBano = new THREE.PointLight(0xfff2df,0.9,4); luzBano.position.set(8.7,3,3); interior.add(luzBano);
}

/* ================= BAÑO PRINCIPAL (segundo piso, ensuite) ================= */
function crearBanoPrincipal(){
  /* Espacio entre la pared separadora (x=4.7) y el muro exterior (x=9.7), z -5.4 a -0.3 */
  crearInodoro(8.6,4.5,-4.3);
  crearLavamanos(6,4.5,-0.9, muebles);
  cubo(6,5.9,-0.6,1,0.7,0.05,materiales.vidrio,decoracion); /* espejo */
  /* ducha de vidrio */
  cubo(8.6,4.5,-1.5,1.9,0.02,1.9,materiales.ceramica,muebles);
  cubo(7.7,5.6,-1.5,0.05,2.2,1.9,materiales.vidrio,decoracion);
  cubo(8.6,5.6,-2.4,1.9,2.2,0.05,materiales.vidrio,decoracion);
  cilindro(8.6,6.7,-1.5,0.06,0.4,materiales.metal,decoracion); /* regadera */
  const luzBP = new THREE.PointLight(0xfff2df,1,5); luzBP.position.set(7.5,7,-2); interior.add(luzBP);
}

function crearInodoro(x,pisoY,z){
  const base = pisoY + 0.02;
  cubo(x,base+0.2,z,0.42,0.4,0.55,materiales.ceramica,muebles);
  cilindro(x,base+0.45,z-0.05,0.24,0.35,materiales.ceramica,muebles);
  cubo(x,base+0.68,z+0.2,0.42,0.16,0.16,materiales.ceramica,muebles);
}
function crearLavamanos(x,pisoY,z,grupo){
  const base = pisoY + 0.02;
  cubo(x,base+0.75,z,0.7,0.08,0.5,materiales.ceramica,grupo);
  cilindro(x,base+0.38,z,0.08,0.7,materiales.blancoMetal,grupo);
  cilindro(x,base+0.82,z-0.15,0.02,0.12,materiales.metal,grupo);
}

/* ================= MUEBLES SEGUNDO PISO ================= */
function crearMueblesSegundoPiso(){
  crearHabitacionNino(-7,-1.5);
  crearHabitacionNina(5.8,-1.5);
  crearHabitacionPrincipal();
}

function crearHabitacionNino(x,z){
  crearCama(x,5.2,z,2.8,4, materiales.azulNino);
  cubo(x,5.7,z+3,2.5,0.25,1,materiales.madera,muebles);
  crearSilla(x,z+2);
  cubo(x+2,6.1,z-3,1.5,2.8,0.7,materiales.blanco,muebles);
  cubo(x,4.86,z,4,0.03,3,materiales.azulNino,muebles);
  /* decoración: pequeño garaje de juguete / cohete */
  cilindro(x-1.7,5.5,z-3,0.14,0.6,materiales.rojoMoto,decoracion);
  esfera(x-1.7,5.85,z-3,0.16,materiales.blancoMetal,decoracion);
}

function crearHabitacionNina(x,z){
  crearCama(x,5.2,z,2.8,4, materiales.rosaClaro);
  cubo(x,5.7,z+3,2.5,0.25,1,materiales.maderaClara,muebles);
  crearSilla(x,z+2);
  cubo(x+2,6.1,z-3,1.5,2.8,0.7,materiales.blanco,muebles);
  cubo(x,4.86,z,4,0.03,3,materiales.rosa,muebles);
  /* decoración: tocador con espejo redondo y una muñeca simple */
  cubo(x-1.9,5.6,z-3.2,0.9,0.6,0.5,materiales.rosaClaro,muebles);
  cilindro(x-1.9,6.15,z-3.4,0.32,0.04,materiales.dorado,decoracion);
  esfera(x+1.9,5.55,z+2.6,0.14,materiales.rosaClaro,decoracion);
  esfera(x+1.9,5.72,z+2.6,0.08,materiales.gatoBlanco,decoracion);
}

function crearCama(x,y,z,ancho,largo,colorSabanas){
  cubo(x,y,z,ancho,0.45,largo,materiales.madera,muebles);
  cubo(x,y+0.35,z,ancho-0.2,0.35,largo-0.25,colorSabanas || materiales.blanco,muebles);
  cubo(x,y+1,z-largo/2+0.15,ancho,1.5,0.25,materiales.madera,muebles);
  cubo(x-0.7,y+0.62,z-largo/2+0.6,1,0.18,0.6,materiales.blanco,muebles);
  cubo(x+0.7,y+0.62,z-largo/2+0.6,1,0.18,0.6,materiales.blanco,muebles);
}

function crearHabitacionPrincipal(){
  crearCama(0,5.2,-3,4.5,5, materiales.blanco);
  cubo(-3,5.5,-3,0.8,0.7,0.8,materiales.madera,muebles);
  cubo(3,5.5,-3,0.8,0.7,0.8,materiales.madera,muebles);
  crearLampara(-3,6,-3); crearLampara(3,6,-3);
  cubo(2,6.1,-4.7,2.2,2.8,0.7,materiales.blanco,muebles); /* armario junto a cama, dentro de la habitación */
  cubo(0,7,-5.2,3.5,1.8,0.12,materiales.negroBrillo,muebles);
}

function crearLampara(x,y,z){
  cilindro(x,y,z,0.08,0.6,materiales.metal,decoracion);
  esfera(x,y+0.35,z,0.25,materiales.dorado,decoracion);
}

function crearIluminacionInterior(){
  const luces=[[-5,3,1],[3,3,1],[7,3,-3],[-7,3,-2],[8.7,3,3],[-7,7,-1],[5,7,-1],[0,7,-3],[7.5,7,-2]];
  luces.forEach(p=>{
    const luz = new THREE.PointLight(0xffe9bd,1.2,12);
    luz.position.set(p[0],p[1],p[2]); luz.castShadow=true; interior.add(luz);
  });
}

/* ================= GATO ANDANTE ================= */
function crearGato(){
  gato = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CapsuleGeometry ? new THREE.SphereGeometry(0.001) : new THREE.SphereGeometry(0.001), materiales.gato);
  /* cuerpo con cajas para compatibilidad r128 */
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.28,0.24), materiales.gato);
  torso.position.set(0,0.22,0); torso.castShadow=true; gato.add(torso);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.15,14,10), materiales.gato);
  cabeza.position.set(0.32,0.3,0); cabeza.castShadow=true; gato.add(cabeza);
  const orejaGeom = new THREE.ConeGeometry(0.05,0.09,8);
  const oreja1 = new THREE.Mesh(orejaGeom, materiales.gato); oreja1.position.set(0.36,0.42,0.07); gato.add(oreja1);
  const oreja2 = new THREE.Mesh(orejaGeom, materiales.gato); oreja2.position.set(0.36,0.42,-0.07); gato.add(oreja2);
  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.05,0.5,8), materiales.gato);
  cola.position.set(-0.35,0.32,0); cola.rotation.z = Math.PI/2.6; cola.name="cola"; gato.add(cola);
  const patas=[[0.18,0.08,0.09],[0.18,0.08,-0.09],[-0.18,0.08,0.09],[-0.18,0.08,-0.09]];
  patas.forEach(p=>{
    const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.18,8), materiales.gato);
    pata.position.set(p[0],p[1],p[2]); gato.add(pata);
  });
  const mancha = new THREE.Mesh(new THREE.SphereGeometry(0.16,10,8), materiales.gatoBlanco);
  mancha.scale.set(1,0.7,1); mancha.position.set(-0.08,0.14,0); gato.add(mancha);
  gato.position.set(3,0.02,6);
  vegetacion.add(gato);
  elegirNuevoObjetivoGato();
}
function elegirNuevoObjetivoGato(){
  const dentroCasa = pisoActual === 1 && Math.random() < 0.4;
  let x,z,y;
  if(dentroCasa){
    x = THREE.MathUtils.randFloat(-8.5,8.5);
    z = THREE.MathUtils.randFloat(-5,5);
    y = 0.02;
  } else {
    x = THREE.MathUtils.randFloat(-16,16);
    z = THREE.MathUtils.randFloat(-11,10);
    y = 0.02;
  }
  gatoObjetivo.set(x,y,z);
}
function actualizarGato(delta){
  if(!gato) return;
  const dir = new THREE.Vector3().subVectors(gatoObjetivo, gato.position); dir.y = 0;
  const dist = dir.length();
  if(dist < 0.3 || gatoEsperando > 0){
    gatoEsperando -= delta;
    if(gatoEsperando <= 0 && dist < 0.3){
      gatoEsperando = THREE.MathUtils.randFloat(1.5,4);
      elegirNuevoObjetivoGato();
    }
  } else {
    dir.normalize();
    const velocidadGato = 1.6;
    gato.position.x += dir.x * velocidadGato * delta;
    gato.position.z += dir.z * velocidadGato * delta;
    const anguloObjetivo = Math.atan2(dir.x, dir.z);
    gato.rotation.y = THREE.MathUtils.lerp(gato.rotation.y, anguloObjetivo, 0.08);
  }
  gato.position.y = 0.02 + Math.abs(Math.sin(performance.now()*0.006))*0.03;
  const cola = gato.getObjectByName("cola");
  if(cola) cola.rotation.x = Math.sin(performance.now()*0.004)*0.3;
}
function vistaGato(){
  salirExploracion();
  const p = gato.position;
  camera.position.set(p.x+2.2, p.y+1.6, p.z+2.2);
  mirarA(p.x,p.y+0.2,p.z);
  actualizarEstado("🐈 " + (pisoActual===1 && Math.abs(p.x)<9 && Math.abs(p.z)<6 ? "El gato anda por la casa" : "El gato anda por el jardín"));
}

/* ================= EVENTOS ================= */
function configurarEventos(){
  window.addEventListener("resize", redimensionar);
  document.addEventListener("keydown", teclaPresionada);
  document.addEventListener("keyup", teclaSoltada);
  canvas.addEventListener("click", activarExploracion);
  document.addEventListener("mousemove", moverMouse);
  document.addEventListener("pointerlockchange", cambioPointerLock);
}
function teclaPresionada(e){
  if(e.code in teclas) teclas[e.code]=true;
  if(e.code==="Escape") salirExploracion();
}
function teclaSoltada(e){ if(e.code in teclas) teclas[e.code]=false; }

function activarExploracion(){
  if(!modoExploracion){
    modoExploracion=true;
    document.body.classList.add("explorando");
    canvas.requestPointerLock();
    actualizarEstado("🚶 Modo exploración");
  }
}
function cambioPointerLock(){
  if(document.pointerLockElement===canvas){ modoExploracion=true; document.body.classList.add("explorando"); }
  else { modoExploracion=false; document.body.classList.remove("explorando"); }
}
function salirExploracion(){
  if(document.pointerLockElement) document.exitPointerLock();
  modoExploracion=false; document.body.classList.remove("explorando");
}
function moverMouse(e){
  if(!modoExploracion) return;
  yaw -= e.movementX*sensibilidad;
  pitch -= e.movementY*sensibilidad;
  const limite = Math.PI/2 - 0.08;
  pitch = Math.max(-limite, Math.min(limite,pitch));
  camera.rotation.order="YXZ";
  camera.rotation.y=yaw; camera.rotation.x=pitch;
}

function actualizarMovimiento(delta){
  if(!modoExploracion) return;
  let velocidad = (teclas.ShiftLeft||teclas.ShiftRight) ? velocidadCorrer : velocidadCaminar;
  const distancia = velocidad*delta;
  let dx=0, dz=0;
  if(teclas.KeyW) dz-=1; if(teclas.KeyS) dz+=1; if(teclas.KeyA) dx-=1; if(teclas.KeyD) dx+=1;
  if(dx===0 && dz===0) return;
  const longitud = Math.sqrt(dx*dx+dz*dz); dx/=longitud; dz/=longitud;
  const forwardX=-Math.sin(yaw), forwardZ=-Math.cos(yaw), rightX=Math.cos(yaw), rightZ=-Math.sin(yaw);
  const movX=(forwardX*dz+rightX*dx)*distancia, movZ=(forwardZ*dz+rightZ*dx)*distancia;
  moverConColision(movX,movZ);
}

function moverConColision(dx,dz){
  const radio=0.38;
  const nuevaX=camera.position.x+dx;
  if(!hayColision(nuevaX,camera.position.z,radio)) camera.position.x=nuevaX;
  const nuevaZ=camera.position.z+dz;
  if(!hayColision(camera.position.x,nuevaZ,radio)) camera.position.z=nuevaZ;
  camera.position.x = THREE.MathUtils.clamp(camera.position.x,-18,18);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z,-20,25);
}

function hayColision(x,z,radio){
  for(const c of colliders){
    if(x+radio>c.minX && x-radio<c.maxX && z+radio>c.minZ && z-radio<c.maxZ){
      const enEscalera = x>5.2 && x<9 && z>-1 && z<5;
      if(enEscalera) continue;
      /* deja pasar por el vano del baño principal / baño social */
      const vanoBanoPrincipal = x>4.5 && x<5 && z>-3 && z<-0.4;
      if(vanoBanoPrincipal) continue;
      const vanoBanoSocial = x>9.3 && x<9.8 && z>1.8 && z<4.9;
      if(vanoBanoSocial) continue;
      return true;
    }
  }
  return false;
}

function actualizarPiso(){
  const enEscalera = camera.position.x>5.2 && camera.position.x<9 && camera.position.z>-1 && camera.position.z<5;
  if(enEscalera){
    if(camera.position.z<2){ camera.position.y=THREE.MathUtils.lerp(camera.position.y,5.9,0.05); pisoActual=2; }
    else { camera.position.y=THREE.MathUtils.lerp(camera.position.y,1.7,0.05); pisoActual=1; }
  }
}

/* ================= VISTAS ================= */
function vistaExterior(){ salirExploracion(); camera.position.set(28,14,30); mirarA(0,3,0); actualizarEstado("🌎 Vista exterior"); }
function vistaFrontal(){ salirExploracion(); camera.position.set(0,8,31); mirarA(0,4,0); actualizarEstado("🏠 Vista frontal"); }
function vistaPatio(){ salirExploracion(); camera.position.set(0,8,-30); mirarA(0,3,-2); actualizarEstado("🌴 Vista patio"); }
function vistaPiscina(){ salirExploracion(); camera.position.set(18,7,-18); mirarA(0,1,-12); actualizarEstado("🏊 Vista piscina"); }
function vistaParqueadero(){ salirExploracion(); camera.position.set(-2,6,15); mirarA(-5,1,8.5); actualizarEstado("🅿️ Parqueadero — carro y moto"); }

function entrarCasa(){
  salirExploracion();
  camera.position.set(0,1.7,4.2);
  yaw=Math.PI; pitch=0; camera.rotation.set(0,yaw,0);
  pisoActual=1;
  actualizarEstado("🚪 Interior — entrada");
  mostrarNotificacion("Haz clic en la escena y usa W A S D para caminar");
}
function salirCasa(){ vistaExterior(); }

function vistaSala(){ salirExploracion(); camera.position.set(-5,1.7,2.5); mirarA(-5,1.7,4); actualizarEstado("🛋️ Sala"); }
function vistaComedor(){ salirExploracion(); camera.position.set(2,1.7,1); mirarA(2,1.6,-2); actualizarEstado("🍽️ Comedor"); }
function vistaCocina(){ salirExploracion(); camera.position.set(6,1.7,-1); mirarA(7,1.7,-4); actualizarEstado("🍳 Cocina integral"); }
function vistaEstudio(){ salirExploracion(); camera.position.set(-7,1.7,-1); mirarA(-7,1.7,-3); actualizarEstado("💻 Estudio"); }
function vistaOratorio(){ salirExploracion(); camera.position.set(-5,1.7,2.5); mirarA(-5.8,2,3.5); actualizarEstado("✝️ Cuarto de oración"); }
function vistaBanoSocial(){ salirExploracion(); camera.position.set(8.6,1.6,2.6); mirarA(9,0.9,4); actualizarEstado("🚻 Baño social"); }

function vistaSegundoPiso(){ salirExploracion(); camera.position.set(5.5,5.8,2); mirarA(0,5.8,1); pisoActual=2; actualizarEstado("⬆️ Segundo piso"); }
function vistaHabitacion1(){ salirExploracion(); camera.position.set(-7,5.9,-1); mirarA(-7,5.8,-3); pisoActual=2; actualizarEstado("🚗 Cuarto del niño"); }
function vistaHabitacion2(){ salirExploracion(); camera.position.set(5.5,5.9,-1); mirarA(5.5,5.8,-3); pisoActual=2; actualizarEstado("🎀 Cuarto de la niña"); }
function vistaPrincipal(){ salirExploracion(); camera.position.set(0,5.9,-1); mirarA(0,5.8,-4); pisoActual=2; actualizarEstado("🛌 Habitación principal"); }
function vistaBanoPrincipal(){ salirExploracion(); camera.position.set(6.5,5.7,-3); mirarA(8.2,5,-2); pisoActual=2; actualizarEstado("🛁 Baño principal"); }

function mirarA(x,y,z){
  const objetivo = new THREE.Vector3(x,y,z);
  camera.lookAt(objetivo);
  yaw = camera.rotation.y; pitch = camera.rotation.x;
}

function configurarBotones(){
  conectar("btnExterior", vistaExterior);
  conectar("btnFrontal", vistaFrontal);
  conectar("btnPatio", vistaPatio);
  conectar("btnPiscina", vistaPiscina);
  conectar("btnParqueadero", vistaParqueadero);
  conectar("btnGato", vistaGato);
  conectar("btnEntrar", entrarCasa);
  conectar("btnSalir", salirCasa);
  conectar("btnSala", vistaSala);
  conectar("btnComedor", vistaComedor);
  conectar("btnCocina", vistaCocina);
  conectar("btnEstudio", vistaEstudio);
  conectar("btnOratorio", vistaOratorio);
  conectar("btnBanoSocial", vistaBanoSocial);
  conectar("btnSegundoPiso", vistaSegundoPiso);
  conectar("btnHabitacion1", vistaHabitacion1);
  conectar("btnHabitacion2", vistaHabitacion2);
  conectar("btnPrincipal", vistaPrincipal);
  conectar("btnBanoPrincipal", vistaBanoPrincipal);
}
function conectar(id,funcion){
  const boton = document.getElementById(id);
  if(!boton){ console.warn("Botón no encontrado:",id); return; }
  boton.addEventListener("click", funcion);
}

function actualizarEstado(texto){
  const el = document.getElementById("estado");
  if(el) el.textContent = texto;
}
function mostrarNotificacion(texto){
  let el = document.querySelector(".notificacion");
  if(!el){ el=document.createElement("div"); el.className="notificacion"; document.body.appendChild(el); }
  el.textContent = texto;
  el.classList.add("mostrar");
  setTimeout(()=>el.classList.remove("mostrar"), 3000);
}

function redimensionar(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
}

function colocarCamaraExterior(){ camera.position.set(27,13,29); mirarA(0,3,0); }

function iniciarCarga(){
  const loading = document.getElementById("loading");
  const progreso = document.getElementById("loadingProgress");
  let valor=0;
  const intervalo = setInterval(()=>{
    valor += Math.random()*18;
    if(valor>=100){
      valor=100; clearInterval(intervalo);
      setTimeout(()=>{ if(loading) loading.classList.add("oculto"); }, 500);
    }
    if(progreso) progreso.style.width = valor+"%";
  }, 120);
}

function animate(){
  requestAnimationFrame(animate);
  const delta = Math.min(clock ? clock.getDelta() : 0.016, 0.05);
  actualizarMovimiento(delta);
  actualizarPiso();
  actualizarGato(delta);
  animarAgua();
  renderer.render(scene,camera);
}
clock = new THREE.Clock();

function animarAgua(){
  const tiempo = performance.now()*0.001;
  exterior.children.forEach(o=>{
    if(o.material===materiales.agua) o.position.y = 0.22 + Math.sin(tiempo*1.5)*0.025;
  });
}

document.addEventListener("keydown", e=>{
  if(e.code==="Digit1") vistaExterior();
  if(e.code==="Digit2") vistaFrontal();
  if(e.code==="Digit3") vistaPatio();
  if(e.code==="Digit4") vistaPiscina();
  if(e.code==="Digit5") entrarCasa();
  if(e.code==="Digit6") vistaSegundoPiso();
  if(e.code==="Digit7") vistaParqueadero();
  if(e.code==="Digit8") vistaGato();
});