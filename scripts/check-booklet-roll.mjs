// Samples the actual formed-and-rolled page shaders with WebGL transform feedback.
// Run against the dev server; covers extraction, holder/tray clearance and flat reader handoff.
// PLAYWRIGHT_CORE=../leafthrough/node_modules/playwright-core/index.mjs node scripts/check-booklet-roll.mjs [url]
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_CORE)).href : 'playwright-core');
const url = process.argv[2] ?? 'http://localhost:5173/';
const album = process.argv[3] ?? 'nevermind';
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist']});
try {
for(const [width,height] of [[1440,900],[390,844],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}});
 await page.goto(`${url}#/${album}/open`);await page.waitForSelector('.preloader.is-done', {state:'attached'});await page.waitForFunction(()=>window.scene?.ready&&!window.scene.viewBusy());
 const result=await page.evaluate(()=>{
  const s=window.scene;s.openBooklet();s.killTween(s.readTween);s.readTween=null;
  const item=s.cases[s.reading],model=item.bookletModel,meshes=[];
  model.traverse(n=>{if(n.isMesh)meshes.push(n);});
  const gl=new OffscreenCanvas(1,1).getContext('webgl2');
  const samplers=meshes.map(mesh=>{
   const shader={vertexShader:'#include <common>\nvoid main(){\n#include <project_vertex>\n}',fragmentShader:'',uniforms:{}};
   mesh.material.onBeforeCompile(shader,s.renderer);
   let source=shader.vertexShader.replace('#include <common>','').replaceAll('attribute ','in ').replaceAll('varying ','out ').replace('void main(){','void main(){ vec3 transformed=sheetPosition(uv,aNoise.x);').replace('#include <project_vertex>','outPosition=transformed; gl_Position=vec4(0);');
   const program=gl.createProgram();
   for(const [type,text] of [[gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;\n#define PI 3.141592653589793\nin vec2 uv;out vec3 outPosition;'+source],[gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n#define PI 3.141592653589793\nout vec4 color;void main(){color=vec4(0);}']]){
    const sh=gl.createShader(type);gl.shaderSource(sh,text);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));gl.attachShader(program,sh);
   }
   gl.transformFeedbackVaryings(program,['outPosition'],gl.SEPARATE_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
   const vao=gl.createVertexArray();gl.bindVertexArray(vao);
   for(const name of ['uv','aNoise']){const a=mesh.geometry.attributes[name],location=gl.getAttribLocation(program,name);if(location<0)continue;gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,a.array,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,a.itemSize,gl.FLOAT,false,0,0);}
   const count=mesh.geometry.attributes.uv.count,output=new Float32Array(count*3),buffer=gl.createBuffer();gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,buffer);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,output.byteLength,gl.DYNAMIC_READ);
   const uv=mesh.geometry.attributes.uv;
   const middle=[0,0.5,1].map(x=>{let best=0,distance=Infinity;for(let i=0;i<uv.count;i++){const d=Math.hypot(uv.getX(i)-x,uv.getY(i)-0.5);if(d<distance){best=i;distance=d;}}return best;});
   return {mesh,program,vao,count,output,buffer,uniforms:shader.uniforms,middle};
  });
  gl.enable(gl.RASTERIZER_DISCARD);
  const p=model.position.clone(),lidInverse=item.lid.matrixWorld.clone(),bodyInverse=item.body.matrixWorld.clone();
  const casePath=[],bookletPath=[],heights=[],angles=[],landingY=[];
  const projected=p.clone(),normal=p.clone();
  let lidHits=0,lidExample=null,reverseError=0,flatError=0,rollSag=0,tabs=0,tabSamples=[],worstTray={depth:0,t:0},insideRange={low:Infinity,high:-Infinity};
  for(let n=0;n<=200;n++){
   const t=n/200;s.read=t;s.updatePlayer(0);s.updateBooklet(0);s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
   let frameLow=Infinity,frameHigh=-Infinity;
   casePath.push(s.gallery.position.toArray());
   bookletPath.push([...item.booklet.position.toArray(),...item.booklet.quaternion.toArray(),...item.booklet.scale.toArray(),...item.bend.value.toArray(),item.bookletCompression.value]);
   lidInverse.copy(item.lid.matrixWorld).invert();bodyInverse.copy(item.body.matrixWorld).invert();
   for(const sample of samplers){
    gl.useProgram(sample.program);gl.bindVertexArray(sample.vao);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,sample.buffer);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,sample.buffer);
    for(const [name,uniform] of Object.entries(sample.uniforms)){const loc=gl.getUniformLocation(sample.program,name);if(loc===null)continue;const v=uniform.value;if(typeof v==='number')gl.uniform1f(loc,v);else if(v?.isVector2)gl.uniform2fv(loc,v.toArray());else if(v?.isVector4)gl.uniform4fv(loc,v.toArray());else if(v?.isVector3)gl.uniform3fv(loc,v.toArray());}
    gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,sample.count);gl.endTransformFeedback();gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,sample.output);
    if(t===0.4){
     const points=sample.middle.map(index=>p.clone().fromArray(sample.output,index*3));
     rollSag=Math.max(rollSag,points[1].distanceTo(points[0].add(points[2]).multiplyScalar(0.5))*120);
    }
    if(t===1){
     const rolled=sample.output.slice();
     gl.uniform4f(gl.getUniformLocation(sample.program,'bookletBend'),0,0,0,0);
     gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,sample.count);gl.endTransformFeedback();gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,sample.output);
     for(let i=0;i<rolled.length;i++)flatError=Math.max(flatError,Math.abs(rolled[i]-sample.output[i]));
    }
    for(let i=0;i<sample.output.length;i+=3){
     projected.fromArray(sample.output,i).applyMatrix4(sample.mesh.matrixWorld).project(s.camera);
     frameLow=Math.min(frameLow,projected.y);frameHigh=Math.max(frameHigh,projected.y);
     p.fromArray(sample.output,i).applyMatrix4(sample.mesh.matrixWorld).applyMatrix4(lidInverse).multiplyScalar(60);
     const x=p.x-76,y=p.y,z=p.z;
     if(t===0){insideRange.low=Math.min(insideRange.low,z);insideRange.high=Math.max(insideRange.high,z);}
     const plate=p.x>-1&&p.x<141&&Math.abs(y)<62.5&&z>3.7&&z<5.2;
     const flange=p.x>-1&&p.x<141&&Math.abs(y)>61.5&&Math.abs(y)<62.5&&z>-2.8&&z<5.2;
     const stop=Math.abs(p.x-138.5)<0.4&&Math.abs(y)>16&&Math.abs(y)<40&&z>2.1&&z<3.7;
     if(plate||flange||stop){lidHits++;lidExample??={t,x:p.x,y,z,plate,flange,stop};}
     // Holders sit .05 mm behind the 1.2 mm booklet bounds (1.75..2.35 mm).
     for(const tx of [-44,44])for(const ty of [-61.5,61.5])if((x-tx)**2+(y-ty)**2<25&&z>1.75&&z<2.35){tabs++;if(tabSamples.length<5)tabSamples.push({t,x,y,z});}
     p.fromArray(sample.output,i).applyMatrix4(sample.mesh.matrixWorld).applyMatrix4(bodyInverse).multiplyScalar(60);
     if(t<=1&&p.x>=-69.5&&p.x<=68&&Math.abs(p.y)<60.5){const surface=p.x<-55.5?3.5:Math.hypot(p.x-6,p.y)<60?2.3:.9;const depth=surface-p.z;if(depth>worstTray.depth)worstTray={depth,t,x:p.x,y:p.y,z:p.z};}
    }
   }
   // The stored stack can exceed reading size on short screens. Check the zoom once
   // extraction is complete; resizing the paper still under the holders would break its fit.
   if(item.bookletCompression.value>0.999) heights.push(frameHigh-frameLow);
   if(t>=0.72){
    landingY.push(projected.copy(item.booklet.position).project(s.camera).y);
    normal.set(0,0,1).applyQuaternion(item.booklet.quaternion);
    const pitch=Math.atan2(normal.y,normal.z)-Math.atan2(s.camera.position.y-item.booklet.position.y,s.camera.position.z-item.booklet.position.z);
    angles.push(pitch*180/Math.PI);
   }
  }
  const maxZoomRatio=Math.max(...heights)/heights.at(-1);
  const maxAngleError=Math.max(...angles.map(angle=>Math.abs(angle-angles.at(-1))));
  const handoffScaleError=Math.abs(item.booklet.scale.x-s.bookletRig.scale.x/2);
  const landingDrift=Math.max(...landingY.map(y=>Math.abs(y-landingY.at(-1))));
  for(let n=200;n>=0;n--){
   s.read=n/200;s.updatePlayer(0);s.updateBooklet(0);
   const pose=[...item.booklet.position.toArray(),...item.booklet.quaternion.toArray(),...item.booklet.scale.toArray(),...item.bend.value.toArray(),item.bookletCompression.value];
   for(let i=0;i<pose.length;i++)reverseError=Math.max(reverseError,Math.abs(pose[i]-bookletPath[n][i]));
   for(let axis=0;axis<3;axis++)reverseError=Math.max(reverseError,Math.abs(s.gallery.position.getComponent(axis)-casePath[n][axis]));
  }
  const steadyCase=casePath.every((p,n)=>!n||(p[1]>=casePath[n-1][1]-1e-9&&p[2]<=casePath[n-1][2]+1e-9));
  const constantCaseDepth=casePath.every(p=>Math.abs(p[0])<1e-12&&Math.abs(p[2])<1e-12);
  return {maxZoomRatio,maxAngleError,handoffScaleError,landingDrift,lidHits,lidExample,tabs,tabSamples,worstTray,insideRange,flatError,rollSag,steadyCase,reverseError,constantCaseDepth};
 });
 assert.ok(result.landingDrift<0.001,`The landing does not dip and rise: ${result.landingDrift}`);
 assert.ok(result.maxZoomRatio<1.01,`No oversized zoom before landing: ${result.maxZoomRatio}`);
 assert.ok(result.maxAngleError<0.5,`No flatten-then-tilt during landing: ${result.maxAngleError}`);
 assert.ok(result.handoffScaleError<1e-6,`No size change at reader handoff: ${result.handoffScaleError}`);
 assert.ok(result.constantCaseDepth,'The box stays at constant depth without zooming');
 assert.ok(result.steadyCase,'The case pans upward without direction reversals');
 assert.ok(result.reverseError<1e-9,'The pages, bend and case retrace exactly the same path on closing');
 assert.equal(result.lidHits,0,`No page penetrates the lid plate, flanges or stops: ${JSON.stringify(result.lidExample)}`);
 assert.equal(result.tabs,0,'No page penetrates a lid holder');
 assert.equal(result.worstTray.depth,0,`No page penetrates the tray or hinge strip: ${JSON.stringify(result.worstTray)}`);
 assert.ok(result.insideRange.low>=2.39 && result.insideRange.high<3.7,'The formed resting stack fits inside the lid');
 assert.ok(result.flatError<1e-5,'Fully unrolled sheets match the reader geometry without a swap or snap');
 assert.ok(result.rollSag>5,'The paper itself curves around the roll during extraction');
 console.log(`${width} × ${height}: steady case, no lid/holder/tray intersections; ${result.rollSag.toFixed(1)} mm bend, zoom ratio ${result.maxZoomRatio.toFixed(4)}, angle variation ${result.maxAngleError.toFixed(3)}°, flat handoff error ${result.flatError}`);
 await page.close();
}
} finally { await browser.close(); }
