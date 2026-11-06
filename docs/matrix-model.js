(function(root){
  'use strict';
  const mul=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((v,a,k)=>v+a*B[k][j],0)));
  const transpose=A=>A[0].map((_,j)=>A.map(row=>row[j]));
  const apply=(A,v)=>A.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));
  function plan(stats,state){
    const t=state.center,rad=state.angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
    const R=[[c,-s],[s,c]],D=[[state.sx,0],[0,state.sy]],M=mul(D,R);
    const offset=apply(M,stats.mean).map(x=>-t*x);
    const H=[[...M[0],offset[0]],[...M[1],offset[1]],[0,0,1]];
    const invM=[[c/state.sx,s/state.sy],[-s/state.sx,c/state.sy]];
    const invOffset=apply(invM,offset).map(x=>-x);
    const inverse=[[...invM[0],invOffset[0]],[...invM[1],invOffset[1]],[0,0,1]];
    const covariance=mul(mul(M,stats.S),transpose(M));
    function stages(point){const raw=[point.x,point.y],centered=raw.map((v,i)=>v-t*stats.mean[i]),rotated=apply(R,centered),scaled=apply(D,rotated);return{raw,centered,rotated,scaled,recovered:apply(inverse,[...scaled,1]).slice(0,2)};}
    return{R,D,M,H,inverse,covariance,stages,map:p=>stages(p).scaled,
      T:[[1,0,-t*stats.mean[0]],[0,1,-t*stats.mean[1]],[0,0,1]],
      determinant:state.sx*state.sy};
  }
  const api={mul,transpose,apply,plan};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.MatrixMath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
