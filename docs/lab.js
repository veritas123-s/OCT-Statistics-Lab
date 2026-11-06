(function(){
  'use strict';
  const $=id=>document.getElementById(id), SOURCE=window.OCT_SOURCE, engine=window.OctStats;
  const esc=s=>String(s??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,p=4)=>v===null||!Number.isFinite(v)?'—':(Math.abs(v)<.5*10**(-p)?0:v).toFixed(p);
  const f2=v=>fmt(v,2),f4=v=>fmt(v,4),f6=v=>fmt(v,6),sum=engine.sum;
  const matrix=rows=>`<span class="matrix" style="--cols:${rows[0].length}" aria-label="矩阵 ${esc(rows.map(r=>r.join('，')).join('；'))}">${rows.flat().map(v=>`<span>${esc(v)}</span>`).join('')}</span>`;
  const row=cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`;
  const table=(heads,rows,totals)=>`<div class="calc-table-wrap"><table class="calc-table"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row).join('')}</tbody>${totals?`<tfoot>${row(totals)}</tfoot>`:''}</table></div>`;
  const eq=s=>`<div class="calc-equation">${s}</div>`,note=s=>`<p class="calc-note">${s}</p>`;
  const signed=values=>values.map((v,i)=>`${i?(v<0?' − ':' + '):(v<0?'−':'')}${f2(Math.abs(v))}`).join('');
  const fromSource=record=>{const v=record.values;return{key:`${v[0]}:${v[1]}`,id:v[0],side:v[1],label:`${v[0].replace('Patient-','P').replace('Control-','C')} ${v[1]==='right'?'R':'L'}`,x:v[10],y:v[11],originalX:v[10],originalY:v[11],sourceRow:record.row};};
  const initialRows=[2,4,6,8,10],initialQueryRows={6:13,8:16};
  const lookup=r=>SOURCE.rows.find(d=>d.row===r);
  let points=initialRows.map(r=>fromSource(lookup(r))),query=fromSource(lookup(13)),queryPreset='6';
  let stats=engine.compute(points),mode='raw',selectedCalc='mean',newCount=0;
  let view=null,drag=null,lastSize='',noticeTimer;
  const graph=$('graph');
  const layers={mean:true,ellipse:true,axes:true,query:true};
  const calcNames={mean:'均值与中心化',variance:'方差与标准差',covariance:'协方差矩阵',eigen:'特征值分解',projection:'主轴投影与白化',distance:'马氏距离'};

  function notify(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),3500);}
  function isOriginalSubset(){return points.length===5&&points.every((p,i)=>p.sourceRow===initialRows[i]&&p.x===p.originalX&&p.y===p.originalY);}
  function renderData(){
    $('editable-data').innerHTML=points.map((p,i)=>`<tr><td title="${esc(p.id)} · ${p.side==='right'?'右眼':p.side==='left'?'左眼':'教学新增'}">${esc(p.label)}</td><td><input type="number" step="0.1" data-index="${i}" data-axis="x" value="${p.x}" class="${p.x!==p.originalX?'edited':''}" aria-label="${esc(p.label)} X"></td><td><input type="number" step="0.1" data-index="${i}" data-axis="y" value="${p.y}" class="${p.y!==p.originalY?'edited':''}" aria-label="${esc(p.label)} Y"></td><td><button class="remove-row" data-remove="${i}" aria-label="移除 ${esc(p.label)}" ${points.length<=2?'disabled':''}>×</button></td></tr>`).join('');
  }
  function updateStats({rebuild=false,fit=false}={}){
    stats=engine.compute(points);
    if(mode==='white'&&!stats.positive){mode='principal';$('coordinate-mode').value=mode;view=null;notify('协方差矩阵不可逆，已切换为主轴坐标。');}
    if(rebuild)renderData();
    const original=isOriginalSubset();$('data-state').textContent=original?'论文原始子集':'教学参照已修改';$('data-state').classList.toggle('modified',!original);
    $('sample-count').textContent=`n = ${points.length}`;
    $('mean-stats').innerHTML=[['X̄',stats.mean[0],'μm'],['Ȳ',stats.mean[1],'μm'],['s²ₓ',stats.a,'μm²'],['s²ᵧ',stats.c,'μm²']].map(([label,v,unit])=>`<div><div class="stat-label">${label}</div><div class="stat-number">${f4(v)}<small>${unit}</small></div></div>`).join('');
    $('covariance-matrix').innerHTML=`<div class="matrix-line">S = ${matrix(stats.S.map(r=>r.map(f2)))}</div><p class="matrix-note">r = ${f4(stats.correlation)} · 分母 n − 1 = ${stats.df}</p>`;
    $('eigen-stats').innerHTML=`<div class="eigen-line"><div>λ₁<b>${f4(stats.eigen[0])}</b></div><div>λ₂<b>${f4(stats.eigen[1])}</b></div></div><p class="vector-line">q₁ = (${f4(stats.q1[0])}, ${f4(stats.q1[1])})<br>q₂ = (${f4(stats.q2[0])}, ${f4(stats.q2[1])})</p>`;
    $('coordinate-mode').querySelector('[value="white"]').disabled=!stats.positive;
    $('coordinate-note').textContent={raw:'原始测量 · μm',centered:'每个点减去均值 · μm',principal:'投影到特征向量方向 · μm',white:'各主轴除以标准差 · 无量纲'}[mode];
    $('graph-help').textContent=mode==='raw'||mode==='centered'?'拖动点改变数值 · 拖动空白平移 · 滚轮缩放':'拖动待测点 · 拖动空白平移 · 滚轮缩放';
    const patientIDs=points.filter(p=>p.sourceRow).map(p=>p.id),unique=new Set(patientIDs).size;
    $('graph-message').textContent=`${points.length} 条参照记录${patientIDs.length===points.length?` · ${unique} 位受试者`:''}${unique<patientIDs.length?' · 含双眼':''}`;
    updateQueryUI();
    if(fit||!view)fitView();else drawGraph();
    if(!$('calculation-panel').hidden)renderCalculation();
  }
  function updateQueryUI(){
    $('query-x').value=query.x;$('query-y').value=query.y;
    const extra=$('query-preset').querySelector('[value="source"]');if(extra)extra.remove();
    if(query.sourceRow&&![13,16].includes(query.sourceRow)){const option=document.createElement('option');option.value='source';option.textContent=`原表 ${query.id} · ${query.side==='right'?'右眼':'左眼'}`;$('query-preset').appendChild(option);queryPreset='source';}
    $('query-preset').value=queryPreset;
    const d=stats.distance(query);
    $('distance-stats').innerHTML=`<div class="distance-row"><div><div class="distance-name">欧氏距离 / μm</div><div class="distance-value">${f4(d.euclidean)}</div></div><div><div class="distance-name">马氏距离 D</div><div class="distance-value">${f4(d.md)}</div></div></div>${stats.positive?'':'<p class="warning-value">S 不可逆，普通马氏距离在此不可计算。</p>'}`;
    $('query-provenance').textContent=query.sourceRow?`${query.id} · ${query.side==='right'?'右眼':'左眼'} · 原表第 ${query.sourceRow} 行`:'自定义演示点，非论文原始观测';
  }
  function customQuery(x,y){query={id:'自定义点',label:'待测点',side:null,sourceRow:null,x,y};queryPreset='custom';}

  function coord(p,s=stats,m=mode){const d=[p.x-s.mean[0],p.y-s.mean[1]];if(m==='raw')return[p.x,p.y];if(m==='centered')return d;const z=s.project(d);return m==='principal'?z:[z[0]/s.sd[0],z[1]/s.sd[1]];}
  function uncoord(v,s=stats,m=mode){if(m==='raw')return{x:v[0],y:v[1]};if(m==='centered')return{x:v[0]+s.mean[0],y:v[1]+s.mean[1]};const z=m==='white'?[v[0]*s.sd[0],v[1]*s.sd[1]]:v;return{x:s.mean[0]+s.q1[0]*z[0]+s.q2[0]*z[1],y:s.mean[1]+s.q1[1]*z[0]+s.q2[1]*z[1]};}
  function dimensions(){return{w:graph.clientWidth,h:graph.clientHeight};}
  function fitView(){
    const{w,h}=dimensions();if(w<5||h<5)return;
    const ps=points.map(p=>coord(p));if(layers.query)ps.push(coord(query));
    const center=mode==='raw'?stats.mean:[0,0];ps.push(center);
    if(layers.ellipse&&stats.positive){let rx,ry;if(mode==='raw'||mode==='centered'){rx=2*Math.sqrt(stats.a);ry=2*Math.sqrt(stats.c);}else if(mode==='principal'){rx=2*stats.sd[0];ry=2*stats.sd[1];}else{rx=2;ry=2;}ps.push([center[0]-rx,center[1]-ry],[center[0]+rx,center[1]+ry]);}
    const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);let loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
    const rangeX=Math.max(hiX-loX,mode==='white'?2:10),rangeY=Math.max(hiY-loY,mode==='white'?2:10);
    view={x:(loX+hiX)/2,y:(loY+hiY)/2,scale:Math.min(Math.max(100,w-125)/(rangeX*1.25),Math.max(130,h-160)/(rangeY*1.25))};
    lastSize=`${w}:${h}`;drawGraph();
  }
  function screen(v){const{w,h}=dimensions();return[w/2+(v[0]-view.x)*view.scale,(h-32)/2-(v[1]-view.y)*view.scale];}
  function world(px,py){const{w,h}=dimensions();return[(px-w/2)/view.scale+view.x,((h-32)/2-py)/view.scale+view.y];}
  function niceStep(aim){const exp=10**Math.floor(Math.log10(aim));for(const m of[1,2,5,10])if(m*exp>=aim)return m*exp;return exp*10;}
  function tick(v,step){const p=step<1?Math.min(5,Math.ceil(-Math.log10(step))):0;return Math.abs(v)<step*.001?'0':v.toFixed(p);}
  function drawGraph(){
    if(!view)return;const{w,h}=dimensions();if(w<5||h<5)return;
    const lo=world(0,h),hi=world(w,0),step=niceStep(76/view.scale),minor=step/5;
    const axis=screen([0,0]),labelY=Math.max(83,Math.min(h-57,axis[1]+16)),labelX=Math.max(12,Math.min(w-50,axis[0]+8));
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${{raw:'原始',centered:'中心化',principal:'主轴',white:'白化'}[mode]}坐标散点图，${points.length}个参照点；当前待测点马氏距离 ${f4(stats.distance(query).md)}"><title>可拖动的 OCT 统计画布</title><defs><clipPath id="plot-clip"><rect width="${w}" height="${h-34}"/></clipPath></defs><g clip-path="url(#plot-clip)">`;
    function gridLines(spacing,stroke,width){let out='',count=0;for(let x=Math.ceil(lo[0]/spacing)*spacing;x<=hi[0]&&count++<400;x+=spacing){const p=screen([x,0]);out+=`<line x1="${p[0]}" y1="0" x2="${p[0]}" y2="${h-34}" stroke="${stroke}" stroke-width="${width}"/>`;}count=0;for(let y=Math.ceil(lo[1]/spacing)*spacing;y<=hi[1]&&count++<400;y+=spacing){const p=screen([0,y]);out+=`<line x1="0" y1="${p[1]}" x2="${w}" y2="${p[1]}" stroke="${stroke}" stroke-width="${width}"/>`;}return out;}
    svg+=gridLines(minor,'#f3f5f7',.7)+gridLines(step,'#e5ebef',1);
    if(axis[0]>=0&&axis[0]<=w)svg+=`<line x1="${axis[0]}" y1="0" x2="${axis[0]}" y2="${h-34}" stroke="#a9b8c2" stroke-width="1.3"/>`;
    if(axis[1]>=0&&axis[1]<=h)svg+=`<line x1="0" y1="${axis[1]}" x2="${w}" y2="${axis[1]}" stroke="#a9b8c2" stroke-width="1.3"/>`;
    for(let x=Math.ceil(lo[0]/step)*step;x<=hi[0];x+=step){const p=screen([x,0]);svg+=`<text x="${p[0]+5}" y="${labelY}" fill="#8d9da8" font-size="11" pointer-events="none">${tick(x,step)}</text>`;}
    for(let y=Math.ceil(lo[1]/step)*step;y<=hi[1];y+=step){const p=screen([0,y]);if(p[1]<70||p[1]>h-47)continue;svg+=`<text x="${labelX}" y="${p[1]-5}" fill="#8d9da8" font-size="11" pointer-events="none">${tick(y,step)}</text>`;}
    const meanCoord=mode==='raw'?stats.mean:[0,0],mc=screen(meanCoord);
    if(layers.ellipse&&stats.positive){for(const radius of[1,2]){let path='';for(let i=0;i<=120;i++){const t=i/120*Math.PI*2;let p;if(mode==='raw'||mode==='centered'){const z1=radius*stats.sd[0]*Math.cos(t),z2=radius*stats.sd[1]*Math.sin(t);p=[meanCoord[0]+stats.q1[0]*z1+stats.q2[0]*z2,meanCoord[1]+stats.q1[1]*z1+stats.q2[1]*z2];}else if(mode==='principal')p=[radius*stats.sd[0]*Math.cos(t),radius*stats.sd[1]*Math.sin(t)];else p=[radius*Math.cos(t),radius*Math.sin(t)];const xy=screen(p);path+=`${i?'L':'M'}${xy[0].toFixed(2)},${xy[1].toFixed(2)} `;}svg+=`<path d="${path}Z" fill="${radius===1?'#368c7410':'none'}" stroke="#84a99b" stroke-width="1.3" stroke-dasharray="${radius===1?'0':'6 5'}" pointer-events="none"/>`;}}
    if(layers.axes){[stats.q1,stats.q2].forEach((q,k)=>{const color=k===0?'#4f92a9':'#a38bb6';let direction;if(mode==='raw'||mode==='centered')direction=q;else direction=k===0?[1,0]:[0,1];const reach=(mode==='white'?2.2:Math.max(stats.sd[k]*2,5));const start=screen([meanCoord[0]-direction[0]*reach,meanCoord[1]-direction[1]*reach]),end=screen([meanCoord[0]+direction[0]*reach,meanCoord[1]+direction[1]*reach]);svg+=`<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" stroke="${color}" stroke-width="1.4" opacity=".8"/><text x="${Math.max(12,Math.min(w-35,end[0]+7))}" y="${Math.max(83,Math.min(h-55,end[1]-7))}" fill="${color}" font-size="12" pointer-events="none">q${k+1}</text>`;});}
    if(layers.mean)svg+=`<path d="M${mc[0]},${mc[1]-5}L${mc[0]+5},${mc[1]}L${mc[0]},${mc[1]+5}L${mc[0]-5},${mc[1]}Z" fill="#4778b1"/><text x="${mc[0]+9}" y="${mc[1]+16}" font-size="11" fill="#6486a8" pointer-events="none">均值</text>`;
    points.forEach((p,i)=>{const xy=screen(coord(p)),editable=mode==='raw'||mode==='centered';svg+=`<g><circle cx="${xy[0]}" cy="${xy[1]}" r="14" fill="transparent" data-point="${i}" class="${editable?'draggable':''}"/><circle cx="${xy[0]}" cy="${xy[1]}" r="5.5" fill="#22846e" stroke="#fff" stroke-width="1.5" data-point="${i}" class="${editable?'draggable':''}"><title>${esc(p.label)}：X=${f2(p.x)}，Y=${f2(p.y)}${p.sourceRow?'；原表第'+p.sourceRow+'行':''}</title></circle><text x="${xy[0]+10}" y="${xy[1]-10}" font-size="11" fill="#548271" pointer-events="none">${esc(p.label)}</text></g>`;});
    if(layers.query){const xy=screen(coord(query)),d=stats.distance(query);svg+=`<line x1="${mc[0]}" y1="${mc[1]}" x2="${xy[0]}" y2="${xy[1]}" stroke="#dc7d3c" stroke-width="1.6" opacity=".65" pointer-events="none"/><circle cx="${xy[0]}" cy="${xy[1]}" r="16" fill="transparent" data-query="true" class="draggable"/><circle cx="${xy[0]}" cy="${xy[1]}" r="7" fill="#dc7d3c" stroke="#fff" stroke-width="2" data-query="true" class="draggable"><title>${esc(query.label)}：X=${f2(query.x)}，Y=${f2(query.y)}；马氏距离=${f4(d.md)}</title></circle><text x="${xy[0]+13}" y="${xy[1]-12}" font-size="12" fill="#b56b38" pointer-events="none">${esc(query.sourceRow?query.label:'待测点')} · D=${f4(d.md)}</text>`;}
    const xlabel={raw:'X · 全局 RNFL（μm）',centered:'X − X̄（μm）',principal:'z₁（μm）',white:'w₁'}[mode],ylabel={raw:'Y · PMB RNFL（μm）',centered:'Y − Ȳ（μm）',principal:'z₂（μm）',white:'w₂'}[mode];
    svg+=`</g><text x="${w-18}" y="${h-51}" text-anchor="end" font-size="11" fill="#879ca8" pointer-events="none">${xlabel}</text><text x="18" y="81" font-size="11" fill="#879ca8" pointer-events="none">${ylabel}</text></svg>`;
    graph.innerHTML=svg;
  }
  function zoom(factor,px,py){if(!view)return;const{w,h}=dimensions();px=px??w/2;py=py??(h-32)/2;const before=world(px,py);view.scale=Math.max(.1,Math.min(2000,view.scale*factor));const after=world(px,py);view.x+=before[0]-after[0];view.y+=before[1]-after[1];drawGraph();}

  graph.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const target=e.target.closest('[data-point],[data-query]'),rect=graph.getBoundingClientRect(),px=e.clientX-rect.left,py=e.clientY-rect.top;
    if(target?.dataset.point!==undefined&&mode!=='raw'&&mode!=='centered'){notify('样本点请在原始或中心化坐标中拖动；这里可以拖动待测点。');return;}
    drag={type:target?(target.dataset.query?'query':'point'):'pan',index:target?.dataset.point!==undefined?Number(target.dataset.point):null,startX:px,startY:py,initialView:{...view},s:stats,m:mode};
    graph.setPointerCapture(e.pointerId);graph.classList.add('dragging');e.preventDefault();
  });
  graph.addEventListener('pointermove',e=>{
    if(!drag)return;const r=graph.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    if(drag.type==='pan'){view.x=drag.initialView.x-(px-drag.startX)/view.scale;view.y=drag.initialView.y+(py-drag.startY)/view.scale;drawGraph();return;}
    const p=uncoord(world(px,py),drag.s,drag.m),x=Math.round(p.x*10)/10,y=Math.round(p.y*10)/10;
    if(drag.type==='query'){customQuery(x,y);updateQueryUI();drawGraph();if(!$('calculation-panel').hidden)renderCalculation();}
    else{points[drag.index].x=x;points[drag.index].y=y;updateStats({rebuild:true});}
  });
  function stopDrag(){drag=null;graph.classList.remove('dragging');}
  graph.addEventListener('pointerup',stopDrag);graph.addEventListener('pointercancel',stopDrag);
  graph.addEventListener('wheel',e=>{e.preventDefault();const r=graph.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('zoom-in').addEventListener('click',()=>zoom(1.3));$('zoom-out').addEventListener('click',()=>zoom(1/1.3));$('fit-view').addEventListener('click',fitView);
  $('coordinate-mode').addEventListener('change',e=>{mode=e.target.value;view=null;updateStats({fit:true});});
  $('toggle-panel').addEventListener('click',()=>{document.body.classList.toggle('panel-collapsed');$('toggle-panel').textContent=document.body.classList.contains('panel-collapsed')?'展开数据面板':'收起面板';fitView();});
  for(const key of Object.keys(layers))$('layer-'+key).addEventListener('change',e=>{layers[key]=e.target.checked;drawGraph();});
  $('editable-data').addEventListener('input',e=>{if(!e.target.matches('input[data-axis]'))return;const el=e.target,i=Number(el.dataset.index),axis=el.dataset.axis,v=el.valueAsNumber;el.classList.toggle('invalid',!Number.isFinite(v));if(!Number.isFinite(v))return;points[i][axis]=v;el.classList.toggle('edited',v!==points[i]['original'+axis.toUpperCase()]);updateStats();});
  $('editable-data').addEventListener('change',e=>{if(e.target.matches('input.invalid')){notify('请填入有限数值，空白不作为 0 参与运算。');}});
  $('editable-data').addEventListener('click',e=>{const el=e.target.closest('[data-remove]');if(!el||points.length<=2)return;points.splice(Number(el.dataset.remove),1);updateStats({rebuild:true});});
  $('add-point').addEventListener('click',()=>{newCount++;points.push({key:`custom-${newCount}`,id:`教学新增-${newCount}`,label:`演示 ${newCount}`,x:Math.round((stats.mean[0]+8)*10)/10,y:Math.round((stats.mean[1]-5)*10)/10,originalX:null,originalY:null,sourceRow:null,side:null});updateStats({rebuild:true,fit:true});notify('已添加教学演示观测，可直接编辑数值。');});
  $('reset').addEventListener('click',()=>{points=initialRows.map(r=>fromSource(lookup(r)));query=fromSource(lookup(13));queryPreset='6';$('query-x').classList.remove('invalid');$('query-y').classList.remove('invalid');updateStats({rebuild:true,fit:true});notify('已恢复 5 条原始参照记录与 Patient-6 待测点。');});
  $('query-preset').addEventListener('change',e=>{queryPreset=e.target.value;if(queryPreset==='custom')customQuery(query.x,query.y);else if(queryPreset!=='source')query=fromSource(lookup(initialQueryRows[queryPreset]));$('query-x').classList.remove('invalid');$('query-y').classList.remove('invalid');updateQueryUI();drawGraph();if(!$('calculation-panel').hidden)renderCalculation();});
  ['x','y'].forEach(axis=>$('query-'+axis).addEventListener('input',e=>{const value=e.target.valueAsNumber;e.target.classList.toggle('invalid',!Number.isFinite(value));if(!Number.isFinite(value))return;customQuery(axis==='x'?value:query.x,axis==='y'?value:query.y);$('query-preset').value='custom';const d=stats.distance(query);$('distance-stats').innerHTML=`<div class="distance-row"><div><div class="distance-name">欧氏距离 / μm</div><div class="distance-value">${f4(d.euclidean)}</div></div><div><div class="distance-name">马氏距离 D</div><div class="distance-value">${f4(d.md)}</div></div></div>${stats.positive?'':'<p class="warning-value">S 不可逆，普通马氏距离在此不可计算。</p>'}`;$('query-provenance').textContent='自定义演示点，非论文原始观测';drawGraph();if(!$('calculation-panel').hidden)renderCalculation();}));

  function exportCSV(){const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const rows=[['Record','Eye','X_um','Y_um','Original_source_row','Edited_or_simulated'],...points.map(p=>[p.id,p.side,p.x,p.y,p.sourceRow,p.x!==p.originalX||p.y!==p.originalY?'yes':'no'])];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='OCT-teaching-current-data.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export-data').addEventListener('click',exportCSV);

  function showMetadata(){renderMetadata();$('metadata-dialog').showModal();}
  $('metadata-open').addEventListener('click',showMetadata);
  function renderMetadata(){
    const all=$('metadata-scope').value==='all',full=$('metadata-columns').value==='all';
    const records=all?SOURCE.rows:SOURCE.rows.filter(r=>[...initialRows,13,16].includes(r.row));
    const indices=full?SOURCE.headers.map((_,i)=>i):[0,1,2,3,4,5,6,7,8,9,10,11];
    const aliases={0:'匿名编号',1:'眼别',2:'性别',3:'年龄 / 岁',4:'病程 / 月',5:'视力',6:'MS 类型',7:'EDSS',8:'既往 ON',9:'VEP',10:'全局 RNFL / μm',11:'PMB / μm'};
    $('metadata-table').innerHTML=`<table class="metadata-table"><thead><tr>${['原表行号',...indices.map(i=>esc(full?SOURCE.headers[i]:aliases[i])),'操作'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${records.map(r=>{const v=r.values,valid=Number.isFinite(v[10])&&Number.isFinite(v[11]);return row([r.row,...indices.map(i=>esc(v[i])),`<button data-source-query="${r.row}" ${valid?'':'disabled'}>作为待测点</button><button data-source-add="${r.row}" ${valid?'':'disabled'}>加入参照</button>`]);}).join('')}</tbody></table>`;
  }
  $('metadata-scope').addEventListener('change',renderMetadata);$('metadata-columns').addEventListener('change',renderMetadata);
  $('metadata-table').addEventListener('click',e=>{const queryButton=e.target.closest('[data-source-query]'),addButton=e.target.closest('[data-source-add]');if(queryButton){query=fromSource(lookup(Number(queryButton.dataset.sourceQuery)));queryPreset=query.sourceRow===13?'6':query.sourceRow===16?'8':'custom';updateQueryUI();drawGraph();if(!$('calculation-panel').hidden)renderCalculation();$('metadata-dialog').close();notify(`已选 ${query.id} ${query.side==='right'?'右眼':'左眼'} 为待测点。`);}if(addButton){const p=fromSource(lookup(Number(addButton.dataset.sourceAdd)));if(points.some(d=>d.key===p.key)){notify('这条原始记录已经在当前参照样本中。');return;}points.push(p);updateStats({rebuild:true,fit:true});notify(`已加入 ${p.label}。同一受试者双眼用于推断时需处理相关性。`);}});
  $('help-open').addEventListener('click',()=>$('help-dialog').showModal());$('sources-link').addEventListener('click',e=>{e.preventDefault();$('help-dialog').showModal();});
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notify('当前环境未允许全屏。可以收起左侧面板放大画布。');}});
  document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'退出全屏':'全屏';fitView();});

  function openCalculation(type){selectedCalc=type;$('calculation-panel').hidden=false;renderCalculation();}
  $('calculation-close').addEventListener('click',()=>$('calculation-panel').hidden=true);
  document.querySelector('.expression-panel').addEventListener('click',e=>{const btn=e.target.closest('[data-calc]');if(btn){e.preventDefault();e.stopPropagation();openCalculation(btn.dataset.calc);}});
  $('calculation-tabs').addEventListener('click',e=>{const btn=e.target.closest('[data-calc]');if(btn){selectedCalc=btn.dataset.calc;renderCalculation();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('calculation-panel').hidden=true;});
  function renderCalculation(){
    $('calculation-title').textContent=calcNames[selectedCalc];
    $('calculation-tabs').innerHTML=Object.entries(calcNames).map(([key,label])=>`<button data-calc="${key}" class="${key===selectedCalc?'active':''}">${label}</button>`).join('');
    const s=stats,dx=s.centered.map(d=>d[0]),dy=s.centered.map(d=>d[1]),labels=points.map(p=>esc(p.label));let html='';
    if(selectedCalc==='mean'){
      html=`<h3>1. 两列分别求和、除以样本数</h3>${eq(`X̄ = (${signed(points.map(p=>p.x))}) / ${s.n}<br>= ${f2(sum(points.map(p=>p.x)))} / ${s.n} = <strong>${f6(s.mean[0])}</strong><br>Ȳ = (${signed(points.map(p=>p.y))}) / ${s.n}<br>= ${f2(sum(points.map(p=>p.y)))} / ${s.n} = <strong>${f6(s.mean[1])}</strong>`)}<h3>2. 每条记录减去对应均值</h3>${table(['观测','X','Y','dₓ = X − X̄','dᵧ = Y − Ȳ'],points.map((p,i)=>[labels[i],f2(p.x),f2(p.y),f4(dx[i]),f4(dy[i])]),['离差和','','',f4(sum(dx)),f4(sum(dy))])}${eq(`第一条：${f2(points[0].x)} − ${f2(s.mean[0])} = ${f4(dx[0])}<br>${f2(points[0].y)} − ${f2(s.mean[1])} = ${f4(dy[0])}`)}<div class="calc-matrix-line">均值向量 p̄ = ${matrix(s.mean.map(v=>[f4(v)]))}</div>${note('中心化后的两列均值都为 0；它改变中心位置，保留样本之间的差。')}`;
    }else if(selectedCalc==='variance'){
      html=`<h3>1. 对每一个离差平方</h3>${table(['观测','dₓ','dₓ²','dᵧ','dᵧ²'],points.map((p,i)=>[labels[i],f4(dx[i]),f4(dx[i]**2),f4(dy[i]),f4(dy[i]**2)]),['合计',f4(sum(dx)),f4(s.scatter[0]),f4(sum(dy)),f4(s.scatter[2])])}<h3>2. 离差平方和除以 n − 1</h3>${eq(`n = ${s.n}，分母 n − 1 = ${s.df}<br>s²ₓ = (${signed(dx.map(v=>v*v))}) / ${s.df}<br>= ${f6(s.scatter[0])} / ${s.df} = <strong>${f6(s.a)} μm²</strong><br>s²ᵧ = (${signed(dy.map(v=>v*v))}) / ${s.df}<br>= ${f6(s.scatter[2])} / ${s.df} = <strong>${f6(s.c)} μm²</strong>`)}<h3>3. 开平方得到标准差</h3>${eq(`sₓ = √${f6(s.a)} = <strong>${f6(Math.sqrt(s.a))} μm</strong><br>sᵧ = √${f6(s.c)} = <strong>${f6(Math.sqrt(s.c))} μm</strong>`)}${note('本画布统一使用样本方差和样本协方差，分母始终是 n − 1。')}`;
    }else if(selectedCalc==='covariance'){
      const products=dx.map((v,i)=>v*dy[i]);
      html=`<h3>1. 同一条观测的两列离差相乘</h3>${table(['观测','dₓ','dᵧ','dₓdᵧ'],points.map((p,i)=>[labels[i],f4(dx[i]),f4(dy[i]),f4(products[i])]),['合计',f4(sum(dx)),f4(sum(dy)),f4(s.scatter[1])])}${eq(`Cov(X,Y) = (${signed(products)}) / ${s.df}<br>= ${f6(s.scatter[1])} / ${s.df} = <strong>${f6(s.b)} μm²</strong>`)}<h3>2. 对角线为方差，非对角线为协方差</h3><div class="calc-matrix-line">S = ${matrix(s.S.map(r=>r.map(f4)))}</div><h3>3. 同样的计算写成矩阵乘法</h3><div class="calc-matrix-line">中心化矩阵 C = ${matrix(s.centered.map(r=>r.map(f2)))}</div><div class="calc-matrix-line">CᵀC = ${matrix([[f4(s.scatter[0]),f4(s.scatter[1])],[f4(s.scatter[1]),f4(s.scatter[2])]])}</div>${eq(`S = CᵀC / ${s.df}`)}<h3>4. 换成无量纲相关系数</h3>${eq(`r = Cov(X,Y) / (sₓsᵧ)<br>= ${f6(s.b)} / (${f6(Math.sqrt(s.a))} × ${f6(Math.sqrt(s.c))})<br>= <strong>${f6(s.correlation)}</strong>`)}${note('正协方差表示同向变化的样本贡献占优。PMB 与全局 RNFL 有整体与局部的联系；不把这种相关直接解释成因果。')}`;
    }else if(selectedCalc==='eigen'){
      const gap=Math.hypot(s.a-s.c,2*s.b),r1=Math.abs(s.b)>1e-10?(s.eigen[0]-s.a)/s.b:null,r2=Math.abs(s.b)>1e-10?(s.eigen[1]-s.a)/s.b:null;
      html=`<h3>1. 解特征方程 det(S − λI) = 0</h3><div class="calc-matrix-line">${matrix([[f4(s.a)+' − λ',f4(s.b)],[f4(s.b),f4(s.c)+' − λ']])}的行列式为 0</div>${eq(`(${f4(s.a)} − λ)(${f4(s.c)} − λ) − (${f4(s.b)})² = 0<br>λ² − ${f6(s.trace)} λ + ${f6(s.det)} = 0<br>λ = [${f6(s.trace)} ± √(${f6(s.trace)}² − 4 × ${f6(s.det)})] / 2<br>= (${f6(s.trace)} ± ${f6(gap)}) / 2<br><strong>λ₁ = ${f6(s.eigen[0])}；λ₂ = ${f6(s.eigen[1])}</strong>`)}<h3>2. 解 (S − λI)q = 0，并令向量长度为 1</h3>${r1===null?note('协方差接近 0，本例可直接沿原坐标方向选择单位特征向量。'):eq(`对 λ₁：(${f6(s.a-s.eigen[0])})u + (${f6(s.b)})v = 0<br>v/u = (λ₁ − ${f4(s.a)}) / (${f4(s.b)}) = ${f6(r1)}<br>(1, ${f6(r1)}) 的长度为 ${f6(Math.hypot(1,r1))}<br>对 λ₂：v/u = ${f6(r2)}；(1, ${f6(r2)}) 的长度为 ${f6(Math.hypot(1,r2))}`)}<div class="calc-matrix-line">q₁ = ${matrix(s.q1.map(v=>[f6(v)]))}q₂ = ${matrix(s.q2.map(v=>[f6(v)]))}</div>${eq(`q₁ᵀq₂ = ${f6(s.q1[0]*s.q2[0]+s.q1[1]*s.q2[1])}<br>q₁ᵀq₁ = ${f6(s.q1[0]**2+s.q1[1]**2)}；q₂ᵀq₂ = ${f6(s.q2[0]**2+s.q2[1]**2)}`)}<h3>3. 组成 S = QΛQᵀ</h3><div class="calc-matrix-line">Q = ${matrix([[f6(s.q1[0]),f6(s.q2[0])],[f6(s.q1[1]),f6(s.q2[1])]])}</div><div class="calc-matrix-line">Λ = ${matrix([[f6(s.eigen[0]),'0'],['0',f6(s.eigen[1])]])}</div><div class="calc-matrix-line">λ₁q₁q₁ᵀ = ${matrix([[s.eigen[0]*s.q1[0]**2,s.eigen[0]*s.q1[0]*s.q1[1]],[s.eigen[0]*s.q1[0]*s.q1[1],s.eigen[0]*s.q1[1]**2]].map(r=>r.map(f4)))}</div><div class="calc-matrix-line">λ₂q₂q₂ᵀ = ${matrix([[s.eigen[1]*s.q2[0]**2,s.eigen[1]*s.q2[0]*s.q2[1]],[s.eigen[1]*s.q2[0]*s.q2[1],s.eigen[1]*s.q2[1]**2]].map(r=>r.map(f4)))}</div><div class="calc-matrix-line">两项相加 = S = ${matrix(s.S.map(r=>r.map(f4)))}</div>${eq(`第一主轴方差占比 = ${f6(s.eigen[0])} / ${f6(s.trace)} = ${s.trace>0?fmt(s.eigen[0]/s.trace*100,4)+'%':'—'}<br>主轴标准差：√λ₁ = ${f6(s.sd[0])}；√λ₂ = ${f6(s.sd[1])}`)}${note('特征向量的正负号可以整体翻转，主轴和距离不变。重特征值时，主轴方向可不唯一。')}`;
    }else if(selectedCalc==='projection'){
      const z=s.scores,w=s.white;
      html=`<h3>1. 中心化后投影到两条单位主轴</h3>${eq(`z₁ = (${f6(s.q1[0])})dₓ + (${f6(s.q1[1])})dᵧ<br>z₂ = (${f6(s.q2[0])})dₓ + (${f6(s.q2[1])})dᵧ<br>第一条：z₁ = (${f6(s.q1[0])}) × (${f4(dx[0])}) + (${f6(s.q1[1])}) × (${f4(dy[0])}) = ${f6(z[0][0])}<br>z₂ = (${f6(s.q2[0])}) × (${f4(dx[0])}) + (${f6(s.q2[1])}) × (${f4(dy[0])}) = ${f6(z[0][1])}`)}${table(['观测','z₁','z₂','z₁²','z₂²','z₁z₂'],z.map((v,i)=>[labels[i],f4(v[0]),f4(v[1]),f4(v[0]**2),f4(v[1]**2),f4(v[0]*v[1])]),['合计',f4(sum(z.map(v=>v[0]))),f4(sum(z.map(v=>v[1]))),f4(sum(z.map(v=>v[0]**2))),f4(sum(z.map(v=>v[1]**2))),f4(sum(z.map(v=>v[0]*v[1])))])}${eq(`Var(z₁) = ${f6(sum(z.map(v=>v[0]**2)))} / ${s.df} = ${f6(s.eigen[0])}<br>Var(z₂) = ${f6(sum(z.map(v=>v[1]**2)))} / ${s.df} = ${f6(s.eigen[1])}<br>Cov(z₁,z₂) = ${f6(sum(z.map(v=>v[0]*v[1])))} / ${s.df} = 0`)}<h3>2. 各主轴除以其标准差</h3>${eq(`w₁ = z₁ / √λ₁ = z₁ / ${f6(s.sd[0])}<br>w₂ = z₂ / √λ₂ = z₂ / ${f6(s.sd[1])}`)}${w?table(['观测','w₁','w₂','w₁²','w₂²','w₁w₂'],w.map((v,i)=>[labels[i],f4(v[0]),f4(v[1]),f4(v[0]**2),f4(v[1]**2),f4(v[0]*v[1])]),['合计','0.0000','0.0000',f4(s.df),f4(s.df),'0.0000'])+eq(`白化后 Var(w₁) = ${s.df} / ${s.df} = 1<br>Var(w₂) = ${s.df} / ${s.df} = 1；Cov(w₁,w₂) = 0`):note('存在零或数值上接近零的特征值，不能在该方向除以标准差；本画布不把它悄悄替换成有限距离。')}${note('在该样本中不相关，不等于总体中统计独立。显示值四舍五入，内部计算使用完整精度。')}`;
    }else{
      const d=s.distance(query);
      html=`<h3>1. 选择待测点，固定当前参照统计量</h3>${eq(`p = (${f4(query.x)}, ${f4(query.y)})<br>参照均值 p̄ = (${f4(s.mean[0])}, ${f4(s.mean[1])})<br>δ = p − p̄ = (${f4(d.delta[0])}, ${f4(d.delta[1])})<br>欧氏距离 = √[(${f4(d.delta[0])})² + (${f4(d.delta[1])})²] = ${f6(d.euclidean)} μm`)}<h3>2. 计算逆协方差矩阵</h3>${eq(`det(S) = ${f6(s.a)} × ${f6(s.c)} − (${f6(s.b)})²<br>= <strong>${f6(s.det)}</strong>`)}${s.positive?`<div class="calc-matrix-line">S⁻¹ = 1 / ${f6(s.det)} × ${matrix([[f4(s.c),f4(-s.b)],[f4(-s.b),f4(s.a)]])}</div><div class="calc-matrix-line">= ${matrix(s.inv.map(r=>r.map(f6)))}</div><h3>3. 直接相乘 D² = δᵀS⁻¹δ</h3>${eq(`(S⁻¹δ)₁ = (${f6(s.inv[0][0])}) × (${f4(d.delta[0])}) + (${f6(s.inv[0][1])}) × (${f4(d.delta[1])}) = ${f6(d.v[0])}<br>(S⁻¹δ)₂ = (${f6(s.inv[1][0])}) × (${f4(d.delta[0])}) + (${f6(s.inv[1][1])}) × (${f4(d.delta[1])}) = ${f6(d.v[1])}<br>D² = (${f4(d.delta[0])}) × (${f6(d.v[0])}) + (${f4(d.delta[1])}) × (${f6(d.v[1])})<br>= <strong>${f6(d.d2)}</strong><br>D = √${f6(d.d2)} = <strong>${f6(d.md)}</strong>`)}<h3>4. 用主轴与白化坐标复算</h3>${eq(`z₁ = (${f6(s.q1[0])}) × (${f4(d.delta[0])}) + (${f6(s.q1[1])}) × (${f4(d.delta[1])}) = ${f6(d.z[0])}<br>z₂ = (${f6(s.q2[0])}) × (${f4(d.delta[0])}) + (${f6(s.q2[1])}) × (${f4(d.delta[1])}) = ${f6(d.z[1])}<br>w₁ = ${f6(d.z[0])} / ${f6(s.sd[0])} = ${f6(d.w[0])}<br>w₂ = ${f6(d.z[1])} / ${f6(s.sd[1])} = ${f6(d.w[1])}<br>D² = z₁² / λ₁ + z₂² / λ₂<br>= ${f6(d.z[0]**2)} / ${f6(s.eigen[0])} + ${f6(d.z[1]**2)} / ${f6(s.eigen[1])}<br>= ${f6(d.w[0]**2)} + ${f6(d.w[1]**2)} = <strong>${f6(d.d2)}</strong><br>D = √(w₁² + w₂²) = <strong>${f6(d.md)}</strong>`)}${note('这就是白化空间中到原点的欧氏距离。等价地 S⁻¹ = Q diag(1/λ₁, 1/λ₂) Qᵀ，沿小方差方向的偏离权重更大。')}`:note('该协方差矩阵在数值上不可逆。当前不能使用普通逆矩阵计算马氏距离；请调整参照观测，使两维不完全共线。')}${note('马氏距离无量纲。它依赖当前参照样本，不直接等于异常概率、诊断或严重程度；椭圆 D = 1、2 没有自动的置信水平含义。')}`;
    }
    $('calculation-content').innerHTML=html;
  }

  let resizeTimer;const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const{w,h}=dimensions();if(lastSize!==`${w}:${h}`)fitView();},70);};
  window.addEventListener('resize',onResize);new ResizeObserver(onResize).observe(graph);
  window.OCT_LAB={get points(){return points.map(p=>({...p}));},get stats(){return stats;},get query(){return{...query};},get mode(){return mode;}};
  updateStats({rebuild:true,fit:true});
})();
