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
let KB=new Map(), LYD=new Map(), LYC=new Map(), PH=new Map(), BM=new Map();
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

let TGS={k:-1,dir:1},TGROWS=null;
function renderTarget(rows){
  TGROWS=rows;
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
  const mdates=[];for(let i=1;i<=+last.slice(8);i++)mdates.push(mk+'-'+pad2(i));
  const mset=new Set(mdates), budM={},actM={},lycM={};
  cats.forEach(c=>{budM[c]=0;actM[c]=0;lycM[c]=0});
  mdates.forEach(d=>cats.forEach(c=>{budM[c]+=budgetDay(d,c);lycM[c]+=LYC.get(lyDate(d)+'|'+c)||0}));
  DATA.C.forEach(c=>{if(mset.has(c[0]))actM[c[1]]=(actM[c[1]]||0)+c[2]});
  const ach=nav/bTot, cls=ach>=1?'good':ach>=.9?'warn':'crit';
  const need=left>0&&mTarget>mtd?(mTarget-mtd)/left:0;
  const lySum=sum(dates.map(d=>(LYD.get(lyDate(d))||{sx:0}).sx));
  const tile=(l,v,s,k)=>`<div class="tg-t${k?' sum':''}"${k?` data-sum="${k}" tabindex="0" role="button" title="Klik untuk rincian per hari"`:''}><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;
  const base=(a,b)=>(bud[b]||act[b])-(bud[a]||act[a]);
  const flat=TGS.k>=1;
  let list=cats.filter(c=>bud[c]>0||act[c]>0).sort((a,b)=>(zn(a)-zn(b))*(TGS.k===0?TGS.dir:1)||base(a,b));
  if(flat){
    const V=c=>{const a=act[c]||0,b=bud[c]||0,l=lyc[c]||0,aM=actM[c]||0,bM=budM[c]||0,lM=lycM[c]||0;
      return [zn(c),title(c),b||null,a,b?a/b:null,b?a-b:null,l||null,l?a/l:null,bM||null,aM,bM?aM/bM:null,bM?aM-bM:null,lM||null,lM?aM/lM:null][TGS.k]};
    list=list.map(c=>[c,V(c)]).sort((x,y)=>{const p=x[1],q=y[1];if(p==null||q==null)return p==null&&q==null?base(x[0],y[0]):p==null?1:-1;
      const r=typeof p==='string'?p.localeCompare(q,'id'):p-q;return r*TGS.dir||base(x[0],y[0])}).map(x=>x[0]);
  }
  const zcount={};list.forEach(c=>{zcount[zn(c)]=(zcount[zn(c)]||0)+1});let zprev=null;
  const cell=(a,b,l)=>{const pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit';return `<td class="r num">${b?fu(b):'–'}</td><td class="r num">${fu(a)}</td><td class="c num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?sel(a-b):'–'}</td><td class="r num">${l?fu(l):'–'}</td><td class="r num">${l?lyp(a,l):'–'}</td>`};
  const mcell=(a,b,l)=>cell(a,b,l).replace('<td class="r num">','<td class="r num msep">');
  const mx=x=>mcell(actM[x]||0,budM[x]||0,lycM[x]||0), msum=zs=>mcell(sum(zs.map(x=>actM[x]||0)),sum(zs.map(x=>budM[x]||0)),sum(zs.map(x=>lycM[x]||0)));
  const trs=list.map((c,i)=>{
    const first=flat||zn(c)!==zprev;zprev=zn(c);
    const last=!flat&&(i===list.length-1||zn(list[i+1])!==zn(c));
    const zs=list.filter(x=>zn(x)===zn(c));
    const sub=last?`<tr class="zt"><td>Total ${zn(c)<99?'Zona '+zn(c):'lainnya'}</td>${cell(sum(zs.map(x=>act[x]||0)),sum(zs.map(x=>bud[x]||0)),sum(zs.map(x=>lyc[x]||0)))}${msum(zs)}</tr>`:'';
    const a=act[c]||0,b=bud[c]||0,pc=b?a/b:null,cl=pc==null?'':pc>=1?'good':pc>=.9?'warn':'crit',l=lyc[c];
    return `<tr data-cat="${esc(c)}" tabindex="0" title="Klik untuk rincian master brand"${first&&!flat?' class="zs"':''}>${first?`<td class="zona z${zn(c)}" rowspan="${flat?1:zcount[zn(c)]+1}">${zn(c)<99?'Zona '+zn(c):'–'}</td>`:''}<td class="cat">${esc(title(c))}</td><td class="r num">${b?fu(b):'–'}</td><td class="r num">${fu(a)}</td><td class="c num">${pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`}</td><td class="r num">${b?sel(a-b):'–'}</td><td class="r num">${l?fu(l):'–'}</td><td class="r num">${l?lyp(a,l):'–'}</td>${mx(c)}</tr>${sub}`}).join('');
  const aT=sum(list.map(c=>act[c]||0)), bT=sum(list.map(c=>bud[c]||0)), lT=sum(list.map(c=>lyc[c]||0));
  const dsum=(dim,val,ds)=>sum(DIMD.filter(z=>z.dim===dim&&z.v===val&&ds.has(z.d)).map(z=>z.s));
  const lyset=new Set(dates.map(lyDate)), hasDim=DIMD.some(z=>set.has(z.d)&&z.dim==='source');
  const pjA=dsum('source','Sales Project',set), pjB=sum(dates.map(d=>(KB.get(d)||{}).pj||0));
  const pbA=dsum('typebrand','Private Brand',set), pbL=dsum('typebrand','Private Brand',lyset);
  const pjCard=hasDim?tile('Sales Project · kontribusi',(nav?dec(pjA/nav*100,1):'0,0')+'%',rp(pjA)+(pjB?' vs budget '+rp(pjB)+' ('+dec(pjA/pjB*100,1)+'%)':' · budget belum ada'),'pj'):tile('Sales Project','–','Unggah laporan detail penjualan','pj');
  const pbCard=hasDim?(pbL?tile('Private Brand vs '+lyYear(dates[0]),(pbA/pbL-1>=0?'▲ ':'▼ ')+dec(Math.abs(pbA/pbL-1)*100,1)+'%',rp(pbA)+' vs '+rp(pbL)+' tahun lalu · kontribusi '+(nav?dec(pbA/nav*100,1):'0,0')+'%','pb'):tile('Private Brand',rp(pbA),'kontribusi '+(nav?dec(pbA/nav*100,1):'0,0')+'% · data tahun lalu belum ada','pb')):tile('Private Brand','–','Unggah laporan detail penjualan','pb');
  box.innerHTML=`<div class="tg-top">
    <div class="tg-main sum" data-sum="ach" tabindex="0" role="button" title="Klik untuk rincian per hari"><span class="l">Pencapaian vs budget periode</span><span class="big ${cls}">${dec(ach*100,1)}%</span>
      <div class="pbar" role="img" aria-label="Pencapaian ${dec(ach*100,1)} persen"><i class="${cls}" style="width:${Math.min(ach,1)*100}%"></i></div>
      <span class="s">${rp(nav)} dari budget ${rp(bTot)} · ${ach>=1?'lebih':'kurang'} ${rp(Math.abs(nav-bTot))}</span></div>
    ${tile('Target '+MON[m-1]+' '+y,rp(mTarget),'target bulan penuh, exclude tax','tgt')}
    ${pjCard}
    ${pbCard}
    ${lySum?tile('Sales vs '+lyYear(dates[0]),(nav/lySum-1>=0?'▲ ':'▼ ')+dec(Math.abs(nav/lySum-1)*100,1)+'%',rp(lySum)+' tahun lalu','ly'):''}
  </div>
  <div class="tbl"><table class="tgt"><thead><tr class="grp"><th colspan="2"></th><th colspan="6" class="r">Periode terpilih</th><th colspan="6" class="r msep">MTD · 1 – ${fd(last)}</th></tr><tr><th data-tg="0">Zonasi</th><th data-tg="1">Kategori</th><th data-tg="2" class="r">Budget periode</th><th data-tg="3" class="r">Actual</th><th data-tg="4" class="c">Achievement</th><th data-tg="5" class="r">Selisih</th><th data-tg="6" class="r">Tahun lalu</th><th data-tg="7" class="r">vs tahun lalu</th><th data-tg="8" class="r msep">Budget MTD</th><th data-tg="9" class="r">Actual MTD</th><th data-tg="10" class="c">Achievement MTD</th><th data-tg="11" class="r">Selisih MTD</th><th data-tg="12" class="r">MTD tahun lalu</th><th data-tg="13" class="r">vs tahun lalu</th></tr></thead><tbody>${trs}</tbody>
  <tfoot><tr><td colspan="2">Total</td><td class="r num">${fu(bT)}</td><td class="r num">${fu(aT)}</td><td class="r num">${bT?dec(aT/bT*100,1)+'%':'–'}</td><td class="r num">${sel(aT-bT)}</td><td class="r num">${lT?fu(lT):'–'}</td><td class="r num">${lT?lyp(aT,lT):'–'}</td>${mcell(sum(list.map(c=>actM[c]||0)),sum(list.map(c=>budM[c]||0)),sum(list.map(c=>lycM[c]||0)))}</tr></tfoot></table></div>`;
  tgMark();
}
function tgMark(){
  const box=$('tg');box.querySelectorAll('th[data-tg]').forEach(th=>{const i=+th.dataset.tg;th.tabIndex=0;th.title='Klik untuk mengurutkan';
    if(i===TGS.k)th.setAttribute('aria-sort',TGS.dir>0?'ascending':'descending');else th.removeAttribute('aria-sort')});
}
function tgSort(i){
  const txt=i<=1; // kolom teks: naik dulu; kolom angka: terbesar dulu
  const first=txt?1:-1;
  if(TGS.k!==i)TGS={k:i,dir:first};else if(TGS.dir===first)TGS={k:i,dir:-first};else TGS={k:-1,dir:1};
  const sc=box=>box&&box.scrollLeft, tb=$('tg').querySelector('.tbl'), l=tb?tb.scrollLeft:0;
  renderTarget(TGROWS);
  const nb=$('tg').querySelector('.tbl');if(nb)nb.scrollLeft=l;
  const th=$('tg').querySelector('th[data-tg="'+i+'"]');if(th&&TGS.k===i)th.focus({preventScroll:true});
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
  try{renderCk()}catch(e){}
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
    ['dimSrc','dimTb','rows','foot'].forEach(i=>$(i).innerHTML='');
    return;
  }
  $('period').textContent=`${fdy(rows[0].d)} – ${fdy(rows[rows.length-1].d)} · ${rows.length} hari`;
  renderKpis(rows);renderDims(rows);renderWa();renderRows(rows);
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
      if(ib>=0){const bk=k+'|'+(String(r[ib]==null?'':r[ib]).trim().toUpperCase()||'LAINNYA');{let e=bm.get(bk);if(!e){e={s:0,q:0};bm.set(bk,e)}e.s+=r[ia];e.q+=(iQty>=0&&typeof r[iQty]==='number')?r[iQty]:0}}});
    if(!n) throw new Error(other?'file ini bukan untuk toko '+STORE:'tidak ada baris penjualan yang terbaca');
    return {kind:'detail',name:src,n,items:[...items].map(([k,e])=>{const a=JSON.parse(k);return {store_code:STORE,sale_date:a[0],category:a[1],master_brand:a[2],item_no:a[3],item_name:e.nm,qty:Math.round(e.q*100)/100,sales:Math.round(e.s),lines:e.n,source:src}}),cube:[...cube].map(([k,e])=>{const a=JSON.parse(k);return {store_code:STORE,sale_date:a[0],category:a[1],sub_category:a[2],func:a[3],sub_func:a[4],master_brand:a[5],brand:a[6],source_type:a[7],master_type_brand:a[8],sales:Math.round(e.s),sales_incl:Math.round(e.i),qty:Math.round(e.q*100)/100,lines:e.n,source:src}}),dims:[...dmap].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],dim:p[1],dim_value:p[2],sales:Math.round(v),source:src}}),brands:[...bm].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],master_brand:p[2],sales:Math.round(v.s),qty:Math.round(v.q*100)/100,source:src}}),rows:[...m].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],sales:Math.round(v),source:src}})};
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
  h=rows.findIndex(r=>r&&String(r[0]||'').trim().toUpperCase()==='LY'&&String(r[1]||'').trim().toUpperCase()==='PERSENTASE'&&String(r[2]||'').trim().toUpperCase()==='TANGGAL');
  if(h>=0){
    const out=[], num=x=>typeof x==='number'&&isFinite(x)?x:null;
    rows.slice(h+3).forEach(r=>{const d=r&&toISO(r[2]);if(!d)return;
      const o={store_code:STORE,budget_date:d,traffic:num(r[3]),invoice:num(r[11]),effect:num(r[16]),basket:num(r[21]),prot_qty:num(r[27]),project:num(r[34]),pb:num(r[40]),source:src};
      if(d>='2000'&&(o.traffic||o.invoice||o.basket||o.prot_qty))out.push(o)});
    if(!out.length) throw new Error('tidak ada budget traffic/invoice yang terbaca');
    return {kind:'kpibudget',name:src,rows:out,month:out[0].budget_date.slice(0,7)};
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

/* Checklist database wajib unggah + template standar */
const CKOPEN={};
function ckPeriod(){
  const ref=to||(DATA.D.length?DATA.D.map(r=>r.d).sort().slice(-1)[0]:'')||new Date().toISOString().slice(0,10);
  return {y:+ref.slice(0,4),m:+ref.slice(5,7),day:+ref.slice(8,10),ref};
}
const dlab=d=>(+d.slice(8))+' '+MON[+d.slice(5,7)-1];
const dlist=a=>a.length?a.slice(0,12).map(dlab).join(', ')+(a.length>12?' dan '+(a.length-12)+' tanggal lain':''):'';
function ckItems(){
  const P=ckPeriod(), mm=pad2(P.m), ym=P.y+'-'+mm, dim=new Date(P.y,P.m,0).getDate();
  const exp=[],all=[]; for(let i=1;i<=dim;i++){const d=ym+'-'+pad2(i);all.push(d);if(i<=P.day)exp.push(d)}
  const Dm=new Map(DATA.D.map(r=>[r.d,r])), cs=new Map(); DATA.C.forEach(c=>cs.set(c[0],(cs.get(c[0])||0)+c[2]));
  const lyc=new Set(); LYC.forEach((v,k)=>lyc.add(k.slice(0,10)));
  const out=[], mk=(id,title,file,bad,warn,okTxt,badTxt,lines,tpl)=>out.push({id,title,file,state:bad.length?'bad':(warn&&warn.length?'warn':'ok'),summary:bad.length?badTxt:(warn&&warn.length?warn[0]:okTxt),lines,tpl});
  const miss=exp.filter(d=>!Dm.has(d)), unsync=exp.filter(d=>Dm.has(d)&&Math.abs(Dm.get(d).nav-Dm.get(d).ffc)>=1);
  mk('nav','Report Compare FFC dan NAV (harian)','File: Report Compare FFC And Nav',miss,unsync.length?[unsync.length+' hari belum sinkron NAV dan FFC']:null,'Lengkap sampai '+dlab(P.ref),miss.length+' tanggal belum ada',
    [miss.length?'Belum ada: '+dlist(miss):'Semua tanggal 1 sampai '+dlab(P.ref)+' sudah ada.',unsync.length?'Belum sinkron NAV dan FFC: '+dlist(unsync):'','Isi: sales NAV dan FFC, transaksi, traffic masuk dan keluar.'].filter(Boolean),['nav']);
  const dm=[],inc=[]; exp.forEach(d=>{const r=Dm.get(d);if(!r)return;if(!cs.has(d))dm.push(d);else if(cs.get(d)<r.nav*0.99)inc.push(d+' ('+Math.round(cs.get(d)/r.nav*100)+'%)')});
  const bad2=dm.concat(inc);
  mk('detail','Sales Detail Report (per transaksi)','File: Sales Detail Report (kolom Receipt Date)',bad2,null,'Lengkap, total sesuai NAV',bad2.length+' tanggal belum ada atau belum lengkap',
    [dm.length?'Belum ada: '+dlist(dm):'',inc.length?'Total lebih kecil dari NAV (laporan ditarik sebelum hari selesai): '+inc.slice(0,12).join(', '):'',!bad2.length?'Semua tanggal ada dan totalnya sesuai NAV.':'','Isi: sales per kategori, master brand, item, source type, master type brand, dan qty. Tarik setelah hari selesai.'].filter(Boolean),['detail']);
  const nb=[...BM.keys()].filter(k=>k.startsWith(P.y+'|'+P.m+'|')).length;
  mk('budget','Budget bulanan per kategori','File: Budget (sheet berisi baris Category dan kolom JAN sampai DEC)',nb?[]:['x'],null,nb+' kategori terisi','Belum ada untuk '+MON[P.m-1]+' '+P.y,
    [nb?'Budget '+MON[P.m-1]+' '+P.y+' tersedia untuk '+nb+' kategori.':'Budget '+MON[P.m-1]+' '+P.y+' belum ada.','Isi: target sales bulanan tiap kategori. Satu file untuk satu tahun.'],['budget']);
  const mp=all.filter(d=>!PH.has(d));
  mk('phasing','Budget harian (phasing %)','File: sheet "budget daily" (baris Tanggal dan cont %)',mp,null,'Lengkap '+dim+' hari',mp.length+' tanggal belum ada',
    [mp.length?'Belum ada: '+dlist(mp):'Semua '+dim+' hari sudah ada.','Isi: persentase kontribusi target tiap tanggal. Jumlah sebulan = 100%.'],['phasing']);
  const mk2=all.filter(d=>!KB.has(d));
  mk('kpi','Budget traffic, invoice, basket size, dan Protection BCA','File: budget traffic dan invoice (kolom Tanggal, Traffic, Invoice, Effective Traffic, Basket Size, Mitra10 Proteksi)',mk2,null,'Lengkap '+dim+' hari',mk2.length+' tanggal belum ada',
    [mk2.length?'Belum ada: '+dlist(mk2):'Semua '+dim+' hari sudah ada.','Isi: target harian traffic, invoice, efektivitas, basket size, dan QTY Protection. Dipakai di kartu laporan WhatsApp dan Report Closing.'],['kpi']);
  const ml=exp.filter(d=>{const l=lyDate(d);return !LYD.has(l)||!lyc.has(l)});
  mk('ly','Data tahun lalu (pembanding LY)','File: Compare FFC and NAV dan Sales Detail tahun '+(P.y-1),ml,null,'Lengkap sampai '+dlab(P.ref),ml.length+' tanggal belum ada',
    [ml.length?'Belum ada untuk tanggal: '+dlist(ml.map(d=>lyDate(d)))+' ('+(P.y-1)+')':'Pembanding tahun lalu lengkap.','Isi: file yang sama dengan nomor 1 dan 2, tetapi untuk tahun '+(P.y-1)+'.'],['nav','detail']);
  return out;
}
const TPL={nav:'Compare FFC NAV',detail:'Sales Detail',budget:'Budget Bulanan',phasing:'Budget Harian',kpi:'Budget KPI'};
function tplSheets(kind,y,m){
  const mm=pad2(m), dim=new Date(y,m,0).getDate(), days=[...Array(dim)].map((_,i)=>y+'-'+mm+'-'+pad2(i+1));
  if(kind==='nav') return {name:'Compare FFC NAV',rows:[['Date','Store No (NAV)','Sales Exclude Tax (NAV)','Total Transaction (NAV)','Sales Exclude Tax (FFC)','Total Transaction (FFC)','Total Counter In','Total Counter Out'],...days.map(d=>[d,STORE,null,null,null,null,null,null])]};
  if(kind==='detail') return {name:'Sales Detail',rows:[['Receipt Date','Store No','Category','Sub Category','Function','Sub Function','Master Brand','Brand','Item No','Item Name','Source Type Name','Master Type Brand','Quantity','Amount Include Sales','Amount Exclude Sales']]};
  if(kind==='budget'){const cats=[...new Set(DATA.C.map(c=>c[1]))].sort();return {name:'Budget '+y,rows:[['Category','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'],...(cats.length?cats:['KATEGORI 1']).map(c=>[c,...Array(12).fill(null)])]}}
  if(kind==='phasing') return {name:'Budget daily '+MON[m-1]+' '+y,rows:[[MON[m-1].toUpperCase()],['CATEGORY','Tanggal',...days.map((_,i)=>i+1)],['','cont %',...days.map(()=>null)]]};
  const R=[['LY','PERSENTASE','TANGGAL','TRAFFIC',null,null,null,null,'MTD',null,null,'INVOICE',null,null,null,null,'EFFECTIVE TRAFFIC',null,null,null,null,'BASKET SIZE',null,null,null,null,'MITRA10 PROTEKSI'],[],[]];
  days.forEach(d=>{const r=Array(28).fill(null);r[2]=d;R.push(r)});
  R[1][3]='BUDGET';R[1][11]='BUDGET';R[1][16]='BUDGET';R[1][21]='BUDGET';R[1][27]='BUDGET';
  return {name:'Budget KPI '+MON[m-1]+' '+y,rows:R};
}
function tplGuide(y,m){return {name:'Petunjuk',rows:[['PETUNJUK TEMPLATE UNGGAH DASHBOARD MONITORING'],[''],['1. Isi hanya sheet data. Jangan ubah nama kolom di baris judul.'],['2. Sheet Petunjuk ini otomatis dilewati saat diunggah.'],['3. Compare FFC NAV: satu baris per tanggal, isi sales dan transaksi NAV dan FFC, serta Total Counter In dan Out.'],['4. Sales Detail: tempel data laporan Sales Detail dari sistem di bawah baris judul. Kolom wajib: Receipt Date, Category, Amount Exclude Sales. Kolom lain (Master Brand, Item No, Item Name, Source Type Name, Master Type Brand, Quantity) mengisi popup dan tabel.'],['5. Budget Bulanan: satu baris per kategori, isi target tiap bulan. Tahun dibaca dari nama sheet.'],['6. Budget Harian: isi baris cont % dengan persentase kontribusi tiap tanggal (jumlah 100%). Nama bulan di baris pertama, tahun dari nama sheet.'],['7. Budget KPI: isi Traffic (kolom D), Invoice (L), Effective Traffic (Q), Basket Size (V), Mitra10 Proteksi (AB) per tanggal.'],['8. Unggah lewat tombol Unggah database. Data tanggal yang sama akan diganti. Satu file boleh berisi beberapa sheet.'],['Periode template ini: '+MON[m-1]+' '+y]]}}
function dlTpl(kinds){
  if(typeof XLSX==='undefined'){showMsg('Pustaka Excel belum termuat. Coba lagi sebentar.','err');return}
  const P=ckPeriod(), wb=XLSX.utils.book_new();
  kinds.forEach(k=>{const y=(k==='nav'||k==='detail')&&kinds.ly?P.y-1:P.y;const t=tplSheets(k,y,P.m);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(t.rows),t.name)});
  const g=tplGuide(P.y,P.m);XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(g.rows),g.name);
  XLSX.writeFile(wb,'template-'+(kinds.length>1?'semua':kinds[0])+'-'+P.y+'-'+pad2(P.m)+'.xlsx');
}
function renderCk(){
  if(!$('ckBtn')) return;
  const it=ckItems(), nOk=it.filter(x=>x.state==='ok').length, P=ckPeriod();
  const worst=it.some(x=>x.state==='bad')?'bad':it.some(x=>x.state==='warn')?'warn':'ok';
  $('ckBtn').className='ckbtn '+worst; $('ckBtn').innerHTML='<span class="ckdot"></span>Checklist database <b>'+nOk+'/'+it.length+'</b>';
  const ic={ok:'✓',warn:'!',bad:'✕'};
  $('ckList').innerHTML=it.map((x,i)=>'<li class="ckrow '+x.state+(CKOPEN[x.id]?' open':'')+'"><button type="button" class="ckhead" data-ck="'+x.id+'" aria-expanded="'+!!CKOPEN[x.id]+'"><span class="ckic">'+ic[x.state]+'</span><span class="cktx"><b>'+(i+1)+'. '+x.title+'</b><small>'+x.summary+'</small></span><span class="ckch">▾</span></button>'
    +'<div class="ckdet"><p>'+x.lines.map(l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('</p><p>')+'</p><p class="ckf">'+x.file+'</p><div class="ckacts">'+(canWrite?'<button type="button" class="ckchip" data-up="1">Unggah file</button>':'')+'<button type="button" class="ckchip" data-tpl="'+x.id+'">Unduh template</button></div></div></li>').join('');
  $('ckSub').textContent='Periode '+MON[P.m-1]+' '+P.y+', sampai '+dlab(P.ref)+' (mengikuti tanggal "Sampai")';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#ckBtn'); if(b){const o=$('ckPanel').hidden;$('ckPanel').hidden=!o;b.setAttribute('aria-expanded',String(o));return}
  const h=e.target.closest('.ckhead'); if(h){CKOPEN[h.dataset.ck]=!CKOPEN[h.dataset.ck];renderCk();return}
  const u=e.target.closest('[data-up]'); if(u){$('file').click();return}
  const t=e.target.closest('[data-tpl]'); if(t){const it=ckItems().find(x=>x.id===t.dataset.tpl);const k=it.tpl.slice();if(it.id==='ly')k.ly=true;dlTpl(k);return}
  if(e.target.closest('#ckAll')){dlTpl(['nav','detail','budget','phasing','kpi']);return}
  if(!e.target.closest('#ckPanel')&&$('ckPanel')&&!$('ckPanel').hidden){$('ckPanel').hidden=true;$('ckBtn').setAttribute('aria-expanded','false')}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('ckPanel')&&!$('ckPanel').hidden){$('ckPanel').hidden=true;$('ckBtn').focus()}});

$('upBtn').addEventListener('click',()=>$('file').click());
/* Penanda sedang diunggah: satu orang per waktu, kunci berlaku 10 menit dan diperpanjang selama proses */
let ME='', LOCKBUSY=null, lockTimer=null;
const LOCKMIN=10, tmx=iso=>new Date(iso).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}).replace('.',':');
function showLock(l){
  LOCKBUSY=l&&l.user_email!==ME?l:null;
  const bar=$('lockBar'); if(!bar) return;
  const mine=l&&l.user_email===ME;
  bar.hidden=!l; bar.className=mine?'lock mine':'lock';
  if(l) bar.textContent=mine?'Anda sedang mengunggah data…':'Sedang diunggah oleh '+l.user_email+' sejak '+tmx(l.started_at)+'. Tunggu selesai agar data tidak bentrok, lalu muat ulang halaman.';
  $('upBtn').disabled=!!LOCKBUSY; $('upBtn').title=LOCKBUSY?'Sedang diunggah oleh '+LOCKBUSY.user_email:'';
}
async function readLock(){
  if(!SB||window.__DEMO) return null;
  try{const {data}=await SB.from('store_upload_lock').select('user_email,started_at,expires_at').eq('store_code',STORE).maybeSingle();
    return data&&new Date(data.expires_at)>new Date()?data:null}catch(e){return null}
}
async function acquireLock(){
  if(!SB||window.__DEMO||!ME) return {ok:true};
  const exp=()=>new Date(Date.now()+LOCKMIN*60000).toISOString();
  try{
    await SB.from('store_upload_lock').delete().eq('store_code',STORE).lt('expires_at',new Date().toISOString());
    const {error}=await SB.from('store_upload_lock').insert({store_code:STORE,user_email:ME,expires_at:exp()});
    if(!error) return {ok:true};
    if(error.code==='23505'){
      const cur=await readLock();
      if(cur&&cur.user_email!==ME) return {ok:false,lock:cur};
      await SB.from('store_upload_lock').upsert({store_code:STORE,user_email:ME,started_at:new Date().toISOString(),expires_at:exp()},{onConflict:'store_code'});
    }
    return {ok:true};
  }catch(e){return {ok:true}}
}
const extendLock=async()=>{try{await SB.from('store_upload_lock').update({expires_at:new Date(Date.now()+LOCKMIN*60000).toISOString()}).eq('store_code',STORE).eq('user_email',ME)}catch(e){}};
async function releaseLock(){try{clearInterval(lockTimer);if(SB&&!window.__DEMO&&ME)await SB.from('store_upload_lock').delete().eq('store_code',STORE).eq('user_email',ME)}catch(e){}}
async function pollLock(){showLock(await readLock())}
setInterval(()=>{if(!document.hidden&&ME)pollLock()},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ME)pollLock()});
$('file').addEventListener('change',async e=>{
  const files=[...e.target.files]; e.target.value='';
  if(!files.length||!canWrite) return;
  if(!window.XLSX){showMsg('Pembaca Excel belum termuat. Muat ulang halaman lalu coba lagi.','err');return}
  const lk=await acquireLock();
  if(!lk.ok){showLock(lk.lock);showMsg('Sedang diunggah oleh '+lk.lock.user_email+' sejak '+tmx(lk.lock.started_at)+'. Tunggu selesai lalu coba lagi.','err');return}
  showLock({user_email:ME,started_at:new Date().toISOString()});
  lockTimer=setInterval(extendLock,60000);
  try{await doUpload(files)}finally{await releaseLock();pollLock()}
});
async function doUpload(files){
  showMsg('Membaca '+files.length+' file…','info');
  const ok=[],bad=[];
  for(const f of files){try{const r=await parseFile(f);ok.push(...r);r.skipped.forEach(x=>bad.push(f.name+' / '+x))}catch(err){bad.push(f.name+': '+explain(err))}}
  const parts=[];
  for(const r of ok){
    try{
      if(r.kind==='nav'){await upsertChunks('store_daily',r.rows,'store_code,sale_date');parts.push('Report Compare FFC dan NAV: '+r.rows.length+' hari')}
      else if(r.kind==='budget'){await upsertChunks('store_budget_monthly',r.rows,'store_code,year,month,category');parts.push('Budget '+r.year+': '+r.rows.length+' angka bulanan')}
      else if(r.kind==='kpibudget'){await upsertChunks('store_budget_kpi_daily',r.rows,'store_code,budget_date');parts.push('Budget traffic, invoice, basket, protection '+r.month+': '+r.rows.length+' hari')}
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
}

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
  const mobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent), budget=mobile?16e6:40e6;
  let sc=Math.max(1,Math.min(3,15000/h,15000/w,Math.sqrt(budget/(w*h))));
  for(;;){
    const cv=document.createElement('canvas'); cv.width=Math.round(w*sc); cv.height=Math.round(h*sc);
    const cx=cv.getContext('2d');
    if(cx){ cx.fillStyle='#ffffff'; cx.fillRect(0,0,cv.width,cv.height); cx.scale(sc,sc); cx.imageSmoothingQuality='high'; cx.drawImage(img,0,0);
      const blob=await new Promise(ok=>cv.toBlob(b=>ok(b),'image/png'));
      if(blob) return blob; }
    if(sc<=1) throw new Error('gagal membuat PNG');
    sc=Math.max(1,sc*0.7);
  }
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
$('tgShot').addEventListener('click',()=>runShot($('tgShot'),$('tgCard'),1900,'target-vs-actual-'+new Date().toISOString().slice(0,10)+'.png'));

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
  $('brKpi').innerHTML=t('Budget periode',b?fu(b):'–')+t('Actual',fu(a))+t('Achievement',pc==null?'–':`<span class="pill ${cl}">${dec(pc*100,1)}%</span>`)+t('Selisih vs budget',b?sel(a-b):'–')+t('Tahun lalu',l?fu(l):'–')+t('Growth vs tahun lalu',l?lyp(a,l):'–');
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
$('tg').addEventListener('click',e=>{const h=e.target.closest('th[data-tg]');if(h){tgSort(+h.dataset.tg);return}const r=e.target.closest('tr[data-cat]');if(r)openBrand(r.dataset.cat)});
$('tg').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const h=e.target.closest('th[data-tg]');if(h){e.preventDefault();tgSort(+h.dataset.tg);return}const r=e.target.closest('tr[data-cat]');if(r){e.preventDefault();openBrand(r.dataset.cat)}});

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

/* Kartu ringkasan interaktif: klik untuk rincian per hari */
function openSum(key){
  if(key==='ly'){openKpi('nav');return}
  const ctx=LASTTG; if(!ctx||!ctx.dates.length) return;
  const dates=ctx.dates.slice().sort(), first=dates[0], last=dates[dates.length-1], mk=last.slice(0,7);
  const Dm=new Map(DATA.D.map(r=>[r.d,r])), sx=d=>(Dm.get(d)||{sx:0}).sx, lysx=d=>(LYD.get(lyDate(d))||{sx:0}).sx;
  const dsum=(dim,val,d)=>sum(DIMD.filter(z=>z.d===d&&z.dim===dim&&z.v===val).map(z=>z.s));
  const t=(k,v)=>`<div class="tg-t"><span class="l">${k}</span><span class="v">${v}</span></div>`;
  const pct=(a,b)=>b?dec(a/b*100,1)+'%':'–', sel=v=>pil(v,fu(Math.abs(v))), gr=(a,l)=>l?pil((a/l-1)*100,dec(Math.abs(a/l-1)*100,1)+'%'):'–';
  const tbl=(head,rows,foot)=>`<div class="tbl brtbl"><table class="tgt"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody>${foot?`<tfoot>${foot}</tfoot>`:''}</table></div>`;
  const H=(a)=>a.map((x,i)=>`<th${i?' class="r"':''}>${x}</th>`).join(''), R=(d,c)=>`<tr><td>${hari(d)}, ${fdy(d)}</td>${c.map(x=>`<td class="r num">${x}</td>`).join('')}</tr>`, F=(l,c)=>`<tr><td>${l}</td>${c.map(x=>`<td class="r num">${x}</td>`).join('')}</tr>`;
  brCat='sum-'+key; $('brOv').hidden=false; document.body.style.overflow='hidden';
  let title='',period=fdy(first)+' – '+fdy(last)+' · '+dates.length+' hari',kpi='',body='';
  if(key==='ach'){
    title='Pencapaian vs budget periode';
    const B=sum(dates.map(d=>budgetDay(d))), A=sum(dates.map(sx)), L=sum(dates.map(lysx));
    kpi=t('Budget periode',fu(B))+t('Actual',fu(A))+t('Achievement',pct(A,B))+t(A>=B?'Lebih':'Kurang',fu(Math.abs(A-B)))+t('Tahun lalu',L?fu(L):'–')+t('Growth',gr(A,L));
    body=tbl(H(['Tanggal','Budget','Actual','Achievement','Selisih','Tahun lalu','Growth']),dates.map(d=>{const b=budgetDay(d),a=sx(d),l=lysx(d);return R(d,[fu(b),fu(a),pct(a,b),sel(a-b),l?fu(l):'–',gr(a,l)])}).join(''),F('Total',[fu(B),fu(A),pct(A,B),sel(A-B),L?fu(L):'–',gr(A,L)]));
  } else if(key==='tgt'){
    const y=+mk.slice(0,4), m=+mk.slice(5), dim=new Date(y,m,0).getDate(), all=[...Array(dim)].map((_,i)=>mk+'-'+pad2(i+1));
    title='Target '+MON[m-1]+' '+y+' per hari'; period=MON[m-1]+' '+y+' · '+dim+' hari · sales sampai '+fdy(last);
    const T=sum(all.map(d=>budgetDay(d))), M=sum(all.filter(d=>d<=last).map(sx)), left=all.filter(d=>d>last).length, need=left?Math.max(T-M,0)/left:0;
    kpi=t('Target bulan penuh',fu(T))+t('Tercapai s/d '+fd(last),fu(M))+t('Achievement bulan',pct(M,T))+t('Sisa target',M>=T?'Tercapai':fu(T-M))+t('Hari tersisa',left)+t('Butuh per hari',left&&M<T?fu(need):'–');
    let cb=0,ca=0;
    body=tbl(H(['Tanggal','Budget harian','Budget kumulatif','Actual','Actual kumulatif','Achievement kumulatif']),all.map(d=>{const b=budgetDay(d);cb+=b;const has=d<=last;if(has)ca+=sx(d);return R(d,[fu(b),fu(cb),has?fu(sx(d)):'–',has?fu(ca):'–',has?pct(ca,cb):'–'])}).join(''),F('Total',[fu(T),fu(T),fu(M),fu(M),pct(M,T)]));
  } else if(key==='pj'){
    title='Sales Project per hari';
    const A=sum(dates.map(d=>dsum('source','Sales Project',d))), N=sum(dates.map(sx)), B=sum(dates.map(d=>(KB.get(d)||{}).pj||0));
    kpi=t('Actual project',fu(A))+t('Kontribusi',pct(A,N))+t('Budget project',B?fu(B):'–')+t('Achievement',pct(A,B))+t(A>=B?'Lebih':'Kurang',B?fu(Math.abs(A-B)):'–')+t('Total sales',fu(N));
    body=tbl(H(['Tanggal','Actual project','Kontribusi','Budget project','Achievement','Selisih']),dates.map(d=>{const a=dsum('source','Sales Project',d),b=(KB.get(d)||{}).pj||0;return R(d,[fu(a),pct(a,sx(d)),b?fu(b):'–',pct(a,b),b?sel(a-b):'–'])}).join(''),F('Total',[fu(A),pct(A,N),B?fu(B):'–',pct(A,B),B?sel(A-B):'–']));
  } else if(key==='pb'){
    title='Private Brand per hari';
    const lyd=d=>dsum('typebrand','Private Brand',lyDate(d)), A=sum(dates.map(d=>dsum('typebrand','Private Brand',d))), L=sum(dates.map(lyd)), N=sum(dates.map(sx)), B=sum(dates.map(d=>(KB.get(d)||{}).pb||0));
    kpi=t('Actual Private Brand',fu(A))+t('Tahun lalu',L?fu(L):'–')+t('Growth',gr(A,L))+t('Kontribusi',pct(A,N))+t('Budget (file budget)',B?fu(B):'–')+t('Achievement budget',pct(A,B));
    body=tbl(H(['Tanggal','Actual','Tahun lalu','Selisih','Growth','Kontribusi','Budget','Achievement']),dates.map(d=>{const a=dsum('typebrand','Private Brand',d),l=lyd(d),b=(KB.get(d)||{}).pb||0;return R(d,[fu(a),l?fu(l):'–',l?sel(a-l):'–',gr(a,l),pct(a,sx(d)),b?fu(b):'–',pct(a,b)])}).join(''),F('Total',[fu(A),L?fu(L):'–',L?sel(A-L):'–',gr(A,L),pct(A,N),B?fu(B):'–',pct(A,B)]));
  } else return;
  $('brTitle').textContent=title; $('brPeriod').textContent=period; $('brKpi').innerHTML=kpi; $('brBody').innerHTML=body;
}
$('tg').addEventListener('click',e=>{const k=e.target.closest('[data-sum]');if(k)openSum(k.dataset.sum)});
$('tg').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const k=e.target.closest('[data-sum]');if(k){e.preventDefault();openSum(k.dataset.sum)}});
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


/* Urut kolom untuk tabel di popup dan tabel rincian: klik header (naik/turun/semula) */
const SVN=s=>{s=s.replace(/\s+/g,' ').trim();if(!s||s==='–'||s==='Baru'||s==='-')return null;
  if(/^[A-Za-z]{3}, \d/.test(s))return 'D';
  const m=s.replace(/^▲\s*/,'').replace(/^Rp\s*/,'').match(/^(−|-)?\s*(\d[\d.]*)(,\d+)?/);
  if(!m)return 'T';return (m[1]?-1:1)*parseFloat(m[2].replace(/\./g,'')+(m[3]?m[3].replace(',','.'):''))};
function sortTable(th){
  const tb=th.closest('table').tBodies[0];if(!tb)return;
  const ci=[...th.parentElement.children].indexOf(th), rows=[...tb.rows];
  rows.forEach((r,i)=>{if(r.dataset.oi==null)r.dataset.oi=i});
  const raw=rows.map(r=>r.cells[ci]?SVN(r.cells[ci].textContent):null);
  const date=raw.includes('D'), text=!date&&raw.includes('T');
  const first=text?1:(date?1:-1), cur=th.getAttribute('aria-sort');
  let dir=0;
  if(!cur)dir=first;else if((cur==='ascending')===(first===1))dir=-first;
  th.parentElement.querySelectorAll('th').forEach(x=>x.removeAttribute('aria-sort'));
  let arr;
  if(!dir)arr=rows.map(r=>[r,+r.dataset.oi]).sort((a,b)=>a[1]-b[1]);
  else{
    th.setAttribute('aria-sort',dir>0?'ascending':'descending');
    const key=rows.map((r,i)=>date?+r.dataset.oi:text?(r.cells[ci].textContent.trim()||null):(typeof raw[i]==='number'?raw[i]:null));
    arr=rows.map((r,i)=>[r,key[i]]).sort((a,b)=>{const p=a[1],q=b[1];
      if(p==null||q==null)return p==null&&q==null?a[0].dataset.oi-b[0].dataset.oi:p==null?1:-1;
      const c=text?p.localeCompare(q,'id',{numeric:true}):p-q;return c*dir||a[0].dataset.oi-b[0].dataset.oi});
  }
  arr.forEach(x=>tb.appendChild(x[0]));
}
document.addEventListener('click',e=>{const th=e.target.closest&&e.target.closest('table.tgt thead tr:not(.grp) th');if(th&&!th.dataset.tg)sortTable(th)});
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const th=e.target.closest&&e.target.closest('table.tgt thead tr:not(.grp) th');if(th&&!th.dataset.tg){e.preventDefault();sortTable(th)}});
let sortArm=false;
new MutationObserver(()=>{if(sortArm)return;sortArm=true;requestAnimationFrame(()=>{sortArm=false;
  document.querySelectorAll('table.tgt thead tr:not(.grp) th:not([data-tg]):not([tabindex])').forEach(th=>{th.tabIndex=0;th.title='Klik untuk mengurutkan'})})}).observe(document.body,{childList:true,subtree:true});

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
$('itShot').addEventListener('click',()=>runShot($('itShot'),$('itPanel'),1240,'item-'+String(itKey||'brand').toLowerCase().replace(/\W+/g,'-')+'.png',c=>{
  const rs=[...c.querySelectorAll('tbody tr')]; if(rs.length>30){rs.slice(30).forEach(r=>r.remove());const n=document.createElement('p');n.className='hint';n.style.margin='8px 0 0';n.textContent='30 item teratas dari '+rs.length+' item (urut dari penjualan tertinggi).';c.querySelector('.tbl').after(n)}}));

/* Laporan WhatsApp harian */
const BULAN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const en=n=>Math.round(n).toLocaleString('en-US');
const pc2=x=>(x*100).toFixed(2)+'%';
const gp2=(a,l)=>{if(!l)return '-';const g=(a/l-1)*100;return (g>=0?'+':'')+g.toFixed(2)+'%'};
const pad2=n=>String(n).padStart(2,'0');
let WAQ=null, WAM=0, WSP=null;
// Value inventory Class A: angka tetap (permanen)
const RGVAL={AP:853112424.18,BT:1777219291.35,BM:476637964.89,DW:250966869.14,EL:906010979.28,FW:1212636161.43,HW:95061808.9,HS:17249138.36,KC:283096061.84,PS:3792603075.41,PL:902919696.79,TL:311040361.83};
const RGK=['rgMr', 'rgMn', 'rgWt', 'rgDr', 'rgW10', 'rgP2', 'rgO2', 'rgRi', 'rgRk', 'rgRd', 'rgRs', 'rgRl', 'rgSa', 'rgS2'], RGINV=[["AP", "Appliances"], ["BT", "Bathroom"], ["BM", "Building Material"], ["DW", "Doors And Windows"], ["EL", "Electrical And Lighting"], ["FW", "Flooring And Wall"], ["HW", "Hardware"], ["HS", "Houseware & Hobbies"], ["KC", "Kitchen"], ["PS", "Paint And Sundries"], ["PL", "Plumbing"], ["TL", "Tools"]];
const CLK=['clTt','clIt','clBt','clSm','clWi','clPdd','clOt','clD0','clD1','clD2','clD3','clLate',...RGK];
const clVal=id=>{const e=$(id);if(id==='clLate'||id==='rgWt')return e.value.trim();return e.value===''?null:+e.value};
const WAK=[['waFfc','traffic_manual'],['waQt','prot_qty_t'],['waQa','prot_qty_a'],['waMt','member_t'],['waMa','member_a']];
let WAD=null, WAT=null;
function waVal(id){const v=$(id).value;return v===''?null:+v}
function buildWa(){
  const d=$('waDate').value, D=DATA.D, r=D.find(x=>x.d===d), kb=KB.get(d)||{};
  if(!d||!r){$('waText').value=$('clText').value='Belum ada data untuk tanggal ini. Unggah laporan lewat tombol Unggah.';return}
  const y=+d.slice(0,4), m=+d.slice(5,7), day=+d.slice(8);
  const tgt=budgetDay(d), act=r.sx, ly=LYD.get(lyDate(d)), lyS=ly?ly.sx:0;
  let mt=0; for(let i=1;i<=day;i++) mt+=budgetDay(y+'-'+pad2(m)+'-'+pad2(i));
  const mr=D.filter(x=>x.d.slice(0,7)===d.slice(0,7)&&x.d<=d), ma=sum(mr.map(x=>x.sx)), lm=sum(mr.map(x=>{const q=LYD.get(lyDate(x.d));return q?q.sx:0}));
  const man=waVal('waFfc'), v=x=>x==null?'-':en(x);
  const eF=r.cin?r.tr/r.cin:null, eM=man?r.tr/man:null;
  const L=[
    'Mitra10 Percetakan Negara',
    pad2(day)+' '+BULAN[m-1]+' '+y+' : '+($('waTime').value||'--:--'),
    '',
    'T/A : '+en(tgt)+' / '+en(act)+' / '+(tgt?pc2(act/tgt):'-'),
    'LY/ Growth : '+(lyS?en(lyS):'-')+' ( '+gp2(act,lyS)+' )',
    '',
    'MTD : '+en(mt)+' / '+en(ma)+' / '+(mt?pc2(ma/mt):'-'),
    'LY/Growth : '+(lm?en(lm):'-')+' ( '+gp2(ma,lm)+' )',
    '',
    'Bs Size : '+(r.tr?en(r.sx/r.tr):'-'),
    'Traffic Man/FFC : '+v(man)+' / '+en(r.cin),
    'Invoice : '+en(r.tr),
    'Effect. FFC : '+(eF==null?'-':pc2(eF)),
    'Effect. Manual : '+(eM==null?'-':pc2(eM)),
    '',
    'Mitra10 Protection',
    '・QTY T / A : '+v(waVal('waQt')!=null?waVal('waQt'):kb.pq)+' / '+v(waVal('waQa')),
    '・Member T / A : '+v(waVal('waMt'))+' / '+v(waVal('waMa')),
    '',
    'Alhamdulillah ya Allah',
    'Terimakasih Atas Nikmatmu Hari ini'
  ];
  $('waText').value=L.join('\n');
  buildCl();
}

function buildCl(){
  const d=$('waDate').value, D=DATA.D, r=D.find(x=>x.d===d); if(!d||!r) return;
  const y=+d.slice(0,4), m=+d.slice(5,7), day=+d.slice(8);
  const tgt=budgetDay(d), act=r.sx, ly=LYD.get(lyDate(d))||null, lyS=ly?ly.sx:0;
  let mt=0; for(let i=1;i<=day;i++) mt+=budgetDay(y+'-'+pad2(m)+'-'+pad2(i));
  const mr=D.filter(x=>x.d.slice(0,7)===d.slice(0,7)&&x.d<=d), ma=sum(mr.map(x=>x.sx)), lm=sum(mr.map(x=>{const q=LYD.get(lyDate(x.d));return q?q.sx:0}));
  const v=x=>x==null?'-':en(x), pr=x=>x==null?'-':pc2(x);
  const man=waVal('waFfc'), eF=r.cin?r.tr/r.cin:null, eM=man?r.tr/man:null;
  const dm=(dim,val)=>sum(DIMD.filter(z=>z.d===d&&z.dim===dim&&z.v===val).map(z=>z.s));
  const cont=x=>act?pc2(x/act):'-';
  const sm=clVal('clSm'), pb=dm('typebrand','Private Brand'), wa=dm('source','WhatsApp'), pj=dm('source','Sales Project');
  const pdd=clVal('clPdd'), ot=clVal('clOt'), ds=[clVal('clD0'),clVal('clD1'),clVal('clD2'),clVal('clD3')];
  const dsp=x=>x==null||!ot?'-':pc2(x/ot);
  const late=clVal('clLate');
  const kb=KB.get(d)||{}, lc=ly?ly.cin:0, lt=ly?ly.tr:0, mtt=clVal('clTt'), mit=clVal('clIt'), tt=mtt!=null?mtt:kb.tr, it=mit!=null?mit:kb.iv, bt=clVal('clBt')!=null?clVal('clBt'):kb.bs, pqt=waVal('waQt')!=null?waVal('waQt'):kb.pq;
  const eT=(mtt!=null||mit!=null)?(tt&&it!=null?it/tt:null):(kb.ef!=null?kb.ef:(tt&&it!=null?it/tt:null));
  const L=[
    'REPORT CLOSING','Mitra10 Percetakan Negara',
    pad2(day)+' '+BULAN[m-1]+' '+y+' : '+($('clTime').value||'--:--'),'',
    'T/A : '+en(tgt)+' / '+en(act)+' / '+(tgt?pc2(act/tgt):'-'),
    'LY/ Growth : '+(lyS?en(lyS):'-')+' ( '+gp2(act,lyS)+' )','',
    'MTD : '+en(mt)+' / '+en(ma)+' / '+(mt?pc2(ma/mt):'-'),
    'LY/Growth : '+(lm?en(lm):'-')+' ( '+gp2(ma,lm)+' )','',
    'Bs Size : '+(r.tr?en(act/r.tr):'-'),
    'Traffic Man/FFC : '+v(man)+' / '+en(r.cin),
    'Invoice : '+en(r.tr),
    'Effect. FFC : '+pr(eF),'Effect. Manual : '+pr(eM),'',
    'NEMS','New Member T/A : '+v(waVal('waMt'))+' / '+v(waVal('waMa')),
    'Sales Member : '+v(sm),'Sales Member Contr : '+(sm==null?'-':cont(sm)),'',
    'Sales PB','Actual ( Contribusi) : '+en(pb)+' ( '+cont(pb)+' )','',
    'Sales WhatsApp','Actual ( Contribusi) : '+en(wa)+' / '+cont(wa),'Total Invoice : '+v(clVal('clWi')),'',
    'Sales Project','Actual ( Contribusi) : '+en(pj)+' ( '+cont(pj)+' )','',
    'Report DSL','','PDD : '+v(pdd),'OT : '+v(ot)+' ( '+(pdd&&ot!=null?Math.round(ot/pdd*100)+'%':'-')+' )',
    'KETERANGAN LATE : '+(late?'\n'+late:''),'',
    'Contribusi :',
    'Sameday : '+v(ds[0])+' ( '+dsp(ds[0])+' )','Next day : '+v(ds[1])+' ( '+dsp(ds[1])+' )',
    '2 Days : '+v(ds[2])+' ( '+dsp(ds[2])+' )','>2 Days : '+v(ds[3])+' ( '+dsp(ds[3])+' )','',
    'Mitra10 Protection','QTY T/A/MTD : '+v(pqt)+' / '+v(waVal('waQa'))+' / '+(WAM>0?en(WAM):'-'),'',
    'Traffic','T/A/LY : '+v(tt)+' / '+en(r.cin)+' / '+(lc?en(lc):'-'),
    'Invoice','T/A/LY : '+v(it)+' / '+en(r.tr)+' / '+(lt?en(lt):'-'),
    'Effectivitas Traffic','T/A/LY : '+pr(eT)+' / '+pr(eF)+' / '+(lc?pc2(lt/lc):'-'),
    'Basket Size','T/A/LY : '+v(bt)+' / '+(r.tr?en(act/r.tr):'-')+' / '+(lt&&ly?en(lyS/lt):'-'),'',
    'Terima Kasih yaallah atas nikmatmu ya diberikan pada hari ini','Semoga Omset dihari berikut selalu tercapai'
  ];
  $('clText').value=L.join('\n');
  buildRg(r,d,act,ly);
}

/* Daily Report Closing Region 1 (tabel, bisa disalin sebagai gambar) */
function buildRg(r,d,act,ly){
  const y=+d.slice(0,4), m=+d.slice(5,7), day=+d.slice(8), bud=budgetDay(d), kb=KB.get(d)||{};
  const n2=x=>x==null||isNaN(x)?'-':x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}), n=x=>x==null||isNaN(x)?'-':en(x), p0=x=>x==null||!isFinite(x)?'-':Math.round(x*100)+'%', p2=x=>x==null||!isFinite(x)?'-':(x*100).toFixed(2)+'%';
  const g=(a,l)=>l?a/l-1:null, v=id=>clVal(id)!=null?clVal(id):(waVal(id)!=null?waVal(id):null);
  const lc=ly?ly.cin:0, lt=ly?ly.tr:0, lS=ly?ly.sx:0, eF=r.cin?r.tr/r.cin:null, eL=lc?lt/lc:null, bk=r.tr?act/r.tr:null, bkL=lt?lS/lt:null;
  const dm=(dim,val)=>sum(DIMD.filter(z=>z.d===d&&z.dim===dim&&z.v===val).map(z=>z.s));
  const T=(cls,h)=>'<table class="rgt '+cls+'">'+h+'</table>', th=(t,c,x)=>'<th'+(c?' colspan="'+c+'"':'')+(x?' class="'+x+'"':'')+'>'+t+'</th>', td=(t,x)=>'<td'+(x?' class="'+x+'"':'')+'>'+t+'</td>';
  const tag=t=>'<div class="rgtag">'+t+'</div>';
  const neg=x=>x!=null&&x<0?'rneg':'';
  const row=(a)=>'<tr>'+a+'</tr>';
  let h='<div class="rgtitle">DAILY REPORT CLOSING REGION 1</div><div class="rgdate">'+day+' '+MON[m-1]+' '+y+'</div>';
  // 1 TIEB
  const gS=g(act,lS), gT=g(r.cin,lc), gI=g(r.tr,lt), gE=g(eF,eL), gB=g(bk,bkL);
  const tieb=[bud?n(bud):'-',n(act),lS?n(lS):'-',p0(bud?act/bud:null),'<span class="'+neg(gS)+'">'+p2(gS)+'</span>',n(r.cin),n(lc),p2(gT),n(r.tr),n(lt),p2(gI),p2(eF),p2(eL),p2(gE),n(bk),n(bkL),'<span class="'+neg(gB)+'">'+p2(gB)+'</span>'];
  const cells=(c)=>c.map((x,i)=>td(x,'num'+(i===3?' acv':'')+(i===4?' gw':''))).join('');
  h+=tag('TIEB')+T('w1',row(th('Store',1,'st')+th('SALES',5)+th('TRAFFIC',3)+th('INVOICE',3)+th('E TRAFFIC',3)+th('BASKET SIZE',3))+row(th('')+['Budget','Actual','LY','ACV','GROWTH','ACT','LY','GRW','ACT','LY','GRW','ACT','LY','GRW','ACT','LY','GRW'].map(x=>th(x)).join(''))
    +row(td('PCN','store')+cells(tieb))+row(td('Total','tot')+cells(tieb).replace(/class="num/g,'class="tot num')));
  // 2 inventory
  const inv=RGINV.map(([k])=>RGVAL[k]), invT=sum(inv.map(x=>x||0)), anyInv=inv.some(x=>x!=null);
  h+=tag('VALUE INVENTORY CLASS A')+T('w2',row(th('STORE',1,'st')+th('VALUE INVENTORY CLASS A BY CATEGORY',12)+th('TOTAL INV CLASS A'))+row(th('')+RGINV.map(([k])=>th(k)).join('')+th(''))
    +row(td('PCN','store')+inv.map(x=>td(n2(x),'num')).join('')+td(anyInv?n2(invT):'-','num'))+row(td('TOTAL','tot')+inv.map(x=>td(n(x),'tot num')).join('')+td(anyInv?n(invT):'-','tot num')));
  // 3 service level
  const pd=clVal('clPdd'), ot=clVal('clOt'), p2d=v('rgP2'), o2d=v('rgO2');
  const rs=['rgRi','rgRk','rgRd','rgRs','rgRl'].map(i=>v(i)), rsT=sum(rs.map(x=>x||0));
  const dslc=[n(pd),n(ot),p2(pd&&ot!=null?ot/pd:null),n(p2d),n(o2d),p2(pd&&p2d!=null?p2d/pd:null),p2(p2d&&o2d!=null?o2d/p2d:null),...rs.map(n),rs.some(x=>x!=null)?n(rsT):'-'];
  const dc=c=>c.map((x,i)=>td(x,'num'+(i===2||i===5||i===6?' acv':''))).join('');
  h+='<div class="rgsp"></div>'+T('w3',row(th('STORE',1,'st')+th('TOTAL',3)+th('TWO DAYS DELIVERY (0-2 Hari)',4)+th('Reason keterlambatan',5)+th('Total'))+row(th('')+['PD','OT','Service level','PD','OT','CONT','Service level','Internal','Req kons','Dc','Supp','Lain 2',''].map(x=>th(x)).join(''))
    +row(td('PCN','store')+dc(dslc))+row(td('TOTAL','tot')+dc(dslc).replace(/class="num/g,'class="tot num')));
  // 4 project / member / waiting
  const pj=dm('source','Sales Project'), mr=v('rgMr'), mn=v('rgMn'), sm=clVal('clSm');
  const mem=[n(pj),p2(act?pj/act:null),n(mr),n(mn),p0(mr&&mn!=null?mn/mr:null),n(sm),p2(act&&sm!=null?sm/act:null),v('rgWt')||'-',n(v('rgDr')),n(v('rgW10'))];
  const mc=c=>c.map((x,i)=>td(x,'num'+(i===1||i===4||i===6?' acv':''))).join('');
  h+=tag('SALES PROJECT, MEMBER, WATING TIME')+T('w4',row(th('Store Name',1,'st')+th('Sales project',2)+th('MEMBER',5)+th('Waiting time',3))+row(th('')+['Actual Project','Contribusi','Member registrasi','New member transaksi','NEMS','Sales new member','Cont sales new member','Rata rata waktu tunggu','Total DR','> 10 MENIT'].map(x=>th(x)).join(''))
    +row(td('PCN','store')+mc(mem))+row(td('Total','tot')+mc(mem).replace(/class="num/g,'class="tot num')));
  // 5 protection
  const pa=waVal('waQa'), pb=waVal('waQt')!=null?waVal('waQt'):kb.pq;
  h+=tag('MITRA10 PROTECTION')+T('w5',row(th('Store Name',1,'st')+th('MITRA10 PROTECTION',3))+row(th('')+th('ACTUAL')+th('BUDGET')+th('MTD'))
    +row(td('PCN','store')+td(n(pa),'num')+td(n(pb),'num')+td(WAM>0?n(WAM):'-','num'))+row(td('','tot')+td(n(pa),'tot num')+td(n(pb),'tot num')+td(WAM>0?n(WAM):'-','tot num')));
  // 6 salper dan bathroom
  const sa=v('rgSa'), s2=v('rgS2'), bb=budgetDay(d,'BATHROOM'), bl=LYC.get(lyDate(d)+'|BATHROOM')||0, ba=sum(DATA.C.filter(c=>c[0]===d&&c[1]==='BATHROOM').map(c=>c[2])), gb=g(ba,bl);
  const sb=[n(sa),n(s2),p0(sa&&s2!=null?s2/sa:null),bb?n(bb):'-',bl?n(bl):'-',n(ba),p0(bb?ba/bb:null),'<span class="'+neg(gb)+'">'+(gb==null?'-':Math.round(gb*100)+'%')+'</span>'];
  const bc=c=>c.map((x,i)=>td(x,'num'+(i===6?' acv':''))).join('');
  h+=tag('SALPER JUALAN >2 CATEGORY &amp; SALES BATHROOM')+T('w6',row(th('STORE',1,'st')+th('SALPER JUALAN >2 CATEGORY',3)+th('SALES BATHROOM',5))+row(th('')+['ALL SALPER','SALPER >2 CAT','CTR >2 CAT','BUDGET','LAST YEARS','ACTUAL','ACV','GRW'].map(x=>th(x)).join(''))+row(td('PCN','store')+bc(sb)));
  $('rgView').innerHTML=h;
}

/* Salin tabel Region 1 agar bisa ditempel ke Excel (sel, warna, dan gabungan kolom ikut) */
function rgExcelParts(){
  const src=$('rgView'); if(!src.querySelector('table')) return null;
  const clone=src.cloneNode(true), so=[src,...src.querySelectorAll('*')], co=[clone,...clone.querySelectorAll('*')];
  const props=['background-color','color','font-weight','font-size','font-family','text-align','padding-top','padding-right','padding-bottom','padding-left','white-space','border-top','border-right','border-bottom','border-left'];
  so.forEach((o,i)=>{const d=co[i],cs=getComputedStyle(o);if(!d||!d.style)return;
    d.style.cssText=props.map(p=>{let v=cs.getPropertyValue(p);if(p.startsWith('border-')&&!v)v=['width','style','color'].map(k=>cs.getPropertyValue(p+'-'+k)).join(' ');return p+':'+v}).join(';')+';';
    if(o.tagName==='TABLE'){d.style.borderCollapse='collapse';d.style.width='auto'}});
  clone.querySelectorAll('table').forEach(t=>t.setAttribute('border','1'));
  clone.querySelectorAll('.rgsp').forEach(e=>e.replaceWith(document.createElement('br')));
  const html='<html><head><meta charset="utf-8"></head><body>'+clone.innerHTML.replace(/<table/g,'<br><table')+'</body></html>';
  const lines=[];
  src.querySelectorAll(':scope > *').forEach(el=>{
    if(el.tagName==='TABLE'){el.querySelectorAll('tr').forEach(tr=>{const r=[];tr.querySelectorAll('th,td').forEach(c=>{r.push(c.innerText.trim());for(let k=1;k<(+c.getAttribute('colspan')||1);k++)r.push('')});lines.push(r.join('\t'))});lines.push('')}
    else if(el.classList.contains('rgsp')) lines.push(''); else lines.push(el.innerText.trim());
  });
  return {html,text:lines.join('\n')};
}
$('rgExcel').addEventListener('click',async()=>{
  const b=$('rgExcel'), old=b.textContent, parts=rgExcelParts(); if(!parts){return}
  let msg='Tersalin. Tempel di Excel (Ctrl+V)';
  try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([parts.html],{type:'text/html'}),'text/plain':new Blob([parts.text],{type:'text/plain'})})])}
  catch(e){
    try{const r=document.createRange();r.selectNodeContents($('rgView'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);document.execCommand('copy');sel.removeAllRanges()}
    catch(e2){msg='Tidak bisa menyalin. Blok tabel lalu salin manual'}
  }
  b.textContent=msg; setTimeout(()=>{b.textContent=old},3000);
});
$('rgShot').addEventListener('click',()=>runShot($('rgShot'),$('rgView'),1500,'report-closing-region-'+$('waDate').value+'.png'));

async function saveWa(){
  if(!canWrite||!SB||!WAD) return;
  const row={store_code:STORE,report_date:WAD};WAK.forEach(([id,c])=>row[c]=waVal(id));
  row.extra={};CLK.forEach(id=>{row.extra[id]=clVal(id)});
  try{const {error}=await SB.from('store_report_manual').upsert(row,{onConflict:'store_code,report_date'});$('waMsg').textContent=error?'Gagal menyimpan kolom manual':'Kolom manual tersimpan'}catch(e){$('waMsg').textContent='Gagal menyimpan kolom manual'}
}
async function renderWa(){
  const D=DATA.D, inp=$('waDate');
  WAK.forEach(([id])=>{$(id).disabled=!canWrite});CLK.forEach(id=>{$(id).disabled=!canWrite});
  if(!$('clTime').value){const n=new Date();$('clTime').value='21:00'}
  if(!D.length){$('waText').value='Belum ada data. Unggah laporan lewat tombol Unggah.';return}
  const dates=D.map(r=>r.d).sort();
  inp.min=dates[0]; inp.max=dates[dates.length-1];
  if(!inp.value||!dates.includes(inp.value)) inp.value=dates[dates.length-1];
  if(!$('waTime').value){const n=new Date();$('waTime').value=pad2(n.getHours())+':'+pad2(n.getMinutes())}
  const d=inp.value;
  if(WAD!==d){
    WAD=d; WAK.forEach(([id])=>{$(id).value=''}); CLK.forEach(id=>{$(id).value=''}); $('waQa').placeholder='';
    if(SB){try{const {data:bq}=await SB.from('store_day_brand').select('sale_date,qty').eq('store_code',STORE).eq('master_brand','BCA').gte('sale_date',d.slice(0,8)+'01').lte('sale_date',d);
      const q=(bq||[]).filter(x=>x.sale_date===d).reduce((a,x)=>a+(+x.qty||0),0); WAQ=q>0?q:(DATA.C.some(c=>c[0]===d)?0:null); WAM=(bq||[]).reduce((a,x)=>a+(+x.qty||0),0)}catch(e){WAQ=null;WAM=0}}
    WSP=null;
    if(SB){try{const {data:sp}=await SB.rpc('salper_day_counts',{p_store:STORE,p_date:d});const x=Array.isArray(sp)?sp[0]:sp;if(WAD===d&&x&&x.all_salper>0)WSP=x}catch(e){}}
    if(SB){try{const {data}=await SB.from('store_report_manual').select('*').eq('store_code',STORE).eq('report_date',d).maybeSingle();
      if(WAD===d&&data){WAK.forEach(([id,c])=>{$(id).value=data[c]==null?'':data[c]});const ex=data.extra||{};CLK.forEach(id=>{$(id).value=ex[id]==null?'':ex[id]})}}catch(e){}}
  }
  if(WSP){$('rgSa').value=WSP.all_salper;$('rgS2').value=WSP.salper_gt2;$('rgSa').disabled=$('rgS2').disabled=true;$('rgSa').title=$('rgS2').title='Otomatis dari data penjualan salesperson harian'}else{$('rgSa').title=$('rgS2').title='Belum ada data salesperson tanggal ini, isi manual'}
  {const k=KB.get(d)||{},ph=(id,x)=>{$(id).placeholder=x!=null?'budget '+en(x):''};ph('waQt',k.pq);ph('clTt',k.tr);ph('clIt',k.iv);ph('clBt',k.bs)}
  if(WAQ!=null){$('waQa').value=WAQ;$('waQa').disabled=true;$('waQa').title='Otomatis dari Master Brand BCA'}else{$('waQa').title='Belum ada laporan detail tanggal ini';$('waQa').placeholder='belum ada data detail'}
  buildWa();
}
['waDate'].forEach(id=>$(id).addEventListener('change',()=>{renderWa()}));
$('waTime').addEventListener('input',buildWa);
WAK.forEach(([id])=>$(id).addEventListener('input',()=>{buildWa();clearTimeout(WAT);WAT=setTimeout(saveWa,700)}));
CLK.forEach(id=>$(id).addEventListener('input',()=>{buildCl();clearTimeout(WAT);WAT=setTimeout(saveWa,700)}));
$('clTime').addEventListener('input',buildCl);
$('clCopy').addEventListener('click',()=>copyTxt('clText','clMsg'));
$('clSend').addEventListener('click',()=>{window.open('https://wa.me/?text='+encodeURIComponent($('clText').value),'_blank','noopener')});
async function copyTxt(tid,mid){
  const t=$(tid).value, m=$(mid);
  try{await navigator.clipboard.writeText(t);m.textContent='Teks tersalin. Tempel di grup WhatsApp (Ctrl+V)'}
  catch(e){$(tid).select();try{document.execCommand('copy');m.textContent='Teks tersalin'}catch(e2){m.textContent='Tidak bisa menyalin, blok teks lalu salin manual'}}
  setTimeout(()=>{m.textContent=''},3500);
}
$('waCopy').addEventListener('click',()=>copyTxt('waText','waMsg'));
$('waSend').addEventListener('click',()=>{window.open('https://wa.me/?text='+encodeURIComponent($('waText').value),'_blank','noopener')});
$('brClose').addEventListener('click',closeBrand);
$('brOv').addEventListener('click',e=>{if(e.target===$('brOv'))closeBrand()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('itOv').hidden)closeItems();else if(!$('brOv').hidden)closeBrand()});
$('brShot').addEventListener('click',()=>runShot($('brShot'),$('brPanel'),1140,'brand-'+String(brCat||'kategori').toLowerCase().replace(/\W+/g,'-')+'.png'));
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
  WAD=null;
  const [d,c,b,p,dm,kb]=await Promise.all([
    fetchAll('store_daily','sale_date,nav_sales,nav_trx,ffc_sales,ffc_trx,counter_in,counter_out',['sale_date']),
    fetchAll('store_day_category','sale_date,category,sales',['sale_date','category']),
    fetchAll('store_budget_monthly','year,month,category,budget',['year','month']),
    fetchAll('store_budget_phasing','phase_date,pct',['phase_date']),
    fetchAll('store_day_dim','sale_date,dim,dim_value,sales',['sale_date','dim','dim_value']),
    fetchAll('store_budget_kpi_daily','budget_date,traffic,invoice,effect,basket,prot_qty,project,pb',['budget_date']).catch(()=>[])
  ]);
  KB=new Map();kb.forEach(r=>KB.set(r.budget_date,{tr:+r.traffic||null,iv:+r.invoice||null,ef:+r.effect||null,bs:+r.basket||null,pq:+r.prot_qty||null,pj:+r.project||null,pb:+r.pb||null}));
  DIMD=dm.map(r=>({d:r.sale_date,dim:r.dim,v:r.dim_value,s:+r.sales}));
  const DS=new Map();c.forEach(r=>DS.set(r.sale_date,(DS.get(r.sale_date)||0)+ +r.sales));
  const D=d.map(r=>({d:r.sale_date,sx:DS.has(r.sale_date)?Math.max(DS.get(r.sale_date),+r.nav_sales):+r.nav_sales,nav:+r.nav_sales,tr:+r.nav_trx,ffc:+r.ffc_sales,ffct:+r.ffc_trx,cin:+r.counter_in,cout:+r.counter_out}));
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
    ME=session.user.email||'';$('who-name').textContent=ME;$('who-role').textContent=roleRow.role;
    $('upbox').hidden=!canWrite;
    if(window.__DEMO){$('lnk-sp').hidden=true;$('logout').hidden=true;$('who-role').textContent='pratinjau';$('uphint').textContent='Pratinjau: unggahan tersimpan di browser ini saja.'}
    await loadData();pollLock();
    $('boot').hidden=true;$('app').hidden=false;
    const r=presetRange(DATA.D.length>31?'month':'all');setRange(r[0],r[1]);
    if(!DATA.D.length) showMsg(canWrite?'Belum ada data. Unggah Report Compare FFC and Nav dan Sales Detail Report.':'Belum ada data. Minta admin atau editor mengunggahnya.','info');
  }catch(err){
    bootMsg('Gagal memuat data: '+((err&&err.message)||err),true);
  }
})();
})();
