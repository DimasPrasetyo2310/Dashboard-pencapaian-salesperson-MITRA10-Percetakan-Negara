// Follow Up Customer, MITRA10 Percetakan Negara (10005).
// Tabel Supabase: fu_customers, fu_logs, fu_salespeople (lihat supabase/followup_customer.sql).
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS=['Baru','Dihubungi','Deal','Batal'];
const OPEN=new Set(['Baru','Dihubungi','Penawaran']);
const MON=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const nf=new Intl.NumberFormat('id-ID');
const dec=(n,d)=>n.toFixed(d).replace('.',',');
const rp=n=>{n=+n||0;if(n>=1e9)return 'Rp '+dec(n/1e9,2)+' M';if(n>=1e6)return 'Rp '+dec(n/1e6,1)+' jt';return 'Rp '+nf.format(Math.round(n))};
const rpFull=n=>'Rp '+nf.format(Math.round(+n||0));
let _td='',_tt=0;const today=()=>{const n=Date.now();if(n-_tt>60000){_td=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});_tt=n}return _td};
const addDays=(iso,n)=>new Date(Date.parse(iso+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
const fd=iso=>{if(!iso)return '';const p=iso.slice(0,10).split('-');return (+p[2])+' '+MON[+p[1]-1]+' '+p[0]};
const fdt=ts=>{if(!ts)return '';const d=new Date(ts);return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'})+' '+d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})};
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/864e5);
const digits=s=>String(s==null?'':s).replace(/\D/g,'');
const waNum=hp=>{let d=digits(hp);if(!d)return '';if(d.startsWith('0'))d='62'+d.slice(1);else if(d.startsWith('8'))d='62'+d;return d};
const normHp=hp=>{const w=waNum(hp);return w.length>=8?w:''};
const parseRp=v=>{if(typeof v==='number')return v;const d=String(v==null?'':v).replace(/[^\d,.-]/g,'').replace(/[.,](?=\d{3}(\D|$))/g,'').replace(',','.');const n=parseFloat(d);return isFinite(n)?n:0};

// Selama pemeliharaan hanya admin yang bisa masuk. Ubah ke false bila sudah siap dipakai seluruh tim.
const MAINTENANCE=true;
const SALES_DOMAIN='@sales.mitra10pcn.id';
const isSalesEmail=e=>(e||'').toLowerCase().endsWith(SALES_DOMAIN);
function idToEmail(v){v=(v||'').trim();if(!v||v.includes('@'))return v.toLowerCase();let m=v.toUpperCase().replace(/\s+/g,'');
  if(/^\d{1,10}$/.test(m))m='S10005-'+m.padStart(10,'0');else if(/^S\d+$/.test(m))m=m.slice(0,6)+'-'+m.slice(6);return m.toLowerCase()+SALES_DOMAIN}
const emailToId=e=>isSalesEmail(e)?e.slice(0,-SALES_DOMAIN.length).toUpperCase():'';
const CFG=window.APP_CONFIG||{};
const SB=(window.supabase&&CFG.SUPABASE_URL&&CFG.SUPABASE_PUBLISHABLE_KEY&&!/YOUR-/.test(CFG.SUPABASE_URL))?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_PUBLISHABLE_KEY):null;

let ME='',ROLE='',MANAGER=false,ADMIN=false,MYSALES=[];
let CUST=[],SALES=[],USERS=[];
const F={q:'',sales:'',due:'',status:''};
let SORT={k:'',dir:1},PAGE=0;const PER=50;
let CUR=null;

function showMsg(text,kind){const m=$('msg');m.hidden=!text;m.className='msg '+(kind||'info');m.textContent=text||'';if(text&&kind==='ok')setTimeout(()=>{if(m.textContent===text)m.hidden=true},5000)}
function dlgMsg(id,text,kind){const m=$(id);m.hidden=!text;m.className='msg '+(kind||'info');m.textContent=text||''}
const errText=e=>{if(!e)return 'tidak diketahui';if(typeof e==='string')return e;const m=e.message||e.error_description||e.details||e.hint;if(m)return m;if(e.code||e.status)return 'kode '+(e.code||e.status);try{return JSON.stringify(e)}catch(x){return 'tidak diketahui'}};

/* ---------- Data ---------- */
async function fetchAll(table,cols,order,onProg){
  const retry=async f=>{let last;for(let t=0;t<3;t++){try{return await f()}catch(e){last=e;await new Promise(r=>setTimeout(r,800*(t+1)))}}throw last};
  if(table!=='fu_customers'){
    return retry(async()=>{let q=SB.from(table).select(cols);if(order)q=q.order(order,{ascending:true});const {data,error}=await q.limit(5000);if(error)throw new Error(errText(error));return data});
  }
  // Ambil per rentang id (memakai indeks, tanpa OFFSET) supaya cepat walau datanya puluhan ribu.
  const edge=async asc=>retry(async()=>{const {data,error}=await SB.from(table).select('id').order('id',{ascending:asc}).limit(1);if(error)throw new Error('gagal membaca data ('+errText(error)+')');return data[0]?data[0].id:null});
  const lo=await edge(true);if(lo==null)return [];
  const hi=await edge(false);
  const STEP=2000,starts=[];for(let x=lo;x<=hi;x+=STEP)starts.push(x);
  const parts=new Array(starts.length);let done=0;
  const job=i=>retry(async()=>{const a=starts[i];const out=[];let from=a;
    for(;;){const {data,error}=await SB.from(table).select(cols).gte('id',from).lt('id',a+STEP).order('id',{ascending:true}).limit(1000);
      if(error)throw new Error(errText(error));out.push(...data);if(data.length<1000)break;from=data[data.length-1].id+1}
    parts[i]=out;done++;if(onProg)onProg(done,starts.length)});
  for(let i=0;i<starts.length;i+=4)await Promise.all(Array.from({length:Math.min(4,starts.length-i)},(_,k)=>job(i+k)));
  return parts.flat();
}
async function loadData(){
  const [c,s]=await Promise.all([
    fetchAll('fu_customers','id,member_no,nama,hp,salesperson,status,next_date,potensi,catatan,sumber,last_contact,created_at,updated_at','id',(d,n)=>{if(!$('boot').hidden&&n>3)$('boot-msg').textContent='Memuat data customer… '+Math.round(d/n*100)+'%'}),
    fetchAll('fu_salespeople','name,email,sales_id','name')
  ]);
  CUST=c.map(r=>({...r,potensi:+r.potensi||0}));SALES=s;
  MYSALES=SALES.filter(x=>x.email&&x.email.toLowerCase()===ME.toLowerCase()).map(x=>x.name);
}
const salesNames=()=>[...new Set([...SALES.map(s=>s.name),...CUST.map(c=>c.salesperson).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'id'));

/* ---------- Jadwal ---------- */
function dueState(c){
  if(!OPEN.has(c.status))return 'closed';
  if(!c.next_date)return 'none';
  const t=today();
  if(c.next_date<t)return 'late';
  if(c.next_date===t)return 'today';
  return 'later';
}
function dueLabel(c){
  const s=dueState(c);if(s==='closed')return '<span class="muted">Selesai</span>';
  if(s==='none')return '<span class="muted">Belum dijadwalkan</span>';
  const d=daysBetween(today(),c.next_date);
  if(s==='late')return `<span class="due late">${fd(c.next_date)} · terlambat ${-d} hari</span>`;
  if(s==='today')return '<span class="due today">Hari ini</span>';
  return `<span class="due">${fd(c.next_date)}${d<=7?' · '+d+' hari lagi':''}</span>`;
}
const PRI={late:0,today:1,later:2,none:3,closed:4};

/* ---------- Ringkasan per salesperson ---------- */
let SPCUR=null,SPF={st:'',q:''},SPPAGE=0;const SPPER=50;
const jkDate=ts=>ts?new Date(ts).toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'}):'';
const contacted=c=>c.status!=='Baru'||!!c.last_contact;
const sentToday=c=>!!c.last_contact&&jkDate(c.last_contact)===today();
const sidOf=n=>{const s=SALES.find(x=>x.name===n);return s&&s.sales_id?s.sales_id:''};
function spStats(){
  const by=new Map();
  CUST.forEach(c=>{const k=c.salesperson||'(tanpa salesperson)';let r=by.get(k);if(!r){r={name:k,sid:sidOf(k),total:0,done:0,today:0,deal:0};by.set(k,r)}
    r.total++;if(contacted(c))r.done++;if(sentToday(c))r.today++;if(c.status==='Deal')r.deal++});
  return [...by.values()].map(r=>({...r,todo:r.total-r.done}));
}
function renderKpis(){
  const L=CUST,done=L.filter(contacted).length,tod=L.filter(sentToday).length,deal=L.filter(c=>c.status==='Deal').length,bat=L.filter(c=>c.status==='Batal').length;
  const K=[
    {cls:'hero',l:'Total database',v:nf.format(L.length),s:MANAGER?nf.format(spStats().length)+' salesperson':'customer milik Anda'},
    {l:'Sudah dihubungi',v:nf.format(done),s:L.length?dec(done/L.length*100,1)+'% dari database':'–'},
    {l:'Belum dihubungi',v:nf.format(L.length-done),s:'menunggu dikirimi pesan'},
    {l:'Terkirim hari ini',v:nf.format(tod),s:'pesan WhatsApp hari ini'},
    {l:'Deal',v:nf.format(deal),s:`${nf.format(bat)} batal`}
  ];
  $('kpis').innerHTML=K.map(k=>`<div class="kpi ${k.cls||''}" style="cursor:default"><span class="l">${k.l}</span><span class="v num">${k.v}</span><span class="s">${k.s}</span></div>`).join('');
}
function renderTable(){
  const q=F.q.trim().toLowerCase();
  let L=spStats();
  if(q)L=L.filter(r=>r.name.toLowerCase().includes(q)||r.sid.toLowerCase().includes(q));
  const k=SORT.k||'sid',d=SORT.k?SORT.dir:1;
  L.sort((a,b)=>(typeof a[k]==='number'?(a[k]-b[k]):String(a[k]||'~').localeCompare(String(b[k]||'~'),'id'))*d);
  $('rows').innerHTML=L.length?L.map(r=>{const pct=r.total?r.done/r.total:0;
    return `<tr data-sp="${esc(r.name)}" tabindex="0">
      <td data-l="ID" class="num">${esc(r.sid||'–')}</td>
      <td class="cname"><button type="button" class="spname">${esc(r.name)}</button></td>
      <td class="r num" data-l="Total">${nf.format(r.total)}</td>
      <td class="r num" data-l="Sudah">${nf.format(r.done)}</td>
      <td class="r num" data-l="Belum">${nf.format(r.todo)}</td>
      <td class="r num" data-l="Hari ini">${r.today?nf.format(r.today):'<span class="muted">0</span>'}</td>
      <td class="r num" data-l="Deal">${r.deal?nf.format(r.deal):'<span class="muted">0</span>'}</td>
      <td data-l="Progres"><div style="display:flex;align-items:center;gap:8px"><div class="bar"><i style="width:${(pct*100).toFixed(0)}%"></i></div><span class="num">${dec(pct*100,0)}%</span></div></td></tr>`}).join('')
    :`<tr><td colspan="8" class="empty">${CUST.length?'Tidak ada salesperson yang cocok.':(MANAGER?'Belum ada customer. Klik "Impor Excel" untuk memasukkan data.':'Belum ada customer untuk Anda.')}</td></tr>`;
  const T=L.reduce((s,r)=>({t:s.t+r.total,d:s.d+r.done,h:s.h+r.today,x:s.x+r.deal}),{t:0,d:0,h:0,x:0});
  $('foot').innerHTML=L.length>1?`<tr><td colspan="2">${nf.format(L.length)} salesperson</td><td class="r num">${nf.format(T.t)}</td><td class="r num">${nf.format(T.d)}</td><td class="r num">${nf.format(T.t-T.d)}</td><td class="r num">${nf.format(T.h)}</td><td class="r num">${nf.format(T.x)}</td><td></td></tr>`:'';
  $('rows').querySelectorAll('tr[data-sp]').forEach(tr=>{const open=()=>openSp(tr.dataset.sp);
    tr.addEventListener('click',open);tr.addEventListener('keydown',e=>{if(e.key==='Enter')open()})});
  // pencarian customer lintas salesperson
  const hits=$('cust-hits'),qd=digits(F.q);
  if(q.length>=3&&!L.length||qd.length>=5){
    const H=CUST.filter(c=>c.nama.toLowerCase().includes(q)||(qd.length>=5&&(digits(c.hp).includes(qd)||(c.member_no||'').includes(qd)))).slice(0,30);
    hits.hidden=false;
    hits.innerHTML=`<div class="flabel" style="margin-bottom:6px">Customer yang cocok${H.length===30?' (30 teratas)':''}</div>`+(H.length?`<div class="tbl"><table style="min-width:560px"><tbody>${H.map(c=>`<tr data-id="${c.id}"><td><b>${esc(c.nama)}</b>${c.member_no?` <span class="muted">· ${esc(c.member_no)}</span>`:''}</td><td>${esc(c.hp||'–')}</td><td>${esc(c.salesperson||'–')}</td><td><span class="st st-${esc(c.status)}">${esc(c.status)}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Tidak ada customer yang cocok.</p>');
    hits.querySelectorAll('tr[data-id]').forEach(tr=>tr.addEventListener('click',()=>openCust(+tr.dataset.id)));
  }else hits.hidden=true;
}
function render(){
  renderKpis();renderTable();
  $('scope').textContent=MANAGER?'Semua salesperson · '+nf.format(CUST.length)+' customer':(MYSALES.length?'Customer milik '+MYSALES.join(', '):'Akun Anda belum dihubungkan ke nama salesperson. Hubungi admin.');
  if($('dlg-sp').open)renderSp();
}

/* ---------- Popup salesperson ---------- */
const waIcon=()=>'<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>';
const dSp=$('dlg-sp');
function openSp(name){SPCUR=name;SPF={st:'',q:''};SPPAGE=0;$('sp-q').value='';dlgMsg('sp-msg','');fillTplSelect();renderSp();if(!dSp.open)dSp.showModal()}
function renderSp(){
  const all=CUST.filter(c=>(c.salesperson||'(tanpa salesperson)')===SPCUR);
  const sid=sidOf(SPCUR),done=all.filter(contacted).length,tod=all.filter(sentToday).length;
  $('sp-title').textContent=SPCUR;
  $('sp-sub').textContent=`${sid?sid+' · ':''}${nf.format(all.length)} customer · ${nf.format(done)} sudah dihubungi · ${nf.format(all.length-done)} belum`;
  $('sp-today').textContent=nf.format(tod);
  const warn=tod>=DAILY_SAFE;$('sp-today').parentElement.classList.toggle('warn',warn);
  $('sp-limit').textContent=warn?`Sudah ${DAILY_SAFE}+ pesan hari ini. Sebaiknya lanjutkan besok agar nomor tidak diblokir WhatsApp.`:`Batas aman ±${DAILY_SAFE} pesan per hari per nomor.`;
  const cnt=f=>all.filter(f).length;
  const CH=[['','Semua',all.length],['todo','Belum dihubungi',cnt(c=>!contacted(c))],['done','Sudah dihubungi',cnt(contacted)],['today','Hari ini',tod],['Deal','Deal',cnt(c=>c.status==='Deal')],['Batal','Batal',cnt(c=>c.status==='Batal')]];
  $('sp-chips').innerHTML=CH.map(([v,l,n])=>`<button type="button" class="chip" data-s="${v}" aria-pressed="${SPF.st===v}">${l}<span class="n">${nf.format(n)}</span></button>`).join('');
  $('sp-chips').querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{SPF.st=b.dataset.s;SPPAGE=0;renderSp()}));
  const q=SPF.q.trim().toLowerCase(),qd=digits(SPF.q);
  let L=all.filter(c=>{const s=SPF.st;
    if(s==='todo'&&contacted(c))return false;if(s==='done'&&!contacted(c))return false;if(s==='today'&&!sentToday(c))return false;
    if((s==='Deal'||s==='Batal')&&c.status!==s)return false;
    if(q&&!c.nama.toLowerCase().includes(q)&&!(qd.length>=3&&(digits(c.hp).includes(qd)||(c.member_no||'').includes(qd))))return false;
    return true});
  L.sort((a,b)=>(contacted(a)-contacted(b))||a.nama.localeCompare(b.nama,'id'));
  const pages=Math.max(1,Math.ceil(L.length/SPPER));if(SPPAGE>=pages)SPPAGE=pages-1;
  const part=L.slice(SPPAGE*SPPER,SPPAGE*SPPER+SPPER);
  $('sp-rows').innerHTML=part.length?part.map(c=>{const wa=waNum(c.hp),st=sentToday(c);
    return `<tr data-id="${c.id}">
      <td class="cname"><b>${esc(c.nama)}</b>${c.member_no?`<small>No. member ${esc(c.member_no)}</small>`:''}</td>
      <td data-l="No. HP">${wa?esc(c.hp):'<span class="muted">Tidak ada nomor</span>'}</td>
      <td data-l="Status"><span class="st st-${esc(c.status)}">${esc(c.status)}</span></td>
      <td data-l="Terakhir">${c.last_contact?fdt(c.last_contact):'<span class="muted">Belum pernah</span>'}</td>
      <td class="r" data-l="Aksi"><div class="actions" style="justify-content:flex-end">
        ${wa?`<button type="button" class="btn sm wa${st?' sent':''}" data-wa="${c.id}">${waIcon()} ${st?'Kirim lagi':'Kirim WA'}</button>`:''}
        <button type="button" class="btn sm" data-det="${c.id}">Detail</button></div></td></tr>`}).join('')
    :'<tr><td colspan="5" class="empty">Tidak ada customer di filter ini.</td></tr>';
  $('sp-pager').innerHTML=pages>1?`<span>${nf.format(L.length)} customer · halaman ${SPPAGE+1} dari ${pages}</span><span class="actions"><button type="button" class="btn sm" id="spg-prev"${SPPAGE?'':' disabled'}>Sebelumnya</button><button type="button" class="btn sm" id="spg-next"${SPPAGE<pages-1?'':' disabled'}>Berikutnya</button></span>`:(L.length?`<span>${nf.format(L.length)} customer</span>`:'');
  if(pages>1){$('spg-prev').onclick=()=>{SPPAGE--;renderSp()};$('spg-next').onclick=()=>{SPPAGE++;renderSp()}}
  $('sp-rows').querySelectorAll('[data-wa]').forEach(b=>b.addEventListener('click',()=>sendWa(+b.dataset.wa,b)));
  $('sp-rows').querySelectorAll('[data-det]').forEach(b=>b.addEventListener('click',()=>openCust(+b.dataset.det)));
}
let spqT;$('sp-q').addEventListener('input',e=>{clearTimeout(spqT);spqT=setTimeout(()=>{SPF.q=e.target.value;SPPAGE=0;renderSp()},150)});

/* ---------- Template pesan & kirim WA ---------- */
const DAILY_SAFE=50;
const DEFAULT_TPL={id:0,judul:'Sapaan member (contoh)',aktif:true,isi:'{salam} {Bapak/Ibu|Kak} {nama},\n\nSaya {sales} dari {toko}. {Terima kasih sudah menjadi member kami|Terima kasih atas kepercayaannya berbelanja di tempat kami}.\n\n{Ada kebutuhan bahan bangunan atau renovasi yang bisa kami bantu?|Kalau sedang ada rencana renovasi, saya siap bantu carikan produknya.}\n\nBalas pesan ini kapan saja ya. Bila tidak ingin dihubungi lagi, cukup balas STOP.'};
let TPL=[],TPL_DB=false,TPL_RR=0,TPLCUR=null;
async function loadTemplates(){
  try{const {data,error}=await SB.from('fu_templates').select('id,judul,isi,aktif,urut').order('urut',{ascending:true}).order('id',{ascending:true});
    if(error)throw error;TPL_DB=true;TPL=data.length?data:[DEFAULT_TPL];}
  catch(e){TPL_DB=false;TPL=[DEFAULT_TPL]}
}
const titleCase=s=>String(s||'').toLowerCase().replace(/(^|[\s.'-])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).trim();
function salam(){const h=+new Date().toLocaleString('en-US',{hour:'numeric',hour12:false,timeZone:'Asia/Jakarta'})%24;return h<11?'Selamat pagi':h<15?'Selamat siang':h<18?'Selamat sore':'Selamat malam'}
function renderMsg(isi,c,sp){
  let t=String(isi||'');
  const vars={salam:salam(),nama:titleCase(c.nama),sales:titleCase(sp||c.salesperson||''),member:c.member_no||'',toko:'MITRA10 Percetakan Negara'};
  t=t.replace(/\{(salam|nama|sales|member|toko)\}/gi,(m,k)=>vars[k.toLowerCase()]);
  for(let i=0;i<5&&/\{[^{}]*\|[^{}]*\}/.test(t);i++)t=t.replace(/\{([^{}]*\|[^{}]*)\}/g,(m,o)=>{const a=o.split('|');return a[Math.floor(Math.random()*a.length)]});
  return t.replace(/[ \t]+\n/g,'\n').trim();
}
function fillTplSelect(){
  const act=TPL.filter(t=>t.aktif!==false),cur=$('sp-tpl').value;
  $('sp-tpl').innerHTML=(act.length>1?`<option value="rr">Acak bergilir (${act.length} template aktif)</option>`:'')+act.map(t=>`<option value="${t.id}">${esc(t.judul)}</option>`).join('');
  if([...$('sp-tpl').options].some(o=>o.value===cur))$('sp-tpl').value=cur;
}
function pickTpl(){
  const act=TPL.filter(t=>t.aktif!==false);if(!act.length)return DEFAULT_TPL;
  const v=$('sp-tpl').value;if(v==='rr'){const t=act[TPL_RR%act.length];TPL_RR++;return t}
  return act.find(t=>String(t.id)===v)||act[0];
}
async function sendWa(id,btn){
  const c=CUST.find(x=>x.id===id);if(!c)return;
  const num=waNum(c.hp);if(!num){dlgMsg('sp-msg','Customer ini tidak punya nomor HP yang valid.','err');return}
  const t=pickTpl(),text=renderMsg(t.isi,c,c.salesperson);
  window.open('https://wa.me/'+num+'?text='+encodeURIComponent(text),'_blank','noopener');
  if(btn){btn.disabled=true}
  try{
    const now=new Date().toISOString(),st=c.status==='Baru'?'Dihubungi':c.status;
    const {error:e1}=await SB.from('fu_logs').insert({customer_id:c.id,cara:'WhatsApp blast',catatan:'Template: '+t.judul+'\n\n'+text,status:st});if(e1)throw e1;
    const {data,error:e2}=await SB.from('fu_customers').update({status:st,last_contact:now}).eq('id',c.id).select().single();if(e2)throw e2;
    Object.assign(c,data,{potensi:+data.potensi||0});
    const tod=CUST.filter(x=>x.salesperson===c.salesperson&&sentToday(x)).length;
    dlgMsg('sp-msg',tod>=DAILY_SAFE?`Pesan ke ${c.nama} tercatat. Hari ini sudah ${tod} pesan, sebaiknya berhenti dan lanjut besok supaya nomor WhatsApp tidak diblokir.`:`Pesan ke ${c.nama} tercatat (template "${t.judul}"). Pastikan sudah menekan Kirim di WhatsApp.`,tod>=DAILY_SAFE?'err':'ok');
    render();
  }catch(e){dlgMsg('sp-msg','WhatsApp terbuka, tapi gagal mencatat: '+errText(e),'err');if(btn)btn.disabled=false}
}
/* Kelola template */
const dTpl=$('dlg-tpl');
const SAMPLE={nama:'BUDI SANTOSO',member_no:'2010000000000',salesperson:''};
function renderTplList(){
  $('tpl-list').innerHTML=TPL.map(t=>`<li><button type="button" data-t="${t.id}" aria-current="${TPLCUR&&TPLCUR.id===t.id}">${esc(t.judul)}${t.aktif===false?' <span class="off">(nonaktif)</span>':''}</button></li>`).join('');
  $('tpl-list').querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>editTpl(TPL.find(t=>String(t.id)===b.dataset.t))));
}
function tplPreview(){const sp=SPCUR||MYSALES[0]||'Nama Sales';$('tpl-preview').textContent=renderMsg($('tpl-isi').value,{...SAMPLE,salesperson:sp},sp)||'(kosong)'}
function editTpl(t){
  TPLCUR=t||null;$('tpl-judul').value=t?t.judul:'';$('tpl-isi').value=t?t.isi:'';$('tpl-aktif').checked=t?t.aktif!==false:true;
  $('tpl-del').hidden=!t||!t.id||!MANAGER;renderTplList();tplPreview();
}
$('btn-msgtpl').addEventListener('click',()=>{
  dlgMsg('tpl-msg',TPL_DB?'':'Tabel template belum dibuat di database, jadi yang tampil adalah template contoh dan belum bisa disimpan.',TPL_DB?'':'info');
  ['tpl-judul','tpl-isi','tpl-aktif'].forEach(id=>$(id).disabled=!MANAGER);
  $('tpl-save').hidden=!MANAGER;$('tpl-new').hidden=!MANAGER;
  editTpl(TPL[0]);dTpl.showModal();
});
$('tpl-isi').addEventListener('input',tplPreview);$('tpl-reroll').addEventListener('click',tplPreview);
$('tpl-new').addEventListener('click',()=>{editTpl(null);$('tpl-judul').focus()});
$('tpl-save').addEventListener('click',async()=>{
  if(!TPL_DB){dlgMsg('tpl-msg','Tabel template belum ada di database. Jalankan supabase/followup_templates.sql dulu.','err');return}
  const row={judul:$('tpl-judul').value.trim(),isi:$('tpl-isi').value.trim(),aktif:$('tpl-aktif').checked};
  if(!row.judul||!row.isi){dlgMsg('tpl-msg','Judul dan isi wajib diisi.','err');return}
  $('tpl-save').disabled=true;
  try{
    let r;if(TPLCUR&&TPLCUR.id){r=await SB.from('fu_templates').update(row).eq('id',TPLCUR.id).select().single()}
    else{r=await SB.from('fu_templates').insert({...row,urut:TPL.filter(t=>t.id).length}).select().single()}
    if(r.error)throw r.error;
    await loadTemplates();editTpl(TPL.find(t=>t.id===r.data.id));fillTplSelect();dlgMsg('tpl-msg','Template tersimpan.','ok');
  }catch(e){dlgMsg('tpl-msg','Gagal menyimpan: '+errText(e),'err')}
  $('tpl-save').disabled=false;
});
let tplDelArm=false;
$('tpl-del').addEventListener('click',async()=>{
  if(!TPLCUR||!TPLCUR.id)return;
  if(!tplDelArm){tplDelArm=true;$('tpl-del').textContent='Klik lagi untuk menghapus';setTimeout(()=>{tplDelArm=false;$('tpl-del').textContent='Hapus'},4000);return}
  const {error}=await SB.from('fu_templates').delete().eq('id',TPLCUR.id);
  if(error){dlgMsg('tpl-msg','Gagal menghapus: '+error.message,'err');return}
  await loadTemplates();editTpl(TPL[0]);fillTplSelect();dlgMsg('tpl-msg','Template dihapus.','ok');
});

/* ---------- Dialog customer ---------- */
const dlg=$('dlg');
document.querySelectorAll('dialog [data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
['c-status','l-status'].forEach(id=>{$(id).innerHTML=STATUS.map(s=>`<option>${s}</option>`).join('')});
function fillForm(c){
  $('c-nama').value=c?c.nama:'';$('c-hp').value=c?(c.hp||''):'';
  $('c-sales').value=c?(c.salesperson||''):((SPCUR&&SPCUR!=='(tanpa salesperson)'?SPCUR:'')||(MYSALES.length===1?MYSALES[0]:''));
  $('c-sales').readOnly=!MANAGER&&MYSALES.length===1;
  $('c-potensi').value=c&&c.potensi?nf.format(c.potensi):'';
  $('c-status').value=c?c.status:'Baru';$('c-next').value=c?(c.next_date||''):today();
  $('c-catatan').value=c?(c.catatan||''):'';
}
async function openCust(id){
  CUR=CUST.find(c=>c.id===id)||null;
  dlgMsg('dlg-msg','');fillForm(CUR);
  const isNew=!CUR;
  $('dlg-title').textContent=isNew?'Customer baru':CUR.nama;
  $('dlg-sub').innerHTML=isNew?'Isi data customer lalu simpan.':`${CUR.member_no?'No. member '+esc(CUR.member_no)+' · ':''}${esc(CUR.salesperson||'')}${CUR.hp?' · '+esc(CUR.hp):''} · <span class="st st-${esc(CUR.status)}">${esc(CUR.status)}</span>`;
  $('log-box').hidden=isNew;$('hist-box').hidden=isNew;$('c-del').hidden=isNew||!MANAGER;
  delArm=false;$('c-del').textContent='Hapus customer';
  $('c-save').textContent=isNew?'Simpan customer':'Simpan data customer';
  if(!isNew){
    $('l-status').value=CUR.status==='Baru'?'Dihubungi':CUR.status;
    $('l-next').value=addDays(today(),3);$('l-note').value='';$('l-cara').value='WhatsApp';
    $('logs').innerHTML='<li class="muted">Memuat riwayat…</li>';
  }
  if(!dlg.open)dlg.showModal();
  if(isNew){$('c-nama').focus();return}
  $('l-note').focus();
  const {data,error}=await SB.from('fu_logs').select('id,at,cara,catatan,status,next_date,by_email').eq('customer_id',id).order('at',{ascending:false});
  if(CUR&&CUR.id!==id)return;
  if(error){$('logs').innerHTML=`<li class="muted">Gagal memuat riwayat: ${esc(error.message)}</li>`;return}
  $('logs').innerHTML=data.length?data.map(l=>`<li><div class="meta">${fdt(l.at)} · ${esc(l.cara||'')}${l.by_email?' · '+esc(l.by_email.split('@')[0]):''}${l.status?` · <span class="st st-${esc(l.status)}">${esc(l.status)}</span>`:''}${l.next_date?' · jadwal berikutnya '+fd(l.next_date):''}</div>${l.catatan?`<p>${esc(l.catatan)}</p>`:''}</li>`).join(''):'<li class="muted">Belum ada riwayat follow up.</li>';
}
document.querySelectorAll('[data-plus]').forEach(b=>b.addEventListener('click',()=>{$('l-next').value=addDays(today(),+b.dataset.plus)}));
$('l-status').addEventListener('change',()=>{if(!OPEN.has($('l-status').value))$('l-next').value=''});
$('btn-add').addEventListener('click',()=>openCust(-1));

$('c-save').addEventListener('click',async()=>{
  const row={nama:$('c-nama').value.trim(),hp:$('c-hp').value.trim()||null,salesperson:$('c-sales').value.trim()||null,
    potensi:parseRp($('c-potensi').value),status:$('c-status').value,next_date:$('c-next').value||null,catatan:$('c-catatan').value.trim()||null};
  if(!row.nama){dlgMsg('dlg-msg','Nama customer wajib diisi.','err');$('c-nama').focus();return}
  if(!row.salesperson){dlgMsg('dlg-msg','Salesperson wajib diisi.','err');$('c-sales').focus();return}
  if(!MANAGER&&!MYSALES.includes(row.salesperson)){dlgMsg('dlg-msg','Anda hanya bisa memakai nama salesperson Anda sendiri: '+MYSALES.join(', ')+'.','err');return}
  if(!OPEN.has(row.status))row.next_date=null;
  if(!CUR&&row.hp){const k=normHp(row.hp),dup=k&&CUST.find(c=>normHp(c.hp)===k);if(dup&&!$('c-save').dataset.force){dlgMsg('dlg-msg',`No. HP ini sudah terdaftar atas nama ${dup.nama} (${dup.salesperson||'-'}). Klik simpan sekali lagi bila tetap ingin menambah.`,'err');$('c-save').dataset.force='1';return}}
  delete $('c-save').dataset.force;
  $('c-save').disabled=true;
  try{
    if(CUR){
      const {data,error}=await SB.from('fu_customers').update(row).eq('id',CUR.id).select().single();if(error)throw error;
      Object.assign(CUR,data,{potensi:+data.potensi||0});
      dlgMsg('dlg-msg','Data customer tersimpan.','ok');
      $('dlg-title').textContent=CUR.nama;
    }else{
      const {data,error}=await SB.from('fu_customers').insert(row).select().single();if(error)throw error;
      CUST.push({...data,potensi:+data.potensi||0});
      render();await openCust(data.id);dlgMsg('dlg-msg','Customer ditambahkan. Catat follow up pertama di sini.','ok');
    }
    render();
  }catch(e){dlgMsg('dlg-msg','Gagal menyimpan: '+errText(e),'err')}
  $('c-save').disabled=false;
});
$('l-save').addEventListener('click',async()=>{
  if(!CUR)return;
  const st=$('l-status').value,nx=OPEN.has(st)?($('l-next').value||null):null,note=$('l-note').value.trim();
  if(!note){dlgMsg('dlg-msg','Tulis hasil follow up dulu.','err');$('l-note').focus();return}
  $('l-save').disabled=true;
  try{
    const now=new Date().toISOString();
    const {error:e1}=await SB.from('fu_logs').insert({customer_id:CUR.id,cara:$('l-cara').value,catatan:note,status:st,next_date:nx});if(e1)throw e1;
    const {data,error:e2}=await SB.from('fu_customers').update({status:st,next_date:nx,last_contact:now}).eq('id',CUR.id).select().single();if(e2)throw e2;
    Object.assign(CUR,data,{potensi:+data.potensi||0});
    render();await openCust(CUR.id);dlgMsg('dlg-msg','Follow up tersimpan.','ok');
  }catch(e){dlgMsg('dlg-msg','Gagal menyimpan: '+errText(e),'err')}
  $('l-save').disabled=false;
});
let delArm=false;
$('c-del').addEventListener('click',async()=>{
  if(!CUR)return;
  if(!delArm){delArm=true;$('c-del').textContent='Klik lagi untuk menghapus';setTimeout(()=>{delArm=false;$('c-del').textContent='Hapus customer'},4000);return}
  const {error}=await SB.from('fu_customers').delete().eq('id',CUR.id);
  if(error){dlgMsg('dlg-msg','Gagal menghapus: '+error.message,'err');return}
  CUST=CUST.filter(c=>c.id!==CUR.id);dlg.close();render();showMsg('Customer dihapus.','ok');
});

/* ---------- Impor / template / unduh ---------- */
const FIELDS=[
  ['member_no',/^(no|nomor|id|kode|kartu)?member(no|id|number|card)?$/],
  ['salesperson',/^(nama)?(sales|salesperson|spg|pic|marketing)/],
  ['hp',/(hp|telp|telepon|phone|whatsapp|^wa|nowa|handphone|kontak|nomor)/],
  ['nama',/(nama|name|customer|pelanggan|konsumen|client|toko)/],
  ['status',/status/],
  ['next_date',/(followup|jadwal|next|tanggal|tgl|date)/],
  ['potensi',/(potensi|nilai|nominal|estimasi|omzet|value|budget|rp)/],
  ['catatan',/(catatan|keterangan|ket|kebutuhan|note|remark|produk|item)/],
  ['sumber',/(sumber|source|asal)/]
];
function mapHeader(row){
  const m={},used=new Set();
  row.forEach((h,i)=>{const k=String(h==null?'':h).toLowerCase().replace(/[^a-z]/g,'');if(!k)return;
    for(const [f,re] of FIELDS){if(!(f in m)&&re.test(k)){m[f]=i;break}}});
  return m;
}
function normStatus(v){
  const s=String(v==null?'':v).toLowerCase();if(!s.trim())return 'Baru';
  if(/deal|closing|close|won|beli|sukses/.test(s))return 'Deal';
  if(/batal|lost|cancel|gagal|tidak|reject/.test(s))return 'Batal';
  if(/tawar|quot|nego|sph/.test(s))return 'Penawaran';
  if(/hubung|contact|follow|fu|prospek/.test(s))return 'Dihubungi';
  return 'Baru';
}
function toIso(v){
  if(v==null||v==='')return null;
  if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*6e4).toISOString().slice(0,10);
  if(typeof v==='number'&&v>20000&&v<80000)return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10);
  const s=String(v).trim();let m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  if((m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}
  return null;
}
$('btn-import').addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(!window.XLSX){showMsg('Pembaca Excel belum termuat. Muat ulang halaman lalu coba lagi.','err');return}
  try{
    showMsg('Membaca '+f.name+'…','info');
    const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
    let rows=null,map=null,hi=-1;
    for(const name of wb.SheetNames){
      const r=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});
      for(let i=0;i<Math.min(15,r.length);i++){const m=mapHeader(r[i]||[]);if('nama' in m&&Object.keys(m).length>=2){rows=r;map=m;hi=i;break}}
      if(rows)break;
    }
    if(!rows){showMsg('Kolom nama customer tidak ditemukan. Pakai tombol "Template" untuk contoh format.','err');return}
    const seenM=new Set(CUST.map(c=>c.member_no).filter(Boolean)),seen=new Set(CUST.map(c=>normHp(c.hp)).filter(Boolean)),seenN=new Set(CUST.map(c=>(c.nama+'|'+(c.salesperson||'')).toLowerCase()));
    const out=[];let dup=0,empty=0;
    const g=(r,k)=>k in map?r[map[k]]:null;
    for(const r of rows.slice(hi+1)){
      if(!r||!r.some(v=>v!=null&&String(v).trim()!==''))continue;
      const nama=String(g(r,'nama')??'').trim();if(!nama){empty++;continue}
      const hpRaw=g(r,'hp');const hp=hpRaw==null?null:String(hpRaw).trim()||null;
      const sp=String(g(r,'salesperson')??'').trim()||null;
      const mRaw=g(r,'member_no'),mno=mRaw==null||String(mRaw).trim()===''?null:String(mRaw).trim();
      const k=normHp(hp),kn=(nama+'|'+(sp||'')).toLowerCase();
      if(mno){if(seenM.has(mno)){dup++;continue}seenM.add(mno)}
      else{if((k&&seen.has(k))||seenN.has(kn)){dup++;continue}if(k)seen.add(k);seenN.add(kn)}
      const status=normStatus(g(r,'status'));
      out.push({member_no:mno,nama,hp,salesperson:sp,status,next_date:OPEN.has(status)?toIso(g(r,'next_date')):null,potensi:parseRp(g(r,'potensi')),
        catatan:(g(r,'catatan')==null?null:String(g(r,'catatan')).trim()||null),sumber:(g(r,'sumber')==null?f.name:String(g(r,'sumber')).trim())});
    }
    if(!out.length){showMsg(`Tidak ada customer baru di file ini (${dup} sudah ada${empty?', '+empty+' baris tanpa nama':''}).`,'info');return}
    IMPORTING=true;
    for(let i=0;i<out.length;i+=1000){
      showMsg(`Menyimpan ${nf.format(Math.min(i+1000,out.length))} dari ${nf.format(out.length)} customer… jangan tutup halaman ini.`,'info');
      const {error}=await SB.from('fu_customers').insert(out.slice(i,i+1000));
      if(error){IMPORTING=false;await loadData();render();throw new Error(error.message+` (${nf.format(i)} customer pertama sudah tersimpan; impor ulang file yang sama untuk melanjutkan, yang sudah ada otomatis dilewati)`)}
    }
    IMPORTING=false;
    const noSales=out.filter(r=>!r.salesperson).length;
    const okMsg=`${nf.format(out.length)} customer diimpor dari ${f.name}.${dup?' '+nf.format(dup)+' dilewati karena sudah ada.':''}${noSales?' '+noSales+' tanpa salesperson (hanya terlihat admin/editor).':''}`;
    try{await loadData();render();showMsg(okMsg,'ok')}
    catch(e2){showMsg(okMsg+' Daftar belum termuat ulang ('+errText(e2)+'). Muat ulang halaman (F5).','info')}
  }catch(err){showMsg('Gagal mengimpor: '+errText(err),'err')}
});
$('btn-tpl').addEventListener('click',()=>{
  if(!window.XLSX)return;
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([
    ['No Member','Nama Customer','No HP','Salesperson','Status','Follow Up Berikutnya','Nilai Potensi','Keterangan','Sumber'],
    ['2010000000000','Bapak Contoh','081234567890',salesNames()[0]||'NAMA SALES','Baru',today(),15000000,'Renovasi dapur, butuh keramik dan kitchen set','Walk in'],
  ]);
  ws['!cols']=[{wch:16},{wch:24},{wch:16},{wch:22},{wch:12},{wch:20},{wch:14},{wch:40},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws,'Customer');
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Petunjuk'],['Status: Baru, Dihubungi, Penawaran, Deal, Batal (kosong = Baru)'],['Tanggal: format tanggal Excel atau dd/mm/yyyy'],['Nama salesperson harus sama dengan yang dipetakan di "Akun Salesperson"'],['Customer dengan No Member (atau No HP bila tanpa No Member) yang sudah ada dilewati saat impor']]),'Petunjuk');
  XLSX.writeFile(wb,'template-follow-up-customer.xlsx');
});
$('btn-export').addEventListener('click',()=>{
  if(!window.XLSX)return;
  const S=spStats().sort((a,b)=>String(a.sid||'~').localeCompare(String(b.sid||'~')));
  const ws1=XLSX.utils.aoa_to_sheet([['Salesperson ID','Salesperson','Total Database','Sudah Dihubungi','Belum Dihubungi','Terkirim Hari Ini','Deal'],...S.map(r=>[r.sid,r.name,r.total,r.done,r.todo,r.today,r.deal])]);
  ws1['!cols']=[{wch:20},{wch:30},{wch:14},{wch:15},{wch:15},{wch:16},{wch:8}];
  const L=CUST.slice().sort((a,b)=>String(a.salesperson||'').localeCompare(String(b.salesperson||''),'id')||a.nama.localeCompare(b.nama,'id'));
  const ws2=XLSX.utils.aoa_to_sheet([['Salesperson ID','Salesperson','No Member','Nama Customer','No HP','Status','Terakhir Dihubungi','Keterangan'],
    ...L.map(c=>[sidOf(c.salesperson),c.salesperson||'',c.member_no||'',c.nama,c.hp||'',c.status,c.last_contact?fdt(c.last_contact):'',c.catatan||''])]);
  ws2['!cols']=[{wch:20},{wch:26},{wch:16},{wch:26},{wch:16},{wch:11},{wch:20},{wch:36}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws1,'Per Salesperson');XLSX.utils.book_append_sheet(wb,ws2,'Customer');
  XLSX.writeFile(wb,'follow-up-customer-'+today()+'.xlsx');
});

/* ---------- Akun salesperson (admin) ---------- */
const dA=$('dlg-acct');
function renderAcct(){
  const em=new Map(SALES.map(s=>[s.name,s.email||'']));
  const names=salesNames(),cnt=n=>CUST.filter(c=>c.salesperson===n).length;
  const shown=e=>isSalesEmail(e)?emailToId(e):e;
  $('acct-rows').innerHTML=names.length?names.map((n,i)=>`<tr><td><b>${esc(n)}</b><div class="muted" style="font-size:12px">${cnt(n)} customer</div></td><td><input type="text" id="ae-${i}" value="${esc(shown(em.get(n)||''))}" list="user-list" placeholder="ID Salesperson atau email"></td><td><input type="text" id="ap-${i}" inputmode="numeric" autocomplete="new-password" placeholder="${em.get(n)?'(tidak diubah)':'buat akun'}"></td><td><button type="button" class="btn sm" data-i="${i}">Simpan</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">Belum ada nama salesperson. Impor data customer dulu atau tambah di bawah.</td></tr>';
  if(!$('user-list')){const dl=document.createElement('datalist');dl.id='user-list';document.body.appendChild(dl)}
  $('user-list').innerHTML=USERS.map(u=>`<option value="${esc(u)}">`).join('');
  $('acct-rows').querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.i;saveAcct(names[i],$('ae-'+i).value,$('ap-'+i).value,b)}));
}
async function saveAcct(name,email,pass,btn){
  name=(name||'').trim();email=idToEmail(email);
  if(!name||!email){dlgMsg('acct-msg','Nama dan email wajib diisi.','err');return}
  if(btn)btn.disabled=true;
  const {data,error}=await SB.rpc('fu_upsert_sales_account',{p_name:name,p_email:email,p_password:pass||null});
  if(btn)btn.disabled=false;
  if(error){dlgMsg('acct-msg','Gagal: '+error.message,'err');return}
  dlgMsg('acct-msg',name+': '+data.replace(email,isSalesEmail(email)?emailToId(email):email)+(pass?'. PIN/password: '+pass:''),'ok');
  await loadData();renderAcct();render();
}
$('btn-acct').addEventListener('click',async()=>{
  dlgMsg('acct-msg','');
  const {data}=await SB.from('user_roles').select('email').order('email');USERS=(data||[]).map(r=>r.email).filter(Boolean);
  renderAcct();dA.showModal();
});
$('a-add').addEventListener('click',async()=>{await saveAcct($('a-name').value,$('a-email').value,$('a-pass').value);$('a-name').value='';$('a-email').value='';$('a-pass').value=''});

/* ---------- Kontrol ---------- */
let qT;$('q').addEventListener('input',e=>{clearTimeout(qT);qT=setTimeout(()=>{F.q=e.target.value;renderTable()},150)});
document.querySelectorAll('th [data-sort]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const k=b.dataset.sort;if(SORT.k===k){if(SORT.dir===-1){SORT={k:'',dir:1}}else SORT.dir=-1}else SORT={k,dir:['total','done','todo','today','deal'].includes(k)?-1:1};renderTable()}));

/* ---------- Boot ---------- */
const bootMsg=(t,out)=>{$('boot-msg').textContent=t;$('boot-out').hidden=!out;$('boot').hidden=false;$('app').hidden=true};
const toLogin=()=>{try{sessionStorage.setItem('mitra10_next','followup.html')}catch(e){}location.replace('login.html?next=followup.html')};
const signOut=async()=>{try{if(SB)await SB.auth.signOut()}catch(e){}location.replace('index.html')};
$('btn-pin').addEventListener('click',()=>{dlgMsg('pin-msg','');$('pin-1').value='';$('pin-2').value='';$('dlg-pin').showModal();$('pin-1').focus()});
$('pin-save').addEventListener('click',async()=>{
  const a=$('pin-1').value,b=$('pin-2').value;
  if(a.length<6){dlgMsg('pin-msg','PIN/password minimal 6 karakter.','err');return}
  if(a!==b){dlgMsg('pin-msg','Kedua isian tidak sama.','err');return}
  $('pin-save').disabled=true;const {error}=await SB.auth.updateUser({password:a});$('pin-save').disabled=false;
  if(error){dlgMsg('pin-msg','Gagal: '+(/same/i.test(error.message)?'PIN baru sama dengan PIN lama.':error.message),'err');return}
  dlgMsg('pin-msg','Berhasil diganti. Pakai PIN baru saat masuk berikutnya.','ok');
});
$('logout').addEventListener('click',signOut);$('boot-out').addEventListener('click',signOut);
let IMPORTING=false,rt;
function liveChange(p){
  if(IMPORTING)return;
  const n=p.new,o=p.old;
  if(p.eventType==='DELETE'){CUST=CUST.filter(c=>c.id!==(o&&o.id))}
  else if(n&&n.id){const i=CUST.findIndex(c=>c.id===n.id),row={...n,potensi:+n.potensi||0};
    if(i>=0)CUST[i]=Object.assign(CUST[i],row);else CUST.push(row);
    if(CUR&&CUR.id===n.id)CUR=CUST.find(c=>c.id===n.id)}
  clearTimeout(rt);rt=setTimeout(render,600);
}
(async function boot(){
  if(!SB){bootMsg('Konfigurasi belum lengkap: isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di public/config.js.',false);return}
  try{
    const {data:{session}}=await SB.auth.getSession();
    if(!session){toLogin();return}
    ME=session.user.email||'';
    const {data:roleRow}=await SB.from('user_roles').select('role').eq('user_id',session.user.id).maybeSingle();
    ROLE=roleRow?roleRow.role:'';
    MANAGER=ROLE==='admin'||ROLE==='editor';ADMIN=ROLE==='admin';
    if(MAINTENANCE&&!ADMIN){$('boot').querySelector('h1').textContent='Sedang dilakukan pemeliharaan berkala';bootMsg('Halaman Follow Up Customer sedang disiapkan dan untuk sementara hanya dapat dibuka oleh admin. Silakan kembali lagi nanti.',true);return}
    await Promise.all([loadData(),loadTemplates()]);
    if(MAINTENANCE)showMsg('Mode pemeliharaan aktif: hanya admin yang dapat membuka halaman ini.','info');
    if(!MANAGER&&!MYSALES.length){bootMsg('Akun '+ME+' belum dihubungkan ke nama salesperson. Minta admin menghubungkannya di menu Akun Salesperson.',true);return}
    $('who-name').textContent=isSalesEmail(ME)?(MYSALES[0]||'')+' · '+emailToId(ME):ME;$('who-role').textContent=MANAGER?ROLE:'sales';
    $('btn-import').hidden=!MANAGER;$('btn-tpl').hidden=!MANAGER;$('btn-acct').hidden=!ADMIN;
    if(window.startPresence)startPresence(SB,ME,ROLE||'sales','Follow Up');
    $('boot').hidden=true;$('app').hidden=false;
    render();
    if(!MANAGER&&MYSALES.length===1)openSp(MYSALES[0]);
    SB.channel('fu-live').on('postgres_changes',{event:'*',schema:'public',table:'fu_customers'},liveChange).subscribe();
  }catch(err){bootMsg('Gagal memuat data: '+errText(err),true)}
})();
})();
