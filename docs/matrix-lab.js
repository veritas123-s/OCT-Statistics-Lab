(function(){
  'use strict';
  const $=id=>document.getElementById(id),math=window.MatrixMath,G=window.MANIM_GEOMETRY;
  const f=(v,p=4)=>Number.isFinite(v)?(Math.abs(v)<.5*10**(-p)?0:v).toFixed(p):'—';
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mat=A=>`<span class="matrix" style="--cols:${A[0].length}">${A.flat().map(x=>`<span>${f(x,4)}</span>`).join('')}</span>`;
  const lab=window.OCT_LAB,parent=document.querySelector('.graph-workspace');
  let state={center:1,angle:0,sx:1,sy:1},past=[{...state}],historyIndex=0,lastPreset='center';
  let selectedPoint='query',lastSignature=JSON.stringify(lab.points),view=null,panning=null,active=true;
  let animation=null;
  function stopAnimation(){if(animation){cancelAnimationFrame(animation.frame);const done=animation.resolve;animation=null;done(false);}}
  function animateTo(next,{duration=700,record=true,presetName=null}={}){
    stopAnimation();lastPreset=presetName;
    const start={...state},began=performance.now();
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)duration=0;
    return new Promise(resolve=>{
      const task={resolve,frame:0};animation=task;
      function frame(now){
        if(animation!==task)return;
        const t=duration>0?Math.min(1,(now-began)/duration):1,u=t*t*(3-2*t);
        state={center:start.center+(next.center-start.center)*u,angle:start.angle+(next.angle-start.angle)*u,
          sx:Math.exp(Math.log(start.sx)+(Math.log(next.sx)-Math.log(start.sx))*u),
          sy:Math.exp(Math.log(start.sy)+(Math.log(next.sy)-Math.log(start.sy))*u)};
        if(t===1){state={...next};animation=null;if(record)commit();}
        render();
        if(t<1)task.frame=requestAnimationFrame(frame);else resolve(true);
      }
      task.frame=requestAnimationFrame(frame);
    });
  }
  const entry=document.createElement('button');entry.id='matrix-open';entry.className='mx-toggle';entry.textContent='矩阵实验';document.querySelector('.header-actions').prepend(entry);
  const section=document.createElement('section');section.id='matrix-workspace';section.className='matrix-workspace';section.setAttribute('aria-label','可回退的矩阵变换实验');
  section.innerHTML=`<div class="mx-top"><div><h2>矩阵变换实验 <small>Manim 几何 · 随时回退</small></h2></div><button id="mx-exit">返回散点编辑</button></div>
  <div class="mx-body"><div class="mx-plot-wrap"><div id="mx-canvas" class="mx-canvas" tabindex="0" aria-label="矩阵变换画布，可平移和缩放"></div><div class="mx-view-tools"><button id="mx-fit">适应图形</button><button id="mx-plus" aria-label="变换视图放大">＋</button><button id="mx-minus" aria-label="变换视图缩小">−</button></div><div class="mx-view-label" id="mx-view-label"></div></div>
  <div class="mx-controls"><div><p class="mx-control-title">选状态；任何滑块都能往回拖</p><div class="mx-stages"><button data-preset="raw">原始观测</button><button data-preset="center">① 中心化</button><button data-preset="rotate">② 旋转对齐</button><button data-preset="white">③ 白化缩放</button></div><div class="mx-history"><button id="mx-undo">← 撤销一步</button><button id="mx-redo">重做 →</button><span id="mx-history-count"></span></div></div>
  <div class="mx-control"><label for="mx-center">中心化程度 t<output id="mx-center-value"></output></label><input id="mx-center" type="range" min="0" max="1" step="0.001" value="1"><p>p → p − t p̄；平移不改变协方差。</p></div>
  <div class="mx-control"><label for="mx-angle">旋转角度 φ<output id="mx-angle-value"></output></label><input id="mx-angle" type="range" min="-180" max="180" step="0.01" value="0"><p id="mx-target-angle"></p></div>
  <div class="mx-control"><label for="mx-sx">横轴缩放 sₓ<output id="mx-sx-value"></output></label><input id="mx-sx" type="range" min="0.001" max="2" step="0.0001" value="1"><label for="mx-sy">纵轴缩放 sᵧ<output id="mx-sy-value"></output></label><input id="mx-sy" type="range" min="0.001" max="2" step="0.0001" value="1"><div class="mx-number-pair"><label>sₓ<input id="mx-sx-number" type="number" min="0.001" max="20" step="0.001" value="1" aria-label="横轴缩放数值"></label><label>sᵧ<input id="mx-sy-number" type="number" min="0.001" max="20" step="0.001" value="1" aria-label="纵轴缩放数值"></label></div><p>缩放改变数据和椭圆；“适应图形”只改变镜头。</p></div>
  <div class="mx-select-point"><label>追踪一个点<select id="mx-point" aria-label="追踪的观测"></select></label><div class="mx-point-summary" id="mx-point-summary"></div><p class="mx-cov-label">变换后的协方差 S′ = M S Mᵀ</p><div id="mx-covariance"></div><label class="mx-layer-label"><input id="mx-grid" type="checkbox" checked>显示随矩阵变形的网格</label><label class="mx-layer-label"><input id="mx-ghost" type="checkbox">显示变换前轮廓作比较</label></div>
  <p class="mx-tag">每一步从原始坐标精确重算，回退不会累积误差。旋转采用 det(Q₊)=+1 的主轴基；与原统计面板的第二主轴相差一个符号。</p></div></div>
  <div class="mx-proof"><div class="mx-equation-heading"><span>列向量：p′ = D · R · (p − t p̄)，累计 H = D₃ R₃ T</span><small>右边的矩阵先作用</small></div><div class="mx-factors" id="mx-factors"></div><details><summary>展开：每一步乘法、点坐标及逆变换数值</summary><div id="mx-numerical" class="mx-numerical"></div></details></div>`;
  parent.appendChild(section);
  const canvas=$('mx-canvas');

  function preset(name){const s=lab.stats;if(name==='raw')return{center:0,angle:0,sx:1,sy:1};if(name==='center')return{center:1,angle:0,sx:1,sy:1};return{center:1,angle:-s.theta*180/Math.PI,sx:name==='white'?1/s.sd[0]:1,sy:name==='white'?1/s.sd[1]:1};}
  function commit(){if(JSON.stringify(state)===JSON.stringify(past[historyIndex]))return;past=past.slice(0,historyIndex+1);past.push({...state});if(past.length>100)past.shift();historyIndex=past.length-1;}
  function readPoint(){return selectedPoint==='query'?lab.query:lab.points[Number(selectedPoint)]||lab.query;}
  function syncPointOptions(){const key=$('mx-point').value||selectedPoint;const options=[['query','当前待测点'],...lab.points.map((p,i)=>[String(i),p.label])];$('mx-point').innerHTML=options.map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('');selectedPoint=options.some(v=>v[0]===key)?key:'query';$('mx-point').value=selectedPoint;}
  function render({fit=false}={}){
    const s=lab.stats,plan=math.plan(s,state),p=readPoint(),stages=plan.stages(p);
    ['center','angle','sx','sy'].forEach(k=>{$('mx-'+k).value=state[k];$('mx-'+k+'-value').textContent=f(state[k],k==='angle'?2:4)+(k==='angle'?'°':'');});
    if(document.activeElement!==$('mx-sx-number'))$('mx-sx-number').value=f(state.sx,6);
    if(document.activeElement!==$('mx-sy-number'))$('mx-sy-number').value=f(state.sy,6);
    $('mx-target-angle').textContent=`对齐角度为 ${f(-s.theta*180/Math.PI,4)}°；旋转保持欧氏长度。`;
    $('mx-undo').disabled=historyIndex===0;$('mx-redo').disabled=historyIndex===past.length-1;$('mx-history-count').textContent=`${historyIndex+1} / ${past.length}`;
    document.querySelectorAll('[data-preset]').forEach(b=>{b.classList.toggle('active',JSON.stringify(state)===JSON.stringify(preset(b.dataset.preset)));if(b.dataset.preset==='white')b.disabled=!s.positive;});
    $('mx-covariance').innerHTML=mat(plan.covariance);
    const mappedMean=plan.map({x:s.mean[0],y:s.mean[1]}),currentLength=Math.hypot(stages.scaled[0]-mappedMean[0],stages.scaled[1]-mappedMean[1]);
    $('mx-point-summary').innerHTML=`原始：(${f(p.x)}, ${f(p.y)})<br>当前：<strong>(${f(stages.scaled[0])}, ${f(stages.scaled[1])})</strong><br>到当前中心的欧氏距离：${f(currentLength)}<br>参照下马氏距离：${f(s.distance(p).md)}`;
    $('mx-factors').innerHTML=`<div class="mx-factor"><h3>① T：平移到均值中心</h3>${mat(plan.T)}<p>齐次坐标 [X,Y,1]ᵀ；最后一列控制平移。</p></div><div class="mx-factor"><h3>② R：真正的旋转</h3>${mat(plan.R)}<p>det(R)=1，RᵀR=I；改变方向，保留长度。</p></div><div class="mx-factor"><h3>③ D：分别缩放两条坐标轴</h3>${mat(plan.D)}<p>白化取 1/√λ₁=${f(1/s.sd[0],6)}，1/√λ₂=${f(1/s.sd[1],6)}。</p></div><div class="mx-factor mx-matrix-total"><h3>累计矩阵 H：一次得到同一结果</h3>${mat(plan.H)}<p>线性部分 M=DR；平移部分为 −M t p̄。</p></div>`;
    $('mx-numerical').innerHTML=`1. 平移：d = (${f(p.x,6)} − ${f(state.center,6)} × ${f(s.mean[0],6)}, ${f(p.y,6)} − ${f(state.center,6)} × ${f(s.mean[1],6)}) = <code>(${f(stages.centered[0],6)}, ${f(stages.centered[1],6)})</code><br>
    2. 旋转：z₁ = (${f(plan.R[0][0],6)}) × (${f(stages.centered[0],6)}) + (${f(plan.R[0][1],6)}) × (${f(stages.centered[1],6)}) = <code>${f(stages.rotated[0],6)}</code><br>z₂ = (${f(plan.R[1][0],6)}) × (${f(stages.centered[0],6)}) + (${f(plan.R[1][1],6)}) × (${f(stages.centered[1],6)}) = <code>${f(stages.rotated[1],6)}</code><br>
    3. 缩放：p′ = (${f(state.sx,6)} × ${f(stages.rotated[0],6)}, ${f(state.sy,6)} × ${f(stages.rotated[1],6)}) = <code>(${f(stages.scaled[0],6)}, ${f(stages.scaled[1],6)})</code><br>
    4. 逆变换：<div class="calc-matrix-line">H⁻¹ = ${mat(plan.inverse)}</div>H⁻¹[p′₁,p′₂,1]ᵀ = <code>(${f(stages.recovered[0],6)}, ${f(stages.recovered[1],6)}, 1)</code>，回到原始坐标。<br>
    协方差：S′ = (DR)S(DR)ᵀ；先旋转对齐得到 diag(${f(s.eigen[0],6)}, ${f(s.eigen[1],6)})，再按主轴标准差缩放得到 I。任意手动角度下直接计算 M S Mᵀ，未把协方差强行置零。`;
    if(active){if(fit||!view)fitView();else draw();}
    window.dispatchEvent(new Event('matrix:frame'));
  }
  function ellipseCurves(s){if(!G)return[];const B=[[s.q1[0]*s.sd[0],-s.q2[0]*s.sd[1]],[s.q1[1]*s.sd[0],-s.q2[1]*s.sd[1]]];return G.unit_circle.map(curve=>curve.map(v=>{const xy=math.apply(B,v);return{x:xy[0]+s.mean[0],y:xy[1]+s.mean[1]};}));}
  function size(){return{w:canvas.clientWidth,h:canvas.clientHeight};}
  function screen(v){const{w,h}=size();return[w/2+(v[0]-view.x)*view.scale,h/2-(v[1]-view.y)*view.scale];}
  function world(px,py){const{w,h}=size();return[(px-w/2)/view.scale+view.x,(h/2-py)/view.scale+view.y];}
  function fitView(){const{w,h}=size();if(w<5||h<5)return;const s=lab.stats,plan=math.plan(s,state),pts=[...lab.points,lab.query,...ellipseCurves(s).flat()].map(plan.map),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const lx=Math.min(...xs),hx=Math.max(...xs),ly=Math.min(...ys),hy=Math.max(...ys);view={x:(lx+hx)/2,y:(ly+hy)/2,scale:Math.min(Math.max(90,w-85)/(Math.max(hx-lx,1)*1.3),Math.max(100,h-65)/(Math.max(hy-ly,1)*1.3))};draw();}
  function pathFor(curves,mapper){let out='';curves.forEach((curve,i)=>{const ps=curve.map(p=>screen(mapper(p)));if(i===0)out+=`M${ps[0][0]},${ps[0][1]}`;out+=` C${ps[1][0]},${ps[1][1]} ${ps[2][0]},${ps[2][1]} ${ps[3][0]},${ps[3][1]}`;});return out+'Z';}
  function nice(v){const unit=10**Math.floor(Math.log10(v));return[1,2,5,10].find(k=>k*unit>=v)*unit;}
  function draw(){
    if(!view||!active)return;if(!G){canvas.textContent='Manim 几何数据未加载。';return;}
    const{w,h}=size();if(w<5||h<5)return;const s=lab.stats,plan=math.plan(s,state),curves=ellipseCurves(s),lo=world(0,h),hi=world(w,0),tick=nice(75/view.scale),dec=Math.min(5,Math.max(0,-Math.floor(Math.log10(tick))));
    const axis=screen([0,0]),axisX=Math.max(8,Math.min(w-40,axis[0]+5)),axisY=Math.max(22,Math.min(h-30,axis[1]+16));
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="由 Manim 曲线经矩阵变换后的椭圆，旋转 ${f(state.angle,2)} 度，缩放 ${f(state.sx)}、${f(state.sy)}"><defs><clipPath id="mx-clip"><rect width="${w}" height="${h}"/></clipPath><marker id="mx-arrow1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6" fill="#428fa2"/></marker><marker id="mx-arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0L6,3L0,6" fill="#ad8bb6"/></marker></defs><g clip-path="url(#mx-clip)">`;
    for(let x=Math.ceil(lo[0]/tick)*tick;x<=hi[0];x+=tick){const p=screen([x,0]);svg+=`<line x1="${p[0]}" y1="0" x2="${p[0]}" y2="${h}" stroke="#edf1f4"/><text x="${p[0]+4}" y="${axisY}" fill="#9baab3" font-size="10">${f(x,dec)}</text>`;}
    for(let y=Math.ceil(lo[1]/tick)*tick;y<=hi[1];y+=tick){const p=screen([0,y]);svg+=`<line x1="0" y1="${p[1]}" x2="${w}" y2="${p[1]}" stroke="#edf1f4"/><text x="${axisX}" y="${p[1]-4}" fill="#9baab3" font-size="10">${f(y,dec)}</text>`;}
    svg+=`<line x1="0" y1="${axis[1]}" x2="${w}" y2="${axis[1]}" stroke="#bfccd3"/><line x1="${axis[0]}" y1="0" x2="${axis[0]}" y2="${h}" stroke="#bfccd3"/>`;
    if($('mx-grid').checked){const origin=screen(plan.map({x:s.mean[0],y:s.mean[1]}));for(const line of math.viewportGrid(plan.M,origin,view.scale,w,h)){const[a,b]=line.ends;svg+=`<line class="mx-lattice" data-axis="${line.axis}" data-step="${line.step}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#b4d4c3" stroke-width=".8" opacity=".75"/>`;}}
    if($('mx-ghost').checked)svg+=`<path d="${pathFor(curves,p=>[p.x-s.mean[0],p.y-s.mean[1]])}" fill="none" stroke="#c4cdd2" stroke-dasharray="5 5" stroke-width="1.3"/>`;
    svg+=`<path d="${pathFor(curves,plan.map)}" fill="#25856e13" stroke="#22846e" stroke-width="2.2"/>`;
    const mc=screen(plan.map({x:s.mean[0],y:s.mean[1]}));
    for(let k=0;k<2;k++){const v=[s.mean[0]+(k===0?10:0),s.mean[1]+(k===1?10:0)],ep=screen(plan.map({x:v[0],y:v[1]})),color=k===0?'#428fa2':'#ad8bb6';svg+=`<line x1="${mc[0]}" y1="${mc[1]}" x2="${ep[0]}" y2="${ep[1]}" stroke="${color}" stroke-width="2" marker-end="url(#mx-arrow${k+1})"/><text x="${ep[0]+6}" y="${ep[1]-6}" fill="${color}" font-size="10">10·M e${k+1}</text>`;}
    lab.points.forEach(p=>{const xy=screen(plan.map(p));svg+=`<circle cx="${xy[0]}" cy="${xy[1]}" r="4.5" fill="#22846e" stroke="#fff"/><text x="${xy[0]+7}" y="${xy[1]-8}" fill="#61907e" font-size="10">${esc(p.label)}</text>`;});
    const query=lab.query,qp=screen(plan.map(query));svg+=`<line x1="${mc[0]}" y1="${mc[1]}" x2="${qp[0]}" y2="${qp[1]}" stroke="#dc7d3c" stroke-width="1.4"/><circle cx="${qp[0]}" cy="${qp[1]}" r="6" fill="#dc7d3c" stroke="#fff"/><text x="${qp[0]+9}" y="${qp[1]-9}" fill="#b57648" font-size="11">待测点</text><circle cx="${mc[0]}" cy="${mc[1]}" r="3" fill="#4778b1"/></g><text x="${w-12}" y="${h-16}" text-anchor="end" fill="#8ea1ab" font-size="10">当前变换坐标</text></svg>`;
    canvas.innerHTML=svg;$('mx-view-label').textContent=`1 个当前坐标单位 = ${f(view.scale,2)} px · 视图缩放只改变镜头`;
  }
  function setActive(value){if(!value)stopAnimation();active=value;section.hidden=!value;parent.classList.toggle('matrix-active',value);if(value){syncPointOptions();render({fit:true});}window.dispatchEvent(new Event('resize'));}
  entry.addEventListener('click',()=>setActive(!active));$('mx-exit').addEventListener('click',()=>setActive(false));
  document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{const name=b.dataset.preset;animateTo(preset(name),{presetName:name});}));
  for(const key of['center','angle','sx','sy']){
    $('mx-'+key).addEventListener('input',e=>{stopAnimation();state[key]=Number(e.target.value);lastPreset=null;render();});
    $('mx-'+key).addEventListener('change',()=>{commit();render();});
  }
  ['sx','sy'].forEach(key=>{
    const field=$('mx-'+key+'-number');let dirty=false;
    field.addEventListener('input',e=>{stopAnimation();dirty=true;const v=e.target.valueAsNumber;if(Number.isFinite(v)&&v>=.001&&v<=20){state[key]=v;lastPreset=null;render();}});
    const finish=e=>{if(!dirty){render();return;}dirty=false;const v=e.target.valueAsNumber;if(!Number.isFinite(v)||v<.001||v>20)e.target.value=f(state[key],6);else{state[key]=v;lastPreset=null;commit();}render();};
    field.addEventListener('change',finish);field.addEventListener('blur',finish);
  });
  $('mx-undo').addEventListener('click',()=>{stopAnimation();if(historyIndex>0)animateTo({...past[--historyIndex]},{record:false});});
  $('mx-redo').addEventListener('click',()=>{stopAnimation();if(historyIndex<past.length-1)animateTo({...past[++historyIndex]},{record:false});});
  $('mx-point').addEventListener('change',e=>{selectedPoint=e.target.value;render();});
  ['mx-grid','mx-ghost'].forEach(id=>$(id).addEventListener('change',draw));
  $('mx-fit').addEventListener('click',fitView);
  function zoom(factor,x,y){const{w,h}=size();x=x??w/2;y=y??h/2;const old=world(x,y);view.scale=Math.max(.05,Math.min(3000,view.scale*factor));const fresh=world(x,y);view.x+=old[0]-fresh[0];view.y+=old[1]-fresh[1];draw();}
  $('mx-plus').addEventListener('click',()=>zoom(1.4));$('mx-minus').addEventListener('click',()=>zoom(1/1.4));
  canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;panning={x:e.clientX,y:e.clientY,view:{...view}};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!panning)return;view.x=panning.view.x-(e.clientX-panning.x)/view.scale;view.y=panning.view.y+(e.clientY-panning.y)/view.scale;draw();});
  canvas.addEventListener('pointerup',()=>panning=null);canvas.addEventListener('pointercancel',()=>panning=null);
  window.addEventListener('oct:datachange',()=>{stopAnimation();const sig=JSON.stringify(lab.points);if(sig!==lastSignature){lastSignature=sig;if(lastPreset)state=preset(lastPreset);if(!lab.stats.positive&&(state.sx!==1||state.sy!==1)){state={center:1,angle:0,sx:1,sy:1};lastPreset='center';}past=[{...state}];historyIndex=0;}syncPointOptions();render();});
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(active)fitView();},80);}).observe(canvas);
  window.OCT_MATRIX={animateTo,setState(next){stopAnimation();state={...next};commit();render();},stop(){stopAnimation();commit();render();},get animating(){return!!animation;},get state(){return{...state};},get plan(){return math.plan(lab.stats,state);},get history(){return past.map(p=>({...p}));},get historyIndex(){return historyIndex;}};
  syncPointOptions();setActive(true);
})();
