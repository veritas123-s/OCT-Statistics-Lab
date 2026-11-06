(function(root){
  'use strict';
  const sum=xs=>xs.reduce((s,x)=>s+x,0);
  function compute(points){
    const n=points.length;
    if(n<2)throw new Error('至少需要两条完整的二维观测。');
    if(points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('数据必须为有限数值。');
    const mean=[sum(points.map(p=>p.x))/n,sum(points.map(p=>p.y))/n];
    const centered=points.map(p=>[p.x-mean[0],p.y-mean[1]]),df=n-1;
    const scatter=[sum(centered.map(d=>d[0]**2)),sum(centered.map(d=>d[0]*d[1])),sum(centered.map(d=>d[1]**2))];
    const [a,b,c]=scatter.map(v=>v/df),trace=a+c,det=a*c-b*b;
    const gap=Math.hypot(a-c,2*b),eigen=[Math.max(0,(trace+gap)/2),Math.max(0,(trace-gap)/2)];
    const theta=.5*Math.atan2(2*b,a-c),q1=[Math.cos(theta),Math.sin(theta)],q2=[Math.sin(theta),-Math.cos(theta)];
    const sd=eigen.map(Math.sqrt),tol=Math.max(1,eigen[0])*1e-10,positive=eigen[1]>tol;
    const project=d=>[q1[0]*d[0]+q1[1]*d[1],q2[0]*d[0]+q2[1]*d[1]];
    const scores=centered.map(project),white=positive?scores.map(z=>[z[0]/sd[0],z[1]/sd[1]]):null;
    const inv=positive?[[c/det,-b/det],[-b/det,a/det]]:null;
    function distance(point){
      const delta=[point.x-mean[0],point.y-mean[1]],z=project(delta),euclidean=Math.hypot(...delta);
      if(!positive)return{delta,z,euclidean,md:null,d2:null,w:null,v:null};
      const w=[z[0]/sd[0],z[1]/sd[1]],v=[inv[0][0]*delta[0]+inv[0][1]*delta[1],inv[1][0]*delta[0]+inv[1][1]*delta[1]];
      return{delta,z,w,v,euclidean,d2:w[0]**2+w[1]**2,md:Math.hypot(...w)};
    }
    return{n,df,mean,centered,scatter,S:[[a,b],[b,c]],a,b,c,trace,det,eigen,q1,q2,sd,theta,positive,scores,white,inv,project,distance,
      correlation:a>0&&c>0?b/Math.sqrt(a*c):null};
  }
  const api={compute,sum};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OctStats=api;
})(typeof globalThis!=='undefined'?globalThis:this);
