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
    const d = days[date] || (days[date]={tot:0,rec:new Set(),lines:0,unS:0,unL:0,unRec:new Set(),people:{},hours:{}});
    const amt = num(get(r,'amount exclude sales')), inc = num(get(r,'amount include sales')), rn = String(get(r,'receipt no')).trim();
    let sid = String(get(r,'salescode id')).trim(); if(/^(null|none|nan|n\/a|-)$/i.test(sid)) sid='';
    d.tot += amt; d.rec.add(rn); d.lines++; used++;
    const hr = hourOf(get(r,'time')); if(hr!==null) d.hours[hr] = (d.hours[hr]||0)+amt;
    if(!sid){ d.unS += amt; d.unL++; d.unRec.add(rn); continue; }
    const p = d.people[sid] || (d.people[sid]={id:sid,name:'',sales:0,incl:0,qty:0,rec:new Set(),lines:0,disc:0,cats:{},brands:{},pb:0});
    if(!p.name){ const nm=clean(get(r,'salescode name')); if(nm && !/^(null|none|nan)$/i.test(nm)) p.name=nm; }
    p.sales += amt; p.incl += inc; p.qty += num(get(r,'qty'));
    p.rec.add(rn); p.lines++; p.disc += num(get(r,'dicount amount'));
    const cat = String(get(r,'category')).trim() || 'Lainnya';
    p.cats[cat] = (p.cats[cat]||0)+amt;
    const mb = String(get(r,'master brand')).trim().toUpperCase() || 'LAINNYA';
    p.brands[mb] = (p.brands[mb]||0)+amt;
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
        return {id:p.id,name:nm,role:/KASIR/i.test(nm)?'Kasir':'Sales',sales:Math.round(p.sales),incl:Math.round(p.incl),qty:Math.round(p.qty),receipts:p.rec.size,lines:p.lines,disc:Math.round(p.disc),cats,brands,pb:Math.round(p.pb)};
      }),
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
function setSched(s){
  SCH = s || {dates:[],people:[]}; SCHM = {};
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
  const m = {total:0,receipts:0,lines:0,unSales:0,unLines:0,unReceipts:0,days:sel.length,from:sel[0],to:sel[sel.length-1]};
  const map = {}, hrs = {};
  sel.forEach(d=>{ const x=days[d];
    for(const k of ['total','receipts','lines','unSales','unLines','unReceipts']) m[k]+=x.meta[k];
    x.hours.forEach(h=>{hrs[h.h]=(hrs[h.h]||0)+h.sales;});
    x.people.forEach(p=>{
      const a = map[p.id] || (map[p.id]={id:p.id,name:p.name,role:p.role,sales:0,excl:0,qty:0,receipts:0,lines:0,disc:0,cats:{},brands:{},pb:0});
      for(const k of ['sales','excl','qty','receipts','lines','disc','pb']) a[k]+=(p[k]||0);
      for(const b in (p.brands||{})) a.brands[b]=(a.brands[b]||0)+p.brands[b];
      a.name=p.name; for(const c in p.cats) a.cats[c]=(a.cats[c]||0)+p.cats[c];
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
  if(p.lines) h+='<br>Rata-rata '+rp(p.avg)+' / struk';
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
    const hi=l.filter(p=>p.sales/p.target>=1).length, lo=l.filter(p=>p.sales/p.target<.75).length;
    return {n,hi,lo,hiP:n?hi/n:0,loP:n?lo/n:0,ipd:wd?rc/wd:0,bz:rc?s/rc:0}; };
  const rows=zs.map(z=>{ const num=(z.match(/\d+/)||[''])[0]; const l=list.filter(p=>p.zona===z);
    const cats=[...new Set(SCH.people.filter(e=>e.zona===z).map(e=>title(e.cat||'')).filter(Boolean))];
    return Object.assign({z:num||z, cat:ZLAB[num]||cats.join(', ')}, agg(l)); });
  return {rows, tot:agg(list)};
}
function mppTable(name,color,list){
  const {rows,tot}=mppSummary(list), pc=v=>Math.round(v*100)+'%', ip=v=>v?v.toFixed(2).replace('.',','):'0', bz=v=>v?fmtN.format(Math.round(v)):'0';
  const tr=r=>'<td class="num">'+r.n+'</td><td class="num '+(r.hi?'ok':'')+'">'+r.hi+'</td><td class="num g">'+pc(r.hiP)+'</td><td class="num">'+r.lo+'</td><td class="num r">'+pc(r.loP)+'</td><td class="num">'+ip(r.ipd)+'</td><td class="num">'+bz(r.bz)+'</td>';
  return '<div class="mpp"><div class="mpph"><i style="background:'+color+'"></i>'+esc(name)+'</div><div class="scroll" style="max-height:none"><table class="mt"><thead><tr><th class="l">Zona</th><th class="l">Category</th><th>Actual MPP</th><th>Salper ≥100%</th><th>Cont</th><th>Salper &lt;75%</th><th>Cont</th><th>IPD</th><th>BZ</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td class="l">'+esc(r.z)+'</td><td class="l cat">'+esc(r.cat)+'</td>'+tr(r)+'</tr>').join('')+
    '<tr class="tot"><td class="l" colspan="2">Total</td>'+tr(tot)+'</tr></tbody></table></div></div>';
}
function renderMPP(){
  const body=$('mpp-body');
  if(!SCH.people.length){ body.innerHTML='<p class="note">Unggah file jadwal &amp; target untuk menampilkan summary ini.</p>'; $('mpp-sub').textContent=''; $('mpp-note').textContent=''; return; }
  const mem=P.filter(p=>p.hasSch && p.target>0);
  $('mpp-sub').textContent = (M.days? (M.days===1? 'Daily · '+fd(M.from,{day:'numeric',month:'short',year:'numeric'}) : fd(M.from,{day:'numeric',month:'short'})+' sampai '+fd(M.to,{day:'numeric',month:'short',year:'numeric'})+' · '+M.days+' hari') : 'tidak ada data')+' · berdasarkan achievement penjualan';
  body.innerHTML = mppTable('Summary all salesperson, all staff (PB & eksternal)','#f0a500',mem)+mppTable('Summary all salesperson, Private Brand only','#2a9de0',mem.filter(p=>String(p.brand||'').toUpperCase()==='PRIVATE BRAND'));
  $('mpp-note').textContent='Actual MPP = jumlah salesperson yang punya hari kerja (target) pada rentang tanggal. Salper = jumlah orang dengan achievement (penjualan ÷ target) di atas atau di bawah batas itu, Cont = persen dari MPP. IPD = rata-rata invoice (struk) yang dihasilkan per salesperson per hari kerja. BZ = rata-rata nilai penjualan per struk; arti BZ saya baca dari contoh Anda, jadi koreksi bila berbeda.';
}

const COLS = [
  ['rank','#'],['name','Salesperson'],['zona','Zonasi'],['code','Jadwal'],['cat','Kategori utama'],['sales','Penjualan'],['brand','Penjualan master brand'],['nonbrand','Penjualan non master brand'],['target','Target'],['ach','Pencapaian'],['wd','Hari kerja'],['share','% total'],['receipts','Struk'],['qty','Qty'],['avg','Rata-rata / struk']
];
const TXT = new Set(['name','cat','zona','code']);
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
  const cols = COLS.filter(c=>hasT || !['zona','code','wd','brand','nonbrand','target','ach'].includes(c[0]));
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
  const val = (p,k)=> k==='share'?p.sales : k==='brand'?brandSales(p) : k==='nonbrand'?nonBrand(p) : k==='ach'?ratio(p) : k==='target'?(p.target==null?-1:p.target) : k==='code'?codeOn(p.id,sd) : k==='rank'?(p.rank==null?1e9:p.rank) : TXT.has(k)?String(p[k]||'').toLowerCase() : p[k];
  const L = base.filter(p=>!q||p.name.toLowerCase().includes(q)).sort((a,b)=>{
    const x=val(a,S.sort), y=val(b,S.sort); return (x<y?-1:x>y?1:0)*S.dir; });
  const mx = Math.max(1,...P.map(p=>p.sales));
  lastL=L; lastHasT=hasT; lastSd=sd;
  $('tbody').innerHTML = L.map(p=>{
    const a=ratio(p), cd=codeOn(p.id,sd);
    let t='<tr><td class="rk num">'+(p.rank==null?'–':p.rank)+'</td><td class="l">'+esc(p.name)+(p.role==='Kasir'?'<span class="chip">Kasir</span>':'')+'</td>'+(hasT?'<td class="l">'+(p.zona?esc(p.zona):'–')+'</td><td class="l">'+(cd?esc(cd):'–')+'</td>':'')+'<td class="l">'+(p.cat?esc(title(p.cat)):'–')+'</td>'+
      '<td class="num"><div class="cell"><span class="mini"><i style="width:'+Math.max(0,p.sales/mx*100)+'%"></i></span><span style="min-width:100px;display:inline-block;text-align:right">'+rp(p.sales)+'</span></div></td>'+(hasT?'<td class="num" title="'+esc(brandTip(p))+'">'+(p.brand?rp(brandSales(p))+'<span class="bn">'+esc(title(p.brand))+'</span>':'–')+'</td><td class="num">'+(p.brand?rp(nonBrand(p)):'–')+'</td>':'');
    if(hasT){
      t+='<td class="num">'+(p.target==null?'–':p.target===0?'<span style="color:var(--ink3)">tidak ada</span>':rp(p.target))+'</td>'+
        '<td class="num">'+(p.target>0? '<span class="pill '+(a>=1?'hi':a>=.75?'mid':'lo')+'">'+(a>=1?'✓ ':'')+Math.round(a*100)+'%</span>' : '–')+'</td>'+
        '<td class="num">'+(p.hasSch&&p.cov? p.wd : '–')+'</td>';
    }
    t+='<td class="num">'+pct(p.sales/(M.total||1))+'</td><td class="num">'+p.receipts+'</td><td class="num">'+fmtN.format(p.qty)+'</td><td class="num">'+(p.lines?rp(p.avg):'–')+'</td>';
    return t+'</tr>';
  }).join('') || '<tr><td colspan="15" style="text-align:center;color:var(--ink3)">Tidak ada orang yang cocok dengan filter.</td></tr>';
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

function renderFoot(){
  const noSch = P.filter(p=>p.lines>0 && !p.hasSch).length;
  $('foot').innerHTML = '<b>Catatan data.</b> '+fmtN.format(M.unLines)+' baris item ('+fmtN.format(M.unReceipts)+' struk, '+rp(M.unSales)+', '+pct(M.unSales/(M.total||1))+' dari total) tidak memiliki kode sales, jadi tidak masuk peringkat tetapi tetap dihitung di total toko. Nilai penjualan memakai kolom Amount Exclude Sales. Penjualan master brand adalah jumlah penjualan barang (rincian item) yang dijual salesperson itu dan masuk master brand yang tertulis di file jadwal; untuk Private Brand dipakai penanda Master Type Brand = Private Brand. Satu orang bisa muncul di beberapa struk yang sama dengan orang lain, sehingga jumlah struk per orang tidak dijumlahkan ke total. '+
   '<b>Target.</b> Target harian diambil dari kolom TARGET/DAY di file jadwal, dicocokkan lewat Sales ID. Target MTD atau target satu rentang tanggal adalah target harian dikali jumlah hari kerja yang sudah berjalan dalam rentang itu. Hari kerja adalah tanggal berkode S, P, atau M (termasuk P/JKP dan S/JKS). Kode OFF, CT, L, MT, OT, dan OUTING tidak punya target. Hari setelah tanggal akhir rentang belum dihitung. Penjualan di hari tanpa target tetap dihitung sebagai penjualan.'+(noSch?' '+noSch+' orang bertransaksi tetapi tidak ada di file jadwal, jadi ditampilkan tanpa target.':'');
}

function all(){ renderSub(); renderKPI(); renderRank(); renderMPP(); renderTable(); renderFoot(); }
document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>{ S.role=b.dataset.role; document.querySelectorAll('[data-role]').forEach(x=>x.setAttribute('aria-pressed',x===b)); all(); }));
document.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ S.m=b.dataset.m; document.querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',x===b)); renderRank(); }));
$('topn').addEventListener('change',e=>{ S.topn=parseInt(e.target.value,10); renderRank(); });
$('q').addEventListener('input',e=>{ S.q=e.target.value; renderTable(); });
// ---- Screenshot tabel detail (PNG untuk dibagikan) ----
function shotCanvas(){
  const rows = lastL, hasT = lastHasT, sd = lastSd;
  const S2=Math.max(1,Math.min(2,12000/(150+36*(lastL.length+3)))), W=1080, padX=32, FONT="'Public Sans',system-ui,-apple-system,'Segoe UI',sans-serif", DISP="'Schibsted Grotesk','Public Sans',system-ui,sans-serif";
  const cols = hasT
    ? [['#',44,'r'],['Salesperson',220,'l'],['Zonasi',90,'l'],['Jadwal '+shortD(sd),80,'l'],['Penjualan',130,'r'],['Penjualan master brand',160,'bt'],['Non master brand',130,'r'],['Target',120,'r'],['Pencapaian',150,'bar']]
    : [['#',44,'r'],['Salesperson',280,'l'],['Kategori utama',220,'l'],['Penjualan',170,'r'],['% total',100,'r'],['Struk',70,'r']];
  const tw = cols.reduce((a,c)=>a+c[1],0), scale=(W-padX*2)/tw; cols.forEach(c=>c[1]=c[1]*scale);
  const q = S.q.trim();
  const f = []; f.push(S.role==='all'?'Semua peran':S.role==='Kasir'?'Kasir':'Sales'); if(S.zona) f.push('Zonasi '+S.zona);
  if(lastHasT && !S.schSel.length) f.push('Tanggal jadwal '+shortD(sd)); if(S.schSel.length) f.push('Jadwal '+schLabel()+' ('+shortD(sd)+')'); if(lastDr) f.push((S.dMode==='mtd'?'MTD':'Rentang tabel')+' '+lastM.days+' hari'); if(q) f.push('Cari "'+q+'"');
  const period = lastM.from? (lastM.from===lastM.to? fd(lastM.from) : fd(lastM.from,{day:'numeric',month:'short'})+' sampai '+fd(lastM.to)) : '';
  const headH=96, thH=34, rowH=36, footH=48, H=headH+thH+rowH*Math.max(rows.length,1)+footH;
  const c=document.createElement('canvas'); c.width=W*S2; c.height=H*S2; const g=c.getContext('2d'); g.scale(S2,S2);
  g.fillStyle='#fff'; g.fillRect(0,0,W,H); g.textBaseline='middle';
  const fit=(t,w)=>{ t=String(t); if(g.measureText(t).width<=w) return t; while(t.length>1 && g.measureText(t+'…').width>w) t=t.slice(0,-1); return t+'…'; };
  g.fillStyle='#0b0b0b'; g.font='700 22px '+DISP; g.textAlign='left'; g.fillText('Pencapaian Salesperson',padX,30);
  g.fillStyle='#52514e'; g.font='400 13px '+FONT;
  g.fillText(fit(D.store+' · '+period+' · penjualan tanpa PPN',W-padX*2),padX,56);
  g.fillStyle='#7a7975'; g.fillText(fit('Filter: '+f.join(' · ')+' · '+rows.length+' orang',W-padX*2),padX,76);
  let y=headH; g.fillStyle='#f6f6f5'; g.fillRect(padX,y,W-padX*2,thH);
  g.font='500 11px '+FONT; g.fillStyle='#7a7975';
  const cx=(i)=>padX+cols.slice(0,i).reduce((a,x)=>a+x[1],0);
  cols.forEach((k,i)=>{ const x=cx(i), w=k[1]; const l=k[2]==='l'||k[2]==='bar'; g.textAlign=l?'left':'right'; g.fillText(k[0].toUpperCase(),l?x+10:x+w-10,y+thH/2); });
  y+=thH; 
  rows.forEach((p,r)=>{
    const a=p.target>0? p.sales/p.target : -1, cd=codeOn(p.id,sd);
    if(r%2) { g.fillStyle='#fafafa'; g.fillRect(padX,y,W-padX*2,rowH); }
    g.fillStyle='#ecedeb'; g.fillRect(padX,y+rowH-1,W-padX*2,1);
    const cells = hasT
      ? [p.rank==null?'–':p.rank, p.name, p.zona||'–', cd||'–', rp(p.sales), p.brand?brandSales(p):null, p.brand?rp(nonBrand(p)):'–', p.target==null?'–':p.target===0?'tidak ada':rp(p.target), null]
      : [p.rank==null?'–':p.rank, p.name, p.cat?title(p.cat):'–', rp(p.sales), pct(p.sales/(lastM.total||1)), p.receipts];
    cols.forEach((k,i)=>{
      const x=cx(i), w=k[1], mid=y+rowH/2;
      if(k[2]==='bar'){
        const bw=w-20-44, bx=x+10;
        g.fillStyle='#ecedeb'; g.fillRect(bx,mid-4,bw,8);
        if(a>=0){ g.fillStyle=a>=1?'#1f8a4c':'#2a78d6'; g.fillRect(bx,mid-4,Math.min(1,a)*bw,8); g.font='600 13px '+FONT; g.textAlign='right'; g.fillStyle=a>=1?'#1f8a4c':'#0b0b0b'; g.fillText(Math.round(a*100)+'%',x+w-10,mid); }
        else { g.font='400 13px '+FONT; g.textAlign='right'; g.fillStyle='#7a7975'; g.fillText('–',x+w-10,mid); }
        return;
      }
      if(k[2]==='bt'){ g.textAlign='right'; if(cells[i]==null){ g.font='400 13px '+FONT; g.fillStyle='#7a7975'; g.fillText('–',x+w-10,mid); } else { g.font='400 13px '+FONT; g.fillStyle='#0b0b0b'; g.fillText(rp(cells[i]),x+w-10,mid-7); g.font='400 10.5px '+FONT; g.fillStyle='#7a7975'; g.fillText(fit(title(p.brand),w-20),x+w-10,mid+8); } return; }
      const l=k[2]==='l'; g.textAlign=l?'left':'right';
      g.font=(i===1?'500 ':'400 ')+'13px '+FONT; g.fillStyle=(i===0||cells[i]==='–'||cells[i]==='tidak ada')?'#7a7975':'#0b0b0b';
      g.fillText(fit(cells[i],w-20),l?x+10:x+w-10,mid);
    });
    y+=rowH;
  });
  if(!rows.length){ g.fillStyle='#7a7975'; g.textAlign='center'; g.font='400 13px '+FONT; g.fillText('Tidak ada orang yang cocok dengan filter.',W/2,y+rowH/2); y+=rowH; }
  g.fillStyle='#7a7975'; g.font='400 11px '+FONT; g.textAlign='left';
  const now=new Date().toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  g.fillText('Dibuat '+now+(hasT?' · target = TARGET/MONTH dibagi hari kerja jadwal':''),padX,y+footH/2+4);
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
  const W=1080, px=32, S2=2, cols=[['Zona',56,'c'],['Category',330,'l'],['Actual\nMPP',90,'r'],['Salper\n≥100%',96,'r'],['Cont',70,'r'],['Salper\n<75%',96,'r'],['Cont',70,'r'],['IPD',70,'r'],['BZ',138,'r']];
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
      const vals=isTot?['Total','',r.n,r.hi,pc(r.hiP),r.lo,pc(r.loP),ip(r.ipd),bz(r.bz)]:[r.z,r.cat,r.n,r.hi,pc(r.hiP),r.lo,pc(r.loP),ip(r.ipd),bz(r.bz)];
      let x=px; cols.forEach((k,i)=>{
        g.font=(isTot?'700 ':'400 ')+'13px '+FONT; g.fillStyle='#0e1a2b';
        if(i===4&&!isTot) g.fillStyle='#0e6b49'; if(i===6&&!isTot) g.fillStyle='#b4271c';
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
const toLogin=()=>{ location.replace('login.html'); };
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
const signOut=async()=>{ try{ if(SB) await SB.auth.signOut(); }catch(e){} toLogin(); };
$('logout').addEventListener('click',signOut); $('boot-out').addEventListener('click',signOut);
boot().catch(e=>bootMsg('Gagal memulai: '+(e&&e.message||e),true));

})();
