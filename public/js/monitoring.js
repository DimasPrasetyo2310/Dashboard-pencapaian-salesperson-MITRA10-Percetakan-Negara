// Monitoring Sales Bulanan, MITRA10 Percetakan Negara (10005). Membaca dan menulis tabel store_daily dan store_day_category di Supabase.
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const STORE='10005';
const nf=new Intl.NumberFormat('id-ID');
const dec=(n,d)=>n.toFixed(d).replace('.',',');
const rp=n=>n>=1e9?'Rp '+dec(n/1e9,2)+' M':'Rp '+dec(n/1e6,1)+' jt';
const jt=n=>dec(n/1e6,1)+' jt';
const fu=n=>Math.round(n).toLocaleString('id-ID');
const sel=n=>Math.round(n)<0?'<span class="negbox">−'+fu(Math.abs(n))+'</span>':fu(n);
const lyp=(a,l)=>{const v=(a/l-1)*100;return Math.round(v*10)/10<0?'<span class="negbox">−'+dec(Math.abs(v),1)+'%</span>':'<span class="posbox">▲ '+dec(v,1)+'%</span>'};
const sum=a=>a.reduce((x,y)=>x+y,0);
const pad=n=>String(n).padStart(2,'0');
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const fd=iso=>{const p=iso.split('-');return (+p[2])+' '+MON[+p[1]-1]};
const fdy=iso=>fd(iso)+' '+iso.slice(0,4);
const addDays=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const title=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());

let DATA={D:[],C:[],B:[]};
let LYD=new Map(), LYC=new Map(), PH=new Map(), BM=new Map();
let skipPartial=false; let BRD=null, LASTTG=null, LASTK=[];
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
const kpiHTML=k=>`<div class="kpi${k.hero?' hero':''}" data-kpi="${k.key}" tabindex="0" title="Klik untuk rincian per hari"><div class="kh">${ic(k.i)}<span class="l">${k.l}</span></div><div class="vrow"><span class="v">${k.v}</span>${k.extra||''}</div><span class="s">${k.s}</span>${k.sp?spark(k.sp):''}${k.ly||''}<div class="pk">${k.pk}</div></div>`;

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
const eff=r=>r.cin?r.tr/r.cin:0, bsk=r=>r.tr?r.sx/r.tr:0;

function niceMax(v){const st=[10,20,25,50,100,200,250,500,1000].map(x=>x*1e6);for(const s of st){if(v<=s*5)return [Math.ceil(v/s)*s,s]}return [Math.ceil(v/1e9)*1e9,1e9]}
function niceCount(v){for(const s of [10,20,50,100,200,500,1000,2000,5000,10000]){if(v/s<=5)return [Math.ceil(v/s)*s,s]}return [Math.ceil(v/10000)*10000,10000]}
const roundTop=(x,y,w,h,r)=>{r=Math.min(r,h/2,w/2);return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`};

function renderKpis(rows){
  LASTK=rows;
  const n=rows.length, cin=sum(rows.map(d=>d.cin)), trn=sum(rows.map(d=>d.tr)), nav=sum(rows.map(d=>d.sx));
  const pc=peakOf(rows,r=>r.cin), pt=peakOf(rows,r=>r.tr), pe=peakOf(rows,eff), pb=peakOf(rows,bsk), ps=peakOf(rows,r=>r.sx);
  const e=cin?trn/cin:0;
  const pr=rows.map(r=>[r,LYD.get(lyDate(r.d))]).filter(x=>x[1]);
  let L=null;
  if(pr.length){const c=pr.map(x=>x[0]),l=pr.map(x=>x[1]);
    L={cin:[sum(c.map(x=>x.cin)),sum(l.map(x=>x.cin))],tr:[sum(c.map(x=>x.tr)),sum(l.map(x=>x.tr))],nav:[sum(c.map(x=>x.sx)),sum(l.map(x=>x.sx))],d:rows[0].d,full:pr.length===rows.length};
    L.e=[L.cin[0]?L.tr[0]/L.cin[0]:0,L.cin[1]?L.tr[1]/L.cin[1]:0];L.b=[L.tr[0]?L.nav[0]/L.tr[0]:0,L.tr[1]?L.nav[1]/L.tr[1]:0];}
  const D=(k,f,o)=>L?dlt(L[k][0],L[k][1],Object.assign({d:L.d,txt:f(L[k][1])},o||{})):'';
  $('kpis').innerHTML=[
    {key:'cin',i:'traffic',l:'Traffic',v:nf.format(cin),s:'pengunjung masuk · rata-rata '+nf.format(Math.round(cin/n))+' per hari',sp:rows.map(d=>d.cin),ly:D('cin',nf.format),pk:'Tertinggi '+fd(pc.d)+' · '+nf.format(pc.cin)},
    {key:'tr',i:'invoice',l:'Invoice',v:nf.format(trn),s:'rata-rata '+nf.format(Math.round(trn/n))+' per hari',sp:rows.map(d=>d.tr),ly:D('tr',nf.format),pk:'Tertinggi '+fd(pt.d)+' · '+nf.format(pt.tr)},
    {key:'e',i:'target',l:'Efektivitas traffic',v:cin?dec(e*100,1)+'%':'–',extra:ring(e),s:'invoice ÷ traffic',sp:rows.map(eff),ly:D('e',v=>dec(v*100,1)+'%',{pts:1}),pk:'Tertinggi '+fd(pe.d)+' · '+dec(eff(pe)*100,1)+'%'},
    {key:'b',i:'basket',l:'Basket size',v:trn?rp(nav/trn):'–',s:'sales ÷ invoice',sp:rows.map(bsk),ly:D('b',rp),pk:'Tertinggi '+fd(pb.d)+' · '+rp(bsk(pb))},
    {key:'nav',hero:1,i:'sales',l:'Sales',v:rp(nav),s:'exclude tax · '+rp(nav/n)+' per hari',sp:rows.map(d=>d.sx),ly:D('nav',rp),pk:'Tertinggi '+fd(ps.d)+' · '+rp(ps.sx)}
  ].map(kpiHTML).join('');
  $('lyNote').hidden=!(L&&!L.full);
  if(L&&!L.full)$('lyNote').textContent='Pembanding tahun lalu hanya tersedia untuk '+pr.length+' dari '+rows.length+' hari pada rentang ini; selisih dihitung untuk hari yang ada pembandingnya saja.';
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
const DIMS=[['source','dimSrc','Source Type Name'],['typebrand','dimTb','Master Type Brand']];
let DIMD=[];
function renderDims(rows){
  const set=new Set(rows.map(r=>r.d)), lyset=new Set(rows.map(r=>lyDate(r.d)));
  DIMS.forEach(([dim,id,label])=>{
    const cur={},ly={};
    DIMD.forEach(r=>{if(r.dim!==dim)return;if(set.has(r.d))cur[r.v]=(cur[r.v]||0)+r.s;else if(lyset.has(r.d))ly[r.v]=(ly[r.v]||0)+r.s});
    const ks=[...new Set([...Object.keys(cur),...Object.keys(ly)])].map(k=>({k,a:cur[k]||0,l:ly[k]||0})).filter(x=>Math.round(x.a)||Math.round(x.l)).sort((x,y)=>y.a-x.a||y.l-x.l);
    if(!ks.length){$(id).innerHTML='<div class="empty">Belum ada data. Unggah laporan detail penjualan (periode ini dan tahun lalu) lewat tombol Unggah.</div>';return}
    const A=sum(ks.map(x=>x.a)),L=sum(ks.map(x=>x.l));
    const gr=(x,y)=>y?lyp(x,y):(x?'<span class="posbox">Baru</span>':'–');
    const trs=ks.map(x=>`<tr><td>${esc(x.k)}</td><td class="r num">${fu(x.a)}</td><td class="r num">${A?dec(x.a/A*100,1)+'%':'–'}</td><td class="r num">${x.l?fu(x.l):'–'}</td><td class="r num">${L?dec(x.l/L*100,1)+'%':'–'}</td><td class="r num">${sel(x.a-x.l)}</td><td class="r num">${gr(x.a,x.l)}</td></tr>`).join('');
    $(id).innerHTML=`<div class="tbl"><table class="tgt dimt"><thead><tr><th>${label}</th><th class="r">Actual</th><th class="r">Kontribusi</th><th class="r">Tahun lalu</th><th class="r">Kontribusi LY</th><th class="r">Selisih</th><th class="r">Growth</th></tr></thead><tbody>${trs}</tbody><tfoot><tr><td>Total</td><td class="r num">${fu(A)}</td><td class="r num">100%</td><td class="r num">${L?fu(L):'–'}</td><td class="r num">${L?'100%':'–'}</td><td class="r num">${L?sel(A-L):'–'}</td><td class="r num">${L?lyp(A,L):'–'}</td></tr></tfoot></table></div>`;
  });
}

function renderTarget(rows){
  const box=$('tg');
  if(!rows.length){$('tgPeriod').textContent='';box.innerHTML='<div class="empty">Tidak ada data pada rentang tanggal ini.</div>';return}
  $('tgPeriod').textContent=fdy(rows[0].d)+' – '+fdy(rows[rows.length-1].d)+' · '+rows.length+' hari';
  const dates=rows.map(r=>r.d), set=new Set(dates);
  const cats=[...new Set([...[...BM.keys()].map(k=>k.split('|')[2]),...DATA.C.filter(c=>set.has(c[0])).map(c=>c[1])])];
  const bud={},act={},lyc={};
  cats.forEach(c=>{bud[c]=0;act[c]=0;lyc[c]=0});
  dates.forEach(d=>cats.forEach(c=>{bud[c]+=budgetDay(d,c)}));
  DATA.C.forEach(c=>{if(set.has(c[0]))act[c[1]]=(act[c[1]]||0)+c[2]});
  dates.forEach(d=>cats.forEach(c=>{lyc[c]+=LYC.get(lyDate(d)+'|'+c)||0}));
  const bTot=sum(Object.values(bud));
  LASTTG={set,dates,bud,act,lyc};
  if(!bTot){box.innerHTML='<div class="empty">Belum ada budget untuk bulan pada rentang ini. Unggah file Budget (sheet "budget 1 tahun" dan "budget daily").</div>';return}
  const nav=sum(rows.map(r=>r.sx));
  const last=dates[dates.length-1], y=+last.slice(0,4), m=+last.slice(5,7), mk=last.slice(0,7);
  const mTarget=monthBudget(y,m);
  const mtd=sum(DATA.D.filter(r=>r.d.slice(0,7)===mk&&r.d<=last).map(r=>r.sx));
  const done=Math.max(...DATA.D.filter(r=>r.d.slice(0,7)===mk).map(r=>+r.d.slice(8)));
  const left=dim(y,m)-done;
  const ach=nav/bTot, cls=ach>=1?'good':ach>=.9?'warn':'crit';
  const need=left>0&&mTarget>mtd?(mTarget-mtd)/left:0;
  const lySum=sum(dates.map(d=>(LYD.get(lyDate(d))||{sx:0}).sx));
  const tile=(l,v,s)=>`<div class="tg-t"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;
  const list=cats.filter(c=>bud[c]>0||act[c]>0).sort((a,b)=>zn(a)-zn(b)||(bud[b]||act[b])-(bud[a]||act[a]));
  const zcount={};list.forEach(c=>{zcount[zn(c)]=(zcount[zn(c)]||0)+1});let zprev=null;
  const cell=(a,b,l)=>{const pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit';return `<td class="r num">${b?fu(b):'–'}</td><td class="r num">${fu(a)}</td><td class="r num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?sel(a-b):'–'}</td><td class="r num">${l?fu(l):'–'}</td><td class="r num">${l?lyp(a,l):'–'}</td>`};
  const trs=list.map((c,i)=>{
    const first=zn(c)!==zprev;zprev=zn(c);
    const last=i===list.length-1||zn(list[i+1])!==zn(c);
    const zs=list.filter(x=>zn(x)===zn(c));
    const sub=last?`<tr class="zt"><td>Total ${zn(c)<99?'Zona '+zn(c):'lainnya'}</td>${cell(sum(zs.map(x=>act[x]||0)),sum(zs.map(x=>bud[x]||0)),sum(zs.map(x=>lyc[x]||0)))}</tr>`:'';
    const a=act[c]||0,b=bud[c]||0,pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit',l=lyc[c];
    return `<tr data-cat="${esc(c)}" tabindex="0" title="Klik untuk rincian master brand"${first?' class="zs"':''}>${first?`<td class="zona z${zn(c)}" rowspan="${zcount[zn(c)]+1}">${zn(c)<99?'Zona '+zn(c):'–'}</td>`:''}<td>${esc(title(c))}</td><td class="r num">${b?fu(b):'–'}</td><td class="r num">${fu(a)}</td><td class="r num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?sel(a-b):'–'}</td><td class="r num">${l?fu(l):'–'}</td><td class="r num">${l?lyp(a,l):'–'}</td></tr>${sub}`}).join('');
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
  <tfoot><tr><td colspan="2">Total</td><td class="r num">${fu(bT)}</td><td class="r num">${fu(aT)}</td><td class="r num">${bT?dec(aT/bT*100,1)+'%':'–'}</td><td class="r num">${sel(aT-bT)}</td><td class="r num">${lT?fu(lT):'–'}</td><td class="r num">${lT?lyp(aT,lT):'–'}</td></tr></tfoot></table></div>`;
}
function renderRows(rows){
  $('rows').innerHTML=rows.map(d=>{
    const diff=d.nav-d.ffc, ok=Math.abs(diff)<1;
    return `<tr><td class="num">${fdy(d.d)}</td><td class="r num">${nf.format(d.cin)}</td><td class="r num">${nf.format(d.cout)}</td><td class="r num">${nf.format(d.tr)}</td><td class="r num">${d.cin?dec(d.tr/d.cin*100,1)+'%':'–'}</td><td class="r num">${d.tr?jt(d.nav/d.tr):'–'}</td><td class="r num">${jt(d.nav)}</td><td class="r num">${jt(d.ffc)}</td><td>${ok?'<span class="pill good">✓ Cocok</span>':`<span class="pill warn">! Selisih ${jt(diff)}</span>`}</td></tr>`}).join('');
  const cin=sum(rows.map(d=>d.cin)),trn=sum(rows.map(d=>d.tr)),nav=sum(rows.map(d=>d.nav)),ffc=sum(rows.map(d=>d.ffc));
  $('foot').innerHTML=`<tr><td>Total</td><td class="r num">${nf.format(cin)}</td><td class="r num">${nf.format(sum(rows.map(d=>d.cout)))}</td><td class="r num">${nf.format(trn)}</td><td class="r num">${cin?dec(trn/cin*100,1)+'%':'–'}</td><td class="r num">${trn?jt(nav/trn):'–'}</td><td class="r num">${jt(nav)}</td><td class="r num">${jt(ffc)}</td><td></td></tr>`;
}
let tgR={from:null,to:null};
function tgRows(base){
  if(!tgR.from&&!tgR.to) return base;
  let r=DATA.D.filter(x=>(!tgR.from||x.d>=tgR.from)&&(!tgR.to||x.d<=tgR.to)).sort((a,b)=>a.d<b.d?-1:1);
  if(skipPartial) r=r.filter(x=>Math.abs(x.nav-x.ffc)<1);
  return r;
}
function render(){
  let rows=DATA.D.filter(x=>x.d>=from&&x.d<=to).sort((a,b)=>a.d<b.d?-1:1);
  const nPart=rows.filter(r=>Math.abs(r.nav-r.ffc)>=1).length;
  if(skipPartial) rows=rows.filter(r=>Math.abs(r.nav-r.ffc)<1);
  $('partWrap').hidden=!nPart&&!skipPartial;$('partLbl').textContent='Abaikan hari yang belum sinkron NAV dan FFC ('+nPart+' hari)';
  document.querySelectorAll('.chip').forEach(c=>{const r=presetRange(c.dataset.p);c.setAttribute('aria-pressed',String(r[0]===from&&r[1]===to))});
  const ds=allDates();
  if(ds.length){$('from').min=$('to').min=$('tgFrom').min=$('tgTo').min=ds[0];$('from').max=$('to').max=$('tgFrom').max=$('tgTo').max=ds[ds.length-1]}
  $('tgFrom').value=tgR.from||from;$('tgTo').value=tgR.to||to;$('tgSync').hidden=!(tgR.from||tgR.to);
  renderTarget(tgRows(rows));
  if(!rows.length){
    $('period').textContent='Tidak ada data pada rentang ini';
    $('kpis').innerHTML='<div class="card empty">Tidak ada data pada rentang tanggal ini. Ubah tanggal atau unggah database.</div>';
    ['dimSrc','dimTb','rows','foot','tcChart','tcLegend','efList'].forEach(i=>$(i).innerHTML='');
    return;
  }
  $('period').textContent=`${fdy(rows[0].d)} – ${fdy(rows[rows.length-1].d)} · ${rows.length} hari`;
  renderKpis(rows);renderDims(rows);renderTraffic(rows);renderEf(rows);renderRows(rows);
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
    const ic=hd.indexOf('Category'), ia=hd.indexOf('Amount Exclude Sales'), is=hd.indexOf('Store No'), ib=hd.indexOf('Master Brand'), isr=hd.indexOf('Source Type Name'), itb=hd.indexOf('Master Type Brand');
    if(ic<0||ia<0) throw new Error('kolom Category atau Amount Exclude Sales tidak ada');
    const m=new Map(), bm=new Map(), dmap=new Map(), cube=new Map();
    const hx=(...ns)=>{for(const n of ns){const i=hd.indexOf(n);if(i>=0)return i}return -1};
    const iSub=hx('Sub Category'), iFn=hx('Function'), iSf=hx('Sub Function'), iBr=hx('Brand'), iQty=hx('Qty','Quantity'), iInc=hx('Amount Include Sales','Amount Inculde Sales');
    const tx=(r,i)=>i<0||r[i]==null?'':String(r[i]).trim(); let n=0,other=0;
    const iNo=hx('Item No'), iNm=hx('Item Name'), items=new Map();
    rows.slice(h+1).forEach(r=>{const d=toISO(r[0]);if(!d||typeof r[ia]!=='number'||!r[ic])return;
      if(is>=0&&r[is]!=null&&String(r[is]).trim()!==STORE){other++;return}
      const k=d+'|'+r[ic];m.set(k,(m.get(k)||0)+r[ia]);n++;
      if(iNo>=0&&tx(r,iNo)){const ik=JSON.stringify([d,r[ic],(tx(r,ib).toUpperCase()||'LAINNYA'),tx(r,iNo).replace(/^0+(?=\d)/,'')]);let e=items.get(ik);if(!e){e={nm:tx(r,iNm),s:0,q:0,n:0};items.set(ik,e)}e.s+=r[ia];e.q+=(iQty>=0&&typeof r[iQty]==='number')?r[iQty]:0;e.n++}
      {const ck=JSON.stringify([d,tx(r,ic),tx(r,iSub),tx(r,iFn),tx(r,iSf),tx(r,ib),tx(r,iBr),tx(r,isr),tx(r,itb)]);let e=cube.get(ck);if(!e){e={s:0,i:0,q:0,n:0};cube.set(ck,e)}e.s+=r[ia];e.i+=(iInc>=0&&typeof r[iInc]==='number')?r[iInc]:0;e.q+=(iQty>=0&&typeof r[iQty]==='number')?r[iQty]:0;e.n++}
      const addD=(dim,ix)=>{if(ix<0)return;const dk=d+'|'+dim+'|'+(String(r[ix]==null?'':r[ix]).trim()||'Lainnya');dmap.set(dk,(dmap.get(dk)||0)+r[ia])};addD('source',isr);addD('typebrand',itb);
      if(ib>=0){const bk=k+'|'+(String(r[ib]==null?'':r[ib]).trim().toUpperCase()||'LAINNYA');bm.set(bk,(bm.get(bk)||0)+r[ia])}});
    if(!n) throw new Error(other?'file ini bukan untuk toko '+STORE:'tidak ada baris penjualan yang terbaca');
    return {kind:'detail',name:src,n,items:[...items].map(([k,e])=>{const a=JSON.parse(k);return {store_code:STORE,sale_date:a[0],category:a[1],master_brand:a[2],item_no:a[3],item_name:e.nm,qty:Math.round(e.q*100)/100,sales:Math.round(e.s),lines:e.n,source:src}}),cube:[...cube].map(([k,e])=>{const a=JSON.parse(k);return {store_code:STORE,sale_date:a[0],category:a[1],sub_category:a[2],func:a[3],sub_func:a[4],master_brand:a[5],brand:a[6],source_type:a[7],master_type_brand:a[8],sales:Math.round(e.s),sales_incl:Math.round(e.i),qty:Math.round(e.q*100)/100,lines:e.n,source:src}}),dims:[...dmap].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],dim:p[1],dim_value:p[2],sales:Math.round(v),source:src}}),brands:[...bm].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],master_brand:p[2],sales:Math.round(v),source:src}}),rows:[...m].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],sales:Math.round(v),source:src}})};
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
      else{await upsertChunks('store_day_category',r.rows,'store_code,sale_date,category');parts.push('Detail penjualan: '+nf.format(r.n)+' baris, '+new Set(r.rows.map(x=>x.sale_date)).size+' hari');
        if(r.items&&r.items.length){await upsertChunks('store_day_item',r.items,'store_code,sale_date,category,master_brand,item_no');parts.push('Detail item: '+nf.format(r.items.length)+' data')}
        if(r.cube&&r.cube.length){await upsertChunks('store_day_detail',r.cube,'store_code,sale_date,category,sub_category,func,sub_func,master_brand,brand,source_type,master_type_brand');parts.push('Arsip detail lengkap: '+nf.format(r.cube.length)+' data')}
        if(r.dims&&r.dims.length){await upsertChunks('store_day_dim',r.dims,'store_code,sale_date,dim,dim_value');parts.push('Source type dan master type brand: '+nf.format(r.dims.length)+' data')}
        if(r.brands&&r.brands.length){await upsertChunks('store_day_brand',r.brands,'store_code,sale_date,category,master_brand');parts.push('Master brand: '+nf.format(r.brands.length)+' data')}}
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
$('tgFrom').addEventListener('change',e=>{tgR.from=e.target.value||null;if(!tgR.to)tgR.to=$('tgTo').value||null;render()});
$('tgTo').addEventListener('change',e=>{tgR.to=e.target.value||null;if(!tgR.from)tgR.from=$('tgFrom').value||null;render()});
$('tgSync').addEventListener('click',()=>{tgR={from:null,to:null};render()});
/* Gambar kartu: tanpa pustaka luar. Kartu disalin ke SVG lalu digambar ke canvas. */
async function cardToPng(el){
  const w=Math.ceil(Math.max(el.scrollWidth,el.getBoundingClientRect().width)), h=Math.ceil(el.scrollHeight);
  const clone=el.cloneNode(true);
  clone.querySelectorAll('.no-shot').forEach(n=>n.remove());
  const src=[el,...el.querySelectorAll('*')], dst=[clone,...clone.querySelectorAll('*')];
  const keep=new Set([...el.querySelectorAll('.no-shot')].flatMap(n=>[n,...n.querySelectorAll('*')]));
  const srcKeep=src.filter(n=>!keep.has(n));
  srcKeep.forEach((o,i)=>{
    const d=dst[i]; if(!d||!d.style) return;
    const cs=getComputedStyle(o);
    let css=''; for(const p of cs) css+=p+':'+cs.getPropertyValue(p)+';';
    d.style.cssText=css+'font-family:"Segoe UI",system-ui,-apple-system,Arial,sans-serif;';
  });
  clone.style.width=w+'px';clone.style.height='auto';clone.style.boxShadow='none';
  clone.querySelectorAll('.tbl,.br-body').forEach(t=>{t.style.overflow='visible';t.style.maxHeight='none'});
  const xhtml=new XMLSerializer().serializeToString(clone);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">'+xhtml+'</div></foreignObject></svg>';
  const img=new Image();
  await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(new Error('gagal membuat gambar'));img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});
  const sc=Math.max(1,Math.min(2,15000/h)), cv=document.createElement('canvas'); cv.width=w*sc; cv.height=h*sc;
  const cx=cv.getContext('2d'); cx.fillStyle='#ffffff'; cx.fillRect(0,0,cv.width,cv.height); cx.scale(sc,sc); cx.drawImage(img,0,0);
  return await new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error('gagal membuat PNG')),'image/png'));
}
/* Salin/bagikan gambar: elemen digandakan ke wadah tersembunyi selebar layar PC, jadi hasilnya selalu utuh (tidak terpotong) di HP maupun PC. */
async function shotImage(el,width,name,prep){
  const host=document.createElement('div'); host.className='shot-host'; host.style.width=width+'px';
  const c=el.cloneNode(true); c.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id')); c.removeAttribute('id'); c.classList.add('shot');
  host.appendChild(c); document.body.appendChild(host); if(prep) prep(c);
  try{ await new Promise(r=>requestAnimationFrame(()=>r())); return await cardToPng(c) } finally { host.remove() }
}
async function deliverImage(pngP,name){
  try{ await navigator.clipboard.write([new ClipboardItem({'image/png':pngP})]); return 'Tersalin. Tempel di WhatsApp' }catch(e){}
  const blob=await pngP, file=new File([blob],name,{type:'image/png'});
  try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); return 'Gambar dibagikan' } }catch(e){ if(e&&e.name==='AbortError') return 'Dibatalkan' }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  return 'Gambar diunduh ke galeri/unduhan';
}
async function runShot(btn,el,width,name,prep){
  const old=btn.textContent; btn.disabled=true; btn.textContent='Memproses…';
  try{ btn.textContent=await deliverImage(shotImage(el,width,name,prep),name) }catch(err){ btn.textContent='Gagal membuat gambar' }
  setTimeout(()=>{btn.textContent=old;btn.disabled=false},2800);
}
$('tgShot').addEventListener('click',()=>runShot($('tgShot'),$('tgCard'),1180,'target-vs-actual-'+new Date().toISOString().slice(0,10)+'.png'));

/* Popup rincian master brand per kategori */
async function loadBrands(){
  if(BRD) return BRD;
  const r=await fetchAll('store_day_brand','sale_date,category,master_brand,sales',['sale_date','category','master_brand']);
  BRD=r.map(x=>({d:x.sale_date,c:x.category,b:x.master_brand,s:+x.sales}));
  return BRD;
}
let brCat=null, BRCTX=null;
async function openBrand(cat){
  if(!LASTTG) return;
  brCat=cat; BRCTX=null;
  const ov=$('brOv'), body=$('brBody'); ov.hidden=false; document.body.style.overflow='hidden';
  $('brTitle').textContent=title(cat)+(zn(cat)<99?' · Zona '+zn(cat):'');
  const {set,dates,bud,act,lyc}=LASTTG;
  $('brPeriod').textContent=fdy(dates[0])+' – '+fdy(dates[dates.length-1])+' · '+dates.length+' hari · dibanding '+lyYear(dates[0])+' (tanggal yang sama)';
  const a=act[cat]||0,b=bud[cat]||0,l=lyc[cat]||0,pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit';
  const t=(k,v)=>`<div class="tg-t"><span class="l">${k}</span><span class="v">${v}</span></div>`;
  $('brKpi').innerHTML=t('Budget periode',b?fu(b):'–')+t('Actual',fu(a))+t('Capaian',pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`)+t('Selisih vs budget',b?sel(a-b):'–')+t('Tahun lalu',l?fu(l):'–')+t('Growth vs tahun lalu',l?lyp(a,l):'–');
  body.innerHTML='<div class="empty">Memuat rincian master brand…</div>';
  let rows;
  try{rows=await loadBrands()}catch(e){if(brCat===cat)body.innerHTML='<div class="empty">Gagal memuat data master brand.</div>';return}
  if(brCat!==cat) return;
  BRCTX={cat,dates};
  const lyset=new Set(dates.map(lyDate)), cur={}, ly={};
  rows.forEach(r=>{if(r.c!==cat)return;if(set.has(r.d))cur[r.b]=(cur[r.b]||0)+r.s;else if(lyset.has(r.d))ly[r.b]=(ly[r.b]||0)+r.s});
  const brs=[...new Set([...Object.keys(cur),...Object.keys(ly)])].map(k=>({k,a:cur[k]||0,l:ly[k]||0}))
    .filter(x=>Math.round(x.a)||Math.round(x.l)).sort((x,y)=>y.a-x.a||y.l-x.l);
  if(!brs.length){body.innerHTML='<div class="empty">Rincian master brand belum tersedia untuk kategori dan rentang ini. Unggah laporan detail penjualan (periode ini dan tahun lalu) lewat tombol Unggah.</div>';return}
  const A=sum(brs.map(x=>x.a)),L=sum(brs.map(x=>x.l));
  const gr=(x,y)=>y?lyp(x,y):(x?'<span class="posbox">Baru</span>':'–');
  const trs=brs.map((x,i)=>`<tr data-b="${esc(x.k)}" tabindex="0" title="Klik untuk detail item"><td class="r num">${i+1}</td><td>${esc(title(x.k))}</td><td class="r num">${fu(x.a)}</td><td class="r num">${A?dec(x.a/A*100,1)+'%':'–'}</td><td class="r num">${x.l?fu(x.l):'–'}</td><td class="r num">${sel(x.a-x.l)}</td><td class="r num">${gr(x.a,x.l)}</td></tr>`).join('');
  body.innerHTML=`<div class="tbl brtbl"><table class="tgt"><thead><tr><th class="r">#</th><th>Master brand</th><th class="r">Actual</th><th class="r">Kontribusi</th><th class="r">Tahun lalu</th><th class="r">Selisih</th><th class="r">Growth</th></tr></thead><tbody>${trs}</tbody>
  <tfoot><tr><td></td><td>Total (${brs.length} brand)</td><td class="r num">${fu(A)}</td><td class="r num">${A?'100%':'–'}</td><td class="r num">${L?fu(L):'–'}</td><td class="r num">${sel(A-L)}</td><td class="r num">${L?lyp(A,L):'–'}</td></tr></tfoot></table></div>`;
}
function closeBrand(){closeItems();$('brOv').hidden=true;document.body.style.overflow='';brCat=null}
$('tg').addEventListener('click',e=>{const r=e.target.closest('tr[data-cat]');if(r)openBrand(r.dataset.cat)});
$('tg').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const r=e.target.closest('tr[data-cat]');if(r){e.preventDefault();openBrand(r.dataset.cat)}});

/* Popup rincian per hari untuk kartu KPI */
const KM={
  cin:{l:'Traffic',f:r=>r.cin,agg:a=>sum(a.map(r=>r.cin)),fmt:v=>nf.format(Math.round(v)),per:'Total'},
  tr:{l:'Invoice',f:r=>r.tr,agg:a=>sum(a.map(r=>r.tr)),fmt:v=>nf.format(Math.round(v)),per:'Total'},
  e:{l:'Efektivitas traffic',f:r=>r.cin?r.tr/r.cin:0,agg:a=>{const c=sum(a.map(r=>r.cin));return c?sum(a.map(r=>r.tr))/c:0},fmt:v=>dec(v*100,1)+'%',pts:1,per:'Periode'},
  b:{l:'Basket size',f:r=>r.tr?r.sx/r.tr:0,agg:a=>{const t=sum(a.map(r=>r.tr));return t?sum(a.map(r=>r.sx))/t:0},fmt:v=>fu(v),per:'Periode'},
  nav:{l:'Sales (exclude tax)',f:r=>r.sx,agg:a=>sum(a.map(r=>r.sx)),fmt:v=>fu(v),per:'Total'}
};
const HARI=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const hari=d=>HARI[new Date(d+'T00:00:00Z').getUTCDay()];
const pil=(v,t)=>Math.round(v*10)/10<0?'<span class="negbox">−'+t+'</span>':Math.round(v*10)/10>0?'<span class="posbox">▲ '+t+'</span>':t;
function openKpi(key){
  const m=KM[key], rows=LASTK; if(!m||!rows.length) return;
  brCat='kpi-'+key; $('brOv').hidden=false; document.body.style.overflow='hidden';
  $('brTitle').textContent=m.l+' per hari';
  $('brPeriod').textContent=fdy(rows[0].d)+' – '+fdy(rows[rows.length-1].d)+' · '+rows.length+' hari · dibanding '+lyYear(rows[0].d)+' (tanggal yang sama)';
  const pr=rows.filter(r=>LYD.get(lyDate(r.d))), cur=m.agg(pr.length?pr:rows), ly=pr.length?m.agg(pr.map(r=>LYD.get(lyDate(r.d)))):0;
  const all=m.agg(rows), hi=peakOf(rows,m.f), lo=rows.reduce((q,r)=>m.f(r)<m.f(q)?r:q,rows[0]);
  const gv=ly?(m.pts?(cur-ly)*100:(cur/ly-1)*100):0, gt=m.pts?dec(Math.abs(gv),1)+' poin':dec(Math.abs(gv),1)+'%';
  const t=(k,v)=>`<div class="tg-t"><span class="l">${k}</span><span class="v">${v}</span></div>`;
  $('brKpi').innerHTML=t(m.per==='Total'?'Total periode':'Periode',m.fmt(all))+t('Tahun lalu',ly?m.fmt(ly):'–')+t(m.pts?'Selisih':'Growth',ly?pil(gv,gt):'–')+t('Tertinggi',m.fmt(m.f(hi))+'<span class="s">'+fd(hi.d)+'</span>')+t('Terendah',m.fmt(m.f(lo))+'<span class="s">'+fd(lo.d)+'</span>')+t('Rata-rata per hari',m.fmt(key==='cin'||key==='tr'||key==='nav'?all/rows.length:all));
  const trs=rows.map(r=>{
    const v=m.f(r), q=LYD.get(lyDate(r.d)), l=q?m.f(q):0, has=!!q&&l>0;
    const dv=has?(m.pts?(v-l)*100:v-l):0, gr=has?(m.pts?dv:(v/l-1)*100):0;
    const selTxt=has?(m.pts?dec(Math.abs(dv),1)+' poin':fu(Math.abs(dv))):'';
    const grTxt=has?(m.pts?'':dec(Math.abs(gr),1)+'%'):'';
    return `<tr><td>${hari(r.d)}, ${fdy(r.d)}</td><td class="r num">${m.fmt(v)}</td><td class="r num">${has?m.fmt(l)+' <span class="mut">('+fd(lyDate(r.d))+')</span>':'–'}</td><td class="r num">${has?pil(dv,selTxt):'–'}</td>${m.pts?'':`<td class="r num">${has?pil(gr,grTxt):'–'}</td>`}</tr>`}).join('');
  const tfoot=`<tr><td>${m.per}</td><td class="r num">${m.fmt(all)}</td><td class="r num">${ly?m.fmt(ly):'–'}</td><td class="r num">${ly?pil(m.pts?(cur-ly)*100:cur-ly,m.pts?dec(Math.abs(gv),1)+' poin':fu(Math.abs(cur-ly))):'–'}</td>${m.pts?'':`<td class="r num">${ly?pil(gv,gt):'–'}</td>`}</tr>`;
  const note=key==='nav'?'<p class="hint">Sales dihitung dari laporan detail penjualan yang diunggah (kolom Amount Exclude Sales), sama dengan tabel Target vs actual. Hari yang belum punya laporan detail memakai Sales Exclude Tax (NAV).</p>':'';
  $('brBody').innerHTML=note+`<div class="tbl brtbl"><table class="tgt"><thead><tr><th>Tanggal</th><th class="r">${m.l}</th><th class="r">Tahun lalu</th><th class="r">Selisih</th>${m.pts?'':'<th class="r">Growth</th>'}</tr></thead><tbody>${trs}</tbody><tfoot>${tfoot}</tfoot></table></div>`;
}
$('kpis').addEventListener('click',e=>{const k=e.target.closest('.kpi[data-kpi]');if(k)openKpi(k.dataset.kpi)});
$('kpis').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const k=e.target.closest('.kpi[data-kpi]');if(k){e.preventDefault();openKpi(k.dataset.kpi)}});

/* Ekspor cadangan: seluruh tabel monitoring dalam satu file JSON */
$('bkBtn').addEventListener('click',async()=>{
  const b=$('bkBtn'), old=b.textContent; b.disabled=true; b.textContent='Mengekspor…';
  const T=[['store_daily',['sale_date']],['store_day_category',['sale_date','category']],['store_day_brand',['sale_date','category','master_brand']],['store_day_dim',['sale_date','dim','dim_value']],['store_day_detail',['sale_date','category','sub_category','func','sub_func','master_brand','brand','source_type','master_type_brand']],['store_budget_monthly',['year','month','category']],['store_budget_phasing',['phase_date']]];
  try{
    const out={dibuat:new Date().toISOString(),toko:STORE,tabel:{}};
    for(const [t,o] of T){b.textContent='Mengekspor '+t.replace('store_','')+'…';out.tabel[t]=await fetchAll(t,'*',o)}
    const blob=new Blob([JSON.stringify(out)],{type:'application/json'}), a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='cadangan-monitoring-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();
    b.textContent='Cadangan diunduh';
  }catch(err){b.textContent='Gagal mengekspor'}
  setTimeout(()=>{b.textContent=old;b.disabled=false},3000);
});

/* Popup detail item per master brand */
const itN=n=>Math.round(n*100)/100===Math.round(n)?nf.format(Math.round(n)):dec(n,2);
let itKey=null;
async function openItems(brandKey){
  if(!BRCTX) return;
  const {cat,dates}=BRCTX; itKey=cat+'|'+brandKey;
  $('itOv').hidden=false;
  $('itTitle').textContent=title(brandKey)+' · '+title(cat);
  $('itPeriod').textContent=fdy(dates[0])+' – '+fdy(dates[dates.length-1])+' · '+dates.length+' hari · dibanding '+lyYear(dates[0])+' (tanggal yang sama)';
  $('itKpi').innerHTML=''; $('itBody').innerHTML='<div class="empty">Memuat detail item…</div>';
  const set=new Set(dates), lyd=dates.map(lyDate), lyset=new Set(lyd), lo=[...lyd,...dates].sort()[0], hi=[...lyd,...dates].sort().slice(-1)[0];
  let rows=[];
  try{
    for(let from0=0;;from0+=1000){
      const {data,error}=await SB.from('store_day_item').select('sale_date,item_no,item_name,qty,sales').eq('store_code',STORE).eq('category',cat).eq('master_brand',brandKey).gte('sale_date',lo).lte('sale_date',hi).order('sale_date').order('item_no').range(from0,from0+999);
      if(error) throw error; rows=rows.concat(data); if(data.length<1000) break;
    }
  }catch(e){if(itKey===cat+'|'+brandKey)$('itBody').innerHTML='<div class="empty">Gagal memuat detail item.</div>';return}
  if(itKey!==cat+'|'+brandKey) return;
  const M=new Map();
  rows.forEach(r=>{const cu=set.has(r.sale_date), l=!cu&&lyset.has(r.sale_date); if(!cu&&!l)return;
    let e=M.get(r.item_no); if(!e){e={no:r.item_no,nm:r.item_name||'',a:0,q:0,l:0,lq:0};M.set(r.item_no,e)}
    if(cu){e.a+=+r.sales;e.q+=+r.qty;if(r.item_name)e.nm=r.item_name}else{e.l+=+r.sales;e.lq+=+r.qty;if(!e.nm)e.nm=r.item_name||''}});
  const its=[...M.values()].filter(x=>Math.round(x.a)||Math.round(x.l)).sort((x,y)=>y.a-x.a||y.l-x.l);
  if(!its.length){$('itBody').innerHTML='<div class="empty">Detail item belum tersedia untuk brand dan rentang ini. Unggah laporan detail penjualan (periode ini dan tahun lalu) lewat tombol Unggah.</div>';return}
  const A=sum(its.map(x=>x.a)),L=sum(its.map(x=>x.l)),Q=sum(its.map(x=>x.q));
  const t=(k,v)=>`<div class="tg-t"><span class="l">${k}</span><span class="v">${v}</span></div>`;
  const gr=(x,y)=>y?lyp(x,y):(x?'<span class="posbox">Baru</span>':'–');
  $('itKpi').innerHTML=t('Actual',fu(A))+t('Tahun lalu',L?fu(L):'–')+t('Growth vs tahun lalu',L?lyp(A,L):'–')+t('Selisih',L?sel(A-L):'–')+t('Jumlah item',nf.format(its.filter(x=>x.a>0).length)+'<span class="s">dari '+nf.format(its.length)+' item</span>')+t('Qty terjual',itN(Q));
  const trs=its.map((x,i)=>`<tr><td class="r num">${i+1}</td><td class="num">${esc(x.no)}</td><td>${esc(x.nm)}</td><td class="r num">${x.q?itN(x.q):'–'}</td><td class="r num">${x.a?fu(x.a):'0'}</td><td class="r num">${A?dec(x.a/A*100,1)+'%':'–'}</td><td class="r num">${x.l?fu(x.l):'–'}</td><td class="r num">${sel(x.a-x.l)}</td><td class="r num">${gr(x.a,x.l)}</td></tr>`).join('');
  $('itBody').innerHTML=`<div class="tbl brtbl"><table class="tgt itm"><thead><tr><th class="r">#</th><th>Item No</th><th>Nama item</th><th class="r">Qty</th><th class="r">Actual</th><th class="r">Kontribusi</th><th class="r">Tahun lalu</th><th class="r">Selisih</th><th class="r">Growth</th></tr></thead><tbody>${trs}</tbody><tfoot><tr><td></td><td></td><td>Total (${nf.format(its.length)} item)</td><td class="r num">${itN(Q)}</td><td class="r num">${fu(A)}</td><td class="r num">100%</td><td class="r num">${L?fu(L):'–'}</td><td class="r num">${L?sel(A-L):'–'}</td><td class="r num">${L?lyp(A,L):'–'}</td></tr></tfoot></table></div>`;
}
function closeItems(){$('itOv').hidden=true;itKey=null}
$('brBody').addEventListener('click',e=>{const r=e.target.closest('tr[data-b]');if(r)openItems(r.dataset.b)});
$('brBody').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const r=e.target.closest('tr[data-b]');if(r){e.preventDefault();openItems(r.dataset.b)}});
$('itClose').addEventListener('click',closeItems);
$('itOv').addEventListener('click',e=>{if(e.target===$('itOv'))closeItems()});
$('itShot').addEventListener('click',()=>runShot($('itShot'),$('itPanel'),1100,'item-'+String(itKey||'brand').toLowerCase().replace(/\W+/g,'-')+'.png',c=>{
  const rs=[...c.querySelectorAll('tbody tr')]; if(rs.length>30){rs.slice(30).forEach(r=>r.remove());const n=document.createElement('p');n.className='hint';n.style.margin='8px 0 0';n.textContent='30 item teratas dari '+rs.length+' item (urut dari penjualan tertinggi).';c.querySelector('.tbl').after(n)}}));
$('brClose').addEventListener('click',closeBrand);
$('brOv').addEventListener('click',e=>{if(e.target===$('brOv'))closeBrand()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('itOv').hidden)closeItems();else if(!$('brOv').hidden)closeBrand()});
$('brShot').addEventListener('click',()=>runShot($('brShot'),$('brPanel'),1060,'brand-'+String(brCat||'kategori').toLowerCase().replace(/\W+/g,'-')+'.png'));
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
  const [d,c,b,p,dm]=await Promise.all([
    fetchAll('store_daily','sale_date,nav_sales,nav_trx,ffc_sales,ffc_trx,counter_in,counter_out',['sale_date']),
    fetchAll('store_day_category','sale_date,category,sales',['sale_date','category']),
    fetchAll('store_budget_monthly','year,month,category,budget',['year','month']),
    fetchAll('store_budget_phasing','phase_date,pct',['phase_date']),
    fetchAll('store_day_dim','sale_date,dim,dim_value,sales',['sale_date','dim','dim_value'])
  ]);
  DIMD=dm.map(r=>({d:r.sale_date,dim:r.dim,v:r.dim_value,s:+r.sales}));
  const DS=new Map();c.forEach(r=>DS.set(r.sale_date,(DS.get(r.sale_date)||0)+ +r.sales));
  const D=d.map(r=>({d:r.sale_date,sx:DS.has(r.sale_date)?DS.get(r.sale_date):+r.nav_sales,nav:+r.nav_sales,tr:+r.nav_trx,ffc:+r.ffc_sales,ffct:+r.ffc_trx,cin:+r.counter_in,cout:+r.counter_out}));
  const yr=D.length?Math.max(...D.map(r=>+r.d.slice(0,4))):0;
  LYD=new Map();LYC=new Map();PH=new Map();BM=new Map();BRD=null;
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
