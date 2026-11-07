// Monitoring Sales Bulanan, MITRA10 Percetakan Negara (10005). Membaca dan menulis tabel store_daily dan store_day_category di Supabase.
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STORE='10005';
const nf=new Intl.NumberFormat('id-ID');
const dec=(n,d)=>n.toFixed(d).replace('.',',');
const rp=n=>n>=1e9?'Rp '+dec(n/1e9,2)+' M':'Rp '+dec(n/1e6,1)+' jt';
const jt=n=>dec(n/1e6,1)+' jt';
const sum=a=>a.reduce((x,y)=>x+y,0);
const pad=n=>String(n).padStart(2,'0');
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fd=iso=>{const p=iso.split('-');return (+p[2])+' '+MON[+p[1]-1]};
const fdy=iso=>fd(iso)+' '+iso.slice(0,4);
const addDays=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const title=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());

let DATA={D:[],C:[],B:[]};
let LYD=new Map(), LYC=new Map(), PH=new Map(), BM=new Map();
let skipPartial=false;
let from='',to='';

const allDates=()=>DATA.D.map(x=>x.d).sort();
function presetRange(p){
  const ds=allDates(); if(!ds.length) return ['',''];
  const mn=ds[0], mx=ds[ds.length-1];
  if(p==='7') return [addDays(mx,-6)<mn?mn:addDays(mx,-6),mx];
  if(p==='month') return [mx.slice(0,7)+'-01'<mn?mn:mx.slice(0,7)+'-01',mx];
  return [mn,mx];
}
function setRange(a,b){from=a;to=b;$('from').value=a;$('to').value=b;render()}
function showMsg(text,kind){const m=$('msg');m.hidden=!text;m.className='msg '+kind;m.textContent=text}

/* ---------- Ikon, sparkline, ring ---------- */
const ICON={
  traffic:'<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17.5 14c2.2.3 3.5 2 3.5 4.5"/>',
  invoice:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  basket:'<path d="M3 9h18l-2 11H5z"/><path d="M8 9l3-5M16 9l-3-5"/>',
  sales:'<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>'
};
const ic=k=>`<span class="ic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg></span>`;
function spark(vals){
  if(vals.length<2) return '';
  const w=200,h=44,p=6,mn=Math.min(...vals),mx=Math.max(...vals),n=vals.length;
  const x=i=>p+i*(w-2*p)/(n-1), y=v=>h-p-((v-mn)/((mx-mn)||1))*(h-2*p);
  const pts=vals.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
  const lx=x(n-1),ly=y(vals[n-1]);
  return `<div class="sp"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${p},${h} ${pts} ${lx},${h}" fill="var(--spark)" opacity=".14"/><polyline points="${pts}" fill="none" stroke="var(--spark)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg><i class="dot" style="left:${(lx/w*100).toFixed(2)}%;top:${(ly/h*100).toFixed(2)}%"></i></div>`;
}
function ring(pct){
  const r=20,c=2*Math.PI*r,o=c*(1-Math.max(0,Math.min(pct,1)));
  return `<svg class="ring" viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--grid)" stroke-width="6"/><circle cx="26" cy="26" r="${r}" fill="none" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${o.toFixed(2)}" transform="rotate(-90 26 26)"/></svg>`;
}
const kpiHTML=k=>`<div class="kpi${k.hero?' hero':''}"><div class="kh">${ic(k.i)}<span class="l">${k.l}</span></div><div class="vrow"><span class="v">${k.v}</span>${k.extra||''}</div><span class="s">${k.s}</span>${k.sp?spark(k.sp):''}${k.ly||''}<div class="pk">${k.pk}</div></div>`;

/* ---------- Budget dan pembanding tahun lalu ---------- */
const lyDate=d=>(+d.slice(0,4)-1)+d.slice(4);
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
const monthBudget=(y,m,cat)=>{let t=0;BM.forEach((v,k)=>{const p=k.split('|');if(+p[0]===y&&+p[1]===m&&(!cat||p[2]===cat))t+=v});return t};
function dayShare(d){
  const p=PH.get(d); if(p!=null) return p;
  const pre=d.slice(0,7); for(const k of PH.keys()) if(k.slice(0,7)===pre) return 0;
  return 1/dim(+d.slice(0,4),+d.slice(5,7));
}
const budgetDay=(d,cat)=>monthBudget(+d.slice(0,4),+d.slice(5,7),cat)*dayShare(d);
function dlt(c,l,o){
  if(!l) return '';
  o=o||{};
  const v=o.pts?(c-l)*100:(c/l-1)*100, up=v>=0;
  return `<div class="ly"><b class="${up?'up':'dn'}">${up?'▲':'▼'} ${dec(Math.abs(v),1)}${o.pts?' poin':'%'}</b> <span>vs ${lyYear(o.d)} · ${o.txt}</span></div>`;
}
const lyYear=d=>d?(+d.slice(0,4)-1):'';
const ZONA={'FLOORING AND WALL':1,'APPLIANCES':3,'BATHROOM':2,'ELECTRICAL AND LIGHTING':3,'HOUSEWARE & HOBBIES':3,'KITCHEN':3,'MISCELLANEOUS':3,'BUILDING MATERIAL':4,'DOORS AND WINDOWS':4,'HARDWARE':4,'PAINT AND SUNDRIES':5,'PLUMBING':2,'TOOLS':5};
const zn=c=>ZONA[String(c).toUpperCase()]||99;
const peakOf=(rows,f)=>rows.reduce((b,r)=>f(r)>f(b)?r:b,rows[0]);
const eff=r=>r.cin?r.tr/r.cin:0, bsk=r=>r.tr?r.nav/r.tr:0;

function niceMax(v){const st=[10,20,25,50,100,200,250,500,1000].map(x=>x*1e6);for(const s of st){if(v<=s*5)return [Math.ceil(v/s)*s,s]}return [Math.ceil(v/1e9)*1e9,1e9]}
function niceCount(v){for(const s of [10,20,50,100,200,500,1000,2000,5000,10000]){if(v/s<=5)return [Math.ceil(v/s)*s,s]}return [Math.ceil(v/10000)*10000,10000]}
const roundTop=(x,y,w,h,r)=>{r=Math.min(r,h/2,w/2);return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`};

function renderKpis(rows){
  const n=rows.length, cin=sum(rows.map(d=>d.cin)), trn=sum(rows.map(d=>d.tr)), nav=sum(rows.map(d=>d.nav));
  const pc=peakOf(rows,r=>r.cin), pt=peakOf(rows,r=>r.tr), pe=peakOf(rows,eff), pb=peakOf(rows,bsk), ps=peakOf(rows,r=>r.nav);
  const e=cin?trn/cin:0;
  const pr=rows.map(r=>[r,LYD.get(lyDate(r.d))]).filter(x=>x[1]);
  let L=null;
  if(pr.length){const c=pr.map(x=>x[0]),l=pr.map(x=>x[1]);
    L={cin:[sum(c.map(x=>x.cin)),sum(l.map(x=>x.cin))],tr:[sum(c.map(x=>x.tr)),sum(l.map(x=>x.tr))],nav:[sum(c.map(x=>x.nav)),sum(l.map(x=>x.nav))],d:rows[0].d,full:pr.length===rows.length};
    L.e=[L.cin[0]?L.tr[0]/L.cin[0]:0,L.cin[1]?L.tr[1]/L.cin[1]:0];L.b=[L.tr[0]?L.nav[0]/L.tr[0]:0,L.tr[1]?L.nav[1]/L.tr[1]:0];}
  const D=(k,f,o)=>L?dlt(L[k][0],L[k][1],Object.assign({d:L.d,txt:f(L[k][1])},o||{})):'';
  $('kpis').innerHTML=[
    {i:'traffic',l:'Traffic',v:nf.format(cin),s:'pengunjung masuk · rata-rata '+nf.format(Math.round(cin/n))+' per hari',sp:rows.map(d=>d.cin),ly:D('cin',nf.format),pk:'Tertinggi '+fd(pc.d)+' · '+nf.format(pc.cin)},
    {i:'invoice',l:'Invoice',v:nf.format(trn),s:'rata-rata '+nf.format(Math.round(trn/n))+' per hari',sp:rows.map(d=>d.tr),ly:D('tr',nf.format),pk:'Tertinggi '+fd(pt.d)+' · '+nf.format(pt.tr)},
    {i:'target',l:'Efektivitas traffic',v:cin?dec(e*100,1)+'%':'–',extra:ring(e),s:'invoice ÷ traffic',sp:rows.map(eff),ly:D('e',v=>dec(v*100,1)+'%',{pts:1}),pk:'Tertinggi '+fd(pe.d)+' · '+dec(eff(pe)*100,1)+'%'},
    {i:'basket',l:'Basket size',v:trn?rp(nav/trn):'–',s:'sales ÷ invoice',sp:rows.map(bsk),ly:D('b',rp),pk:'Tertinggi '+fd(pb.d)+' · '+rp(bsk(pb))},
    {hero:1,i:'sales',l:'Sales',v:rp(nav),s:'exclude tax · '+rp(nav/n)+' per hari',sp:rows.map(d=>d.nav),ly:D('nav',rp),pk:'Tertinggi '+fd(ps.d)+' · '+rp(ps.nav)}
  ].map(kpiHTML).join('');
  $('lyNote').hidden=!(L&&!L.full);
  if(L&&!L.full)$('lyNote').textContent='Pembanding tahun lalu hanya tersedia untuk '+pr.length+' dari '+rows.length+' hari pada rentang ini; selisih dihitung untuk hari yang ada pembandingnya saja.';
}
function renderChart(rows){
  const byD=new Map(rows.map(r=>[r.d,r]));
  const months=new Set(rows.map(r=>r.d.slice(0,7))), monthView=months.size===1;
  let slots;
  if(monthView){const p=rows[0].d.split('-').map(Number);const dim=new Date(Date.UTC(p[0],p[1],0)).getUTCDate();slots=Array.from({length:dim},(_,i)=>`${p[0]}-${pad(p[1])}-${pad(i+1)}`)}
  else slots=rows.map(r=>r.d);
  const avg=sum(rows.map(r=>r.nav))/rows.length;
  const [mx,step]=niceMax(Math.max(...rows.map(r=>r.nav))*1.12);
  const W=720,H=270,L=44,R=10,T=24,B=28,iw=W-L-R,ih=H-T-B,slot=iw/slots.length,bw=Math.min(slot*0.62,46);
  const y=v=>T+ih-(v/mx)*ih;
  let g='<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--accent-soft)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" stroke-width="3"/></pattern></defs>';
  for(let v=0;v<=mx+1;v+=step){g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L-6}" y="${y(v)+3.5}" text-anchor="end">${Math.round(v/1e6)}</text>`}
  const every=monthView?5:Math.ceil(slots.length/8), labels=rows.length<=12;
  slots.forEach((dt,i)=>{
    const show=monthView?(i===0||(i+1)%5===0):(i%every===0);
    if(show) g+=`<text x="${L+(i+0.5)*slot}" y="${H-8}" text-anchor="middle">${monthView?i+1:fd(dt)}</text>`;
    const r=byD.get(dt); if(!r) return;
    const x=L+i*slot+(slot-bw)/2, top=y(r.nav), h=Math.max(T+ih-top,0), bad=Math.abs(r.nav-r.ffc)>=1;
    const tip=`${fdy(dt)} · ${rp(r.nav)} · ${r.tr} invoice`+(bad?' (NAV dan FFC belum sama)':'');
    g+=`<path data-tip="${esc(tip)}" d="${roundTop(x,top,bw,h,4)}" fill="${bad?'url(#hatch)':'var(--accent)'}"${bad?' stroke="var(--accent)" stroke-width="1.2"':''}/>`;
    if(labels) g+=`<text class="vl" x="${x+bw/2}" y="${top-6}" text-anchor="middle">${Math.round(r.nav/1e6)}</text>`;
    g+=`<rect data-tip="${esc(tip)}" x="${L+i*slot}" y="${T}" width="${slot}" height="${ih}" fill="transparent"/>`;
  });
  g+=`<line x1="${L}" x2="${W-R}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--amber)" stroke-width="1.8" stroke-dasharray="6 4"/><text class="av" x="${W-R}" y="${y(avg)-6}" text-anchor="end">rata-rata ${Math.round(avg/1e6)}</text>`;
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik sales harian">${g}</svg>`;
  $('chHint').textContent='Rp juta per hari, exclude tax. '+(monthView?'Sumbu bawah: tanggal.':'Sumbu bawah: tanggal dan bulan.');
  const bads=rows.filter(r=>Math.abs(r.nav-r.ffc)>=1);
  $('chLegend').innerHTML=`<span><i style="background:var(--accent)"></i>Sales NAV</span>`+(bads.length?`<span><i style="background:var(--accent-soft);border:1.5px solid var(--accent)"></i>NAV dan FFC belum sama</span>`:'')+`<span><i style="background:var(--amber)"></i>Rata-rata harian</span>`;
  $('chNote').innerHTML=bads.length?`<div class="note" style="margin-top:12px">Selisih NAV dan FFC: ${bads.slice(0,4).map(r=>`${fd(r.d)} (${rp(r.nav-r.ffc)}, ${r.tr-r.ffct} invoice)`).join('; ')}${bads.length>4?` dan ${bads.length-4} tanggal lain`:''}. Biasanya data hari berjalan belum sinkron.</div>`:'';
}
function renderTraffic(rows){
  const n=rows.length, [mx,step]=niceCount(Math.max(...rows.map(r=>r.cin))*1.12);
  const W=720,H=250,L=44,R=10,T=18,B=28,iw=W-L-R,ih=H-T-B,slot=iw/n,gw=Math.min(slot*0.72,76),bw=gw/2-1.5;
  const y=v=>T+ih-(v/mx)*ih;
  let g='';
  for(let v=0;v<=mx+1;v+=step){g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L-6}" y="${y(v)+3.5}" text-anchor="end">${nf.format(v)}</text>`}
  const every=Math.ceil(n/8), labels=n<=7;
  rows.forEach((r,i)=>{
    const cx=L+(i+0.5)*slot, x1=cx-bw-1.5, x2=cx+1.5;
    if(i%every===0) g+=`<text x="${cx}" y="${H-8}" text-anchor="middle">${fd(r.d)}</text>`;
    const tip=`${fdy(r.d)} · traffic masuk ${nf.format(r.cin)} · invoice ${nf.format(r.tr)} · efektivitas ${r.cin?dec(r.tr/r.cin*100,1)+'%':'–'}`;
    g+=`<path d="${roundTop(x1,y(r.cin),bw,T+ih-y(r.cin),4)}" fill="var(--s1)"/><path d="${roundTop(x2,y(r.tr),bw,T+ih-y(r.tr),4)}" fill="var(--s2)"/>`;
    if(labels) g+=`<text class="vl" x="${x1+bw/2}" y="${y(r.cin)-5}" text-anchor="middle">${nf.format(r.cin)}</text><text class="vl" x="${x2+bw/2}" y="${y(r.tr)-5}" text-anchor="middle">${nf.format(r.tr)}</text>`;
    g+=`<rect data-tip="${esc(tip)}" x="${L+i*slot}" y="${T}" width="${slot}" height="${ih}" fill="transparent"/>`;
  });
  $('tcChart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik traffic dan invoice harian">${g}</svg>`;
  $('tcLegend').innerHTML=`<span><i style="background:var(--s1)"></i>Traffic masuk</span><span><i style="background:var(--s2)"></i>Invoice</span>`;
}
function renderEf(rows){
  const cin=sum(rows.map(r=>r.cin)), avg=cin?sum(rows.map(r=>r.tr))/cin:0;
  $('efList').innerHTML=rows.map(r=>{const e=eff(r);return `<div class="ef" data-tip="${esc(fdy(r.d)+' · '+nf.format(r.tr)+' invoice dari '+nf.format(r.cin)+' pengunjung')}"><span class="d num">${fd(r.d)}</span><div class="b"><i style="width:${Math.min(e,1)*100}%"></i><u style="left:${Math.min(avg,1)*100}%"></u></div><span class="p">${dec(e*100,1)}%</span></div>`}).join('');
}
function renderCats(){
  const m=new Map();
  DATA.C.forEach(c=>{if(c[0]>=from&&c[0]<=to)m.set(c[1],(m.get(c[1])||0)+c[2])});
  const list=[...m].sort((a,b)=>b[1]-a[1]);
  if(!list.length){$('cats').innerHTML='<div class="empty">Belum ada data kategori pada rentang ini. Unggah laporan detail penjualan untuk menampilkannya.</div>';return}
  const mx=Math.max(...list.map(x=>x[1]),1), total=sum(list.map(x=>x[1]));
  $('cats').innerHTML=list.map(([k,v],i)=>`<div class="cat" data-tip="${esc(title(k)+' · '+rp(v))}"><div class="t"><span><span class="rk">${i+1}</span>${esc(title(k))}</span><span class="num">${jt(v)} · ${dec(v/total*100,0)}%</span></div><div class="b"><i style="width:${v/mx*100}%"></i></div></div>`).join('');
}

function renderTarget(rows){
  const box=$('tg'), dates=rows.map(r=>r.d), set=new Set(dates);
  const cats=[...new Set([...[...BM.keys()].map(k=>k.split('|')[2]),...DATA.C.filter(c=>set.has(c[0])).map(c=>c[1])])];
  const bud={},act={},lyc={};
  cats.forEach(c=>{bud[c]=0;act[c]=0;lyc[c]=0});
  dates.forEach(d=>cats.forEach(c=>{bud[c]+=budgetDay(d,c)}));
  DATA.C.forEach(c=>{if(set.has(c[0]))act[c[1]]=(act[c[1]]||0)+c[2]});
  dates.forEach(d=>cats.forEach(c=>{lyc[c]+=LYC.get(lyDate(d)+'|'+c)||0}));
  const bTot=sum(Object.values(bud));
  if(!bTot){box.innerHTML='<div class="empty">Belum ada budget untuk bulan pada rentang ini. Unggah file Budget (sheet "budget 1 tahun" dan "budget daily").</div>';return}
  const nav=sum(rows.map(r=>r.nav));
  const last=dates[dates.length-1], y=+last.slice(0,4), m=+last.slice(5,7), mk=last.slice(0,7);
  const mTarget=monthBudget(y,m);
  const mtd=sum(DATA.D.filter(r=>r.d.slice(0,7)===mk&&r.d<=last).map(r=>r.nav));
  const done=Math.max(...DATA.D.filter(r=>r.d.slice(0,7)===mk).map(r=>+r.d.slice(8)));
  const left=dim(y,m)-done;
  const ach=nav/bTot, cls=ach>=1?'good':ach>=.9?'warn':'crit';
  const need=left>0&&mTarget>mtd?(mTarget-mtd)/left:0;
  const lySum=sum(dates.map(d=>(LYD.get(lyDate(d))||{nav:0}).nav));
  const tile=(l,v,s)=>`<div class="tg-t"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;
  const list=cats.filter(c=>bud[c]>0||act[c]>0).sort((a,b)=>zn(a)-zn(b)||(bud[b]||act[b])-(bud[a]||act[a]));
  const zcount={};list.forEach(c=>{zcount[zn(c)]=(zcount[zn(c)]||0)+1});let zprev=null;
  const cell=(a,b,l)=>{const pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit';return `<td class="r num">${b?jt(b):'–'}</td><td class="r num">${jt(a)}</td><td class="r num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?jt(a-b):'–'}</td><td class="r num">${l?jt(l):'–'}</td><td class="r num">${l?(a/l-1>=0?'▲ ':'▼ ')+dec(Math.abs(a/l-1)*100,1)+'%':'–'}</td>`};
  const trs=list.map((c,i)=>{
    const first=zn(c)!==zprev;zprev=zn(c);
    const last=i===list.length-1||zn(list[i+1])!==zn(c);
    const zs=list.filter(x=>zn(x)===zn(c));
    const sub=last?`<tr class="zt"><td>Total ${zn(c)<99?'Zona '+zn(c):'lainnya'}</td>${cell(sum(zs.map(x=>act[x]||0)),sum(zs.map(x=>bud[x]||0)),sum(zs.map(x=>lyc[x]||0)))}</tr>`:'';
    const a=act[c]||0,b=bud[c]||0,pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit',l=lyc[c];
    return `<tr${first?' class="zs"':''}>${first?`<td class="zona z${zn(c)}" rowspan="${zcount[zn(c)]+1}">${zn(c)<99?'Zona '+zn(c):'–'}</td>`:''}<td>${esc(title(c))}</td><td class="r num">${b?jt(b):'–'}</td><td class="r num">${jt(a)}</td><td class="r num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?jt(a-b):'–'}</td><td class="r num">${l?jt(l):'–'}</td><td class="r num">${l?(a/l-1>=0?'▲ ':'▼ ')+dec(Math.abs(a/l-1)*100,1)+'%':'–'}</td></tr>${sub}`}).join('');
  const aT=sum(list.map(c=>act[c]||0)), bT=sum(list.map(c=>bud[c]||0)), lT=sum(list.map(c=>lyc[c]||0));
  box.innerHTML=`<div class="tg-top">
    <div class="tg-main"><span class="l">Pencapaian vs budget periode</span><span class="big ${cls}">${dec(ach*100,1)}%</span>
      <div class="pbar" role="img" aria-label="Pencapaian ${dec(ach*100,1)} persen"><i class="${cls}" style="width:${Math.min(ach,1)*100}%"></i></div>
      <span class="s">${rp(nav)} dari budget ${rp(bTot)} · ${ach>=1?'lebih':'kurang'} ${rp(Math.abs(nav-bTot))}</span></div>
    ${tile('Target '+MON[m-1]+' '+y,rp(mTarget),'target bulan penuh, exclude tax')}
    ${tile('Tercapai bulan ini',dec(mTarget?mtd/mTarget*100:0,1)+'%',rp(mtd)+' s/d '+fd(last))}
    ${tile('Sisa target',mTarget>mtd?rp(mTarget-mtd):'Tercapai',left>0?(mTarget>mtd?rp(need)+' per hari untuk '+left+' hari lagi':left+' hari lagi'):'bulan sudah lewat')}
    ${lySum?tile('Sales vs '+lyYear(dates[0]),(nav/lySum-1>=0?'▲ ':'▼ ')+dec(Math.abs(nav/lySum-1)*100,1)+'%',rp(lySum)+' tahun lalu'):''}
  </div>
  <div class="tbl"><table class="tgt"><thead><tr><th>Zonasi</th><th>Kategori</th><th class="r">Budget periode</th><th class="r">Actual</th><th class="r">Capaian</th><th class="r">Selisih</th><th class="r">Tahun lalu</th><th class="r">vs tahun lalu</th></tr></thead><tbody>${trs}</tbody>
  <tfoot><tr><td colspan="2">Total</td><td class="r num">${jt(bT)}</td><td class="r num">${jt(aT)}</td><td class="r num">${bT?dec(aT/bT*100,1)+'%':'–'}</td><td class="r num">${jt(aT-bT)}</td><td class="r num">${lT?jt(lT):'–'}</td><td class="r num">${lT?(aT/lT-1>=0?'▲ ':'▼ ')+dec(Math.abs(aT/lT-1)*100,1)+'%':'–'}</td></tr></tfoot></table></div>`;
}
function renderRows(rows){
  $('rows').innerHTML=rows.map(d=>{
    const diff=d.nav-d.ffc, ok=Math.abs(diff)<1;
    return `<tr><td class="num">${fdy(d.d)}</td><td class="r num">${nf.format(d.cin)}</td><td class="r num">${nf.format(d.cout)}</td><td class="r num">${nf.format(d.tr)}</td><td class="r num">${d.cin?dec(d.tr/d.cin*100,1)+'%':'–'}</td><td class="r num">${d.tr?jt(d.nav/d.tr):'–'}</td><td class="r num">${jt(d.nav)}</td><td class="r num">${jt(d.ffc)}</td><td>${ok?'<span class="pill good">✓ Cocok</span>':`<span class="pill warn">! Selisih ${jt(diff)}</span>`}</td></tr>`}).join('');
  const cin=sum(rows.map(d=>d.cin)),trn=sum(rows.map(d=>d.tr)),nav=sum(rows.map(d=>d.nav)),ffc=sum(rows.map(d=>d.ffc));
  $('foot').innerHTML=`<tr><td>Total</td><td class="r num">${nf.format(cin)}</td><td class="r num">${nf.format(sum(rows.map(d=>d.cout)))}</td><td class="r num">${nf.format(trn)}</td><td class="r num">${cin?dec(trn/cin*100,1)+'%':'–'}</td><td class="r num">${trn?jt(nav/trn):'–'}</td><td class="r num">${jt(nav)}</td><td class="r num">${jt(ffc)}</td><td></td></tr>`;
}
function render(){
  let rows=DATA.D.filter(x=>x.d>=from&&x.d<=to).sort((a,b)=>a.d<b.d?-1:1);
  const nPart=rows.filter(r=>Math.abs(r.nav-r.ffc)>=1).length;
  if(skipPartial) rows=rows.filter(r=>Math.abs(r.nav-r.ffc)<1);
  $('partWrap').hidden=!nPart&&!skipPartial;$('partLbl').textContent='Abaikan hari yang belum sinkron NAV dan FFC ('+nPart+' hari)';
  document.querySelectorAll('.chip').forEach(c=>{const r=presetRange(c.dataset.p);c.setAttribute('aria-pressed',String(r[0]===from&&r[1]===to))});
  const ds=allDates();
  if(ds.length){$('from').min=$('to').min=ds[0];$('from').max=$('to').max=ds[ds.length-1]}
  if(!rows.length){
    $('period').textContent='Tidak ada data pada rentang ini';
    $('kpis').innerHTML='<div class="card empty">Tidak ada data pada rentang tanggal ini. Ubah tanggal atau unggah database.</div>';
    ['chart','chLegend','chNote','cats','rows','foot','tcChart','tcLegend','efList','tg'].forEach(i=>$(i).innerHTML='');
    return;
  }
  $('period').textContent=`${fdy(rows[0].d)} – ${fdy(rows[rows.length-1].d)} · ${rows.length} hari`;
  renderKpis(rows);renderChart(rows);renderTraffic(rows);renderEf(rows);renderCats();renderTarget(rows);renderRows(rows);
}

/* ---------- Unggah database ke Supabase ---------- */
function serialToISO(n){return new Date(Math.round((n-25569)*864e5)).toISOString().slice(0,10)}
function toISO(v){
  if(typeof v==='number') return serialToISO(v);
  if(v instanceof Date) return v.toISOString().slice(0,10);
  if(typeof v==='string'){
    let m=v.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[1]+'-'+m[2]+'-'+m[3];
    m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if(m){const y=+m[3]<100?2000+ +m[3]:+m[3];return y+'-'+pad(+m[2])+'-'+pad(+m[1])}
  }
  return null;
}
function parseSheet(f,sh,sn){
  const rows=XLSX.utils.sheet_to_json(sh,{header:1,raw:true,defval:null});
  const src=f.name+' / '+sn;
  let h=rows.findIndex(r=>r&&r[0]==='Date'&&r.some(x=>String(x).trim()==='Sales Exclude Tax (NAV)'));
  if(h>=0){
    const hd=rows[h].map(x=>String(x==null?'':x).trim());
    const ix=n=>{const i=hd.indexOf(n);if(i<0)throw new Error('kolom "'+n+'" tidak ada');return i};
    const c={nav:ix('Sales Exclude Tax (NAV)'),tr:ix('Total Transaction (NAV)'),ffc:ix('Sales Exclude Tax (FFC)'),ffct:ix('Total Transaction (FFC)'),cin:ix('Total Counter In'),cout:ix('Total Counter Out')};
    const is=hd.indexOf('Store No (NAV)'), out=[]; let other=0;
    rows.slice(h+1).forEach(r=>{const d=toISO(r[0]);if(!d||typeof r[c.nav]!=='number')return;
      if(is>=0&&r[is]!=null&&String(r[is]).trim()!==STORE){other++;return}
      out.push({store_code:STORE,sale_date:d,nav_sales:Math.round(r[c.nav]),nav_trx:+r[c.tr]||0,ffc_sales:Math.round(+r[c.ffc]||0),ffc_trx:+r[c.ffct]||0,counter_in:+r[c.cin]||0,counter_out:+r[c.cout]||0,source:src})});
    if(!out.length) throw new Error(other?'file ini bukan untuk toko '+STORE:'tidak ada baris tanggal yang terbaca');
    return {kind:'nav',name:src,rows:out};
  }
  h=rows.findIndex(r=>r&&r[0]==='Receipt Date');
  if(h>=0){
    const hd=rows[h].map(x=>String(x==null?'':x).trim());
    const ic=hd.indexOf('Category'), ia=hd.indexOf('Amount Exclude Sales'), is=hd.indexOf('Store No');
    if(ic<0||ia<0) throw new Error('kolom Category atau Amount Exclude Sales tidak ada');
    const m=new Map(); let n=0,other=0;
    rows.slice(h+1).forEach(r=>{const d=toISO(r[0]);if(!d||typeof r[ia]!=='number'||!r[ic])return;
      if(is>=0&&r[is]!=null&&String(r[is]).trim()!==STORE){other++;return}
      const k=d+'|'+r[ic];m.set(k,(m.get(k)||0)+r[ia]);n++});
    if(!n) throw new Error(other?'file ini bukan untuk toko '+STORE:'tidak ada baris penjualan yang terbaca');
    return {kind:'detail',name:src,n,rows:[...m].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],sales:Math.round(v),source:src}})};
  }
  const yr=(sn.match(/20\d\d/)||[String(new Date().getFullYear())])[0];
  const MI=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'], ALT={MEI:'MAY',AGU:'AUG',AGS:'AUG',OKT:'OCT',DES:'DEC'};
  const mon=v=>{const k=String(v==null?'':v).trim().toUpperCase().slice(0,3);return MI.indexOf(ALT[k]||k)};
  h=rows.findIndex(r=>r&&String(r[0]||'').trim().toLowerCase()==='category'&&mon(r[1])===0);
  if(h>=0){
    const out=[];
    rows.slice(h+1).forEach(r=>{const cat=String(r&&r[0]||'').trim().toUpperCase();if(!cat||/^TOTAL/.test(cat))return;
      for(let m=0;m<12;m++){const v=r[1+m];if(typeof v==='number'&&v>0)out.push({store_code:STORE,year:+yr,month:m+1,category:cat,budget:Math.round(v),source:src})}});
    if(!out.length) throw new Error('tidak ada angka budget yang terbaca');
    return {kind:'budget',name:src,rows:out,year:+yr};
  }
  h=rows.findIndex(r=>r&&String(r[0]||'').trim().toUpperCase()==='CATEGORY'&&String(r[1]||'').trim().toLowerCase()==='tanggal');
  if(h>=1&&mon(rows[h-1][0])>=0){
    const m=mon(rows[h-1][0])+1, pr=rows.slice(h+1).find(r=>r&&String(r[1]||'').trim().toLowerCase()==='cont %');
    if(!pr) throw new Error('baris "cont %" tidak ada');
    const out=[];
    rows[h].forEach((dv,i)=>{if(i>=2&&typeof dv==='number'&&typeof pr[i]==='number')out.push({store_code:STORE,phase_date:yr+'-'+pad(m)+'-'+pad(dv),pct:pr[i],source:src})});
    if(!out.length) throw new Error('tidak ada persentase harian yang terbaca');
    return {kind:'phasing',name:src,rows:out,month:MON[m-1]+' '+yr};
  }
  throw new Error('format tidak dikenali');
}
async function parseFile(f){
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:false});
  const ok=[],bad=[];
  wb.SheetNames.forEach(sn=>{try{ok.push(parseSheet(f,wb.Sheets[sn],sn))}catch(err){bad.push(sn+': '+explain(err))}});
  if(!ok.length) throw new Error(bad.length===1?bad[0]:'tidak ada sheet yang dikenali ('+bad.join('; ')+')');
  ok.skipped=bad;
  return ok;
}
async function upsertChunks(table,rows,conflict){
  for(let i=0;i<rows.length;i+=500){
    const {error}=await SB.from(table).upsert(rows.slice(i,i+500),{onConflict:conflict});
    if(error) throw error;
  }
}
function explain(err){
  const m=(err&&err.message)||String(err);
  if(/row-level security|permission denied/i.test(m)) return 'peran Anda tidak boleh mengubah data (hanya admin dan editor)';
  return m;
}
$('upBtn').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{
  const files=[...e.target.files]; e.target.value='';
  if(!files.length||!canWrite) return;
  if(!window.XLSX){showMsg('Pembaca Excel belum termuat. Muat ulang halaman lalu coba lagi.','err');return}
  showMsg('Membaca '+files.length+' file…','info');
  const ok=[],bad=[];
  for(const f of files){try{const r=await parseFile(f);ok.push(...r);r.skipped.forEach(x=>bad.push(f.name+' / '+x))}catch(err){bad.push(f.name+': '+explain(err))}}
  const parts=[];
  for(const r of ok){
    try{
      if(r.kind==='nav'){await upsertChunks('store_daily',r.rows,'store_code,sale_date');parts.push('Report Compare FFC dan NAV: '+r.rows.length+' hari')}
      else if(r.kind==='budget'){await upsertChunks('store_budget_monthly',r.rows,'store_code,year,month,category');parts.push('Budget '+r.year+': '+r.rows.length+' angka bulanan')}
      else if(r.kind==='phasing'){await upsertChunks('store_budget_phasing',r.rows,'store_code,phase_date');parts.push('Budget harian '+r.month+': '+r.rows.length+' hari')}
      else{await upsertChunks('store_day_category',r.rows,'store_code,sale_date,category');parts.push('Detail penjualan: '+nf.format(r.n)+' baris, '+new Set(r.rows.map(x=>x.sale_date)).size+' hari')}
    }catch(err){bad.push(r.name+': '+explain(err))}
  }
  if(parts.length){await loadData();const r=presetRange('all');setRange(r[0],r[1])}
  if(parts.length&&!bad.length) showMsg('Berhasil disimpan. '+parts.join(' · ')+'. Data tanggal yang sama diganti dengan yang baru.','ok');
  else if(parts.length) showMsg('Sebagian disimpan. '+parts.join(' · ')+'. Gagal: '+bad.join('; '),'err');
  else showMsg('Tidak ada yang tersimpan. '+bad.join('; ')+'. Gunakan file Report Compare FFC and Nav, Sales Detail Report, atau file Budget.','err');
});

/* ---------- Filter tanggal ---------- */
$('from').addEventListener('change',e=>{let a=e.target.value,b=$('to').value;if(!a)return;if(b&&a>b)b=a;setRange(a,b)});
$('to').addEventListener('change',e=>{let b=e.target.value,a=$('from').value;if(!b)return;if(a&&b<a)a=b;setRange(a,b)});
$('partChk').addEventListener('change',e=>{skipPartial=e.target.checked;render()});
$('chips').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;const r=presetRange(c.dataset.p);setRange(r[0],r[1])});

const tip=$('tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t){tip.textContent=t.getAttribute('data-tip');tip.style.opacity=1}else tip.style.opacity=0});
document.addEventListener('mousemove',e=>{tip.style.left=Math.min(e.clientX+12,innerWidth-250)+'px';tip.style.top=(e.clientY+14)+'px'});

/* ---------- Sesi, peran, dan pemuatan data ---------- */
const CFG=window.APP_CONFIG||{};
const SB=(window.supabase&&CFG.SUPABASE_URL&&CFG.SUPABASE_PUBLISHABLE_KEY&&!/YOUR-/.test(CFG.SUPABASE_URL))?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_PUBLISHABLE_KEY):null;
let canWrite=false;
const bootMsg=(t,showOut)=>{$('boot-msg').textContent=t;$('boot-out').hidden=!showOut;$('boot').hidden=false;$('app').hidden=true};
const toLogin=()=>{try{sessionStorage.setItem('mitra10_next','monitoring.html')}catch(e){}location.replace('login.html?next=monitoring.html')};
async function fetchAll(table,cols,order){
  const out=[];
  for(let from0=0;;from0+=1000){
    let q=SB.from(table).select(cols).eq('store_code',STORE);
    order.forEach(o=>{q=q.order(o)});
    const {data,error}=await q.range(from0,from0+999);
    if(error) throw error;
    out.push(...data);
    if(data.length<1000) break;
  }
  return out;
}
async function loadData(){
  const [d,c,b,p]=await Promise.all([
    fetchAll('store_daily','sale_date,nav_sales,nav_trx,ffc_sales,ffc_trx,counter_in,counter_out',['sale_date']),
    fetchAll('store_day_category','sale_date,category,sales',['sale_date','category']),
    fetchAll('store_budget_monthly','year,month,category,budget',['year','month']),
    fetchAll('store_budget_phasing','phase_date,pct',['phase_date'])
  ]);
  const D=d.map(r=>({d:r.sale_date,nav:+r.nav_sales,tr:+r.nav_trx,ffc:+r.ffc_sales,ffct:+r.ffc_trx,cin:+r.counter_in,cout:+r.counter_out}));
  const yr=D.length?Math.max(...D.map(r=>+r.d.slice(0,4))):0;
  LYD=new Map();LYC=new Map();PH=new Map();BM=new Map();
  D.filter(r=>+r.d.slice(0,4)<yr).forEach(r=>LYD.set(r.d,r));
  c.filter(r=>+r.sale_date.slice(0,4)<yr).forEach(r=>LYC.set(r.sale_date+'|'+r.category,(LYC.get(r.sale_date+'|'+r.category)||0)+ +r.sales));
  b.forEach(r=>BM.set(r.year+'|'+r.month+'|'+r.category,+r.budget));
  p.forEach(r=>PH.set(r.phase_date,+r.pct));
  DATA={
    D:D.filter(r=>+r.d.slice(0,4)===yr),
    C:c.filter(r=>+r.sale_date.slice(0,4)===yr).map(r=>[r.sale_date,r.category,+r.sales]),
    B:b
  };
}
const signOut=async()=>{try{if(SB)await SB.auth.signOut()}catch(e){}location.replace('index.html')};
$('logout').addEventListener('click',signOut);$('boot-out').addEventListener('click',signOut);
(async function boot(){
  if(!SB){bootMsg('Konfigurasi belum lengkap: isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di public/config.js.',false);return}
  try{
    const {data:{session}}=await SB.auth.getSession();
    if(!session){toLogin();return}
    const {data:roleRow,error}=await SB.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
    if(error||!roleRow){bootMsg('Akun Anda belum punya peran. Hubungi admin.',true);return}
    canWrite=roleRow.role==='admin'||roleRow.role==='editor';
    $('who-name').textContent=session.user.email||'';$('who-role').textContent=roleRow.role;
    $('upbox').hidden=!canWrite;
    if(window.__DEMO){$('lnk-sp').hidden=true;$('logout').hidden=true;$('who-role').textContent='pratinjau';$('uphint').textContent='Pratinjau: unggahan tersimpan di browser ini saja.'}
    await loadData();
    $('boot').hidden=true;$('app').hidden=false;
    const r=presetRange(DATA.D.length>31?'month':'all');setRange(r[0],r[1]);
    if(!DATA.D.length) showMsg(canWrite?'Belum ada data. Unggah Report Compare FFC and Nav dan Sales Detail Report.':'Belum ada data. Minta admin atau editor mengunggahnya.','info');
  }catch(err){
    bootMsg('Gagal memuat data: '+((err&&err.message)||err),true);
  }
})();
})();
