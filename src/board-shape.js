const vertex=(x,y)=>`${x},${y}`;
/** Trace exposed cell edges, including interior holes. Clockwise outer loops,
 * counterclockwise holes; diagonal contact never joins two separate regions. */
export function boardContours(mask){
  const edges=[],out=new Map(),rows=mask.length,cols=mask[0].length;
  const active=(r,c)=>!!mask[r]?.[c];
  function add(x,y,xx,yy,d){const e={a:[x,y],b:[xx,yy],d,used:false};edges.push(e);const k=vertex(x,y);if(!out.has(k))out.set(k,[]);out.get(k).push(e);}
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(active(r,c)){
    if(!active(r-1,c))add(c,r,c+1,r,0);
    if(!active(r,c+1))add(c+1,r,c+1,r+1,1);
    if(!active(r+1,c))add(c+1,r+1,c,r+1,2);
    if(!active(r,c-1))add(c,r+1,c,r,3);
  }
  const loops=[];
  for(const first of edges){
    if(first.used)continue;const points=[];let e=first;
    while(e&&!e.used){
      e.used=true;points.push(e.a);
      const candidates=(out.get(vertex(...e.b))||[]).filter(q=>!q.used);
      const priority=[(e.d+1)%4,e.d,(e.d+3)%4,(e.d+2)%4];
      e=candidates.sort((a,b)=>priority.indexOf(a.d)-priority.indexOf(b.d))[0];
    }
    loops.push(points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);}));
  }
  return loops;
}
export function boardPath(mask,step,offset=0,radius=7){
  const n=v=>Math.round(v*100)/100;
  return boardContours(mask).map(loop=>{
    const pts=loop.map(([x,y])=>[offset+x*step,offset+y*step]);
    const corners=pts.map((p,i)=>{
      const prev=pts[(i+pts.length-1)%pts.length],next=pts[(i+1)%pts.length];
      const before=Math.hypot(prev[0]-p[0],prev[1]-p[1]),after=Math.hypot(next[0]-p[0],next[1]-p[1]);
      const r=Math.min(radius,before/2,after/2);
      return {p,b:[p[0]+(prev[0]-p[0])/before*r,p[1]+(prev[1]-p[1])/before*r],a:[p[0]+(next[0]-p[0])/after*r,p[1]+(next[1]-p[1])/after*r]};
    });
    return corners.map(({p,b,a},i)=>`${i?'L':'M'}${b.map(n).join(' ')}Q${p.map(n).join(' ')} ${a.map(n).join(' ')}`).join('')+'Z';
  }).join('');
}
