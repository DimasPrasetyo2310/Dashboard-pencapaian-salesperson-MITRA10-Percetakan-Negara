/* Penanda user yang sedang online (Supabase Realtime Presence, tanpa tabel database).
   Dipanggil: startPresence(SB, email, role, 'Monitoring' | 'Salesperson') */
(function(){
  const css='.pr-wrap{position:relative;display:inline-block}.pr-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:inherit;border-radius:999px;padding:3px 10px;font:600 12px system-ui,sans-serif;cursor:pointer}.pr-dot{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.25)}.pr-pop{position:fixed;left:8px;top:48px;min-width:140px;max-width:min(220px,calc(100vw - 16px));background:#fff;color:#1a2540;border-radius:12px;box-shadow:0 10px 30px rgba(10,20,50,.3);padding:7px 10px;z-index:9998;font:12.5px system-ui,sans-serif}.pr-pop[hidden]{display:none}.pr-pop h4{margin:0 0 4px;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:#5b6b8c}.pr-row{display:flex;align-items:center;gap:7px;padding:4px 0;border-top:1px solid #edf0f7}.pr-row:first-of-type{border-top:0}.pr-av{flex:0 0 26px;height:26px;border-radius:50%;background:#2563c9;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}.pr-t{min-width:0}.pr-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pr-t span{font-size:11.5px;color:#6b7893}';
  window.startPresence=function(SB,email,role,page){
    try{
      if(!SB||!email||window.__presenceOn) return; window.__presenceOn=true;
      const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
      const who=document.querySelector('.who'); if(!who) return;
      const wrap=document.createElement('span');wrap.className='pr-wrap';
      wrap.innerHTML='<button type="button" class="pr-btn" aria-expanded="false" title="Lihat siapa yang sedang online"><i class="pr-dot"></i><span id="pr-n">1 online</span></button><div class="pr-pop" hidden><h4>Sedang online</h4><div id="pr-list"></div></div>';
      who.insertBefore(wrap,who.firstChild);
      const btn=wrap.querySelector('.pr-btn'),pop=wrap.querySelector('.pr-pop');
      const place=()=>{pop.hidden=false;const r=btn.getBoundingClientRect(),w=pop.offsetWidth,vw=document.documentElement.clientWidth;pop.style.left=Math.max(8,Math.min(r.left,vw-w-8))+'px';pop.style.top=(r.bottom+6)+'px'};
      wrap.addEventListener('mouseenter',place);wrap.addEventListener('mouseleave',()=>{pop.hidden=true});
      btn.addEventListener('click',e=>{e.stopPropagation();place();btn.setAttribute('aria-expanded','true')});
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
        document.getElementById('pr-list').innerHTML=list.map(u=>'<div class="pr-row" title="'+esc(u.email+' · '+(u.role||'')+' · '+[...u.pages].join(', ')+' · sejak '+hm(u.since))+'"><i class="pr-dot"></i><div class="pr-t"><b>'+esc(u.email.split('@')[0])+(u.email===email?' (Anda)':'')+'</b></div></div>').join('')||'<span>Tidak ada</span>';
      };
      ch.on('presence',{event:'sync'},render).subscribe(async s=>{if(s==='SUBSCRIBED'){try{await ch.track({email,role,page,since})}catch(e){}}});
    }catch(e){}
  };
})();
