/* Penanda user yang sedang online (Supabase Realtime Presence, tanpa tabel database).
   Dipanggil: startPresence(SB, email, role, 'Monitoring' | 'Salesperson') */
(function(){
  const css='.pr-wrap{position:relative;display:inline-block}.pr-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:inherit;border-radius:999px;padding:3px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}.pr-dot{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.25)}.pr-chips{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}.pr-chip{display:inline-flex;align-items:center;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,.16);border-radius:999px;padding:2px 9px;font:600 11.5px system-ui,sans-serif}.pr-chip.me{background:rgba(52,211,153,.28)}@media(max-width:700px){.pr-chips{display:none}}.pr-pop{position:absolute;right:0;top:calc(100% + 8px);min-width:260px;max-width:92vw;background:#fff;color:#1a2540;border-radius:12px;box-shadow:0 10px 30px rgba(10,20,50,.3);padding:10px 12px;z-index:9998;font:13px system-ui,sans-serif}.pr-pop[hidden]{display:none}.pr-pop h4{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#5b6b8c}.pr-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #edf0f7}.pr-row:first-of-type{border-top:0}.pr-av{flex:0 0 26px;height:26px;border-radius:50%;background:#2563c9;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}.pr-t{min-width:0}.pr-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pr-t span{font-size:11.5px;color:#6b7893}';
  window.startPresence=function(SB,email,role,page){
    try{
      if(!SB||!email||window.__presenceOn) return; window.__presenceOn=true;
      const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
      const who=document.querySelector('.who'); if(!who) return;
      const wrap=document.createElement('span');wrap.className='pr-wrap';
      wrap.innerHTML='<button type="button" class="pr-btn" aria-expanded="false" title="Lihat siapa yang sedang online"><i class="pr-dot"></i><span id="pr-n">1 online</span></button><span class="pr-chips" id="pr-chips"></span><div class="pr-pop" hidden><h4>Sedang online</h4><div id="pr-list"></div></div>';
      who.insertBefore(wrap,who.firstChild);
      const btn=wrap.querySelector('.pr-btn'),pop=wrap.querySelector('.pr-pop');
      btn.addEventListener('click',e=>{e.stopPropagation();pop.hidden=!pop.hidden;btn.setAttribute('aria-expanded',String(!pop.hidden))});
      document.addEventListener('click',e=>{if(!wrap.contains(e.target)){pop.hidden=true;btn.setAttribute('aria-expanded','false')}});
      const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const hm=t=>{try{return new Date(t).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}catch(e){return ''}};
      const key=email+'|'+Math.random().toString(36).slice(2,8), since=new Date().toISOString();
      const ch=SB.channel('presence-online',{config:{presence:{key}}});
      const render=()=>{
        const st=ch.presenceState(),by=new Map();
        Object.values(st).forEach(arr=>arr.forEach(m=>{const k=m.email;if(!k)return;const e=by.get(k);if(!e)by.set(k,{email:k,role:m.role,pages:new Set([m.page]),since:m.since});else{e.pages.add(m.page);if(m.since<e.since)e.since=m.since}}));
        const list=[...by.values()].sort((a,b)=>(a.email===email?-1:b.email===email?1:a.since<b.since?-1:1));
        document.getElementById('pr-n').textContent=list.length+' online';
        const nm=e=>e.split('@')[0];
        document.getElementById('pr-chips').innerHTML=list.slice(0,4).map(u=>'<span class="pr-chip'+(u.email===email?' me':'')+'" title="'+esc(u.email)+'">'+esc(nm(u.email))+(u.email===email?' (Anda)':'')+'</span>').join('')+(list.length>4?'<span class="pr-chip">+'+(list.length-4)+'</span>':'');
        document.getElementById('pr-list').innerHTML=list.map(u=>'<div class="pr-row"><div class="pr-av">'+esc(u.email.charAt(0).toUpperCase())+'</div><div class="pr-t"><b>'+esc(u.email)+(u.email===email?' (Anda)':'')+'</b><span>'+esc(u.role||'')+' · '+esc([...u.pages].join(', '))+' · sejak '+hm(u.since)+'</span></div></div>').join('')||'<span>Tidak ada</span>';
      };
      ch.on('presence',{event:'sync'},render).subscribe(async s=>{if(s==='SUBSCRIBED'){try{await ch.track({email,role,page,since})}catch(e){}}});
    }catch(e){}
  };
})();
