/* JKR AI patch v3.0 - loads after the main script. */
(function(){
const $=id=>document.getElementById(id);
const oldAsk=window.askAI;
let pend=[],active=null,rec=null,listening=false;
const st=document.createElement('style');
st.textContent='.modal{max-height:90vh;overflow-y:auto}.pchips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.pchips span{background:#f0efff;border:1px solid #e4e6fb;border-radius:14px;padding:4px 10px;font-size:12px;cursor:pointer}.amenu{display:none;gap:8px;flex-wrap:wrap;margin-bottom:8px}.amenu.on{display:flex}.msg .row2{margin-top:6px;display:flex;gap:12px}.msg .row2 button{border:0;background:none;color:#6335e8;font-size:12px;padding:0}.micon{background:#ffe4ee!important}';
document.head.appendChild(st);

/* old model names are retired -> use the latest alias */
if(!cfg.model||/^gemini-2\.5-flash$/.test(cfg.model))cfg.model='gemini-flash-latest';
if(!cfg.isrc)cfg.isrc='free';
if(!cfg.vl)cfg.vl='ur-PK';
store.set('cfg',cfg);

/* ---------- Gemini streaming with retry + backup models ---------- */
async function gs(contents,onT){
  const list=[...new Set([cfg.model||'gemini-flash-latest','gemini-flash-latest','gemini-flash-lite-latest','gemini-3.8-flash'])];
  let last='',think=true;
  for(const m of list){
    for(let t=0;t<2;t++){
      const ac=new AbortController(),to=setTimeout(()=>ac.abort(),25000);
      try{
        const body=JSON.stringify(think?{contents,generationConfig:{thinkingConfig:{thinkingBudget:0}}}:{contents});
        const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(m)+':streamGenerateContent?alt=sse&key='+encodeURIComponent(cfg.key),{method:'POST',headers:{'Content-Type':'application/json'},body,signal:ac.signal});
        if(!r.ok){
          clearTimeout(to);const tx=await r.text();last=r.status+' ('+m+') '+tx.slice(0,160);
          if(r.status===400&&think){think=false;t--;continue}
          if([400,401,403].includes(r.status))throw new Error(last);
          if(r.status===404)break;
          await new Promise(z=>setTimeout(z,1500));continue;
        }
        const rd=r.body.getReader(),dc=new TextDecoder();let buf='',full='',first=true;
        while(true){
          const {done,value}=await rd.read();
          if(first){clearTimeout(to);first=false}
          if(done)break;
          buf+=dc.decode(value,{stream:true});
          const lines=buf.split('\n');buf=lines.pop();
          for(const ln of lines){
            if(!ln.startsWith('data:'))continue;
            try{const j=JSON.parse(ln.slice(5));const p=j.candidates&&j.candidates[0]&&j.candidates[0].content&&j.candidates[0].content.parts;
              if(p){full+=p.map(x=>x.text||'').join('');if(onT)onT(full)}}catch(e){}
          }
        }
        if(!full)throw new Error('Jawab khali aaya');
        return full;
      }catch(e){
        clearTimeout(to);
        if(e.name==='AbortError'){last='Time out ('+m+')';continue}
        throw e;
      }
    }
  }
  throw new Error('Sab models busy ya band hain. Thori der baad try karein. Aakhri: '+last);
}
window.askAI=async function(prompt,files=[]){
  if(!cfg.key)throw Error('Pehle Settings mein API key daalein.');
  if(cfg.provider!=='gemini')return oldAsk(prompt,files);
  const parts=[{text:prompt}];files.forEach(f=>parts.push({inlineData:{mimeType:f.mime_type,data:f.data}}));
  return gs([{role:'user',parts}]);
};

/* ---------- attachments ---------- */
function readF(f){return new Promise((res,rej)=>{
  if(f.size>15*1024*1024)return rej(new Error(f.name+' bohat bari hai (15MB tak)'));
  if(f.type.startsWith('image/')){const img=new Image(),url=URL.createObjectURL(f);
    img.onload=()=>{const k=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res({kind:'img',name:f.name,mime:'image/jpeg',data:c.toDataURL('image/jpeg',.85).split(',')[1]})};
    img.onerror=()=>rej(new Error('Photo nahi khuli'));img.src=url;return}
  if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){const fr=new FileReader();fr.onload=()=>res({kind:'pdf',name:f.name,mime:'application/pdf',data:String(fr.result).split(',')[1]});fr.onerror=()=>rej(new Error('PDF nahi khuli'));fr.readAsDataURL(f);return}
  if(/\.(txt|csv|md|json)$/i.test(f.name)||f.type.startsWith('text/')){const fr=new FileReader();fr.onload=()=>res({kind:'text',name:f.name,text:String(fr.result).slice(0,60000)});fr.onerror=()=>rej(new Error('File nahi khuli'));fr.readAsText(f);return}
  rej(new Error(f.name+': sirf photo, PDF, txt, csv, md, json chalti hain'));
})}
const chips=document.createElement('div');chips.className='pchips';
const am=document.createElement('div');am.className='amenu';
am.innerHTML='<button class="soft" data-a="image/*">🖼 Photo</button><button class="soft" data-a="image/*" data-c="1">📷 Camera</button><button class="soft" data-a=".pdf,.txt,.csv,.md,.json">📄 Document</button>';
const comp=document.querySelector('#chatPane .composer');
comp.before(chips);comp.before(am);
function drawChips(){chips.innerHTML='';pend.forEach((a,i)=>{const s=document.createElement('span');s.textContent=(a.kind==='img'?'🖼 ':'📎 ')+a.name.slice(0,24)+' ✕';s.onclick=()=>{pend.splice(i,1);drawChips()};chips.appendChild(s)})}
$('attachBtn').onclick=()=>am.classList.toggle('on');
am.querySelectorAll('button').forEach(b=>b.onclick=()=>{am.classList.remove('on');const fi=$('chatFile');fi.accept=b.dataset.a;if(b.dataset.c)fi.setAttribute('capture','environment');else fi.removeAttribute('capture');fi.click()});
$('chatFile').onchange=async e=>{for(const f of e.target.files){try{pend.push(await readF(f))}catch(err){alert(err.message)}}e.target.value='';drawChips()};

/* ---------- chat with memory, files, streaming ---------- */
function ensureChat(first){if(!active){active={id:Date.now(),title:first.slice(0,55),messages:[],date:new Date().toLocaleString(),archived:false};chats.unshift(active)}return active}
function actions(box,text){
  const r=document.createElement('div');r.className='row2';
  const c=document.createElement('button');c.textContent='Copy';c.onclick=()=>{try{navigator.clipboard.writeText(text);c.textContent='Copied ✓'}catch(e){}};
  const s=document.createElement('button');s.textContent='🔊 Sunein';
  s.onclick=()=>{try{const ss=speechSynthesis;if(ss.speaking){ss.cancel();s.textContent='🔊 Sunein';return}const u=new SpeechSynthesisUtterance(text.replace(/[*`#]/g,''));u.lang=cfg.vl||'ur-PK';u.onend=()=>{s.textContent='🔊 Sunein'};s.textContent='⏹ Band';ss.speak(u)}catch(e){}};
  r.appendChild(c);r.appendChild(s);box.appendChild(r);
}
window.sendChat=async function(){
  const q=$('prompt').value.trim();
  if((!q&&!pend.length)||busy)return;
  if(!cfg.key){alert('Pehle Settings mein API key daalein.');settingsDialog();return}
  busy=true;$('sendBtn').disabled=true;$('prompt').value='';
  const files=pend.slice();pend=[];drawChips();
  let full_q=q||'Is file/photo ko dekh kar batayein ye kya hai aur khulasa dein.';
  files.filter(f=>f.kind==='text').forEach(f=>{full_q+='\n\n[File: '+f.name+']\n'+f.text});
  const media=files.filter(f=>f.kind!=='text');
  const ch=ensureChat(q||files[0].name);
  const ub=addMessage('user',q||'📎 '+files.map(f=>f.name).join(', '),false);
  files.forEach(f=>{if(f.kind==='img'){const im=document.createElement('img');im.src='data:'+f.mime+';base64,'+f.data;im.style.maxWidth='180px';ub.appendChild(im)}else if(f.kind!=='text'||true){const d=document.createElement('div');d.textContent='📎 '+f.name;d.style.cssText='font-size:12px;margin-top:6px';ub.appendChild(d)}});
  ch.messages.push({role:'user',text:q||'📎 '+files.map(f=>f.name).join(', '),api:full_q});save();
  const box=addMessage('ai','…',false);
  try{
    let answer;
    if(cfg.provider!=='gemini'){answer=await oldAsk(full_q);box.textContent=answer}
    else{
      let msgs=ch.messages.slice(-20);while(msgs.length&&msgs[0].role!=='user')msgs.shift();
      const contents=msgs.map((m,i)=>{const parts=[{text:m.api||m.text}];if(i===msgs.length-1)media.forEach(f=>parts.push({inlineData:{mimeType:f.mime,data:f.data}}));return{role:m.role==='assistant'?'model':'user',parts}});
      answer=await gs(contents,t=>{box.textContent=t;$('messages').scrollTop=$('messages').scrollHeight});
      box.textContent=answer;
    }
    ch.messages.push({role:'assistant',text:answer});save();actions(box,answer);
  }catch(e){box.textContent='Error: '+e.message;ch.messages.pop();save()}
  finally{busy=false;$('sendBtn').disabled=false;$('messages').scrollTop=$('messages').scrollHeight}
};
$('sendBtn').onclick=window.sendChat;
window.openChat=function(id){const c=chats.find(x=>x.id===id);if(!c)return;active=c;setTab('chat');$('messages').innerHTML='';c.messages.forEach(m=>addMessage(m.role,m.text,false))};
const nb=document.createElement('button');nb.className='soft';nb.textContent='✚ New chat';nb.style.marginBottom='8px';
nb.onclick=()=>{if(busy)return;active=null;pend=[];drawChips();$('messages').innerHTML='<div class="welcome"><div class="bubble">💬</div><b>Nayi Conversation</b><span>Apna sawal neeche likhein.</span></div>'};
$('messages').before(nb);

/* ---------- voice in chat ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const mic=document.createElement('button');mic.className='soft';mic.textContent='🎤';mic.title='Bol kar likhein';
$('sendBtn').before(mic);
mic.onclick=()=>{
  if(!SR){alert('Is browser mein voice input nahi hai (Chrome use karein)');return}
  if(listening){rec&&rec.stop();return}
  rec=new SR();rec.lang=cfg.vl||'ur-PK';rec.interimResults=true;
  const base=$('prompt').value;
  rec.onresult=e=>{let t='';for(const r of e.results)t+=r[0].transcript;$('prompt').value=(base?base+' ':'')+t};
  rec.onend=()=>{listening=false;mic.classList.remove('micon')};
  rec.onerror=e=>{alert('Voice masla: '+e.error+(e.error==='not-allowed'?' (microphone ki ijazat dein)':''))};
  listening=true;mic.classList.add('micon');try{rec.start()}catch(e){listening=false;mic.classList.remove('micon')}
};

/* ---------- images: free source first ---------- */
async function geminiImage(p){
  const u='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.imageModel||'gemini-2.5-flash-image')+':generateContent?key='+encodeURIComponent(cfg.key);
  const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:p}]}],generationConfig:{responseModalities:['TEXT','IMAGE']}})});
  const t=await r.text();if(!r.ok)throw new Error(r.status+' '+t.slice(0,200));
  const parts=(JSON.parse(t).candidates?.[0]?.content?.parts)||[];
  const imgs=parts.filter(x=>x.inlineData).map(x=>'data:'+x.inlineData.mimeType+';base64,'+x.inlineData.data);
  if(!imgs.length)throw new Error('Image nahi bani');return imgs;
}
function showImg(out,src,dl){const im=document.createElement('img');im.src=src;out.appendChild(im);const a=document.createElement('a');a.href=src;a.target='_blank';if(dl)a.download='jkr-ai.png';a.textContent=dl?'Download image':'🔗 Tasveer kholein (long-press → Save image)';a.className='soft';a.style.cssText='display:inline-block;margin-top:8px';out.appendChild(a)}
$('imageBtn').onclick=async()=>{
  const p=$('imagePrompt').value.trim();if(!p)return;
  const out=$('imageResult');out.textContent='Tasveer ban rahi hai…';
  try{
    if(cfg.isrc==='gemini'){
      if(!cfg.key)throw new Error('Pehle API key daalein');
      const imgs=await geminiImage(p);out.innerHTML='';imgs.forEach(d=>showImg(out,d,true));return;
    }
    const u='https://image.pollinations.ai/prompt/'+encodeURIComponent(p)+'?width=768&height=768&nologo=true&seed='+Math.floor(Math.random()*1e6);
    await new Promise((res,rej)=>{const im=new Image(),tm=setTimeout(()=>rej(new Error('Time out: bohat dair lagi')),60000);
      im.onload=()=>{clearTimeout(tm);out.innerHTML='';showImg(out,u,false);res()};
      im.onerror=()=>{clearTimeout(tm);rej(new Error('Free tasveer service abhi nahi chali (busy ya band ho sakti hai). Thori der baad try karein.'))};
      im.src=u});
  }catch(e){out.textContent='Error: '+e.message}
};

/* ---------- settings ---------- */
window.settingsDialog=function(){
  modal('<h3>⚙ AI Settings</h3><label>Provider</label><select class="field" id="provider"><option value="gemini">Google Gemini</option><option value="openai">OpenAI-compatible</option></select><label>API key</label><input class="field" id="apiKey" type="password" value="'+escapeHtml(cfg.key||'')+'" placeholder="Paste API key"><label>Model</label><input class="field" id="modelName" value="'+escapeHtml(cfg.model||'')+'"><button class="soft" id="chkM" style="width:100%;margin-bottom:10px">🔍 Check models</button><label>Tasveer (Image) source</label><select class="field" id="isrc"><option value="free">Free (Pollinations)</option><option value="gemini">Gemini (paid key)</option></select><label>Image model (sirf Gemini source ke liye)</label><input class="field" id="imageModel" value="'+escapeHtml(cfg.imageModel||'')+'"><label>Voice ki zubaan</label><select class="field" id="vl"><option value="ur-PK">Urdu</option><option value="en-US">English</option><option value="hi-IN">Hindi</option></select><p class="muted">📱 App version: v3.0</p><div class="actions"><button class="soft" onclick="closeModal()">Cancel</button><button class="primary" id="saveCfg">Save settings</button></div>');
  $('provider').value=cfg.provider||'gemini';$('isrc').value=cfg.isrc||'free';$('vl').value=cfg.vl||'ur-PK';
  $('chkM').onclick=async()=>{const b=$('chkM'),k=$('apiKey').value.trim();if(!k){b.textContent='Pehle API key daalein';return}
    b.textContent='Check ho raha hai…';
    try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?key='+encodeURIComponent(k));const t=await r.text();
      if(!r.ok){b.textContent='Error '+r.status+': '+t.slice(0,100);return}
      const ids=JSON.parse(t).models.filter(x=>(x.supportedGenerationMethods||[]).includes('generateContent')).map(x=>x.name.replace(/^models\//,''));
      const cur=$('modelName').value.trim();
      if(!ids.includes(cur))$('modelName').value=ids.includes('gemini-flash-latest')?'gemini-flash-latest':(ids.find(i=>/^gemini-.*flash$/.test(i))||ids[0]);
      b.textContent='✅ Key theek hai ('+ids.length+' models). Ab Save dabayein.';
    }catch(e){b.textContent='Masla: '+e.message}};
  $('saveCfg').onclick=()=>{cfg={provider:$('provider').value,key:$('apiKey').value.trim(),model:$('modelName').value.trim(),imageModel:$('imageModel').value.trim(),isrc:$('isrc').value,vl:$('vl').value};store.set('cfg',cfg);closeModal();alert('Settings save ho gayin.')};
};
$('settingsBtn').onclick=window.settingsDialog;
})();
