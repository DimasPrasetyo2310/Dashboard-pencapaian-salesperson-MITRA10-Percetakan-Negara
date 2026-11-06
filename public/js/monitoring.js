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

let DATA={D:[],C:[]};
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

function spark(vals){
  if(vals.length<2) return '';
  const w=200,h=34,p=4,mx=Math.max(...vals,1e-9),n=vals.length;
  const x=i=>p+i*(w-2*p)/(n-1), y=v=>h-p-(v/mx)*(h-2*p);
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${vals.map((v,i)=>x(i)+','+y(v)).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const kpiHTML=k=>`<div class="kpi"><span class="l">${k.l}</span><span class="v">${k.v}</span><span class="s">${k.s}</span>${k.sp?spark(k.sp):''}</div>`;

function niceMax(v){const st=[10,20,25,50,100,200,250,500,1000].map(x=>x*1e6);for(const s of st){if(v<=s*5)return [s*5,s]}return [Math.ceil(v/1e9)*1e9,1e9]}

function renderKpis(rows){
  const n=rows.length, cin=sum(rows.map(d=>d.cin)), trn=sum(rows.map(d=>d.tr)), nav=sum(rows.map(d=>d.nav));
  $('kpis').innerHTML=[
    {l:'Traffic',v:nf.format(cin),s:'pengunjung masuk · rata-rata '+nf.format(Math.round(cin/n))+' per hari',sp:rows.map(d=>d.cin)},
    {l:'Invoice',v:nf.format(trn),s:'rata-rata '+nf.format(Math.round(trn/n))+' per hari',sp:rows.map(d=>d.tr)},
    {l:'Efektivitas traffic',v:cin?dec(trn/cin*100,1)+'%':'–',s:'invoice ÷ traffic',sp:rows.map(d=>d.cin?d.tr/d.cin:0)},
    {l:'Basket size',v:trn?rp(nav/trn):'–',s:'sales ÷ invoice',sp:rows.map(d=>d.tr?d.nav/d.tr:0)},
    {l:'Sales',v:rp(nav),s:'exclude tax · '+rp(nav/n)+' per hari',sp:rows.map(d=>d.nav)}
  ].map(kpiHTML).join('');
}
function renderChart(rows){
  const byD=new Map(rows.map(r=>[r.d,r]));
  const months=new Set(rows.map(r=>r.d.slice(0,7))), monthView=months.size===1;
  let slots;
  if(monthView){const p=rows[0].d.split('-').map(Number);const dim=new Date(Date.UTC(p[0],p[1],0)).getUTCDate();slots=Array.from({length:dim},(_,i)=>`${p[0]}-${pad(p[1])}-${pad(i+1)}`)}
  else slots=rows.map(r=>r.d);
  const mxv=Math.max(...rows.map(r=>r.nav));
  const [mx,step]=niceMax(mxv*1.08);
  const W=720,H=250,L=48,R=8,T=12,B=28,iw=W-L-R,ih=H-T-B,slot=iw/slots.length,bw=Math.min(slot*0.62,44);
  const y=v=>T+ih-(v/mx)*ih;
  let g='';
  for(let v=0;v<=mx+1;v+=step){g+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L-6}" y="${y(v)+3.5}" text-anchor="end">${Math.round(v/1e6)}</text>`}
  const every=monthView?5:Math.ceil(slots.length/8);
  slots.forEach((dt,i)=>{
    const show=monthView?(i===0||(i+1)%5===0):(i%every===0);
    if(show) g+=`<text x="${L+(i+0.5)*slot}" y="${H-8}" text-anchor="middle">${monthView?i+1:fd(dt)}</text>`;
    const r=byD.get(dt); if(!r) return;
    const x=L+i*slot+(slot-bw)/2, h=Math.max(ih-(y(r.nav)-T),0), bad=Math.abs(r.nav-r.ffc)>=1;
    const tip=`${fdy(dt)} · ${rp(r.nav)} · ${r.tr} invoice`+(bad?' (NAV dan FFC belum sama)':'');
    g+=`<rect data-tip="${esc(tip)}" x="${x}" y="${y(r.nav)}" width="${bw}" height="${h}" rx="3" fill="var(--accent)" opacity="${bad?.55:1}"/>`;
    g+=`<rect data-tip="${esc(tip)}" x="${L+i*slot}" y="${T}" width="${slot}" height="${ih}" fill="transparent"/>`;
  });
  $('chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik sales harian">${g}</svg>`;
  $('chHint').textContent='Rp juta per hari, exclude tax. '+(monthView?'Sumbu bawah: tanggal.':'Sumbu bawah: tanggal dan bulan.');
  const bads=rows.filter(r=>Math.abs(r.nav-r.ffc)>=1);
  $('chLegend').innerHTML=`<span><i style="background:var(--accent)"></i>Sales NAV</span>`+(bads.length?`<span><i style="background:var(--accent);opacity:.55"></i>NAV dan FFC belum sama</span>`:'');
  $('chNote').innerHTML=bads.length?`<div class="note" style="margin-top:10px">Selisih NAV dan FFC: ${bads.slice(0,4).map(r=>`${fd(r.d)} (${rp(r.nav-r.ffc)}, ${r.tr-r.ffct} invoice)`).join('; ')}${bads.length>4?` dan ${bads.length-4} tanggal lain`:''}. Biasanya data hari berjalan belum sinkron.</div>`:'';
}
function renderCats(){
  const m=new Map();
  DATA.C.forEach(c=>{if(c[0]>=from&&c[0]<=to)m.set(c[1],(m.get(c[1])||0)+c[2])});
  const list=[...m].sort((a,b)=>b[1]-a[1]);
  if(!list.length){$('cats').innerHTML='<div class="empty">Belum ada data kategori pada rentang ini. Unggah laporan detail penjualan untuk menampilkannya.</div>';return}
  const mx=Math.max(...list.map(x=>x[1]),1), total=sum(list.map(x=>x[1]));
  $('cats').innerHTML=list.map(([k,v])=>`<div class="cat" data-tip="${esc(title(k)+' · '+rp(v))}"><div class="t"><span>${esc(title(k))}</span><span class="num">${jt(v)} · ${dec(v/total*100,0)}%</span></div><div class="b"><i style="width:${v/mx*100}%"></i></div></div>`).join('');
}
function renderRows(rows){
  $('rows').innerHTML=rows.map(d=>{
    const diff=d.nav-d.ffc, ok=Math.abs(diff)<1;
    return `<tr><td class="num">${fdy(d.d)}</td><td class="r num">${nf.format(d.cin)}</td><td class="r num">${nf.format(d.cout)}</td><td class="r num">${nf.format(d.tr)}</td><td class="r num">${d.cin?dec(d.tr/d.cin*100,1)+'%':'–'}</td><td class="r num">${d.tr?jt(d.nav/d.tr):'–'}</td><td class="r num">${jt(d.nav)}</td><td class="r num">${jt(d.ffc)}</td><td>${ok?'<span class="pill good">✓ Cocok</span>':`<span class="pill warn">! Selisih ${jt(diff)}</span>`}</td></tr>`}).join('');
  const cin=sum(rows.map(d=>d.cin)),trn=sum(rows.map(d=>d.tr)),nav=sum(rows.map(d=>d.nav)),ffc=sum(rows.map(d=>d.ffc));
  $('foot').innerHTML=`<tr><td>Total</td><td class="r num">${nf.format(cin)}</td><td class="r num">${nf.format(sum(rows.map(d=>d.cout)))}</td><td class="r num">${nf.format(trn)}</td><td class="r num">${cin?dec(trn/cin*100,1)+'%':'–'}</td><td class="r num">${trn?jt(nav/trn):'–'}</td><td class="r num">${jt(nav)}</td><td class="r num">${jt(ffc)}</td><td></td></tr>`;
}
function render(){
  const rows=DATA.D.filter(x=>x.d>=from&&x.d<=to).sort((a,b)=>a.d<b.d?-1:1);
  document.querySelectorAll('.chip').forEach(c=>{const r=presetRange(c.dataset.p);c.setAttribute('aria-pressed',String(r[0]===from&&r[1]===to))});
  const ds=allDates();
  if(ds.length){$('from').min=$('to').min=ds[0];$('from').max=$('to').max=ds[ds.length-1]}
  if(!rows.length){
    $('period').textContent='MITRA10 Percetakan Negara (10005) · tidak ada data pada rentang ini';
    $('kpis').innerHTML='<div class="empty">Tidak ada data pada rentang tanggal ini. Ubah tanggal atau unggah database.</div>';
    ['chart','chLegend','chNote','cats','rows','foot'].forEach(i=>$(i).innerHTML='');
    return;
  }
  $('period').textContent=`MITRA10 Percetakan Negara (10005) · ${fdy(rows[0].d)} – ${fdy(rows[rows.length-1].d)} · ${rows.length} hari`;
  renderKpis(rows);renderChart(rows);renderCats();renderRows(rows);
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
async function parseFile(f){
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array'});
  const sh=wb.Sheets[wb.SheetNames[0]];
  if(!sh) throw new Error('file kosong');
  const rows=XLSX.utils.sheet_to_json(sh,{header:1,raw:true,defval:null});
  let h=rows.findIndex(r=>r&&r[0]==='Date'&&r.some(x=>String(x).trim()==='Sales Exclude Tax (NAV)'));
  if(h>=0){
    const hd=rows[h].map(x=>String(x==null?'':x).trim());
    const ix=n=>{const i=hd.indexOf(n);if(i<0)throw new Error('kolom "'+n+'" tidak ada');return i};
    const c={nav:ix('Sales Exclude Tax (NAV)'),tr:ix('Total Transaction (NAV)'),ffc:ix('Sales Exclude Tax (FFC)'),ffct:ix('Total Transaction (FFC)'),cin:ix('Total Counter In'),cout:ix('Total Counter Out')};
    const is=hd.indexOf('Store No (NAV)'), out=[]; let other=0;
    rows.slice(h+1).forEach(r=>{const d=toISO(r[0]);if(!d||typeof r[c.nav]!=='number')return;
      if(is>=0&&r[is]!=null&&String(r[is]).trim()!==STORE){other++;return}
      out.push({store_code:STORE,sale_date:d,nav_sales:Math.round(r[c.nav]),nav_trx:+r[c.tr]||0,ffc_sales:Math.round(+r[c.ffc]||0),ffc_trx:+r[c.ffct]||0,counter_in:+r[c.cin]||0,counter_out:+r[c.cout]||0,source:f.name})});
    if(!out.length) throw new Error(other?'file ini bukan untuk toko '+STORE:'tidak ada baris tanggal yang terbaca');
    return {kind:'nav',name:f.name,rows:out};
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
    return {kind:'detail',name:f.name,n,rows:[...m].map(([k,v])=>{const p=k.split('|');return {store_code:STORE,sale_date:p[0],category:p[1],sales:Math.round(v),source:f.name}})};
  }
  throw new Error('format tidak dikenali');
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
  for(const f of files){try{ok.push(await parseFile(f))}catch(err){bad.push(f.name+': '+explain(err))}}
  const parts=[];
  for(const r of ok){
    try{
      if(r.kind==='nav'){await upsertChunks('store_daily',r.rows,'store_code,sale_date');parts.push('Report Compare FFC dan NAV: '+r.rows.length+' hari')}
      else{await upsertChunks('store_day_category',r.rows,'store_code,sale_date,category');parts.push('Laporan detail: '+nf.format(r.n)+' baris, '+new Set(r.rows.map(x=>x.sale_date)).size+' hari')}
    }catch(err){bad.push(r.name+': '+explain(err))}
  }
  if(parts.length){await loadData();const r=presetRange('all');setRange(r[0],r[1])}
  if(parts.length&&!bad.length) showMsg('Berhasil disimpan ke Supabase. '+parts.join(' · ')+'. Data tanggal yang sama diganti dengan yang baru.','ok');
  else if(parts.length) showMsg('Sebagian disimpan. '+parts.join(' · ')+'. Gagal: '+bad.join('; '),'err');
  else showMsg('Tidak ada yang tersimpan. '+bad.join('; ')+'. Gunakan Report Compare FFC and Nav atau Sales Detail Report.','err');
});

/* ---------- Filter tanggal ---------- */
$('from').addEventListener('change',e=>{let a=e.target.value,b=$('to').value;if(!a)return;if(b&&a>b)b=a;setRange(a,b)});
$('to').addEventListener('change',e=>{let b=e.target.value,a=$('from').value;if(!b)return;if(a&&b<a)a=b;setRange(a,b)});
$('chips').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;const r=presetRange(c.dataset.p);setRange(r[0],r[1])});

const tip=$('tip');
document.addEventListener('mouseover',e=>{const t=e.target.closest('[data-tip]');if(t){tip.textContent=t.getAttribute('data-tip');tip.style.opacity=1}else tip.style.opacity=0});
document.addEventListener('mousemove',e=>{tip.style.left=Math.min(e.clientX+12,innerWidth-250)+'px';tip.style.top=(e.clientY+14)+'px'});

/* ---------- Sesi, peran, dan pemuatan data ---------- */
const CFG=window.APP_CONFIG||{};
const SB=(window.supabase&&CFG.SUPABASE_URL&&CFG.SUPABASE_PUBLISHABLE_KEY&&!/YOUR-/.test(CFG.SUPABASE_URL))?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_PUBLISHABLE_KEY):null;
let canWrite=false;
const bootMsg=(t,showOut)=>{$('boot-msg').textContent=t;$('boot-out').hidden=!showOut;$('boot').hidden=false;$('app').hidden=true};
const toLogin=()=>location.replace('login.html');
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
  const [d,c]=await Promise.all([
    fetchAll('store_daily','sale_date,nav_sales,nav_trx,ffc_sales,ffc_trx,counter_in,counter_out',['sale_date']),
    fetchAll('store_day_category','sale_date,category,sales',['sale_date','category'])
  ]);
  DATA={
    D:d.map(r=>({d:r.sale_date,nav:+r.nav_sales,tr:+r.nav_trx,ffc:+r.ffc_sales,ffct:+r.ffc_trx,cin:+r.counter_in,cout:+r.counter_out})),
    C:c.map(r=>[r.sale_date,r.category,+r.sales])
  };
}
const signOut=async()=>{try{if(SB)await SB.auth.signOut()}catch(e){}toLogin()};
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
    await loadData();
    $('boot').hidden=true;$('app').hidden=false;
    const r=presetRange(DATA.D.length>31?'month':'all');setRange(r[0],r[1]);
    if(!DATA.D.length) showMsg(canWrite?'Belum ada data. Unggah Report Compare FFC and Nav dan Sales Detail Report.':'Belum ada data. Minta admin atau editor mengunggahnya.','info');
  }catch(err){
    bootMsg('Gagal memuat data: '+((err&&err.message)||err),true);
  }
})();
})();
