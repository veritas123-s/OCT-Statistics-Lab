(()=>{
  'use strict';
  const $=id=>document.getElementById(id),M=MatrixMath;
  const f=x=>Number.isFinite(x)?(Math.abs(x)<.000005?0:x).toFixed(5):'—';
  const mat=(A,id='')=>`<span ${id?`id="${id}"`:''} class="matrix" style="--cols:2">${A.flat().map(x=>'<span>'+f(x)+'</span>').join('')}</span>`;
  const target=document.createElement('div');target.id='cov-products';
  document.querySelector('.mx-proof').prepend(target);
  target.innerHTML=`<div class="cov-header"><b>Manim · S′ = D R S Rᵀ Dᵀ</b><div><button id="cov-play">▶ 播放乘法</button><button id="cov-dismiss" hidden>矩阵一览</button></div></div>
    <div id="cov-live-chain" class="cov-chain"></div>
    <div id="cov-process" hidden aria-label="矩阵乘法动效"><div class="cov-step-head"><b id="cov-stage"></b><span id="cov-stage-count"></span></div>
      <div id="cov-operands"></div><div class="cov-progress"><i id="cov-progress"></i></div><div id="cov-scalar"></div></div>
    <details id="cov-dot-details"><summary>逐项乘法</summary><div id="cov-dot" class="cov-dot"></div></details>`;
  let player=null,frame=0;
  const flying=new Set();
  function clearFlying(){for(const animation of flying)animation.cancel();flying.clear();}
  function flyTerms(row,col){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    for(let k=0;k<2;k++)for(let side=0;side<2;side++){
      const source=$(side?'cov-right':'cov-left').children[side?k*2+col:row*2+k],from=source.getBoundingClientRect(),to=$('cov-term-'+k).getBoundingClientRect();
      if(from.left<0||from.right>innerWidth||to.left>innerWidth)continue;
      const ghost=document.createElement('span');ghost.className='cov-flying';ghost.textContent=source.textContent;
      Object.assign(ghost.style,{left:from.left+'px',top:from.top+'px',width:from.width+'px'});document.body.append(ghost);
      const dx=to.left+(side?to.width*.58:0)-from.left,dy=to.top-from.top;
      const animation=ghost.animate([{transform:'translate(0,0)',opacity:0},{offset:.12,transform:'translate(0,-5px)',opacity:1},{transform:`translate(${dx}px,${dy}px)`,opacity:0}],{duration:460,easing:'cubic-bezier(.2,.65,.3,1)'});
      flying.add(animation);const remove=()=>{flying.delete(animation);ghost.remove();};animation.onfinish=remove;animation.oncancel=remove;
    }
  }

  function render(){
    const s=OCT_LAB.stats,p=OCT_MATRIX.plan,A=M.mul(p.R,s.S),C=M.mul(A,M.transpose(p.R));
    $('cov-live-chain').innerHTML='<div><b>A = R S</b><div>'+mat(p.R)+' × '+mat(s.S)+' = '+mat(A)+'</div></div><div><b>Sᵣ = A Rᵀ</b><div>'+mat(A)+' × '+mat(M.transpose(p.R))+' = '+mat(C)+'</div></div><div><b>S′ = D Sᵣ Dᵀ</b><div>'+mat(p.D)+' × '+mat(C)+' × '+mat(M.transpose(p.D))+' = '+mat(p.covariance)+'</div></div>';
    $('cov-dot').innerHTML='A₁₁ = ('+f(p.R[0][0])+') × ('+f(s.S[0][0])+') + ('+f(p.R[0][1])+') × ('+f(s.S[1][0])+') = '+f(A[0][0])+'<br>Sᵣ₁₁ = ('+f(A[0][0])+') × ('+f(p.R[0][0])+') + ('+f(A[0][1])+') × ('+f(p.R[0][1])+') = '+f(C[0][0]);
    document.querySelectorAll('#mx-factors h3').forEach((h,i)=>h.textContent=['T','R','D','H'][i]);
    document.querySelector('.mx-top h2').textContent='矩阵';
  }

  function stages(){
    const s=OCT_LAB.stats,angle=-s.theta*180/Math.PI,center={center:1,angle:0,sx:1,sy:1};
    const aligned={...center,angle},white={...aligned,sx:1/s.sd[0],sy:1/s.sd[1]};
    const {R,D}=M.plan(s,white),A=M.mul(R,s.S),C=M.mul(A,M.transpose(R)),B=M.mul(D,C);
    const list=[
      {title:'中心化',pose:center,duration:650},
      {title:'① A = R S',left:R,right:s.S,name:'A',duration:2200},
      {title:'② Sᵣ = A Rᵀ',left:A,right:M.transpose(R),name:'Sᵣ',pose:aligned,duration:2200},
    ];
    if(s.positive)list.push(
      {title:'③ B = D Sᵣ',left:D,right:C,name:'B',duration:2200},
      {title:'④ S′ = B Dᵀ',left:B,right:M.transpose(D),name:'S′',pose:white,duration:2200}
    );
    return list;
  }

  function showStage(stage){
    $('cov-stage').textContent=stage.title;
    if(!stage.left){$('cov-operands').innerHTML='<div class="cov-centering">p′ = p − p̄</div>';$('cov-scalar').textContent='S′ = S';return;}
    stage.result=M.mul(stage.left,stage.right);
    $('cov-operands').innerHTML=`${mat(stage.left,'cov-left')}<span>×</span>${mat(stage.right,'cov-right')}<span>=</span>${mat(stage.result,'cov-result')}`;
    [...$('cov-result').children].forEach(e=>e.classList.add('cov-unresolved'));
    $('cov-scalar').innerHTML='<span id="cov-term-0"></span><span> + </span><span id="cov-term-1"></span><span> = </span><strong id="cov-sum"></strong>';
  }

  function paint(stage,t){
    $('cov-progress').style.width=(t*100)+'%';
    if(!stage.left)return;
    const progress=t*4,index=Math.min(3,Math.floor(progress)),part=t===1?1:progress-index,row=Math.floor(index/2),col=index%2;
    [...$('cov-left').children].forEach((e,i)=>e.classList.toggle('cov-row-on',Math.floor(i/2)===row));
    [...$('cov-right').children].forEach((e,i)=>e.classList.toggle('cov-col-on',i%2===col));
    [...$('cov-result').children].forEach((e,i)=>{e.classList.toggle('cov-cell-on',i===index);e.classList.toggle('cov-unresolved',!(i<index||i===index&&part>.78));});
    for(let k=0;k<2;k++){
      const term=$('cov-term-'+k);term.textContent='('+f(stage.left[row][k])+') × ('+f(stage.right[k][col])+')';
      term.classList.toggle('cov-term-on',part>k*.35);
    }
    $('cov-sum').textContent=stage.name+['₁₁','₁₂','₂₁','₂₂'][index]+' = '+f(stage.result[row][col]);
    $('cov-sum').classList.toggle('cov-term-on',part>.78);
    if(stage.cell!==index){stage.cell=index;flyTerms(row,col);}
  }

  function startStage(elapsed=0){
    const p=player,stage=p.stages[p.index];p.elapsed=elapsed;p.started=performance.now();
    showStage(stage);paint(stage,elapsed/stage.duration);
    $('cov-stage-count').textContent=p.index+' / '+(p.stages.length-1);
    if(stage.pose)OCT_MATRIX.animateTo(stage.pose,{duration:stage.duration-elapsed});
    frame=requestAnimationFrame(tick);
  }
  function tick(now){
    if(!player||player.paused)return;
    const stage=player.stages[player.index],elapsed=player.elapsed+now-player.started,t=Math.min(1,elapsed/stage.duration);
    paint(stage,t);
    if(t<1){frame=requestAnimationFrame(tick);return;}
    if(stage.pose)OCT_MATRIX.setState(stage.pose);
    if(player.index<player.stages.length-1){player.index++;startStage();}
    else{player.finished=true;OCT_MATRIX.stop();$('cov-play').textContent='↻ 重播乘法';$('cov-stage-count').textContent='完成';}
  }
  function stop({hide=false}={}){
    cancelAnimationFrame(frame);
    clearFlying();
    if(player&&!player.finished)OCT_MATRIX.stop();
    player=null;$('cov-play').textContent='▶ 播放乘法';
    if(hide){$('cov-process').hidden=true;$('cov-dismiss').hidden=true;target.classList.remove('cov-process-open');}
  }
  $('cov-play').onclick=()=>{
    if(player&&!player.finished){
      if(player.paused){player.paused=false;for(const a of flying)a.play();$('cov-play').textContent='Ⅱ 暂停';startStage(player.elapsed);}
      else{const stage=player.stages[player.index];player.elapsed=Math.min(stage.duration,player.elapsed+performance.now()-player.started);player.paused=true;cancelAnimationFrame(frame);for(const a of flying)a.pause();OCT_MATRIX.stop();$('cov-play').textContent='▶ 继续';}
      return;
    }
    stop();player={stages:stages(),index:0,elapsed:0,paused:false,finished:false};
    $('cov-process').hidden=false;$('cov-dismiss').hidden=false;target.classList.add('cov-process-open');$('cov-play').textContent='Ⅱ 暂停';startStage();
  };
  $('cov-dismiss').onclick=()=>stop({hide:true});
  document.addEventListener('input',e=>{if(e.target.id.startsWith('mx-')){const value=e.target.value;stop({hide:true});e.target.value=value;}},true);
  document.addEventListener('click',e=>{if(e.target.closest('[data-preset],#mx-undo,#mx-redo,#mx-exit'))stop({hide:true});},true);
  window.addEventListener('oct:datachange',()=>{stop({hide:true});render();});
  window.addEventListener('matrix:frame',render);
  document.addEventListener('click',e=>{if(e.target.closest('.matrix-workspace'))requestAnimationFrame(render);});
  render();
})();
