import assert from 'node:assert/strict';
// Compare the case's screen projection in Booklet and Listen (less Listen's camera rise), including the return path and the shared lens.
// PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-case-transition.mjs [url]
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');
const url=process.argv[2]??'http://localhost:5173/';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try {
for(const [width,height] of [[1440,900],[390,844],[844,390]]) {
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto(`${url}#/surrender/open`);
 await page.waitForSelector('.preloader.is-done',{state:'attached'});
 await page.waitForFunction(()=>window.scene?.ready&&!window.scene.viewBusy());
 const result=await page.evaluate(()=>{
  const s=window.scene;
  s.openBooklet();s.killTween(s.readTween);s.readTween=null;
  const item=s.cases[s.reading], points=[], corner=s.gallery.position.clone();
  item.body.updateWorldMatrix(true,true);
  item.body.traverse(n=>{
   if(!n.isMesh)return;
   if(!n.geometry.boundingBox)n.geometry.computeBoundingBox();
   const b=n.geometry.boundingBox;
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(corner.clone().set(x,y,z).applyMatrix4(n.matrixWorld));
  });
  function snapshot(){
   s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
   const projected=points.map(p=>p.clone().add(s.gallery.position).project(s.camera));
   return {projected,boxPan:s.gallery.position.y/4.4,lens:s.lens,bottom:Math.max(...projected.map(p=>1-p.y))};
  }
  let maxError=0,returnError=0;
  const reference=[];
  for(const t of [0.2,0.3,0.4,0.45,0.5,0.525,0.53]){
   // The same pan, easing and lens; only Listen's camera rises (for the player's product shot),
   // while the booklet is read head-on, so compare with that rise taken out.
   s.read=0;s.listen=t;s.updatePlayer(0);s.setLens(s.lens,0);
   const listen=snapshot();
   s.listen=0;
   let low=0,high=1;
   for(let n=0;n<35;n++){const mid=(low+high)/2;s.read=mid;s.updatePlayer(0);if(s.gallery.position.y/4.4<listen.boxPan)low=mid;else high=mid;}
   s.read=(low+high)/2;s.updatePlayer(0);
   const booklet=snapshot();
   for(let i=0;i<listen.projected.length;i++)maxError=Math.max(maxError,listen.projected[i].distanceTo(booklet.projected[i]));
   reference.push({read:s.read,lens:s.lens,y:s.gallery.position.y});
  }
  for(const entry of reference.slice().reverse()){
   s.read=entry.read;s.listen=0;s.updatePlayer(0);
   returnError=Math.max(returnError,Math.abs(s.lens-entry.lens),Math.abs(s.gallery.position.y-entry.y));
  }
  let sharedLensError=0;
  for(let n=0;n<=200;n++){
   s.read=n/200;s.listen=0;s.updatePlayer(0);
   const shot=snapshot();
   sharedLensError=Math.max(sharedLensError,Math.abs(shot.lens-shot.boxPan));
  }
  s.read=1;s.updatePlayer(0);s.updateBooklet(0);
  const finalLens=s.lens;
  s.listen=0;s.animateListen(1);const listenOpen=s.listenTween.duration;s.killTween(s.listenTween);s.listenTween=null;
  s.listen=1;s.animateListen(0);const listenReturn=s.listenTween.duration;s.killTween(s.listenTween);s.listenTween=null;s.listen=0;
  s.read=0;s.animateRead(1);const bookletOpen=s.readTween.duration;s.killTween(s.readTween);s.readTween=null;
  s.read=1;s.animateRead(0);const bookletReturn=s.readTween.duration;s.killTween(s.readTween);s.readTween=null;
  return {maxError,returnError,sharedLensError,finalLens,listenOpen,listenReturn,bookletOpen,bookletReturn};
 });
 assert.ok(result.maxError<1e-7,`Matching case projections: ${JSON.stringify(result)}`);
 assert.equal(result.returnError,0);
 assert.ok(result.sharedLensError<1e-12,'Booklet and Listen retain the same camera throughout');
 assert.equal(result.finalLens,1);
 assert.equal(result.bookletOpen,result.listenOpen);
 assert.equal(result.bookletReturn,result.listenReturn);
 console.log(JSON.stringify({width,height,...result}));await page.close();
}
} finally {await browser.close();}
