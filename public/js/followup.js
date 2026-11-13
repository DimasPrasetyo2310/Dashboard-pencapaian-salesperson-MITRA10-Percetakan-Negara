// Follow Up Customer, MITRA10 Percetakan Negara (10005).
// Tabel Supabase: fu_customers, fu_logs, fu_salespeople (lihat supabase/followup_customer.sql).
(function(){
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STATUS=['Baru','Dihubungi','Penawaran','Deal','Batal'];
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

/* ---------- Filter & render ---------- */
function scoped(){return CUST.filter(c=>!F.sales||c.salesperson===F.sales)}
function filtered(){
  const q=F.q.trim().toLowerCase(),qd=digits(F.q),t=today(),w=addDays(t,7);
  return scoped().filter(c=>{
    if(F.status&&c.status!==F.status)return false;
    if(F.due){const s=dueState(c);
      if(F.due==='late'&&s!=='late')return false;
      if(F.due==='today'&&s!=='today')return false;
      if(F.due==='due'&&s!=='late'&&s!=='today')return false;
      if(F.due==='week'&&!(OPEN.has(c.status)&&c.next_date&&c.next_date>=t&&c.next_date<=w))return false;
      if(F.due==='none'&&s!=='none')return false;}
    if(q){const hay=(c.nama+' '+(c.catatan||'')+' '+(c.salesperson||'')+' '+(c.member_no||'')).toLowerCase();
      if(!hay.includes(q)&&!(qd.length>=3&&digits(c.hp).includes(qd)))return false}
    return true;
  });
}
function sorted(list){
  const k=SORT.k,d=SORT.dir;
  return list.slice().sort((a,b)=>{
    if(!k){const p=PRI[dueState(a)]-PRI[dueState(b)];if(p)return p;
      return String(a.next_date||'9999').localeCompare(String(b.next_date||'9999'))||b.potensi-a.potensi}
    let x=a[k],y=b[k];
    if(k==='potensi')return (x-y)*d;
    if(k==='status')return (STATUS.indexOf(x)-STATUS.indexOf(y))*d;
    x=x==null?'':String(x);y=y==null?'':String(y);
    if(!x&&y)return 1;if(x&&!y)return -1;
    return x.localeCompare(y,'id')*d;
  });
}
function renderKpis(){
  const L=scoped(),t=today();
  const open=L.filter(c=>OPEN.has(c.status));
  const late=open.filter(c=>dueState(c)==='late').length,tod=open.filter(c=>dueState(c)==='today').length;
  const pen=L.filter(c=>c.status==='Penawaran'),deal=L.filter(c=>c.status==='Deal'),bat=L.filter(c=>c.status==='Batal');
  const sum=a=>a.reduce((s,c)=>s+c.potensi,0);
  const ratio=deal.length+bat.length?deal.length/(deal.length+bat.length):null;
  const week=open.filter(c=>c.next_date&&c.next_date>t&&c.next_date<=addDays(t,7)).length;
  const K=[
    {cls:'hero',l:'Customer aktif',v:nf.format(open.length),s:`dari ${nf.format(L.length)} customer · potensi ${rp(sum(open))}`,act:{status:'',due:''}},
    {cls:late?'alert':'',l:'Perlu follow up',v:nf.format(late+tod),s:`${nf.format(tod)} hari ini · ${nf.format(late)} terlambat · ${nf.format(week)} minggu ini`,act:{due:'due',status:''}},
    {l:'Penawaran',v:nf.format(pen.length),s:'potensi '+rp(sum(pen)),act:{status:'Penawaran',due:''}},
    {l:'Deal',v:nf.format(deal.length),s:'nilai '+rp(sum(deal)),act:{status:'Deal',due:''}},
    {l:'Rasio deal',v:ratio==null?'–':dec(ratio*100,0)+'%',s:`${nf.format(deal.length)} deal · ${nf.format(bat.length)} batal`,act:null}
  ];
  $('kpis').innerHTML=K.map((k,i)=>`<button type="button" class="kpi ${k.cls||''}" data-k="${i}"${k.act?'':' disabled style="cursor:default"'}><span class="l">${k.l}</span><span class="v num">${k.v}</span><span class="s">${k.s}</span></button>`).join('');
  $('kpis').querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{const a=K[+b.dataset.k].act;if(!a)return;Object.assign(F,a);$('f-due').value=F.due;PAGE=0;render()}));
}
function renderChips(){
  const L=scoped(),cnt=s=>L.filter(c=>c.status===s).length;
  $('chips').innerHTML=[['','Semua',L.length],...STATUS.map(s=>[s,s,cnt(s)])].map(([v,l,n])=>`<button type="button" class="chip" data-s="${v}" aria-pressed="${F.status===v}">${l}<span class="n">${nf.format(n)}</span></button>`).join('');
  $('chips').querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{F.status=b.dataset.s;PAGE=0;render()}));
}
function renderTable(){
  const L=sorted(filtered()),pages=Math.max(1,Math.ceil(L.length/PER));
  if(PAGE>=pages)PAGE=pages-1;
  const part=L.slice(PAGE*PER,PAGE*PER+PER);
  $('rows').innerHTML=part.length?part.map(c=>{
    const s=dueState(c),wa=waNum(c.hp);
    return `<tr data-id="${c.id}" class="${s==='late'?'late':s==='today'?'today':''}" tabindex="0">
      <td class="cname"><b>${esc(c.nama)}</b>${c.member_no?`<small>No. member ${esc(c.member_no)}</small>`:''}${c.catatan?`<small>${esc(c.catatan.length>70?c.catatan.slice(0,70)+'…':c.catatan)}</small>`:''}</td>
      <td data-l="No. HP">${wa?`<a class="wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" data-stop>${waIcon()}${esc(c.hp)}</a>`:'<span class="muted">–</span>'}</td>
      <td data-l="Sales">${esc(c.salesperson||'–')}</td>
      <td data-l="Status"><span class="st st-${esc(c.status)}">${esc(c.status)}</span></td>
      <td data-l="Jadwal">${dueLabel(c)}</td>
      <td class="r num" data-l="Potensi">${c.potensi?rp(c.potensi):'<span class="muted">–</span>'}</td>
      <td data-l="Terakhir">${c.last_contact?fdt(c.last_contact):'<span class="muted">Belum pernah</span>'}</td></tr>`}).join('')
    :`<tr><td colspan="7" class="empty">${CUST.length?'Tidak ada customer yang cocok dengan filter.':(MANAGER?'Belum ada customer. Klik "Impor Excel" untuk memasukkan data, atau "+ Customer".':'Belum ada customer untuk Anda. Klik "+ Customer" untuk menambah.')}</td></tr>`;
  const tot=L.reduce((s,c)=>s+c.potensi,0);
  $('foot').innerHTML=L.length?`<tr><td colspan="5">${nf.format(L.length)} customer</td><td class="r num">${rp(tot)}</td><td></td></tr>`:'';
  $('pager').innerHTML=pages>1?`<span>Halaman ${PAGE+1} dari ${pages}</span><span class="actions"><button type="button" class="btn sm" id="pg-prev"${PAGE?'':' disabled'}>Sebelumnya</button><button type="button" class="btn sm" id="pg-next"${PAGE<pages-1?'':' disabled'}>Berikutnya</button></span>`:'';
  if(pages>1){$('pg-prev').onclick=()=>{PAGE--;renderTable()};$('pg-next').onclick=()=>{PAGE++;renderTable()}}
  $('rows').querySelectorAll('tr[data-id]').forEach(tr=>{
    const open=()=>openCust(+tr.dataset.id);
    tr.addEventListener('click',e=>{if(e.target.closest('[data-stop]'))return;open()});
    tr.addEventListener('keydown',e=>{if(e.key==='Enter')open()});
  });
}
const waIcon=()=>'<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3z"/></svg>';
function renderRecap(){
  $('recap-card').hidden=!MANAGER;if(!MANAGER)return;
  const by=new Map();
  CUST.forEach(c=>{const k=c.salesperson||'(tanpa salesperson)';if(!by.has(k))by.set(k,[]);by.get(k).push(c)});
  const rows=[...by.entries()].map(([n,L])=>{
    const ct=s=>L.filter(c=>c.status===s).length,d=ct('Deal'),b=ct('Batal');
    return {n,L,t:L.length,ct,d,b,late:L.filter(c=>dueState(c)==='late').length,
      run:L.filter(c=>OPEN.has(c.status)).reduce((s,c)=>s+c.potensi,0),dv:L.filter(c=>c.status==='Deal').reduce((s,c)=>s+c.potensi,0),r:d+b?d/(d+b):null};
  }).sort((a,b)=>b.t-a.t);
  $('recap').innerHTML=rows.length?rows.map(r=>`<tr data-sales="${esc(r.n)}"><td><b>${esc(r.n)}</b></td><td class="r num">${r.t}</td>${STATUS.map(s=>`<td class="r num">${r.ct(s)||'<span class="muted">0</span>'}</td>`).join('')}<td class="r num">${r.late?`<span class="due late">${r.late}</span>`:'<span class="muted">0</span>'}</td><td class="r num">${rp(r.run)}</td><td class="r num">${rp(r.dv)}</td><td>${r.r==null?'<span class="muted">–</span>':`<div style="display:flex;align-items:center;gap:8px"><div class="bar"><i style="width:${(r.r*100).toFixed(0)}%"></i></div><span class="num">${dec(r.r*100,0)}%</span></div>`}</td></tr>`).join(''):'<tr><td colspan="11" class="empty">Belum ada data.</td></tr>';
  $('recap').querySelectorAll('tr[data-sales]').forEach(tr=>tr.addEventListener('click',()=>{F.sales=tr.dataset.sales==='(tanpa salesperson)'?'':tr.dataset.sales;$('f-sales').value=F.sales;PAGE=0;render();window.scrollTo({top:0,behavior:'smooth'})}));
}
function renderSalesFilter(){
  const names=salesNames(),sel=$('f-sales'),cur=F.sales;
  const show=MANAGER||MYSALES.length>1;
  $('f-sales-wrap').hidden=!show;
  const opts=MANAGER?names:MYSALES;
  sel.innerHTML='<option value="">Semua</option>'+opts.map(n=>`<option${n===cur?' selected':''}>${esc(n)}</option>`).join('');
  $('sales-list').innerHTML=(MANAGER?names:MYSALES).map(n=>`<option value="${esc(n)}">`).join('');
}
function render(){
  renderSalesFilter();renderKpis();renderChips();renderTable();renderRecap();
  $('scope').textContent=MANAGER?'Semua customer · '+nf.format(CUST.length)+' customer':(MYSALES.length?'Customer milik '+MYSALES.join(', '):'Akun Anda belum dihubungkan ke nama salesperson. Hubungi admin.');
}

/* ---------- Dialog customer ---------- */
const dlg=$('dlg');
document.querySelectorAll('dialog [data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
['c-status','l-status'].forEach(id=>{$(id).innerHTML=STATUS.map(s=>`<option>${s}</option>`).join('')});
function fillForm(c){
  $('c-nama').value=c?c.nama:'';$('c-hp').value=c?(c.hp||''):'';
  $('c-sales').value=c?(c.salesperson||''):(F.sales||(MYSALES.length===1?MYSALES[0]:''));
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
  if(OPEN.has(st)&&!nx){dlgMsg('dlg-msg','Isi tanggal follow up berikutnya (atau ubah status ke Deal/Batal).','err');$('l-next').focus();return}
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
  const L=sorted(filtered());
  const ws=XLSX.utils.aoa_to_sheet([['No Member','Nama Customer','No HP','Salesperson','Status','Follow Up Berikutnya','Nilai Potensi','Keterangan','Terakhir Dihubungi'],
    ...L.map(c=>[c.member_no||'',c.nama,c.hp||'',c.salesperson||'',c.status,c.next_date||'',c.potensi||0,c.catatan||'',c.last_contact?fdt(c.last_contact):''])]);
  ws['!cols']=[{wch:16},{wch:24},{wch:16},{wch:22},{wch:12},{wch:18},{wch:14},{wch:40},{wch:20}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Follow Up');
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
let qT;$('q').addEventListener('input',e=>{clearTimeout(qT);qT=setTimeout(()=>{F.q=e.target.value;PAGE=0;renderTable()},150)});
$('f-sales').addEventListener('change',e=>{F.sales=e.target.value;PAGE=0;render()});
$('f-due').addEventListener('change',e=>{F.due=e.target.value;PAGE=0;render()});
document.querySelectorAll('th [data-sort]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.sort;if(SORT.k===k){if(SORT.dir===-1){SORT={k:'',dir:1}}else SORT.dir=-1}else SORT={k,dir:1};renderTable()}));

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
    await loadData();
    if(!MANAGER&&!MYSALES.length){bootMsg('Akun '+ME+' belum dihubungkan ke nama salesperson. Minta admin menghubungkannya di menu Akun Salesperson.',true);return}
    $('who-name').textContent=isSalesEmail(ME)?(MYSALES[0]||'')+' · '+emailToId(ME):ME;$('who-role').textContent=MANAGER?ROLE:'sales';
    $('btn-import').hidden=!MANAGER;$('btn-tpl').hidden=!MANAGER;$('btn-acct').hidden=!ADMIN;
    if(window.startPresence)startPresence(SB,ME,ROLE||'sales','Follow Up');
    $('boot').hidden=true;$('app').hidden=false;
    render();
    const t=scoped().filter(c=>['late','today'].includes(dueState(c))).length;
    if(t)showMsg(`Ada ${t} customer yang perlu di-follow up hari ini atau sudah terlambat. Klik kartu "Perlu follow up" untuk melihatnya.`,'info');
    SB.channel('fu-live').on('postgres_changes',{event:'*',schema:'public',table:'fu_customers'},liveChange).subscribe();
  }catch(err){bootMsg('Gagal memuat data: '+errText(err),true)}
})();
})();
