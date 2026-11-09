// Dashboard Pencapaian Salesperson, MITRA10 Percetakan Negara (10005)
const D = {store:'MITRA10 Percetakan Negara', code:'10005', days:{}, sched:null};
(function(){
const norm = s => String(s).replace(/\s+/g,' ').trim().toLowerCase();
const num = v => {
  if(typeof v==='number') return v;
  const s = String(v).trim().replace(/\s/g,'');
  if(!s) return 0;
  const n = Number(s.replace(/,/g,''));
  return isNaN(n) ? 0 : n;
};
const MON = {jan:1,feb:2,mar:3,apr:4,may:5,mei:5,jun:6,jul:7,aug:8,agu:8,agt:8,sep:9,oct:10,okt:10,nov:11,dec:12,des:12};
const pad = n => String(n).padStart(2,'0');
const ymd = (y,m,d) => { y=+y; if(y<100) y+=2000; m=+m; d=+d; if(m<1||m>12||d<1||d>31) return ''; return y+'-'+pad(m)+'-'+pad(d); };
const isoDate = v => {
  if(v instanceof Date && !isNaN(v)) return ymd(v.getFullYear(), v.getMonth()+1, v.getDate());
  if(typeof v==='number'){
    if(v>20000 && v<80000) return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
    return '';
  }
  const s = String(v).trim(); let m;
  if((m=/^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymd(m[1],m[2],m[3]);
  if((m=/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s))) return ymd(m[3],m[2],m[1]);
  if((m=/^(\d{1,2})[\- ]([A-Za-z]{3,})[\- ,]*(\d{2,4})/.exec(s))){ const mo=MON[m[2].slice(0,3).toLowerCase()]; return mo? ymd(m[3],mo,m[1]) : ''; }
  return '';
};
const hourOf = v => {
  if(typeof v==='number') return v<1 ? Math.min(23,Math.floor(v*24+1e-6)) : null;
  const m = /^(\d{1,2}):/.exec(String(v).trim());
  return m ? +m[1] : null;
};
const clean = n => {
  n = String(n).replace(/\s+/g,' ').trim();
  const w = n.split(' '), h = w.length/2;
  if(w.length%2===0 && w.slice(0,h).join(' ')===w.slice(h).join(' ')) n = w.slice(0,h).join(' ');
  return n;
};
const readRows = (XLSX, buf) => {
  const wb = XLSX.read(buf, {type:'array', raw:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  if(!ws) throw new Error('file kosong');
  return XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:''});
};

function parseReport(XLSX, buf, storeCode){
  const rows = readRows(XLSX, buf);
  let hi = -1;
  for(let i=0;i<Math.min(rows.length,30);i++){ if(rows[i].some(c=>norm(c)==='receipt date')){ hi=i; break; } }
  if(hi<0) throw new Error('baris judul kolom tidak ditemukan (harus ada kolom "Receipt Date")');
  const col = {};
  rows[hi].forEach((c,i)=>{ const k=norm(c); if(k && !(k in col)) col[k]=i; });
  const ALIAS = {'qty':['quantity'],'amount include sales':['amount inculde sales','amount incl sales'],'salescode id':['salesperson id'],'salescode name':['salesperson name'],'dicount amount':['discount amount','discount']};
  for(const k in ALIAS){ if(!(k in col)){ const f=ALIAS[k].find(x=>x in col); if(f) col[k]=col[f]; } }
  const need = ['receipt date','receipt no','qty','amount exclude sales','salescode id','salescode name'];
  const miss = need.filter(k=>!(k in col));
  if(miss.length) throw new Error('kolom tidak ada: '+miss.join(', '));
  const get = (r,k) => (k in col) ? r[col[k]] : '';
  const days = {};
  let skippedRows = 0, skippedStore = 0, used = 0;
  for(let i=hi+1;i<rows.length;i++){
    const r = rows[i];
    const date = isoDate(get(r,'receipt date'));
    if(!date){ if(r.some(c=>String(c).trim()!=='')) skippedRows++; continue; }
    const store = String(get(r,'store no')).trim();
    if(storeCode && store && store!==String(storeCode)){ skippedStore++; continue; }
    const d = days[date] || (days[date]={tot:0,rec:new Set(),lines:0,unS:0,unL:0,unRec:new Set(),people:{},hours:{},prot:{},mb:{}});
    const amt = num(get(r,'amount exclude sales')), inc = num(get(r,'amount include sales')), rn = String(get(r,'receipt no')).trim();
    let sid = String(get(r,'salescode id')).trim(); if(/^(null|none|nan|n\/a|-)$/i.test(sid)) sid='';
    d.tot += amt; d.rec.add(rn); d.lines++; used++;
    { const mbk=String(get(r,'master brand')).trim().toUpperCase()||'LAINNYA'; const mq=d.mb[mbk]||(d.mb[mbk]={q:0,s:0}); mq.q+=num(get(r,'qty')); mq.s+=amt; }
    if(/^bca$/i.test(String(get(r,'master brand')).trim())){
      const pk=sid||'-'; const pr=d.prot[pk]||(d.prot[pk]={id:sid,name:'',q:0,s:0});
      pr.q+=num(get(r,'qty')); pr.s+=amt;
      if(!pr.name && sid){ const nm0=clean(get(r,'salescode name')); if(nm0 && !/^(null|none|nan)$/i.test(nm0)) pr.name=nm0; }
    }
    const hr = hourOf(get(r,'time')); if(hr!==null) d.hours[hr] = (d.hours[hr]||0)+amt;
    if(!sid){ d.unS += amt; d.unL++; d.unRec.add(rn); continue; }
    const p = d.people[sid] || (d.people[sid]={id:sid,name:'',sales:0,incl:0,qty:0,rec:new Set(),lines:0,disc:0,cats:{},brands:{},pb:0,it:{}});
    if(!p.name){ const nm=clean(get(r,'salescode name')); if(nm && !/^(null|none|nan)$/i.test(nm)) p.name=nm; }
    p.sales += amt; p.incl += inc; p.qty += num(get(r,'qty'));
    p.rec.add(rn); p.lines++; p.disc += num(get(r,'dicount amount'));
    const cat = String(get(r,'category')).trim() || 'Lainnya';
    p.cats[cat] = (p.cats[cat]||0)+amt;
    const mb = String(get(r,'master brand')).trim().toUpperCase() || 'LAINNYA';
    p.brands[mb] = (p.brands[mb]||0)+amt;
    { const ino=String(get(r,'item no')).trim(), idesc=clean(get(r,'item name')), ik=ino||idesc; const ie=p.it[ik]||(p.it[ik]=[cat,mb,ino,idesc,0,0]); ie[4]+=num(get(r,'qty')); ie[5]+=amt; }
    if(/^private brand$/i.test(String(get(r,'master type brand')).trim())) p.pb += amt;
  }
  const out = {};
  for(const date in days){
    const d = days[date];
    out[date] = {
      basis:'excl2',
      meta:{total:Math.round(d.tot),receipts:d.rec.size,lines:d.lines,unSales:Math.round(d.unS),unLines:d.unL,unReceipts:d.unRec.size},
      people:Object.values(d.people).map(p=>{
        const nm = p.name || p.id;
        const cats = {}; for(const c in p.cats) cats[c]=Math.round(p.cats[c]);
        const brands = {}; for(const b in p.brands){ const v=Math.round(p.brands[b]); if(v) brands[b]=v; }
        return {id:p.id,name:nm,role:/KASIR/i.test(nm)?'Kasir':'Sales',sales:Math.round(p.sales),incl:Math.round(p.incl),qty:Math.round(p.qty),receipts:p.rec.size,lines:p.lines,disc:Math.round(p.disc),cats,brands,pb:Math.round(p.pb),it:Object.values(p.it).map(e=>[e[0],e[1],e[2],e[3],Math.round(e[4]*100)/100,Math.round(e[5])])};
      }),
      mb:Object.fromEntries(Object.entries(d.mb).map(([k,v])=>[k,{q:Math.round(v.q),s:Math.round(v.s)}])),
      prot:Object.values(d.prot).map(x=>({id:x.id,name:x.name||x.id,q:Math.round(x.q),s:Math.round(x.s)})),
      hours:Object.keys(d.hours).map(h=>({h:+h,sales:Math.round(d.hours[h])})).sort((a,b)=>a.h-b.h)
    };
  }
  return {days:out, used, skippedRows, skippedStore};
}

function parseSchedule(XLSX, buf){
  const rows = readRows(XLSX, buf);
  let hi = -1;
  for(let i=0;i<Math.min(rows.length,30);i++){
    if(rows[i].some(c=>norm(c)==='sales id') && rows[i].some(c=>norm(c)==='target/day')){ hi=i; break; }
  }
  if(hi<0) throw new Error('bukan file jadwal (butuh kolom "SALES ID" dan "TARGET/DAY")');
  const col = {};
  rows[hi].forEach((c,i)=>{ const k=norm(c); if(k && !(k in col)) col[k]=i; });
  const dcols = [];
  rows[hi].forEach((c,i)=>{ if(i>col['target/day']){ const d=isoDate(c); if(d) dcols.push([i,d]); } });
  if(!dcols.length) throw new Error('kolom tanggal jadwal tidak ditemukan');
  const g = (r,k) => (k in col) ? String(r[col[k]]).trim() : '';
  const seen = {}, people = [];
  for(let i=hi+1;i<rows.length;i++){
    const r = rows[i];
    const id = g(r,'sales id'); if(!id || seen[id]) continue; seen[id]=1;
    people.push({id, name:clean(g(r,'nama')), brand:g(r,'master brand'), cat:g(r,'category'), zona:g(r,'zonasi'),
      tpd:Math.round(num(r[col['target/day']])), tpm:Math.round(num(r[col['target/month']]||0)),
      c:dcols.map(([ci])=>String(r[ci]).trim().toUpperCase())});
  }
  if(!people.length) throw new Error('tidak ada baris jadwal');
  return {basis:'sched1', dates:dcols.map(x=>x[1]), people};
}
if(typeof module!=='undefined') module.exports = {parseReport, parseSchedule};

let P = [], M = {}, H = [], days = {}, dates = [];
const fmtN = new Intl.NumberFormat('id-ID');
const rp = v => 'Rp ' + fmtN.format(Math.round(v));
const jt = v => { const a=Math.abs(v); if(a>=1e9) return 'Rp '+(v/1e9).toFixed(2).replace('.',',')+' M'; if(a>=1e6) return 'Rp '+(v/1e6).toFixed(1).replace('.',',')+' jt'; if(a>=1e3) return 'Rp '+Math.round(v/1e3)+' rb'; return 'Rp '+Math.round(v); };
const pct = v => (v*100).toFixed(1).replace('.',',')+'%';
const title = s => s.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const fd = (d,o) => new Date(d+'T00:00:00').toLocaleDateString('id-ID',o||{day:'numeric',month:'long',year:'numeric'});
let SCH = {dates:[],people:[]}, SCHM = {}, curSel = [], lastL = [], lastHasT = false, lastSd = '', lastM = {}, lastDr = null;
const isWork = c => /^[SPM](?:[\/.].*)?$/.test(String(c||''));
// Salesperson yang sudah tidak di toko: tidak ditampilkan (tetap aman bila file jadwal di-upload ulang)
const RESIGNED = new Set(['S10005-0000000706','S10005-0000000517','S10005-0000000704']);
function setSched(s){
  SCH = s || {dates:[],people:[]}; SCHM = {};
  if(SCH.people && SCH.people.some(e=>RESIGNED.has(e.id))) SCH = Object.assign({},SCH,{people:SCH.people.filter(e=>!RESIGNED.has(e.id))});
  SCH.people.forEach(e=>{ const by={}; SCH.dates.forEach((d,i)=>{ by[d]=e.c[i]; }); const wdays=SCH.dates.filter((d,i)=>isWork(e.c[i])).length; SCHM[e.id]=Object.assign({},e,{by,wdays,tpe: e.tpd>0? e.tpd : (e.tpm>0? e.tpm/30 : 0)}); });
  const zs=[...new Set(SCH.people.map(e=>e.zona).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
  const sel=$('zona'); if(S.zona && !zs.includes(S.zona)) S.zona='';
  sel.innerHTML='<option value="">Semua zonasi</option>'+zs.map(z=>'<option value="'+esc(z)+'"'+(z===S.zona?' selected':'')+'>'+esc(z)+'</option>').join('');
  $('zona-wrap').hidden = !zs.length;
}
function targetOf(e,sel){
  let target=0, wd=0, cov=0;
  sel.forEach(d=>{ const c=e.by[d]; if(!c) return; cov++; if(isWork(c)){ target+=e.tpe; wd++; } });
  return {target:cov?target:null, wd, cov, code: sel.length===1 ? (e.by[sel[0]]||'') : ''};
}
function applyTargets(sel){
  curSel=sel;
  P.forEach(p=>{
    const e=SCHM[p.id];
    if(e){ Object.assign(p, targetOf(e,sel), {zona:e.zona, brand:e.brand, hasSch:true, tpe:e.tpe, wdays:e.wdays}); }
    else { p.target=null; p.wd=0; p.cov=0; p.code=''; p.zona=''; p.hasSch=false; }
  });
  const have=new Set(P.map(p=>p.id));
  Object.values(SCHM).forEach(e=>{
    if(have.has(e.id)) return;
    const t=targetOf(e,sel);
    if(t.target>0) P.push(Object.assign({id:e.id,name:e.name||e.id,role:'Sales',sales:0,qty:0,receipts:0,lines:0,disc:0,cats:{},cat:'',avg:0,zona:e.zona,brand:e.brand,hasSch:true,tpe:e.tpe,wdays:e.wdays},t));
  });
  P.sort((a,b)=>b.sales-a.sales); P.forEach((p,i)=>{ p.rank=i+1; });
}
function aggregate(from,to){
  const sel = dates.filter(d=>d>=from&&d<=to);
  const m = {total:0,receipts:0,lines:0,unSales:0,unLines:0,unReceipts:0,prot:{},protMiss:0,mb:{},mbMiss:0,days:sel.length,from:sel[0],to:sel[sel.length-1]};
  const map = {}, hrs = {};
  sel.forEach(d=>{ const x=days[d];
    for(const k of ['total','receipts','lines','unSales','unLines','unReceipts']) m[k]+=x.meta[k];
    x.hours.forEach(h=>{hrs[h.h]=(hrs[h.h]||0)+h.sales;});
    if(!x.mb) m.mbMiss++; else for(const k in x.mb){ const a=m.mb[k]||(m.mb[k]={q:0,s:0}); a.q+=x.mb[k].q; a.s+=x.mb[k].s; }
    if(!Array.isArray(x.prot)) m.protMiss++;
    else x.prot.forEach(q=>{ const k=q.id||'-'; const a=m.prot[k]||(m.prot[k]={id:q.id,name:q.name,q:0,s:0}); a.q+=q.q; a.s+=q.s; if(q.name) a.name=q.name; });
    x.people.forEach(p=>{
      if(RESIGNED.has(p.id)) return;
      const a = map[p.id] || (map[p.id]={id:p.id,name:p.name,role:p.role,sales:0,excl:0,qty:0,receipts:0,lines:0,disc:0,cats:{},brands:{},pb:0});
      for(const k of ['sales','excl','qty','receipts','lines','disc','pb']) a[k]+=(p[k]||0);
      for(const b in (p.brands||{})) a.brands[b]=(a.brands[b]||0)+p.brands[b];
      a.name=p.name; for(const c in p.cats) a.cats[c]=(a.cats[c]||0)+p.cats[c];
      if(Array.isArray(p.it)){ const im=a.it||(a.it={}); p.it.forEach(e=>{ const k=e[2]||e[3]; const t=im[k]||(im[k]=[e[0],e[1],e[2],e[3],0,0]); t[4]+=e[4]; t[5]+=e[5]; }); } else a.itMiss=(a.itMiss||0)+1;
    });
  });
  P = Object.values(map).map(a=>{ a.cat=Object.entries(a.cats).sort((x,y)=>y[1]-x[1])[0][0]; return a; }).sort((a,b)=>b.sales-a.sales);
  P.forEach((p,i)=>{ p.rank=i+1; p.avg=p.receipts?p.sales/p.receipts:0; });
  applyTargets(sel);
  M = m;
  H = Object.keys(hrs).map(h=>({h:+h,sales:hrs[h]})).sort((a,b)=>a.h-b.h);
}
function renderSub(){
  const r = M.days? (M.from===M.to? fd(M.from,{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : fd(M.from)+' sampai '+fd(M.to)+' ('+M.days+' hari)') : 'tidak ada data pada rentang ini';
  $('sub').textContent = D.store+' ('+D.code+') · '+r+' · nilai penjualan setelah diskon, tidak termasuk PPN';
}

const S = {dMode:'', dFrom:'', dTo:'', role:'all', zona:'', schDate:'', schSel:[], m:'sales', topn:15, q:'', sort:'sales', dir:-1};

const tip = $('tip');
function showTip(html,e){ tip.innerHTML=html; tip.style.opacity=1; const w=tip.offsetWidth,h=tip.offsetHeight; let x=e.clientX+14,y=e.clientY+14; if(x+w>innerWidth-8)x=e.clientX-w-14; if(y+h>innerHeight-8)y=e.clientY-h-14; tip.style.left=Math.max(8,x)+'px'; tip.style.top=Math.max(8,y)+'px'; }
function hideTip(){ tip.style.opacity=0; }
function tipHTML(p){
  let h='<b>'+esc(p.name)+'</b>Rank #'+p.rank+' dari '+P.length+'<br>Penjualan '+rp(p.sales)+' ('+pct(p.sales/(M.total||1))+' toko)<br>'+p.receipts+' struk · '+p.qty+' qty · '+p.lines+' baris item';
  if(p.lines) h+='<br>Basket size '+rp(p.avg);
  if(P.some(x=>x.disc>0)) h+='<br>Diskon '+rp(p.disc);
  if(p.cat) h+='<br>Kategori utama: '+esc(title(p.cat));
  if(p.hasSch){
    h+='<br>'+esc(p.zona||'-')+' · '+(p.cov? p.wd+' dari '+p.cov+' hari berjadwal kerja' : 'tidak ada jadwal pada periode ini');
    if(p.code) h+=' (jadwal: '+esc(p.code)+')';
    if(p.target>0) h+='<br>Target '+rp(p.target)+' ('+rp(p.tpe)+' × '+p.wd+' hari kerja) · pencapaian '+pct(p.sales/p.target)+' · selisih '+(p.sales-p.target>=0?'+':'-')+rp(Math.abs(p.sales-p.target));
    else if(p.target===0) h+='<br>Tidak ada target (tidak berjadwal kerja)';
  } else h+='<br>Tidak ada di file jadwal, tanpa target';
  return h;
}
const filtered = () => P.filter(p => (S.role==='all' || p.role===S.role) && (!S.zona || p.zona===S.zona));

function renderKPI(){
  const L = filtered(), A = L.filter(p=>p.lines>0), tot = A.reduce((a,p)=>a+p.sales,0);
  $('k-total').textContent = jt(M.total);
  $('k-total-d').textContent = rp(M.total)+' · '+(M.from&&M.to? (M.from===M.to? fd(M.from,{day:'numeric',month:'short'}) : fd(M.from,{day:'numeric',month:'short'})+' – '+fd(M.to,{day:'numeric',month:'short'}))+' · ' : '')+fmtN.format(M.receipts)+' struk';
  $('k-n').textContent = A.length;
  $('k-n-d').textContent = (S.role==='all'?'ada transaksi pada periode ini':'peran '+S.role)+(S.zona?' · '+S.zona:'')+(L.length>A.length?' · '+(L.length-A.length)+' terjadwal tanpa penjualan':'');
  $('k-avg').textContent = jt(tot/(A.length||1));
  const med = A.map(p=>p.sales).sort((a,b)=>a-b); const mid = med.length? (med.length%2? med[(med.length-1)/2] : (med[med.length/2-1]+med[med.length/2])/2):0;
  $('k-avg-d').textContent = 'median '+jt(mid);
  const top = L[0];
  $('k-top').textContent = top? top.name : '-';
  $('k-top-d').textContent = top? jt(top.sales)+' · '+top.lines+' baris item' : '';
  const T = L.filter(p=>p.target>0);
  if(T.length){
    const hit = T.filter(p=>p.sales>=p.target).length, st=T.reduce((a,p)=>a+p.sales,0), tt=T.reduce((a,p)=>a+p.target,0);
    $('k-t-l').textContent='Mencapai target';
    $('k-t').textContent = hit+' / '+T.length;
    $('k-t-d').textContent = 'Total '+pct(st/tt)+' dari target '+jt(tt);
    $('k-t-mw').hidden=false; $('k-t-mw').classList.toggle('full',hit===T.length); $('k-t-m').style.width=Math.round(hit/T.length*100)+'%';
  } else {
    const t10 = A.slice(0,10).reduce((a,p)=>a+p.sales,0);
    $('k-t-l').textContent='Konsentrasi 10 teratas'; $('k-t-mw').hidden=true;
    $('k-t').textContent = pct(t10/(tot||1));
    $('k-t-d').textContent = 'dari penjualan '+(S.role==='all'?'semua orang':S.role.toLowerCase());
  }
}

function renderRank(){
  const L = filtered().slice().sort((a,b)=>b[S.m]-a[S.m]).slice(0,S.topn);
  const key = S.m, mx = Math.max(1,...L.map(p=>p[key]));
  const useT = key==='sales' && L.some(p=>p.target>0);
  const dom = useT? Math.max(mx,...L.map(p=>(p.target||0)*1.05)) : mx;
  const lab = {sales:'penjualan',receipts:'jumlah struk',qty:'qty barang'}[key];
  $('rank-title').textContent = 'Peringkat '+lab;
  $('rank-hint').textContent = L.length+' orang ditampilkan'+(useT?' · garis putus-putus = target sesuai jadwal':'');
  $('rows').innerHTML = L.map(p=>{
    const w = Math.max(0,p[key]/dom*100);
    const v = key==='sales'? jt(p.sales) : fmtN.format(p[key]);
    const low = useT && p.target>0 && p.sales<p.target ? ' low':'';
    const tk = useT && p.target>0 ? '<i class="tick" style="left:'+(p.target/dom*100)+'%"></i>':'';
    return '<div class="row" tabindex="0" data-id="'+esc(p.id)+'"><div class="n" title="'+esc(p.name)+'"><b class="num">'+p.rank+'</b>'+esc(p.name)+'</div><div class="track"><div class="fill'+low+'" style="width:'+w+'%"></div>'+tk+'</div><div class="v num">'+v+'</div></div>';
  }).join('') || '<p class="note">Tidak ada data.</p>';
  $('legend').innerHTML = useT? '<span><i class="sw" style="background:var(--bar)"></i>Mencapai target atau tanpa target</span><span><i class="sw" style="background:var(--muted-bar)"></i>Belum mencapai</span>' : '';
  document.querySelectorAll('#rows .row').forEach(r=>{
    const p = P.find(x=>x.id===r.dataset.id);
    r.addEventListener('mousemove',e=>showTip(tipHTML(p),e));
    r.addEventListener('mouseleave',hideTip);
    r.addEventListener('focus',()=>{const b=r.getBoundingClientRect(); showTip(tipHTML(p),{clientX:b.left+40,clientY:b.bottom-10});});
    r.addEventListener('blur',hideTip);
  });
}

const ZLAB={'1':'Flooring and wall','2':'Bathroom & Plumbing','3':'App, Kitchen & Houseware, Electrical','4':'Building, Doors, Hardware','5':'Paint & sundries, Tools'};
function mppSummary(list){
  const zs=[...new Set(SCH.people.map(e=>e.zona).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
  const agg=l=>{ const n=l.length, s=l.reduce((a,p)=>a+p.sales,0), tg=l.reduce((a,p)=>a+p.target,0), rc=l.reduce((a,p)=>a+p.receipts,0), wd=l.reduce((a,p)=>a+(p.wd||0),0);
    const hi=l.filter(p=>p.sales/p.target>=1).length, lo=l.filter(p=>p.sales/p.target<.75).length, mid=n-hi-lo;
    return {n,hi,mid,lo,hiP:n?hi/n:0,midP:n?mid/n:0,loP:n?lo/n:0,ipd:wd?rc/wd:0,bz:rc?s/rc:0}; };
  const rows=zs.map(z=>{ const num=(z.match(/\d+/)||[''])[0]; const l=list.filter(p=>p.zona===z);
    const cats=[...new Set(SCH.people.filter(e=>e.zona===z).map(e=>title(e.cat||'')).filter(Boolean))];
    return Object.assign({z:num||z, zn:z, cat:ZLAB[num]||cats.join(', ')}, agg(l)); });
  return {rows, tot:agg(list)};
}
function mppTable(name,color,list,key){
  const {rows,tot}=mppSummary(list), pc=v=>Math.round(v*100)+'%', ip=v=>v?v.toFixed(2).replace('.',','):'0', bz=v=>v?fmtN.format(Math.round(v)):'0';
  const tr=r=>'<td class="num" data-b="all">'+r.n+'</td><td class="num '+(r.hi?'ok':'')+'" data-b="hi">'+r.hi+'</td><td class="num g" data-b="hi">'+pc(r.hiP)+'</td><td class="num" data-b="mid">'+r.mid+'</td><td class="num a" data-b="mid">'+pc(r.midP)+'</td><td class="num" data-b="lo">'+r.lo+'</td><td class="num r" data-b="lo">'+pc(r.loP)+'</td><td class="num">'+ip(r.ipd)+'</td><td class="num">'+bz(r.bz)+'</td>';
  return '<div class="mpp"><div class="mpph"><i style="background:'+color+'"></i>'+esc(name)+'</div><div class="scroll" style="max-height:none"><table class="mt"><thead><tr><th class="l">Zona</th><th class="l">Category</th><th>Actual MPP</th><th>Salper ≥100%</th><th>Cont</th><th>Salper 75–99%</th><th>Cont</th><th>Salper &lt;75%</th><th>Cont</th><th>IPD</th><th>BZ</th></tr></thead><tbody>'+
    rows.map(r=>'<tr class="mpp-r" tabindex="0" data-set="'+key+'" data-z="'+esc(r.zn)+'" data-lbl="'+esc('Zona '+r.z+' · '+r.cat)+'" title="Klik untuk melihat daftar salesperson"><td class="l">'+esc(r.z)+'</td><td class="l cat">'+esc(r.cat)+'</td>'+tr(r)+'</tr>').join('')+
    '<tr class="tot mpp-r" tabindex="0" data-set="'+key+'" data-z="" data-lbl="Semua zona" title="Klik untuk melihat daftar salesperson"><td class="l" colspan="2">Total</td>'+tr(tot)+'</tr></tbody></table></div></div>';
}
function renderMPP(){
  const body=$('mpp-body');
  if(!SCH.people.length){ body.innerHTML='<p class="note">Unggah file jadwal &amp; target untuk menampilkan summary ini.</p>'; $('mpp-sub').textContent=''; $('mpp-note').textContent=''; return; }
  const mem=P.filter(p=>p.hasSch && p.target>0);
  $('mpp-sub').textContent = (M.days? (M.days===1? 'Daily · '+fd(M.from,{day:'numeric',month:'short',year:'numeric'}) : fd(M.from,{day:'numeric',month:'short'})+' sampai '+fd(M.to,{day:'numeric',month:'short',year:'numeric'})+' · '+M.days+' hari') : 'tidak ada data')+' · berdasarkan achievement penjualan';
  body.innerHTML = mppTable('Summary all salesperson, all staff (PB & eksternal)','#f0a500',mem,'all')+mppTable('Summary all salesperson, Private Brand only','#2a9de0',mem.filter(p=>String(p.brand||'').toUpperCase()==='PRIVATE BRAND'),'pb');
  }

const COLS = [
  ['rank','#'],['id','Sales ID'],['name','Salesperson'],['zona','Zonasi'],['code','Jadwal'],['cat','Kategori utama'],['mbrand','Master brand'],['sales','Penjualan'],['brand','Penjualan master brand'],['nonbrand','Penjualan non master brand'],['target','Target'],['ach','Pencapaian'],['wd','Hari kerja'],['share','% total'],['receipts','Struk'],['avg','Basket Size']
];
const TXT = new Set(['id','name','cat','zona','code','mbrand']);
const CODE_ORDER = ['S','P','M','P/JKP','P.JKP','S/JKS','S.JKS','OFF','CT','L','MT','OT','OUTING'];
const codeOn = (id,d) => { const e=SCHM[id]; return e? (e.by[d]||'') : ''; };
function schDate(){ const d = S.schDate || M.to; return SCH.dates.includes(d)? d : (SCH.dates[0]||''); }
function schMatch(code){ if(!S.schSel.length) return true; if(!code) return false; return S.schSel.some(v=>v==='WORK'? isWork(code) : code===v); }
const schLabel=()=>S.schSel.map(v=>v==='WORK'?'masuk kerja':v).join(' + ');
function brandSales(p){ if(!p.brand) return -1; const k=String(p.brand).toUpperCase(); return k==='PRIVATE BRAND' ? (p.pb||0) : ((p.brands&&p.brands[k])||0); }
function nonBrand(p){ const b=brandSales(p); return b<0? -1 : Math.max(0,p.sales-b); }
function brandTip(p){ const e=Object.entries(p.brands||{}).sort((a,b)=>b[1]-a[1]); if(!e.length) return 'Belum ada rincian master brand'; return 'Master brand yang dijual: '+e.slice(0,8).map(x=>title(x[0])+' '+rp(x[1])).join(' · ')+(e.length>8?' · +'+(e.length-8)+' lainnya':''); }
const shortD = d => d? fd(d,{day:'numeric',month:'short'}) : '';
function ghost(e){
  return Object.assign({id:e.id,name:e.name||e.id,role:'Sales',sales:0,qty:0,receipts:0,lines:0,disc:0,cats:{},cat:'',avg:0,zona:e.zona,brand:e.brand,hasSch:true,rank:null,tpe:e.tpe,wdays:e.wdays}, targetOf(e,curSel));
}
function renderSchFilter(){
  const box=$('schf');
  if(!SCH.people.length){ box.hidden=true; return; }
  box.hidden=false;
  const d=schDate(), di=$('sch-date');
  di.min=SCH.dates[0]; di.max=SCH.dates[SCH.dates.length-1]; di.value=d;
  $('sch-follow').hidden=!S.schDate;
  const base=SCH.people.filter(e=>!S.zona||e.zona===S.zona);
  const cnt={}; base.forEach(e=>{ const i=SCH.dates.indexOf(d); const c=i>=0? e.c[i] : ''; if(c) cnt[c]=(cnt[c]||0)+1; });
  const codes=Object.keys(cnt).sort((a,b)=>{ const x=CODE_ORDER.indexOf(a), y=CODE_ORDER.indexOf(b); return (x<0?99:x)-(y<0?99:y) || a.localeCompare(b); });
  const work=codes.filter(isWork).reduce((a,c)=>a+cnt[c],0);
  S.schSel=S.schSel.filter(v=>v==='WORK'||cnt[v]);
  const chip=(v,l,n)=>'<button type="button" class="chip2" data-sc="'+esc(v)+'" aria-pressed="'+(v===''?!S.schSel.length:S.schSel.includes(v))+'">'+esc(l)+' <b class="num">'+n+'</b></button>';
  $('sch-chips').innerHTML = chip('','Semua',base.length)+chip('WORK','Masuk kerja',work)+codes.map(c=>chip(c,c,cnt[c])).join('');
}
function detailRange(){
  if(!dates.length || !S.dMode) return null;
  const first=dates[0], last=dates[dates.length-1], cl=d=>d<first?first:d>last?last:d;
  if(S.dMode==='mtd'){ const to=cl(dT.value||last); const ms=to.slice(0,8)+'01'; return {from:ms<first?first:ms, to}; }
  let a=cl(S.dFrom||first), b=cl(S.dTo||last); if(a>b){ const x=a; a=b; b=x; } return {from:a,to:b};
}
function renderTable(){
  const dr=detailRange(); let saved=null;
  if(dr){ saved={P,M,H,curSel}; aggregate(dr.from,dr.to); }
  try{ renderTableInner(dr); }
  finally{ if(saved){ P=saved.P; M=saved.M; H=saved.H; curSel=saved.curSel; } }
}
function syncRange(dr){
  const a=dr?dr.from:dF.value, b=dr?dr.to:dT.value;
  [$('t-from'),$('t-to')].forEach(el=>{ el.min=dates[0]||''; el.max=dates[dates.length-1]||''; });
  $('t-from').value=a||''; $('t-to').value=b||'';
  $('t-mtd').setAttribute('aria-pressed',String(S.dMode==='mtd'));
  $('t-follow').setAttribute('aria-pressed',String(!S.dMode));
}
function renderTableInner(dr){
  lastM=M; lastDr=dr; syncRange(dr);
  const hasT = P.some(p=>p.hasSch);
  renderSchFilter();
  const cols = COLS.filter(c=>hasT || !['zona','code','wd','mbrand','brand','nonbrand','target','ach'].includes(c[0]));
  const sd = schDate();
  $('thead').innerHTML = cols.map(c=>{
    const act = S.sort===c[0];
    const label = c[0]==='code' ? 'Jadwal '+shortD(sd) : c[1];
    return '<th scope="col" class="'+(TXT.has(c[0])?'l':'')+'"'+(act?' aria-sort="'+(S.dir<0?'descending':'ascending')+'"':'')+'><button type="button" data-s="'+c[0]+'">'+label+(act?(S.dir<0?' ↓':' ↑'):'')+'</button></th>';
  }).join('');
  const q = S.q.trim().toLowerCase();
  let base = filtered();
  if(S.schSel.length){
    const have=new Set(base.map(p=>p.id));
    Object.values(SCHM).forEach(e=>{ if(!have.has(e.id) && (S.role!=='Kasir') && (!S.zona||e.zona===S.zona) && !P.some(p=>p.id===e.id)) base.push(ghost(e)); });
    base = base.filter(p=>schMatch(codeOn(p.id,sd)));
  }
  const ratio = p => p.target>0 ? p.sales/p.target : -1;
  const val = (p,k)=> k==='share'?p.sales : k==='brand'?brandSales(p) : k==='nonbrand'?nonBrand(p) : k==='mbrand'?String(p.brand||'').toLowerCase() : k==='id'?String(p.id||'').toLowerCase() : k==='ach'?ratio(p) : k==='target'?(p.target==null?-1:p.target) : k==='code'?codeOn(p.id,sd) : k==='rank'?(p.rank==null?1e9:p.rank) : TXT.has(k)?String(p[k]||'').toLowerCase() : p[k];
  const L = base.filter(p=>!q||p.name.toLowerCase().includes(q)).sort((a,b)=>{
    const x=val(a,S.sort), y=val(b,S.sort); return (x<y?-1:x>y?1:0)*S.dir; });
  const mx = Math.max(1,...P.map(p=>p.sales));
  lastL=L; lastHasT=hasT; lastSd=sd;
  rowMap=Object.fromEntries(L.map(p=>[p.id,p])); popPer=M.days? (M.from===M.to? shortD(M.from) : shortD(M.from)+' – '+shortD(M.to)) : '';
  $('tbody').innerHTML = L.map(p=>{
    const a=ratio(p), cd=codeOn(p.id,sd);
    let t='<tr data-id="'+esc(p.id)+'" tabindex="0"><td class="rk num">'+(p.rank==null?'–':p.rank)+'</td><td class="l" style="font-size:12px;color:var(--ink2);white-space:nowrap">'+esc(p.id)+'</td><td class="l">'+esc(p.name)+(p.role==='Kasir'?'<span class="chip">Kasir</span>':'')+'</td>'+(hasT?'<td class="l">'+(p.zona?esc(p.zona):'–')+'</td><td class="l">'+(cd?esc(cd):'–')+'</td>':'')+'<td class="l">'+(p.cat?esc(title(p.cat)):'–')+'</td>'+(hasT?'<td class="l">'+(p.brand?esc(title(p.brand)):'–')+'</td>':'')+
      '<td class="num"><div class="cell"><span class="mini"><i style="width:'+Math.max(0,p.sales/mx*100)+'%"></i></span><span style="min-width:100px;display:inline-block;text-align:right">'+rp(p.sales)+'</span></div></td>'+(hasT?'<td class="num" title="'+esc(brandTip(p))+'">'+(p.brand?rp(brandSales(p))+'<span class="bn">'+esc(title(p.brand))+'</span>':'–')+'</td><td class="num">'+(p.brand?rp(nonBrand(p)):'–')+'</td>':'');
    if(hasT){
      t+='<td class="num">'+(p.target==null?'–':p.target===0?'<span style="color:var(--ink3)">tidak ada</span>':rp(p.target))+'</td>'+
        '<td class="num">'+(p.target>0? '<span class="pill '+(a>=1?'hi':a>=.75?'mid':'lo')+'">'+(a>=1?'✓ ':'')+Math.round(a*100)+'%</span>' : '–')+'</td>'+
        '<td class="num">'+(p.hasSch&&p.cov? p.wd : '–')+'</td>';
    }
    t+='<td class="num">'+pct(p.sales/(M.total||1))+'</td><td class="num">'+p.receipts+'</td><td class="num">'+(p.lines?rp(p.avg):'–')+'</td>';
    return t+'</tr>';
  }).join('') || '<tr><td colspan="16" style="text-align:center;color:var(--ink3)">Tidak ada orang yang cocok dengan filter.</td></tr>';
  $('tbl-hint').textContent = L.length+' orang'+(dr? ' · '+(S.dMode==='mtd'?'MTD ':'')+shortD(dr.from)+(dr.to!==dr.from?' sampai '+fd(dr.to,{day:'numeric',month:'short',year:'numeric'}):'')+' ('+M.days+' hari)' : '')+(S.schSel.length? ' · jadwal '+schLabel()+' pada '+shortD(sd) : '')+' · klik judul kolom untuk mengurutkan';
  $('thead').querySelectorAll('button').forEach(bt=>bt.addEventListener('click',()=>{
    const k=bt.dataset.s; if(S.sort===k) S.dir*=-1; else {S.sort=k; S.dir=TXT.has(k)?1:-1;} renderTable(); }));
}
$('sch-chips').addEventListener('click',e=>{
  const b=e.target.closest('[data-sc]'); if(!b) return;
  const v=b.dataset.sc;
  if(v==='') S.schSel=[]; else S.schSel = S.schSel.includes(v)? S.schSel.filter(x=>x!==v) : S.schSel.concat(v);
  renderTable();
  const nb=document.querySelector('#sch-chips [data-sc="'+CSS.escape(v)+'"]'); if(nb) nb.focus();
});
$('t-from').addEventListener('change',e=>{ if(!e.target.value) return; if(S.dMode!=='custom'){ S.dTo=$('t-to').value; } S.dMode='custom'; S.dFrom=e.target.value; renderTable(); });
$('t-to').addEventListener('change',e=>{ if(!e.target.value) return; if(S.dMode!=='custom'){ S.dFrom=$('t-from').value; } S.dMode='custom'; S.dTo=e.target.value; renderTable(); });
$('t-mtd').addEventListener('click',()=>{ S.dMode = S.dMode==='mtd' ? '' : 'mtd'; renderTable(); });
$('t-follow').addEventListener('click',()=>{ S.dMode=''; renderTable(); });
$('sch-date').addEventListener('change',e=>{ if(e.target.value) S.schDate=e.target.value; renderTable(); });
$('sch-follow').addEventListener('click',()=>{ S.schDate=''; renderTable(); });

function renderFoot(){ return; // catatan data disembunyikan
  const noSch = P.filter(p=>p.lines>0 && !p.hasSch).length;
  $('foot').innerHTML = '<b>Catatan data.</b> '+fmtN.format(M.unLines)+' baris item ('+fmtN.format(M.unReceipts)+' struk, '+rp(M.unSales)+', '+pct(M.unSales/(M.total||1))+' dari total) tidak memiliki kode sales, jadi tidak masuk peringkat tetapi tetap dihitung di total toko. Nilai penjualan memakai kolom Amount Exclude Sales. Penjualan master brand adalah jumlah penjualan barang (rincian item) yang dijual salesperson itu dan masuk master brand yang tertulis di file jadwal; untuk Private Brand dipakai penanda Master Type Brand = Private Brand. Satu orang bisa muncul di beberapa struk yang sama dengan orang lain, sehingga jumlah struk per orang tidak dijumlahkan ke total. '+
   '<b>Target.</b> Target harian diambil dari kolom TARGET/DAY di file jadwal, dicocokkan lewat Sales ID. Target MTD atau target satu rentang tanggal adalah target harian dikali jumlah hari kerja yang sudah berjalan dalam rentang itu. Hari kerja adalah tanggal berkode S, P, atau M (termasuk P/JKP dan S/JKS). Kode OFF, CT, L, MT, OT, dan OUTING tidak punya target. Hari setelah tanggal akhir rentang belum dihitung. Penjualan di hari tanpa target tetap dihitung sebagai penjualan.'+(noSch?' '+noSch+' orang bertransaksi tetapi tidak ada di file jadwal, jadi ditampilkan tanpa target.':'');
}

let rowMap={}, popPer='', popLast=null;
function closePop(){ const o=$('pop'); if(o.hidden) return; o.hidden=true; document.documentElement.style.overflow=''; if(popLast&&popLast.focus) popLast.focus(); }
function openPerson(p, from){
  popLast=from||null;
  $('pop-id').textContent=p.id; $('pop-name').textContent=p.name; $('pop-name2').textContent=p.name; $('pop-zona').textContent=p.zona||'–'; $('pop-val').textContent=rp(p.sales);
  $('pop-per').textContent=(popPer?popPer+' · ':'')+'sales exclude PPN';
  const items=Object.values(p.it||{}).sort((a,b)=>b[5]-a[5]);
  const tq=items.reduce((s,e)=>s+e[4],0), ts=items.reduce((s,e)=>s+e[5],0);
  const body=$('pop-body');
  if(!items.length) body.innerHTML='<p class="note" style="padding:14px 4px">'+(p.sales>0?'Detail item belum tersimpan untuk orang ini.':'Belum ada penjualan pada rentang ini.')+'</p>';
  else body.innerHTML='<table class="pt"><thead><tr><th>Category</th><th>Master brand</th><th>No Item</th><th>Deskripsi</th><th class="rt">Qty</th><th class="rt">Total value</th></tr></thead><tbody>'+items.map(e=>'<tr><td>'+esc(title(e[0]))+'</td><td>'+esc(title(e[1]))+'</td><td class="num">'+esc(e[2])+'</td><td>'+esc(e[3])+'</td><td class="num rt">'+fmtN.format(e[4])+'</td><td class="num rt">'+rp(e[5])+'</td></tr>').join('')+'</tbody><tfoot><tr><td colspan="4">Total · '+items.length+' item</td><td class="num rt">'+fmtN.format(tq)+'</td><td class="num rt">'+rp(ts)+'</td></tr></tfoot></table>';
  const n=$('pop-note'); n.hidden=!p.itMiss; n.textContent=p.itMiss? p.itMiss+' tanggal belum memuat detail item. Unggah ulang laporan tanggal tersebut agar daftar item lengkap.':'';
  const o=$('pop'); o.hidden=false; document.documentElement.style.overflow='hidden'; $('pop-x').focus(); $('pop-body').scrollTop=0;
}
$('pop-x').addEventListener('click',closePop);
$('pop').addEventListener('click',e=>{ if(e.target===$('pop')) closePop(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closePop(); });
$('tbody').addEventListener('click',e=>{ const tr=e.target.closest('tr[data-id]'); if(!tr||e.target.closest('button,a')) return; const p=rowMap[tr.dataset.id]; if(p) openPerson(p,tr); });
$('tbody').addEventListener('keydown',e=>{ if(e.key!=='Enter') return; const tr=e.target.closest('tr[data-id]'); if(!tr) return; const p=rowMap[tr.dataset.id]; if(p) openPerson(p,tr); });
/* ---- Kartu ringkasan interaktif: klik untuk rincian ---- */
let kLast=null;
function closeK(){ const o=$('kpop'); if(!o||o.hidden) return; o.hidden=true; document.documentElement.style.overflow=''; if(kLast&&kLast.focus) kLast.focus(); }
function kShow(ttl,info,html,from){
  kLast=from||null; $('kpop-t').textContent=ttl;
  $('kpop-per').textContent=M.days? (M.from===M.to? fd(M.from,{day:'numeric',month:'long',year:'numeric'}) : fd(M.from,{day:'numeric',month:'short'})+' sampai '+fd(M.to,{day:'numeric',month:'short',year:'numeric'})+' ('+M.days+' hari)')+' · sales exclude PPN' : 'Tidak ada data pada rentang ini';
  $('kpop-info').innerHTML=info.map(i=>'<div><span>'+esc(i[0])+'</span><b>'+esc(i[1])+'</b></div>').join('');
  $('kpop-body').innerHTML=html; $('kpop').hidden=false; document.documentElement.style.overflow='hidden'; $('kpop-x').focus(); $('kpop-body').scrollTop=0;
}
const kRow=(p,cells,cls)=>'<tr data-pid="'+esc(p.id)+'" tabindex="0"'+(cls?' class="'+cls+'"':'')+'>'+cells.join('')+'</tr>';
const kTbl=(head,rows)=>'<table class="pt"><thead><tr>'+head.map(h=>'<th'+(h[1]?' class="rt"':'')+'>'+h[0]+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>';
const kNum=v=>'<td class="num rt">'+v+'</td>';
function openK(k, el){
  const L=filtered(), A=L.filter(p=>p.lines>0), tot=A.reduce((a,p)=>a+p.sales,0);
  if(k==='total'){
    const sel=dates.filter(d=>d>=M.from&&d<=M.to), mx=Math.max(1,...sel.map(d=>days[d].meta.total));
    const rows=sel.map(d=>{ const x=days[d], t=x.meta.total, r=x.meta.receipts;
      return '<tr><td>'+esc(fd(d,{weekday:'short',day:'numeric',month:'short'}))+'</td>'+kNum(rp(t))+kNum(fmtN.format(r))+kNum(rp(r?t/r:0))+kNum(x.people.length)+'<td style="width:140px"><span class="bar" style="width:'+Math.round(t/mx*100)+'%"></span></td></tr>'; });
    kShow('Total penjualan per tanggal',[['Total penjualan',rp(M.total)],['Struk',fmtN.format(M.receipts)],['Basket size',rp(M.receipts?M.total/M.receipts:0)],['Rata-rata per hari',rp(M.days?M.total/M.days:0)]],
      sel.length? kTbl([['Tanggal'],['Penjualan',1],['Struk',1],['Basket size',1],['Orang aktif',1],['']],rows) : '<p class="note" style="padding:14px 4px">Belum ada data pada rentang ini.</p>',el);
  } else if(k==='aktif'){
    const ia=L.filter(p=>!(p.lines>0));
    const rows=A.map((p,i)=>kRow(p,['<td class="num mut">'+(i+1)+'</td>','<td>'+esc(p.id)+'</td>','<td>'+esc(p.name)+'</td>','<td>'+esc(p.zona||'–')+'</td>',kNum(rp(p.sales)),kNum(fmtN.format(p.receipts))]))
      .concat(ia.map(p=>kRow(p,['<td class="num mut">–</td>','<td>'+esc(p.id)+'</td>','<td>'+esc(p.name)+'</td>','<td>'+esc(p.zona||'–')+'</td>',kNum('belum ada penjualan'),kNum('–')],'dim')));
    kShow('Orang aktif',[['Aktif (ada transaksi)',String(A.length)],['Terjadwal tanpa penjualan',String(ia.length)],['Total dalam daftar',String(L.length)]],
      rows.length? kTbl([['#'],['Sales ID'],['Salesperson'],['Zonasi'],['Penjualan',1],['Struk',1]],rows)+'<p class="note" style="padding:8px 4px">Klik salah satu baris untuk melihat detail item.</p>' : '<p class="note" style="padding:14px 4px">Belum ada orang pada filter ini.</p>',el);
  } else if(k==='avg'){
    const v=A.map(p=>p.sales).sort((a,b)=>a-b), n=v.length, avg=n?tot/n:0, med=n?(n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2):0;
    const rows=A.map((p,i)=>{ const df=p.sales-avg, c=df>=0?'gd':'bd';
      return kRow(p,['<td class="num mut">'+(i+1)+'</td>','<td>'+esc(p.name)+'</td>','<td>'+esc(p.zona||'–')+'</td>',kNum(rp(p.sales)),'<td class="num rt '+c+'">'+(df>=0?'+':'−')+rp(Math.abs(df))+' ('+(df>=0?'+':'−')+Math.round(Math.abs(df)/(avg||1)*100)+'%)</td>']); });
    kShow('Rata-rata penjualan per orang',[['Rata-rata',rp(avg)],['Median',rp(med)],['Tertinggi',n?rp(v[n-1]):'–'],['Terendah',n?rp(v[0]):'–']],
      rows.length? kTbl([['#'],['Salesperson'],['Zonasi'],['Penjualan',1],['Selisih dari rata-rata',1]],rows) : '<p class="note" style="padding:14px 4px">Belum ada penjualan pada rentang ini.</p>',el);
  } else if(k==='top'){
    if(L[0]) openPerson(L[0], el);
  } else if(k==='target'){
    const T=L.filter(p=>p.target>0);
    if(T.length){
      const hit=T.filter(p=>p.sales>=p.target), st=T.reduce((a,p)=>a+p.sales,0), tt=T.reduce((a,p)=>a+p.target,0), gap=T.reduce((a,p)=>a+Math.max(0,p.target-p.sales),0);
      const rows=T.slice().sort((a,b)=>b.sales/b.target-a.sales/a.target).map(p=>{ const a=p.sales/p.target, ok=a>=1;
        return kRow(p,['<td>'+esc(p.name)+'</td>','<td>'+esc(p.zona||'–')+'</td>',kNum(rp(p.target)),kNum(rp(p.sales)),'<td class="num rt '+(ok?'gd':'')+'">'+Math.round(a*100)+'%</td>','<td class="'+(ok?'gd':'bd')+'">'+(ok?'✓ Tercapai':'Kurang '+rp(p.target-p.sales))+'</td>']); });
      kShow('Pencapaian target',[['Tercapai',hit.length+' / '+T.length],['Achievement total',pct(st/tt)],['Belum tercapai',String(T.length-hit.length)],['Total kekurangan',rp(gap)]],
        kTbl([['Salesperson'],['Zonasi'],['Target',1],['Penjualan',1],['Achievement',1],['Status']],rows)+'<p class="note" style="padding:8px 4px">Klik salah satu baris untuk melihat detail item.</p>',el);
    } else {
      const t10=A.slice(0,10), s10=t10.reduce((a,p)=>a+p.sales,0);
      kShow('Konsentrasi 10 teratas',[['10 teratas',rp(s10)],['Porsi dari total',pct(s10/(tot||1))]],
        t10.length? kTbl([['#'],['Salesperson'],['Penjualan',1],['% total',1]],t10.map((p,i)=>kRow(p,['<td class="num mut">'+(i+1)+'</td>','<td>'+esc(p.name)+'</td>',kNum(rp(p.sales)),kNum(pct(p.sales/(tot||1)))]))) : '<p class="note" style="padding:14px 4px">Belum ada penjualan.</p>',el);
    }
  }
}
['total','aktif','avg','top','target'].forEach((k,i)=>{ const el=document.querySelectorAll('.kpis .kpi')[i]; if(!el) return; el.dataset.k=k; el.tabIndex=0; el.setAttribute('role','button'); el.title='Klik untuk melihat rincian'; });
document.querySelector('.kpis').addEventListener('click',e=>{ const c=e.target.closest('.kpi[data-k]'); if(c) openK(c.dataset.k,c); });
document.querySelector('.kpis').addEventListener('keydown',e=>{ if(e.key!=='Enter'&&e.key!==' ') return; const c=e.target.closest('.kpi[data-k]'); if(!c) return; e.preventDefault(); openK(c.dataset.k,c); });
$('kpop-x').addEventListener('click',closeK);
$('kpop').addEventListener('click',e=>{ if(e.target===$('kpop')){ closeK(); return; } const tr=e.target.closest('tr[data-pid]'); if(!tr) return; const p=P.find(x=>x.id===tr.dataset.pid); if(p){ const f=kLast; closeK(); openPerson(p,f); } });
$('kpop').addEventListener('keydown',e=>{ if(e.key!=='Enter') return; const tr=e.target.closest('tr[data-pid]'); if(!tr) return; const p=P.find(x=>x.id===tr.dataset.pid); if(p){ const f=kLast; closeK(); openPerson(p,f); } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeK(); });
/* ---- Salesperson dengan pencapaian MTD di bawah 60% + schedule sampai akhir bulan ---- */
const LOWT=0.6; let lowInfo=null;
function lowCalc(){
  if(!dates.length) return null;
  const last=dates[dates.length-1], to=(dT.value&&dT.value<=last)?dT.value:last, ms=to.slice(0,8)+'01', from=ms<dates[0]?dates[0]:ms;
  const saved={P,M,H,curSel}; let rows=[], tot=0;
  try{
    aggregate(from,to);
    const T=P.filter(p=>p.hasSch&&p.target>0); tot=T.length;
    rows=T.filter(p=>p.sales/p.target<LOWT).map(p=>{ const codes=(SCH.dates||[]).map(d=>codeOn(p.id,d)); return {id:p.id,name:p.name,zona:p.zona||'',brand:p.brand||'',cat:(SCHM[p.id]&&SCHM[p.id].cat)||p.cat||'',tpd:p.tpe||0,target:p.target,sales:p.sales,pct:p.sales/p.target,codes,full:codes.reduce((a,c)=>a+(isWork(c)?(p.tpe||0):0),0)}; });
  } finally { P=saved.P; M=saved.M; H=saved.H; curSel=saved.curSel; }
  rows.sort((a,b)=>a.pct-b.pct);
  return {rows,tot,from,to};
}
function renderLow(){
  const el=$('low-wrap'); if(!el) return;
  const r=lowInfo=lowCalc(), sd=(SCH&&SCH.dates)||[];
  $('low-xlsx').disabled=$('low-copy').disabled=!(r&&r.rows.length);
  if(!r){ $('low-sub').textContent=''; el.innerHTML='<p class="note" style="padding:14px 4px">Belum ada data.</p>'; $('low-note').textContent=''; return; }
  const multi=sd.length&&sd[0].slice(0,7)!==sd[sd.length-1].slice(0,7), dl=d=>multi? (+d.slice(8))+'/'+(+d.slice(5,7)) : String(+d.slice(8));
  $('low-sub').textContent='MTD '+fd(r.from,{day:'numeric',month:'short'})+' sampai '+fd(r.to,{day:'numeric',month:'short',year:'numeric'})+' · '+r.rows.length+' dari '+r.tot+' orang bertarget · jadwal sampai '+(sd.length? fd(sd[sd.length-1],{day:'numeric',month:'long'}) : '–');
  if(!r.rows.length){ el.innerHTML='<p class="note" style="padding:14px 4px">Tidak ada salesperson di bawah 60% pada rentang ini.</p>'; $('low-note').textContent=''; return; }
  const tl=sd.length? fd(sd[sd.length-1],{day:'numeric',month:'short'}) : 'akhir jadwal';
  const head='<tr><th>#</th><th>Sales ID</th><th>Salesperson</th><th>Zonasi</th><th>Category</th><th class="rt">Target harian</th><th class="rt">Target MTD</th><th class="rt">Actual MTD</th><th class="rt">%</th>'+sd.map((d,i)=>'<th class="sc'+(i===0?' sep':'')+'" title="'+esc(fd(d))+'">'+dl(d)+'</th>').join('')+'<th class="rt sep">Target s/d '+esc(tl)+'</th><th class="rt">Actual</th><th class="rt">Achievement</th></tr>';
  const body=r.rows.map((p,i)=>'<tr><td class="num mut">'+(i+1)+'</td><td>'+esc(p.id)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.zona||'–')+'</td><td>'+esc(p.cat||'–')+'</td><td class="num rt">'+rp(p.tpd)+'</td><td class="num rt">'+rp(p.target)+'</td><td class="num rt">'+rp(p.sales)+'</td><td class="num rt bd">'+pct(p.pct)+'</td>'+p.codes.map((c,j)=>'<td class="sc'+(j===0?' sep':'')+' '+(isWork(c)?'on':'off')+'">'+esc(c||'')+'</td>').join('')+'<td class="num rt sep">'+rp(p.full)+'</td><td class="num rt lo-in"></td><td class="num rt"></td></tr>').join('');
  el.innerHTML='<table class="pt"><thead>'+head+'</thead><tbody>'+body+'</tbody></table>';
  $('low-note').textContent='Urut dari pencapaian terendah. Setelah kolom jadwal harian (S/P/M = masuk kerja, selain itu libur atau cuti) ada Target sampai akhir jadwal, Actual (dikosongkan, diisi manual di spreadsheet), dan Achievement (otomatis di spreadsheet).';
}
const colL=n=>{ let s=''; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
const lowTL=()=>{ const sd=(SCH&&SCH.dates)||[]; return sd.length? ckLab(sd[sd.length-1]) : 'akhir jadwal'; };
/* Susunan spreadsheet: SALESPERSON ID | SALESPERSON NAME | ZONA | CATEGORY | per tanggal [SHIFT | BUDGET | ACHIEV (kosong, diisi manual) | %] | TARGET | ACTUAL | ACHIEVEMENT */
const LC=4;
function lowLayout(){
  const sd=(SCH&&SCH.dates)||[], n=sd.length, multi=n&&sd[0].slice(0,7)!==sd[n-1].slice(0,7), dl=d=>multi? (+d.slice(8))+'/'+(+d.slice(5,7)) : String(+d.slice(8));
  const T=LC+4*n, hdr=['SALESPERSON ID','SALESPERSON NAME','ZONA','CATEGORY'], lab=['','','',''];
  sd.forEach(d=>{ hdr.push('SHIFT','BUDGET','ACHIEV','%'); lab.push(dl(d),'','',''); });
  hdr.push('TARGET s/d '+lowTL(),'ACTUAL','ACHIEVEMENT'); lab.push('TOTAL','','');
  const rows=lowInfo.rows.map((p,k)=>{ const R=7+k, x=[p.id,p.name,p.zona||'',p.cat||''], bs=[], as=[];
    sd.forEach((d,i)=>{ const c=LC+4*i, bC=colL(c+1)+R, aC=colL(c+2)+R; x.push(p.codes[i]||'', isWork(p.codes[i])?Math.round(p.tpd):0, null, '=IF('+bC+'>0,N('+aC+')/'+bC+',0)'); bs.push(bC); as.push(aC); });
    x.push('=SUM('+bs.join(',')+')','=SUM('+as.join(',')+')','=IF('+colL(T)+R+'>0,'+colL(T+1)+R+'/'+colL(T)+R+',0)');
    return x; });
  const per='MTD '+fd(lowInfo.from,{day:'numeric',month:'short'})+' sampai '+fd(lowInfo.to,{day:'numeric',month:'short',year:'numeric'});
  const title='Schedule Salesperson pencapaian di bawah 60% (MTD) · '+D.store, sub=per+' · kolom ACHIEV diisi manual, kolom % dan ACHIEVEMENT terisi otomatis';
  return {sd,n,T,hdr,lab,rows,title,sub,aoa:[[title],[sub],[],[],lab,hdr].concat(rows)};
}
const lowLoad=src=>new Promise((ok,no)=>{ if(window.ExcelJS) return ok(); const s=document.createElement('script'); const t=setTimeout(()=>no(new Error('timeout')),10000); s.src=src; s.onload=()=>{ clearTimeout(t); ok(); }; s.onerror=()=>{ clearTimeout(t); no(new Error('gagal memuat')); }; document.head.appendChild(s); });
async function lowStyled(Ly){
  await lowLoad('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js');
  const wb=new ExcelJS.Workbook(), ws=wb.addWorksheet('Di bawah 60% MTD',{views:[{state:'frozen',xSplit:LC,ySplit:6}]});
  const NC=Ly.T+3, thin={style:'thin',color:{argb:'FF9AA5B8'}}, bd={top:thin,left:thin,bottom:thin,right:thin}, fill=c=>({type:'pattern',pattern:'solid',fgColor:{argb:c}});
  ws.getCell(1,1).value=Ly.title; ws.getCell(1,1).font={bold:true,size:14,color:{argb:'FF0F2547'}};
  ws.getCell(2,1).value=Ly.sub; ws.getCell(2,1).font={italic:true,color:{argb:'FF4A576B'}};
  Ly.aoa.slice(4).forEach((row,ri)=>{ const R=5+ri; row.forEach((v,ci)=>{ const cell=ws.getCell(R,ci+1);
    if(typeof v==='string'&&v[0]==='=') cell.value={formula:v.slice(1),result:0}; else if(v!==null&&v!=='') cell.value=v; }); });
  for(let i=0;i<Ly.n;i++){ const c=LC+1+4*i; ws.mergeCells(5,c,5,c+3); }
  ws.mergeCells(5,Ly.T+1,5,Ly.T+3);
  for(let c=1;c<=NC;c++){ const a=ws.getCell(5,c), h=ws.getCell(6,c);
    if(c>LC){ a.fill=fill('FFFFFF00'); a.font={bold:true,size:13,color:{argb:'FFC00000'}}; a.alignment={horizontal:'center',vertical:'middle'}; a.border=bd; }
    else if(c>1) a.fill=fill('FF00FFFF');
    h.fill=fill('FF0F2547'); h.font={bold:true,color:{argb:'FFFFFFFF'}}; h.alignment={horizontal:'center',vertical:'middle',wrapText:true}; h.border=bd; }
  ws.getRow(6).height=30;
  Ly.rows.forEach((row,k)=>{ const R=7+k; ws.getRow(R).height=20;
    for(let c=1;c<=NC;c++){ const cell=ws.getCell(R,c), inDays=c>LC&&c<=LC+4*Ly.n, k4=(c-LC-1)%4; cell.border=bd; cell.font={bold:c<=LC||(inDays&&k4===0)};
      if(c<=LC){ cell.alignment={horizontal:c===1?'left':'center',vertical:'middle'}; continue; }
      if(inDays){
        if(k4===0) cell.alignment={horizontal:'center',vertical:'middle'};
        else if(k4===3){ cell.numFmt='0.00%'; cell.alignment={horizontal:'right',vertical:'middle'}; }
        else { cell.numFmt='#,##0'; cell.alignment={horizontal:'right',vertical:'middle'}; if(k4===2) cell.fill=fill('FFFFFBEA'); }
      } else { cell.numFmt=c===Ly.T+3?'0.00%':'#,##0'; cell.font={bold:true}; cell.alignment={horizontal:'right',vertical:'middle'}; }
    } });
  [22,28,10,26].forEach((w,i)=>{ ws.getColumn(i+1).width=w; });
  for(let i=0;i<Ly.n;i++){ const c=LC+1+4*i; ws.getColumn(c).width=8; ws.getColumn(c+1).width=13; ws.getColumn(c+2).width=13; ws.getColumn(c+3).width=9; }
  ws.getColumn(Ly.T+1).width=18; ws.getColumn(Ly.T+2).width=15; ws.getColumn(Ly.T+3).width=14;
  ws.autoFilter={from:{row:6,column:1},to:{row:6,column:NC}};
  return new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function lowPlain(Ly){
  const ws=XLSX.utils.aoa_to_sheet(Ly.aoa);
  Object.keys(ws).forEach(k=>{ if(k[0]==='!') return; const c=ws[k]; if(c.t==='s'&&c.v[0]==='='){ c.f=c.v.slice(1); c.t='n'; c.v=0; } });
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Ly.aoa.length-1,c:Ly.T+2}});
  ws['!cols']=[{wch:22},{wch:28},{wch:10},{wch:26}].concat(Array.from({length:Ly.n},()=>[{wch:8},{wch:13},{wch:13},{wch:9}]).flat(),[{wch:18},{wch:15},{wch:14}]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Di bawah 60% MTD');
  return new Blob([XLSX.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
async function lowDownload(){
  if(!lowInfo||!lowInfo.rows.length) return;
  const Ly=lowLayout(), nm='salesperson-di-bawah-60-mtd-'+lowInfo.to+'.xlsx'; let blob=null, styled=true;
  $('low-note').textContent='Menyiapkan spreadsheet…';
  try{ blob=await lowStyled(Ly); }
  catch(e){ styled=false; if(!window.XLSX){ $('low-note').textContent='Spreadsheet gagal dibuat. Periksa koneksi, lalu coba lagi.'; return; } try{ blob=lowPlain(Ly); }catch(x){ $('low-note').textContent='Spreadsheet gagal dibuat.'; return; } }
  try{ await saveBlob(blob,nm); $('low-note').textContent='Spreadsheet diunduh'+(styled?'':' (versi polos tanpa warna, karena pustaka format tidak bisa dimuat)')+'. Kolom ACHIEV dikosongkan untuk diisi manual. Untuk Google Sheets: buka sheets.google.com, pilih File, Impor, lalu unggah file ini.'; }
  catch(e){ $('low-note').textContent='Spreadsheet gagal diunduh.'; }
}
async function lowCopy(){
  if(!lowInfo||!lowInfo.rows.length) return;
  const tsv=lowLayout().aoa.map(r=>r.map(v=>v==null?'':v).join('\t')).join('\n');
  const msg='Tabel disalin. Buka Google Sheets, klik sel A1, lalu tekan Ctrl+V. Warna tidak ikut tertempel, jadi untuk tampilan berwarna gunakan tombol Unduh spreadsheet.';
  try{ await navigator.clipboard.writeText(tsv); $('low-note').textContent=msg; }
  catch(e){ const t=document.createElement('textarea'); t.value=tsv; t.style.position='fixed'; t.style.opacity='0'; document.body.appendChild(t); t.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(x){} t.remove(); $('low-note').textContent=ok? msg : 'Browser tidak mengizinkan menyalin. Gunakan tombol Unduh spreadsheet.'; }
}
$('low-xlsx').addEventListener('click',lowDownload);
$('low-copy').addEventListener('click',lowCopy);
/* ---- Summary per MPP: klik baris atau kolom untuk daftar salesperson ---- */
function openMpp(tr,bandKey){
  const set=tr.dataset.set, zn=tr.dataset.z;
  let l=P.filter(p=>p.hasSch&&p.target>0); if(set==='pb') l=l.filter(p=>String(p.brand||'').toUpperCase()==='PRIVATE BRAND'); if(zn) l=l.filter(p=>p.zona===zn);
  const bandOf=p=>{ const a=p.sales/p.target; return a>=1?'hi':a<.75?'lo':'mid'; }, cnt={hi:0,mid:0,lo:0}; l.forEach(p=>cnt[bandOf(p)]++);
  const lab={hi:'≥100%',mid:'75–99%',lo:'<75%'}, cls={hi:'gd',mid:'am',lo:'bd'}, bk=(bandKey&&bandKey!=='all')? bandKey : '';
  const f=(bk? l.filter(p=>bandOf(p)===bk) : l).slice().sort((a,b)=>b.sales/b.target-a.sales/a.target);
  const rows=f.map((p,i)=>{ const b=bandOf(p); return kRow(p,['<td class="num mut">'+(i+1)+'</td>','<td>'+esc(p.id)+'</td>','<td>'+esc(p.name)+'</td>','<td>'+esc(p.zona||'–')+'</td>','<td>'+esc(p.brand?title(p.brand):'–')+'</td>',kNum(rp(p.target)),kNum(rp(p.sales)),'<td class="num rt '+cls[b]+'">'+pct(p.sales/p.target)+'</td>','<td class="'+cls[b]+'">'+lab[b]+'</td>']); });
  kShow('Daftar salesperson · '+tr.dataset.lbl+(set==='pb'?' · Private Brand':'')+(bk?' · '+lab[bk]:''),
    [['Actual MPP',String(l.length)],['≥100%',String(cnt.hi)],['75–99%',String(cnt.mid)],['<75%',String(cnt.lo)]],
    rows.length? kTbl([['#'],['Sales ID'],['Salesperson'],['Zonasi'],['Master brand'],['Target',1],['Penjualan',1],['Achievement',1],['Kelompok']],rows)+'<p class="note" style="padding:8px 4px">Klik salah satu baris untuk melihat detail item. Urut dari capaian tertinggi.</p>' : '<p class="note" style="padding:14px 4px">Tidak ada salesperson pada kelompok ini.</p>',tr);
}
$('mpp-body').addEventListener('click',e=>{ const tr=e.target.closest('tr.mpp-r'); if(!tr) return; const c=e.target.closest('td[data-b]'); openMpp(tr,c?c.dataset.b:''); });
$('mpp-body').addEventListener('keydown',e=>{ if(e.key!=='Enter') return; const tr=e.target.closest('tr.mpp-r'); if(tr) openMpp(tr,''); });
function renderProt(){
  const rows=Object.values(M.prot||{}).sort((a,b)=>b.s-a.s);
  const tq=rows.reduce((s,r)=>s+r.q,0), ts=rows.reduce((s,r)=>s+r.s,0);
  $('prot-sub').textContent=(M.from&&M.to? (M.from===M.to? fd(M.from,{day:'numeric',month:'short'}) : fd(M.from,{day:'numeric',month:'short'})+' – '+fd(M.to,{day:'numeric',month:'short'}))+' · ' : '')+'master brand BCA · exclude PPN';
  const t=$('prot-body');
  if(!rows.length){ t.innerHTML='<p class="note">Belum ada penjualan Mitra10 Proteksi pada rentang ini.</p>'; }
  else t.innerHTML='<table class="pt"><thead><tr><th>#</th><th>Salesperson</th><th class="rt">Qty</th><th class="rt">Value penjualan</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td class="num mut">'+(i+1)+'</td><td>'+(r.id? esc(r.name||r.id):'<i>Tanpa kode sales</i>')+'</td><td class="num rt">'+fmtN.format(r.q)+'</td><td class="num rt">'+rp(r.s)+'</td></tr>').join('')+'</tbody><tfoot><tr><td></td><td>Total</td><td class="num rt">'+fmtN.format(tq)+'</td><td class="num rt">'+rp(ts)+'</td></tr></tfoot></table>';
  const n=$('prot-note'); n.hidden=!M.protMiss; n.textContent=M.protMiss? M.protMiss+' tanggal belum memuat data proteksi. Unggah ulang laporan tanggal tersebut agar ikut terhitung.':'';
}
function renderTopBrand(){
  return; // tabel TOP 10 Master brand dihapus
  const rows=Object.entries(M.mb||{}).map(([k,v])=>({k,q:v.q,s:v.s})).sort((a,b)=>b.s-a.s).slice(0,10);
  $('tb-sub').textContent=(M.from&&M.to? (M.from===M.to? fd(M.from,{day:'numeric',month:'short'}) : fd(M.from,{day:'numeric',month:'short'})+' – '+fd(M.to,{day:'numeric',month:'short'}))+' · ' : '')+'sales exclude PPN per master brand';
  const t=$('tb-body');
  if(!rows.length) t.innerHTML='<p class="note">Belum ada data master brand pada rentang ini.</p>';
  else t.innerHTML='<table class="pt"><thead><tr><th>Master brand</th><th class="rt">Qty</th><th class="rt">Value</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(title(r.k))+'</td><td class="num rt">'+fmtN.format(r.q)+'</td><td class="num rt">'+rp(r.s)+'</td></tr>').join('')+'</tbody></table>';
  const n=$('tb-note'); n.hidden=!M.mbMiss; n.textContent=M.mbMiss? M.mbMiss+' tanggal belum memuat data master brand. Unggah ulang laporan tanggal tersebut agar ikut terhitung.':'';
}
function all(){ renderSub(); renderKPI(); renderRank(); renderProt(); renderTopBrand(); renderMPP(); renderTable(); renderLow(); renderFoot(); }
document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{ S.role=b.dataset.role; document.querySelectorAll('[data-role]').forEach(x=>x.setAttribute('aria-pressed',x===b)); all(); }));
document.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ S.m=b.dataset.m; document.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderRank(); }));
$('topn').addEventListener('change',e=>{ S.topn=parseInt(e.target.value,10); renderRank(); });
$('q').addEventListener('input',e=>{ S.q=e.target.value; renderTable(); });
// ---- Screenshot tabel detail (PNG untuk dibagikan) ----
function shotCanvas(){
  const rows = lastL, hasT = lastHasT, sd = lastSd;
  const S2=Math.max(1,Math.min(2,12000/(150+36*(lastL.length+3)))), W=(hasT?1700:1040), padX=32, FONT="'Public Sans',system-ui,-apple-system,'Segoe UI',sans-serif", DISP="'Schibsted Grotesk','Public Sans',system-ui,sans-serif";
  const cols = hasT
    ? [['#',40,'r'],['Sales ID',175,'l'],['Salesperson',210,'l'],['Zonasi',90,'l'],['Jadwal '+shortD(sd),100,'l'],['Master brand',150,'l'],['Penjualan',170,'r'],['Penjualan master brand',185,'bt'],['Non master brand',160,'r'],['Target',160,'r'],['Pencapaian',170,'bar']]
    : [['#',44,'r'],['Sales ID',150,'l'],['Salesperson',230,'l'],['Kategori utama',200,'l'],['Penjualan',170,'r'],['% total',100,'r'],['Struk',70,'r']];
  const tw = cols.reduce((a,c)=>a+c[1],0), scale=(W-padX*2)/tw; cols.forEach(c=>c[1]=c[1]*scale);
  const q = S.q.trim();
  const f = []; f.push(S.role==='all'?'Semua peran':S.role==='Kasir'?'Kasir':'Sales'); if(S.zona) f.push('Zonasi '+S.zona);
  if(lastHasT && !S.schSel.length) f.push('Tanggal jadwal '+shortD(sd)); if(S.schSel.length) f.push('Jadwal '+schLabel()+' ('+shortD(sd)+')'); if(lastDr) f.push((S.dMode==='mtd'?'MTD':'Rentang tabel')+' '+lastM.days+' hari'); if(q) f.push('Cari "'+q+'"');
  const period = lastM.from? (lastM.from===lastM.to? fd(lastM.from) : fd(lastM.from,{day:'numeric',month:'short'})+' sampai '+fd(lastM.to)) : '';
  const headH=116, thH=46, rowH=48, footH=58, H=headH+thH+rowH*Math.max(rows.length,1)+footH;
  const c=document.createElement('canvas'); c.width=W*S2; c.height=H*S2; const g=c.getContext('2d'); g.scale(S2,S2);
  g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.textBaseline='middle';
  const fit=(t,w)=>{ t=String(t); if(g.measureText(t).width<=w) return t; while(t.length>1 && g.measureText(t+'…').width>w) t=t.slice(0,-1); return t+'…'; };
  g.fillStyle='#0b0b0b'; g.font='700 30px '+DISP; g.textAlign='left'; g.fillText('Pencapaian Salesperson',padX,34);
  g.fillStyle='#52514e'; g.font='400 18px '+FONT;
  g.fillText(fit(D.store+' · '+period+' · penjualan tanpa PPN',W-padX*2),padX,68);
  g.fillStyle='#7a7975'; g.fillText(fit('Filter: '+f.join(' · ')+' · '+rows.length+' orang',W-padX*2),padX,95);
  let y=headH; g.fillStyle='#0f2547'; g.fillRect(padX,y,W-padX*2,thH); g.fillStyle='#f5a800'; g.fillRect(padX,y+thH-3,W-padX*2,3);
  g.font='700 12px '+FONT; g.fillStyle='#ffffff';
  const cx=(i)=>padX+cols.slice(0,i).reduce((a,x)=>a+x[1],0);
  cols.forEach((k,i)=>{ const x=cx(i), w=k[1]; const l=k[2]==='l'||k[2]==='bar'; g.textAlign=l?'left':'right'; g.fillText(k[0].toUpperCase(),l?x+10:x+w-10,y+thH/2); });
  y+=thH; 
  rows.forEach((p,r)=>{
    const a=p.target>0? p.sales/p.target : -1, cd=codeOn(p.id,sd);
    if(r%2) { g.fillStyle='#fafafa'; g.fillRect(padX,y,W-padX*2,rowH); }
    g.fillStyle='#ecedeb'; g.fillRect(padX,y+rowH-1,W-padX*2,1);
    const cells = hasT
      ? [p.rank==null?'–':p.rank, p.id, p.name, p.zona||'–', cd||'–', p.brand?title(p.brand):'–', rp(p.sales), p.brand?brandSales(p):null, p.brand?rp(nonBrand(p)):'–', p.target==null?'–':p.target===0?'tidak ada':rp(p.target), null]
      : [p.rank==null?'–':p.rank, p.id, p.name, p.cat?title(p.cat):'–', rp(p.sales), pct(p.sales/(lastM.total||1)), p.receipts];
    cols.forEach((k,i)=>{
      const x=cx(i), w=k[1], mid=y+rowH/2;
      if(k[2]==='bar'){
        const bw=w-20-62, bx=x+10;
        g.fillStyle='#ecedeb'; g.fillRect(bx,mid-4,bw,8);
        if(a>=0){ g.fillStyle=a>=1?'#1f8a4c':'#2a78d6'; g.fillRect(bx,mid-4,Math.min(1,a)*bw,8); g.font='600 18px '+FONT; g.textAlign='right'; g.fillStyle=a>=1?'#1f8a4c':'#0b0b0b'; g.fillText(Math.round(a*100)+'%',x+w-10,mid); }
        else { g.font='400 18px '+FONT; g.textAlign='right'; g.fillStyle='#7a7975'; g.fillText('–',x+w-10,mid); }
        return;
      }
      if(k[2]==='bt'){ g.textAlign='right'; if(cells[i]==null){ g.font='400 18px '+FONT; g.fillStyle='#7a7975'; g.fillText('–',x+w-10,mid); } else { g.font='400 18px '+FONT; g.fillStyle='#0b0b0b'; g.fillText(rp(cells[i]),x+w-10,mid-7); g.font='400 10.5px '+FONT; g.fillStyle='#7a7975'; g.fillText(fit(title(p.brand),w-20),x+w-10,mid+8); } return; }
      const l=k[2]==='l'; g.textAlign=l?'left':'right';
      g.font=(i===2?'500 ':'400 ')+(i===1?'14px ':'18px ')+FONT; g.fillStyle=(i===0||cells[i]==='–'||cells[i]==='tidak ada')?'#7a7975':'#0b0b0b';
      g.fillText(fit(cells[i],w-20),l?x+10:x+w-10,mid);
    });
    y+=rowH;
  });
  if(!rows.length){ g.fillStyle='#7a7975'; g.textAlign='center'; g.font='400 18px '+FONT; g.fillText('Tidak ada orang yang cocok dengan filter.',W/2,y+rowH/2); y+=rowH; }
  g.fillStyle='#7a7975'; g.font='400 14px '+FONT; g.textAlign='left';
  const now=new Date().toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  g.fillText('Dibuat '+now+(hasT?' · target harian dari file jadwal':''),padX,y+footH/2+4);
  return c;
}
let toastT=0;
const shotMsg=(t,k)=>{ const s=$('shot-msg'); clearTimeout(toastT); s.textContent=t||''; s.hidden=!t; if(t&&k) toastT=setTimeout(()=>{ s.hidden=true; },4500); };
const shotName=()=>'print-screen-'+(lastM.from||'data')+(lastM.to&&lastM.to!==lastM.from?'_'+lastM.to:'')+(S.schSel.length?'_'+S.schSel.join('-').replace(/[^A-Za-z0-9-]/g,''):'')+'.png';
const toBlob=c=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('gagal')),'image/png'));
const shotBlob=async()=>{ try{ await document.fonts.ready; }catch(e){} return toBlob(shotCanvas()); };
// ---- Gambar summary MPP
function mppCanvas(){
  const mem=P.filter(p=>p.hasSch && p.target>0), sets=[['Summary all salesperson, all staff (PB & eksternal)','#f5a800','#2a1d00',mem],['Summary all salesperson, Private Brand only','#2a9de0','#ffffff',mem.filter(p=>String(p.brand||'').toUpperCase()==='PRIVATE BRAND')]];
  const FONT="'Public Sans',system-ui,-apple-system,'Segoe UI',sans-serif", DISP="'Schibsted Grotesk','Public Sans',system-ui,sans-serif";
  const W=1200, px=32, S2=2, cols=[['Zona',56,'c'],['Category',280,'l'],['Actual\nMPP',90,'r'],['Salper\n≥100%',96,'r'],['Cont',70,'r'],['Salper\n75–99%',96,'r'],['Cont',70,'r'],['Salper\n<75%',96,'r'],['Cont',70,'r'],['IPD',70,'r'],['BZ',138,'r']];
  const pc=v=>Math.round(v*100)+'%', ip=v=>v?v.toFixed(2).replace('.',','):'0', bz=v=>v?fmtN.format(Math.round(v)):'0';
  const data=sets.map(s=>mppSummary(s[3]));
  const tblH=30+40+30*data[0].rows.length+34, H=100+tblH*2+16+44;
  const c=document.createElement('canvas'); c.width=W*S2; c.height=H*S2; const g=c.getContext('2d'); g.scale(S2,S2);
  g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.textBaseline='middle';
  g.fillStyle='#0e1a2b'; g.font='700 22px '+DISP; g.textAlign='left'; g.fillText('Summary Pencapaian per MPP',px,30);
  const per = M.days? (M.days===1? 'Daily · '+fd(M.from,{day:'numeric',month:'long',year:'numeric'}) : fd(M.from,{day:'numeric',month:'short'})+' sampai '+fd(M.to,{day:'numeric',month:'short',year:'numeric'})+' ('+M.days+' hari)') : '';
  g.fillStyle='#4a576b'; g.font='400 13px '+FONT; g.fillText(D.store+' · '+per+' · berdasarkan achievement penjualan tanpa PPN',px,56);
  let y=76;
  sets.forEach((s,si)=>{
    const {rows,tot}=data[si];
    g.fillStyle=s[1]; g.fillRect(px,y,W-px*2,30); g.fillStyle=s[2]; g.font='700 14px '+FONT; g.textAlign='left'; g.fillText(s[0],px+12,y+15); y+=30;
    g.fillStyle='#0f2547'; g.fillRect(px,y,W-px*2,40);
    let x=px; cols.forEach(k=>{ g.fillStyle='#fff'; g.font='600 11.5px '+FONT; const ls=k[0].split('\n'); g.textAlign=k[2]==='l'?'left':k[2]==='c'?'center':'right'; const tx=k[2]==='l'?x+10:k[2]==='c'?x+k[1]/2:x+k[1]-10; ls.forEach((l,i)=>g.fillText(l,tx,y+20+(i-(ls.length-1)/2)*14)); x+=k[1]; });
    y+=40;
    const line=(r,isTot,label)=>{
      if(isTot){ g.fillStyle='#ffe29a'; g.fillRect(px,y,W-px*2,34); } else { g.fillStyle='#e3e8f1'; g.fillRect(px,y+29,W-px*2,1); }
      const h=isTot?34:30, mid=y+h/2;
      const vals=isTot?['Total','',r.n,r.hi,pc(r.hiP),r.mid,pc(r.midP),r.lo,pc(r.loP),ip(r.ipd),bz(r.bz)]:[r.z,r.cat,r.n,r.hi,pc(r.hiP),r.mid,pc(r.midP),r.lo,pc(r.loP),ip(r.ipd),bz(r.bz)];
      let x=px; cols.forEach((k,i)=>{
        g.font=(isTot?'700 ':'400 ')+'13px '+FONT; g.fillStyle='#0e1a2b';
        if(i===4&&!isTot) g.fillStyle='#0e6b49'; if(i===6&&!isTot) g.fillStyle='#a86a00'; if(i===8&&!isTot) g.fillStyle='#b4271c';
        g.textAlign=k[2]==='l'?'left':k[2]==='c'?'center':'right';
        if(isTot&&i===0){ g.textAlign='left'; g.fillText('Total',x+10,mid); }
        else if(!(isTot&&i===1)) g.fillText(String(vals[i]),k[2]==='l'?x+10:k[2]==='c'?x+k[1]/2:x+k[1]-10,mid);
        x+=k[1]; });
      y+=h; };
    rows.forEach(r=>line(r,false)); line(tot,true);
    y+=16;
  });
  g.fillStyle='#7a8699'; g.font='400 11px '+FONT; g.textAlign='left';
  g.fillText('Dibuat '+new Date().toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' · IPD = rata-rata invoice per salesperson per hari kerja · BZ = rata-rata penjualan per struk',px,y+8);
  return c;
}
const mppBlob=async()=>{ try{ await document.fonts.ready; }catch(e){} return toBlob(mppCanvas()); };
const mppName=()=>'summary-mpp-'+(M.from||'data')+(M.to&&M.to!==M.from?'_'+M.to:'')+'.png';
// ---- Salin ke clipboard (untuk ditempel di WhatsApp) atau simpan sebagai file
async function saveBlob(blob,name){
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if(dl){ await dl.save({filename:name, data:blob}); return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
async function shotAction(make,name,mode,btns){
  btns.forEach(b=>b.disabled=true); shotMsg('Membuat gambar…');
  try{
    const bp=make();
    if(mode==='copy'){
      let copied=false;
      try{ if(navigator.clipboard&&window.ClipboardItem){ await navigator.clipboard.write([new ClipboardItem({'image/png':bp})]); copied=true; } }catch(e){ copied=false; }
      if(copied){ shotMsg('Gambar disalin. Buka WhatsApp lalu tempel dengan Ctrl+V (di ponsel: tekan lama lalu Tempel).','ok'); }
      else {
        const blob=await bp;
        try{ await saveBlob(blob,name); shotMsg('Browser tidak mengizinkan menyalin, jadi gambar disimpan sebagai file. Kirim file itu di WhatsApp.','ok'); }
        catch(e){ shotMsg(e&&e.code==='declined'?'Dibatalkan.':'Gambar tidak bisa disalin atau disimpan di sini.','warn'); }
      }
    } else {
      try{ await saveBlob(await bp,name); shotMsg('Gambar disimpan.','ok'); }
      catch(e){ shotMsg(e&&e.code==='declined'?'Dibatalkan.':'Penyimpanan gambar tidak tersedia di sini.','warn'); }
    }
  }catch(e){ shotMsg('Gambar gagal dibuat.','warn'); }
  btns.forEach(b=>b.disabled=false);
}
const bDet=[$('ps'),$('ps-dl')], bMpp=[$('mpp-copy'),$('mpp-dl')];
$('ps').addEventListener('click',()=>shotAction(shotBlob,shotName(),'copy',bDet));
$('ps-dl').addEventListener('click',()=>shotAction(shotBlob,shotName(),'save',bDet));
$('mpp-copy').addEventListener('click',()=>shotAction(mppBlob,mppName(),'copy',bMpp));
$('mpp-dl').addEventListener('click',()=>shotAction(mppBlob,mppName(),'save',bMpp));

let canWrite=false;
const dF=$('d-from'), dT=$('d-to');
let dbOverlay={}, localOverlay={}, dbRef=null, dbReady=false;
let dbSchedDoc=null, localSched=null, dbSchedRef=null;
const setStatus=(msg,kind)=>{ const s=$('status'); s.textContent=msg||''; s.className='status'+(kind?' '+kind:''); };
let staleCount=0;
function effectiveDays(){
  const out={}; staleCount=0; for(const d in D.days) out[d]=D.days[d];
  for(const src of [dbOverlay,localOverlay]) for(const d in src){
    if(src[d].deleted) delete out[d];
    else if(src[d].basis==='excl2') out[d]=src[d];
    else staleCount++;
  }
  return out;
}
function effectiveSched(){
  if(localSched) return localSched;
  if(dbSchedDoc && dbSchedDoc.basis==='sched1' && Array.isArray(dbSchedDoc.people)) return dbSchedDoc;
  return D.sched || null;
}
function setRange(a,b){ if(a>b) b=a; dF.value=a; dT.value=b; aggregate(a,b); all(); }
function rebuild(fullRange){
  const pf=dF.value, pt=dT.value;
  const oldLast = dates[dates.length-1];
  const wasAll = !pf || (pf===dates[0] && pt===oldLast);
  const followEnd = !!pt && pt===oldLast;
  days=effectiveDays(); dates=Object.keys(days).sort();
  setSched(effectiveSched());
  [dF,dT].forEach(el=>{ el.min=dates[0]||''; el.max=dates[dates.length-1]||''; });
  renderDataBar();
  if(staleCount && !$('status').textContent) setStatus(staleCount+' hari data tersimpan memakai format lama (belum ada rincian master brand) dan diabaikan. Unggah ulang file untuk menggantinya.','warn');
  if(!dates.length){ dF.value=''; dT.value=''; aggregate('9','0'); all(); return; }
  const first=dates[0], last=dates[dates.length-1];
  if(fullRange||wasAll) setRange(first,last);
  else setRange(pf<first?first:pf, followEnd?last:(pt>last?last:pt));
}
/* Checklist database wajib unggah + template standar (format sama dengan halaman Monitoring) */
const CKOPEN={};
const CKMON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const ckLab=d=>(+d.slice(8))+' '+CKMON[+d.slice(5,7)-1];
const ckDates=a=>a.length? a.slice(0,12).map(ckLab).join(', ')+(a.length>12?' dan '+(a.length-12)+' tanggal lain':'') : '';
function ckPeriod(){
  const z=n=>String(n).padStart(2,'0'), t=new Date(), today=t.getFullYear()+'-'+z(t.getMonth()+1)+'-'+z(t.getDate());
  const ref=$('d-to').value||dates[dates.length-1]||today;
  return {y:+ref.slice(0,4),m:+ref.slice(5,7),day:+ref.slice(8,10),ref};
}
function ckItems(){
  const P=ckPeriod(), z=n=>String(n).padStart(2,'0'), ym=P.y+'-'+z(P.m), exp=[]; for(let i=1;i<=P.day;i++) exp.push(ym+'-'+z(i));
  const sd=new Set((SCH&&SCH.dates)||[]), hasS=!!(SCH&&SCH.people&&SCH.people.length);
  const out=[], mk=(id,title,file,bad,warn,okTxt,badTxt,lines,tpl)=>out.push({id,title,file,state:bad.length?'bad':(warn&&warn.length?'warn':'ok'),summary:bad.length?badTxt:(warn&&warn.length?warn[0]:okTxt),lines:lines.filter(Boolean),tpl});
  const miss=exp.filter(d=>!days[d]);
  const nojam=exp.filter(d=>days[d]&&!(days[d].hours&&days[d].hours.length));
  mk('sales','Sales Detail Report (per transaksi)','File: Sales Detail Report (kolom Receipt Date)',miss,nojam.length?[nojam.length+' hari belum ada rincian jam transaksi']:null,'Lengkap sampai '+ckLab(P.ref),miss.length+' tanggal belum ada',
    [miss.length?'Belum ada: '+ckDates(miss):'Semua tanggal 1 sampai '+ckLab(P.ref)+' sudah ada.',nojam.length?'Belum ada rincian jam: '+ckDates(nojam):'','Isi: penjualan exclude PPN per salesperson, struk, dan jam transaksi. Tarik setelah hari selesai.'],['sales']);
  const old=(f)=>exp.filter(d=>days[d]&&!f(days[d]));
  const mbOk=x=>!!(x.mb&&Object.keys(x.mb).length)&&Array.isArray(x.prot), itOk=x=>(x.people||[]).some(p=>Array.isArray(p.it)&&p.it.length);
  const mbOld=old(mbOk), mbBad=miss.concat(mbOld).sort();
  mk('mb','Master brand dan Mitra10 Proteksi (BCA)','File: Sales Detail Report (kolom Master Brand dan Item)',mbBad,null,'Lengkap sampai '+ckLab(P.ref),mbBad.length+' tanggal belum ada atau perlu unggah ulang',
    [miss.length?'Belum ada: '+ckDates(miss):'',mbOld.length?'Perlu diunggah ulang (data lama belum memuat master brand atau proteksi): '+ckDates(mbOld):'',!mbBad.length?'Semua tanggal memuat master brand dan proteksi.':'','Isi: penjualan per master brand dan qty serta value Mitra10 Proteksi per salesperson.'],['sales']);
  const itOld=old(itOk), itBad=miss.concat(itOld).sort();
  mk('item','Detail item per salesperson (pop up)','File: Sales Detail Report (kolom Item No, Item Name, Qty)',itBad,null,'Lengkap sampai '+ckLab(P.ref),itBad.length+' tanggal belum ada atau perlu unggah ulang',
    [miss.length?'Belum ada: '+ckDates(miss):'',itOld.length?'Perlu diunggah ulang (data lama belum memuat detail item): '+ckDates(itOld):'',!itBad.length?'Semua tanggal memuat detail item.':'','Isi: category, master brand, no item, deskripsi, qty, dan value per salesperson.'],['sales']);
  const ms=hasS? exp.filter(d=>!sd.has(d)) : exp;
  mk('sched','Jadwal dan target salesperson','File: jadwal & target (kolom SALES ID, TARGET/DAY, lalu kolom tanggal)',ms,null,hasS? SCH.people.length+' orang, sampai '+ckLab(SCH.dates[SCH.dates.length-1]) : '',hasS? ms.length+' tanggal belum ada di jadwal' : 'Belum ada file jadwal',
    [hasS? (ms.length?'Belum ada di jadwal: '+ckDates(ms):'Semua tanggal 1 sampai '+ckLab(P.ref)+' ada di jadwal.') : 'Belum ada jadwal & target.','Isi: kode jadwal harian (S/P/M/OFF dst), zonasi, master brand, category, TARGET/DAY dan TARGET/MONTH.'],['sched']);
  return out;
}
function tplSheet(kind,y,m){
  const z=n=>String(n).padStart(2,'0'), dim=new Date(y,m,0).getDate(), ds=[...Array(dim)].map((_,i)=>y+'-'+z(m)+'-'+z(i+1));
  if(kind==='sales') return {name:'Sales Detail',rows:[['Receipt Date','Receipt No','Store No','Time','Salescode ID','Salescode Name','Category','Master Brand','Master Type Brand','Item No','Item Name','Qty','Amount Include Sales','Dicount Amount','Amount Exclude Sales']]};
  return {name:'Jadwal '+CKMON[m-1]+' '+y,rows:[['No','Sales ID','Nama','Master Brand','Category','Zonasi','Target/Month','Target/Day',...ds]]};
}
const TPLGUIDE=[['PETUNJUK TEMPLATE UNGGAH DASHBOARD PENCAPAIAN SALESPERSON'],[''],['1. Isi hanya sheet data. Jangan ubah nama kolom di baris judul.'],['2. Sheet Petunjuk ini dilewati saat diunggah (hanya sheet pertama yang dibaca).'],['3. Sales Detail: tempel data laporan Sales Detail dari sistem di bawah baris judul. Kolom wajib: Receipt Date, Receipt No, Qty, Amount Exclude Sales, Salescode ID, Salescode Name. Store No harus 10005.'],['4. Jadwal: satu baris per salesperson. Isi kode jadwal harian (S, P, M, OFF, dst) pada kolom tanggal, lalu TARGET/DAY dan TARGET/MONTH.'],['5. Unggah lewat tombol Unggah file. Tanggal yang sudah ada akan diganti.']];
async function dlTpl(kinds){
  if(!window.XLSX){ setStatus('Pembaca Excel belum termuat. Coba lagi sebentar.','err'); return; }
  const P=ckPeriod(), wb=XLSX.utils.book_new();
  kinds.forEach(k=>{ const t=tplSheet(k,P.y,P.m); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(t.rows),t.name); });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(TPLGUIDE),'Petunjuk');
  const out=XLSX.write(wb,{type:'array',bookType:'xlsx'});
  const blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const nm={sales:'sales-detail',sched:'jadwal'};
  try{ await saveBlob(blob,'template-'+(kinds.length>1?'semua':nm[kinds[0]])+'-'+P.y+'-'+String(P.m).padStart(2,'0')+'.xlsx'); }catch(e){ setStatus('Template gagal diunduh.','warn'); }
}
function renderChecklist(){
  if(!$('ckBtn')) return;
  const it=ckItems(), nOk=it.filter(x=>x.state==='ok').length, P=ckPeriod();
  const worst=it.some(x=>x.state==='bad')?'bad':it.some(x=>x.state==='warn')?'warn':'ok';
  $('ckBtn').className='ckbtn '+worst; $('ckBtn').innerHTML='<span class="ckdot"></span>Checklist database <b>'+nOk+'/'+it.length+'</b>';
  const ic={ok:'✓',warn:'!',bad:'✕'}, esc2=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  $('ckList').innerHTML=it.map((x,i)=>'<li class="ckrow '+x.state+(CKOPEN[x.id]?' open':'')+'"><button type="button" class="ckhead" data-ck="'+x.id+'" aria-expanded="'+!!CKOPEN[x.id]+'"><span class="ckic">'+ic[x.state]+'</span><span class="cktx"><b>'+(i+1)+'. '+x.title+'</b><small>'+esc2(x.summary)+'</small></span><span class="ckch">▾</span></button>'
    +'<div class="ckdet"><p>'+x.lines.map(esc2).join('</p><p>')+'</p><p class="ckf">'+x.file+'</p><div class="ckacts">'+(canWrite!==false?'<button type="button" class="ckchip" data-up="1">Unggah file</button>':'')+'<button type="button" class="ckchip" data-tpl="'+x.id+'">Unduh template</button></div></div></li>').join('');
  $('ckSub').textContent='Periode '+CKMON[P.m-1]+' '+P.y+', sampai '+ckLab(P.ref)+' (mengikuti tanggal "Sampai")';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#ckBtn'); if(b){ const o=$('ckPanel').hidden; $('ckPanel').hidden=!o; b.setAttribute('aria-expanded',String(o)); return; }
  const h=e.target.closest('.ckhead'); if(h){ CKOPEN[h.dataset.ck]=!CKOPEN[h.dataset.ck]; renderChecklist(); return; }
  const u=e.target.closest('[data-up]'); if(u){ $('file').click(); return; }
  const t=e.target.closest('[data-tpl]'); if(t){ const it=ckItems().find(x=>x.id===t.dataset.tpl); if(it) dlTpl(it.tpl); return; }
  if(e.target.closest('#ckAll')){ dlTpl(['sales','sched']); return; }
  if(!e.target.closest('#ckPanel') && $('ckPanel') && !$('ckPanel').hidden){ $('ckPanel').hidden=true; $('ckBtn').setAttribute('aria-expanded','false'); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&$('ckPanel')&&!$('ckPanel').hidden){ $('ckPanel').hidden=true; $('ckBtn').focus(); } });
function renderDataBar(){
  const n=dates.length, f=o=>fd(o,{day:'numeric',month:'short',year:'numeric'});
  $('db-title').textContent = n? n+' hari data · '+f(dates[0])+(n>1?' sampai '+f(dates[n-1]):'') : 'Belum ada data';
  $('db-sub').textContent = 'Unggah laporan Sales Detail atau file jadwal & target (.xlsx, .xls, .csv), bisa lebih dari satu file. Tanggal penjualan yang sudah ada akan diganti.'+(dbReady?' Data tersimpan di Supabase dan langsung tampil di semua perangkat tim.':' Data belum tersambung ke penyimpanan.');
  if(canWrite===false) $('db-sub').textContent='Peran Anda viewer, jadi hanya bisa melihat data. Untuk memperbarui data, minta admin mengubah peran Anda menjadi editor.';
  const s=SCH;
  $('sch-info').textContent = s.people.length? 'Jadwal & target: '+s.people.length+' orang · '+f(s.dates[0])+(s.dates.length>1?' sampai '+f(s.dates[s.dates.length-1]):'')+(s.source?' · '+s.source:'') : 'Belum ada jadwal & target. Unggah file jadwal untuk menampilkan kolom target.';
  $('mg-body').innerHTML = dates.slice().reverse().map(d=>{
    const x=days[d]; return '<tr><td>'+fd(d)+'</td><td class="num">'+rp(x.meta.total)+'</td><td class="num">'+x.people.length+'</td><td>'+esc(x.source||'File awal')+'</td><td><button type="button" class="btn sm" data-del="'+d+'">Hapus</button></td></tr>';
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--ink3)">Belum ada data. Unggah file untuk mulai.</td></tr>';
  renderChecklist();
}
const errText = e => !e? '' : e.code==='quota_exceeded' ? 'Penyimpanan penuh.' : (e.code==='revoked'||e.code==='not_granted') ? 'Akses penyimpanan tidak tersedia.' : 'Penyimpanan gagal ('+(e.code||'error')+').';
const dbErr = e => !e? '' : (e.code==='42501'||/row-level security|permission/i.test(e.message||'')) ? 'Akun Anda tidak punya izin mengubah data.' : 'Penyimpanan gagal ('+(e.message||e.code||'error')+').';
async function persist(ds, sched){
  if(!SB) return 'Penyimpanan belum tersedia.';
  let fail=0, last=null;
  for(const d of ds){
    const doc=localOverlay[d];
    const { error } = await SB.from('dashboard_days').upsert({store_code:D.code, sale_date:d, doc, source:doc.source||null, uploaded_at:new Date().toISOString()},{onConflict:'store_code,sale_date'});
    if(error){ fail++; last=error; } else delete localOverlay[d];
  }
  if(sched){
    const { error } = await SB.from('dashboard_schedule').upsert({store_code:D.code, doc:sched, source:sched.source||null, uploaded_at:new Date().toISOString()},{onConflict:'store_code'});
    if(error){ fail++; last=error; } else if(localSched===sched) localSched=null;
  }
  if(!fail) await loadAll();
  return fail? dbErr(last)+' '+fail+' bagian belum tersimpan.' : '';
}
let busy=false;
async function handleFiles(list){
  const files=[...list]; if(!files.length||busy) return;
  if(!canWrite){ setStatus('Peran Anda hanya bisa melihat data.','warn'); return; }
  if(!window.XLSX){ setStatus('Pembaca Excel gagal dimuat. Periksa koneksi, lalu muat ulang halaman.','err'); return; }
  busy=true; $('upload').disabled=true;
  const found={}, notes=[]; let used=0, newSched=null;
  for(const f of files){
    try{
      setStatus('Membaca '+f.name+'…');
      const buf=await f.arrayBuffer();
      let r=null;
      try{ r=parseReport(window.XLSX, buf, D.code); }
      catch(e){
        if(!/Receipt Date/.test(e&&e.message||'')) throw e;
        try{ const sc=parseSchedule(window.XLSX, buf); sc.source=f.name; sc.uploadedAt=new Date().toISOString(); newSched=sc; continue; }
        catch(e2){ throw new Error('format tidak dikenali (bukan laporan Sales Detail dan bukan file jadwal & target)'); }
      }
      for(const d in r.days) found[d]=Object.assign(r.days[d],{source:f.name,uploadedAt:new Date().toISOString()});
      used+=r.used;
      if(r.skippedStore) notes.push(f.name+': '+r.skippedStore+' baris dari toko lain dilewati.');
      if(r.skippedRows) notes.push(f.name+': '+r.skippedRows+' baris tanpa tanggal valid dilewati.');
      if(!r.used) notes.push(f.name+': tidak ada baris data untuk toko '+D.code+'.');
    }catch(e){ notes.push(f.name+': '+(e&&e.message||'gagal dibaca')); }
  }
  const ds=Object.keys(found).sort();
  if(!ds.length && !newSched){ setStatus('Tidak ada data yang bisa dimuat. '+notes.join(' '),'err'); busy=false; $('upload').disabled=false; return; }
  ds.forEach(d=>{ localOverlay[d]=found[d]; });
  if(newSched) localSched=newSched;
  rebuild(true);
  const parts=[];
  if(ds.length){ const rng = ds.length>1? fd(ds[0],{day:'numeric',month:'short'})+' sampai '+fd(ds[ds.length-1],{day:'numeric',month:'short',year:'numeric'}) : fd(ds[0]); parts.push(fmtN.format(used)+' baris penjualan, '+ds.length+' hari ('+rng+')'); }
  if(newSched) parts.push('jadwal & target '+newSched.people.length+' orang');
  setStatus('Dashboard diperbarui: '+parts.join('; ')+'. Menyimpan…');
  const err=await persist(ds, newSched);
  setStatus('Dashboard diperbarui: '+parts.join('; ')+'.'+(err? ' '+err : (dbRef?' Tersimpan.':''))+(notes.length?' '+notes.join(' '):''), err||notes.length?'warn':'ok');
  busy=false; $('upload').disabled=false;
}
async function removeDate(d){
  delete localOverlay[d];
  if(!SB||!canWrite){ setStatus('Peran Anda tidak bisa menghapus data.','warn'); return; }
  const { data, error } = await SB.from('dashboard_days').delete().eq('store_code',D.code).eq('sale_date',d).select('sale_date');
  if(error){ setStatus(dbErr(error),'warn'); return; }
  if(!data||!data.length){ setStatus('Data '+fd(d)+' tidak terhapus. Akun Anda mungkin tidak punya izin.','warn'); return; }
  setStatus('Data '+fd(d)+' dihapus.','ok');
  await loadAll();
}
$('upload').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',e=>{ handleFiles(e.target.files); e.target.value=''; });
$('manage').addEventListener('click',()=>{ const p=$('manage-panel'); p.hidden=!p.hidden; $('manage').setAttribute('aria-expanded',String(!p.hidden)); });
let armed=null, armT=0;
$('mg-body').addEventListener('click',e=>{
  const b=e.target.closest('[data-del]'); if(!b) return;
  if(armed===b){ clearTimeout(armT); armed=null; removeDate(b.dataset.del); return; }
  if(armed){ armed.textContent='Hapus'; } clearTimeout(armT);
  armed=b; b.textContent='Klik lagi untuk hapus';
  armT=setTimeout(()=>{ if(armed===b){ b.textContent='Hapus'; armed=null; } },4000);
});
const bar=$('databar');
addEventListener('dragover',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ e.preventDefault(); bar.classList.add('drag'); } });
addEventListener('dragleave',e=>{ if(!e.relatedTarget) bar.classList.remove('drag'); });
addEventListener('drop',e=>{ if(e.dataTransfer&&e.dataTransfer.files.length){ e.preventDefault(); bar.classList.remove('drag'); handleFiles(e.dataTransfer.files); } });
dF.addEventListener('change',()=>{ if(dF.value) setRange(dF.value, dT.value||dF.value); });
dT.addEventListener('change',()=>{ if(dT.value) setRange(dF.value||dT.value, dT.value); });
$('d-all').addEventListener('click',()=>{ if(dates.length) setRange(dates[0],dates[dates.length-1]); });
$('zona').addEventListener('change',e=>{ S.zona=e.target.value; all(); });
rebuild(true);
// ---- Supabase: login, peran, dan data bersama ----
const CFG = window.APP_CONFIG || {};
const SB = (window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_PUBLISHABLE_KEY && !/YOUR-/.test(CFG.SUPABASE_URL)) ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY) : null;
const bootEl=$('boot'), appEl=$('app');
const bootMsg=(t,showOut)=>{ $('boot-msg').textContent=t; $('boot-out').hidden=!showOut; bootEl.hidden=false; appEl.hidden=true; $('psdock').hidden=true; };
const toLogin=()=>{ try{sessionStorage.setItem('mitra10_next','dashboard.html')}catch(e){} location.replace('login.html?next=dashboard.html'); };
async function loadAll(){
  if(!SB) return;
  const [d,s]=await Promise.all([
    SB.from('dashboard_days').select('sale_date,doc').eq('store_code',D.code).order('sale_date'),
    SB.from('dashboard_schedule').select('doc').eq('store_code',D.code).maybeSingle()
  ]);
  if(d.error||s.error){ dbReady=false; setStatus('Data tidak bisa dibaca. '+dbErr(d.error||s.error),'warn'); renderDataBar(); return; }
  const o={}; (d.data||[]).forEach(r=>{ if(r.doc) o[r.sale_date]=r.doc; });
  dbOverlay=o; dbSchedDoc=(s.data&&s.data.doc)||null; dbReady=true; rebuild(false);
}
let reloadT=0; const reloadSoon=()=>{ clearTimeout(reloadT); reloadT=setTimeout(()=>{ if(!busy) loadAll(); },500); };
function applyWrite(){ $('upload').hidden=!canWrite; $('manage').hidden=!canWrite; renderDataBar(); }
const ROLE_LABEL={admin:'Admin',editor:'Editor',viewer:'Viewer'};
async function boot(){
  rebuild(true);
  if(!SB){ bootMsg('Konfigurasi belum lengkap. Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di config.js.',false); return; }
  const { data:{ session } } = await SB.auth.getSession();
  if(!session){ toLogin(); return; }
  SB.auth.onAuthStateChange(ev=>{ if(ev==='SIGNED_OUT') toLogin(); });
  const { data:roleRow, error:roleErr } = await SB.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
  if(roleErr){ bootMsg('Peran akun tidak bisa dibaca: '+roleErr.message,true); return; }
  if(!roleRow){ bootMsg('Akun '+session.user.email+' belum punya peran. Hubungi admin.',true); return; }
  canWrite = roleRow.role==='admin'||roleRow.role==='editor';
  $('who-name').textContent=session.user.email; $('who-role').textContent=ROLE_LABEL[roleRow.role]||roleRow.role;
  bootEl.hidden=true; appEl.hidden=false; $('psdock').hidden=false;
  applyWrite();
  await loadAll();
  const ch=SB.channel('dashboard-data');
  ['dashboard_days','dashboard_schedule'].forEach(t=>ch.on('postgres_changes',{event:'*',schema:'public',table:t},reloadSoon));
  ch.subscribe();
  const refresh=()=>{ if(!busy && !document.hidden) loadAll(); };
  setInterval(refresh,60000);
  document.addEventListener('visibilitychange',refresh);
  addEventListener('focus',refresh);
}
const signOut=async()=>{ try{ if(SB) await SB.auth.signOut(); }catch(e){} location.replace('index.html'); };
$('logout').addEventListener('click',signOut); $('boot-out').addEventListener('click',signOut);
boot().catch(e=>bootMsg('Gagal memulai: '+(e&&e.message||e),true));

})();
