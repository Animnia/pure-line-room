/* room audio — all sounds synthesized with Web Audio API, no assets */
window.RoomAudio=(function(){
  let ctx=null,master=null,noiseBuffer=null;
  const loopStates={};
  const loops={};

  /* real-recorded assets (HTMLAudio, sub-range playback) */
  const ASSETS={
    doorOpen:{src:'sounds/window.mp3',t:19.4,d:0.5,g:0.9},
    doorClose:{src:'sounds/window.mp3',t:31.96,d:1.45,g:0.9},
    windowOpen:{src:'sounds/door_open.mp3',t:0.05,d:1.5,g:0.85},
    windowClose:{src:'sounds/door_close.mp3',t:0.2,d:1.0,g:0.8},
    cabinet:{src:'sounds/cabinet.mp3',t:0.2,d:0.8,g:0.9},
    cabinetClose:{src:'sounds/cabinet.mp3',t:3.05,d:0.9,g:0.9}
  };
  const audioEls={};
  function preloadAssets(){
    for(const k in ASSETS){
      const a=ASSETS[k];
      if(audioEls[k])continue;
      try{
        const el=new Audio(a.src);
        el.preload='auto';
        el.addEventListener('error',()=>{a.failed=true;});
        el.load();
        audioEls[k]=el;
      }catch(e){a.failed=true;}
    }
  }
  function use(name){
    const a=ASSETS[name];
    if(!a||a.failed)return false;
    const el=audioEls[name];
    if(!el||el.error){a.failed=true;return false;}
    try{
      el.pause();
      el.currentTime=a.t;
      el.volume=a.g;
      const p=el.play();
      if(p&&p.catch)p.catch(()=>{});
      if(a.stopTimer)clearTimeout(a.stopTimer);
      a.stopTimer=setTimeout(()=>{try{el.pause();}catch(e){}},a.d*1000);
      return true;
    }catch(e){a.failed=true;return false;}
  }

  function ensure(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      ctx=new AC();
      master=ctx.createGain();master.gain.value=0.4;master.connect(ctx.destination);
      const len=2*ctx.sampleRate,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      noiseBuffer=buf;
      preloadAssets();
      for(const k in loopStates) if(loopStates[k].on) startLoop(k);
    }
    if(ctx.state==='suspended')ctx.resume();
    return true;
  }
  function now(){return ctx.currentTime;}
  const mf=m=>440*Math.pow(2,(m-69)/12);

  /* ---------- primitives ---------- */
  function tone(o){
    const t=o.t!==undefined?o.t:now();
    const os=ctx.createOscillator(),g=ctx.createGain();
    os.type=o.type||'sine';
    os.frequency.setValueAtTime(o.f||440,t);
    if(o.f2)os.frequency.exponentialRampToValueAtTime(Math.max(o.f2,1),t+(o.dur||0.2));
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(o.g||0.05,t+(o.a||0.005));
    g.gain.exponentialRampToValueAtTime(0.0001,t+(o.dur||0.2));
    os.connect(g);g.connect(o.dest||master);
    os.start(t);os.stop(t+(o.dur||0.2)+0.05);
  }
  function noise(o){
    const t=o.t!==undefined?o.t:now();
    const s=ctx.createBufferSource();s.buffer=noiseBuffer;s.loop=true;
    s.playbackRate.value=0.7+Math.random()*0.6;
    const f=ctx.createBiquadFilter();f.type=o.type||'bandpass';
    f.frequency.value=o.f||1000;f.Q.value=o.q||1;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(o.g||0.05,t+(o.a||0.004));
    g.gain.exponentialRampToValueAtTime(0.0001,t+(o.dur||0.2));
    s.connect(f);f.connect(g);g.connect(o.dest||master);
    s.start(t);s.stop(t+(o.dur||0.2)+0.05);
  }
  function squeak(dir,dur,g0){
    const t=now();
    const o=ctx.createOscillator();o.type='triangle';
    const f0=dir>0?520:760,f1=dir>0?820:560,f2=dir>0?640:470;
    o.frequency.setValueAtTime(f0,t);
    o.frequency.linearRampToValueAtTime(f1,t+dur*0.5);
    o.frequency.linearRampToValueAtTime(f2,t+dur);
    const vib=ctx.createOscillator();vib.frequency.value=5.5;
    const vg=ctx.createGain();vg.gain.value=26;
    vib.connect(vg);vg.connect(o.frequency);
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=5;
    bp.frequency.setValueAtTime(f0*1.4,t);
    bp.frequency.linearRampToValueAtTime(f1*1.4,t+dur*0.5);
    bp.frequency.linearRampToValueAtTime(f2*1.4,t+dur);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(g0||0.055,t+0.06);
    g.gain.setValueAtTime((g0||0.055)*0.9,t+dur*0.55);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const tr=ctx.createOscillator();tr.frequency.value=17+Math.random()*10;
    const tg=ctx.createGain();tg.gain.value=(g0||0.055)*0.55;
    tr.connect(tg);tg.connect(g.gain);
    o.connect(bp);bp.connect(g);g.connect(master);
    o.start(t);o.stop(t+dur+0.02);vib.start(t);vib.stop(t+dur+0.02);tr.start(t);tr.stop(t+dur+0.02);
  }
  function clack(delay,g0){
    const v=g0||0.07,t=now()+(delay||0);
    tone({type:'square',f:1500,t,dur:0.022,g:v});
    noise({t:t+0.005,dur:0.03,f:2500,q:1.5,g:v*0.5});
    tone({type:'square',f:1000,t:t+0.06,dur:0.025,g:v*0.7});
  }
  function click(f,dur,g0){tone({type:'square',f:f||1300,dur:dur||0.03,g:g0||0.05});}
  function thud(f,g0,dur){tone({type:'sine',f:f||80,f2:(f||80)*0.6,dur:dur||0.16,g:g0||0.08});}
  function chimeMotif(g0){
    const base=[1568,1760,2093,2349][Math.random()*4|0],t0=now()+0.02;
    [1,1.19,0.89].forEach((mm,i)=>{
      [1,2.76].forEach((m,j)=>tone({type:'sine',f:base*mm*m,t:t0+i*0.14,dur:1.7-j*0.4,g:(g0||0.013)/(j+1)/(i?1.3:1)}));
    });
  }

  /* ---------- one-shots ---------- */
  const sfxMap={
    door(){clack(0,0.05);if(!use('doorOpen')){squeak(1,0.55,0.05);}},
    doorClose(){if(!use('doorClose')){squeak(-1,0.5,0.05);}clack(0.32,0.06);},
    windowOpen(){if(!use('windowOpen')){clack(0,0.06);squeak(1,0.3,0.04);}},
    windowClose(){if(!use('windowClose')){squeak(-1,0.28,0.04);clack(0.26,0.07);}},
    blindsUp(){for(let i=0;i<8;i++)noise({t:now()+i*0.055,dur:0.03,f:1100+i*160,q:3,g:0.028});noise({t:now()+0.5,dur:0.06,f:900,q:2,g:0.03});},
    blindsDown(){for(let i=0;i<8;i++)noise({t:now()+i*0.055,dur:0.03,f:2100-i*150,q:3,g:0.028});noise({t:now()+0.5,dur:0.06,f:800,q:2,g:0.035});},
    drawerOut(){noise({dur:0.4,f:380,f2:0,q:1.2,g:0.05,a:0.06});setTimeout(()=>thud(95,0.05,0.1),380);},
    drawerIn(){noise({dur:0.35,f:600,f2:0,q:1.2,g:0.045,a:0.05});setTimeout(()=>thud(110,0.06,0.1),330);},
    lamp(){click(2100,0.02,0.06);},
    mug(){tone({type:'sine',f:1568,dur:0.7,g:0.05});tone({type:'sine',f:2349,dur:0.5,g:0.02});},
    cabinet(){if(!use('cabinet')){squeak(1,0.2,0.032);clack(0.2,0.05);}},
    cabinetClose(){if(!use('cabinetClose')){squeak(-1,0.2,0.032);clack(0.2,0.05);}},
    book(){noise({dur:0.28,f:1600,q:0.8,g:0.05,a:0.02});},
    clockToggle(){tone({type:'square',f:300,dur:0.06,g:0.15});},
    tick(){noise({dur:0.008,type:'highpass',f:3800,g:0.045});tone({type:'triangle',f:1250,dur:0.012,g:0.045});},
    tock(){noise({dur:0.008,type:'highpass',f:3300,g:0.045});tone({type:'triangle',f:980,dur:0.012,g:0.045});},
    pillow(){noise({dur:0.55,f:700,q:0.7,g:0.05,a:0.08});setTimeout(()=>noise({dur:0.2,f:220,q:0.8,g:0.055,a:0.01}),500);},
    recordArm(){click(1400,0.025,0.045);noise({t:now()+0.12,dur:0.14,type:'highpass',f:2500,g:0.035});},
    picture(){tone({type:'sine',f:180,f2:120,dur:0.12,g:0.06});},
    globe(){tone({type:'triangle',f:210,f2:420,dur:0.35,g:0.035});},
    ball(){[0,0.55,1.1].forEach((d,i)=>tone({type:'sine',f:430,f2:150,t:now()+d,dur:0.15,g:0.075/(i+1)}));},
    switchOn(){click(1250,0.028,0.07);setTimeout(()=>click(900,0.02,0.05),70);},
    switchOff(){click(900,0.028,0.06);setTimeout(()=>click(700,0.02,0.04),70);},
    chair(){noise({dur:0.75,f:260,q:0.8,g:0.055,a:0.1});},
    chime(){chimeMotif(0.018);},
    plant(){noise({dur:0.35,f:1500,q:0.7,g:0.04,a:0.02});}
  };

  /* ---------- continuous loops ---------- */
  function makeGain(v){
    const g=ctx.createGain();g.gain.value=0.0001;g.connect(master);
    const n=now();g.gain.linearRampToValueAtTime(v,n+1.2);
    return g;
  }
  function fadeOut(g,done){
    const n=now();g.gain.cancelScheduledValues(n);g.gain.setValueAtTime(Math.max(g.gain.value,0.0001),n);
    g.gain.linearRampToValueAtTime(0.0001,n+0.7);
    setTimeout(done,800);
  }
  function noiseSrc(dest,filterType,freq,q,g0){
    const s=ctx.createBufferSource();s.buffer=noiseBuffer;s.loop=true;
    const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;f.Q.value=q;
    const g=ctx.createGain();g.gain.value=g0;
    s.connect(f);f.connect(g);g.connect(dest);s.start();
    return s;
  }
  function oscSrc(dest,type,freq,g0){
    const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;
    const g=ctx.createGain();g.gain.value=g0;
    o.connect(g);g.connect(dest);o.start();
    return o;
  }

  const loopBuilders={
    fan(){
      const g=makeGain(0.06),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'sine',58,0.5));
      L.nodes.push(oscSrc(g,'triangle',117,0.12));
      const s=noiseSrc(g,'bandpass',260,0.8,0.4);
      const lfo=ctx.createOscillator();lfo.frequency.value=2.4;
      const lg=ctx.createGain();lg.gain.value=0.2;
      lfo.connect(lg);lg.connect(s.playbackRate);lfo.start();
      L.nodes.push(s,lfo);
      return L;
    },
    steam(){const g=makeGain(0.003),L={g,nodes:[noiseSrc(g,'highpass',5500,0.7,1)]};return L;},
    hum(){
      const g=makeGain(0.005),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'square',120,0.25));
      L.nodes.push(oscSrc(g,'sine',50,0.5));
      const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=300;
      return L;
    },
    plantSway(){
      const g=makeGain(0.01),L={g,nodes:[]};
      const s=noiseSrc(g,'bandpass',1400,0.6,1);
      const lfo=ctx.createOscillator();lfo.frequency.value=0.7;
      const lg=ctx.createGain();lg.gain.value=0.35;
      lfo.connect(lg);lg.connect(s.playbackRate);lfo.start();
      L.nodes.push(s,lfo);
      return L;
    },
    chimes(){
      const L={g:master,on:true};
      const step=()=>{if(!L.on)return;chimeMotif();
        L.timer=setTimeout(step,9000+Math.random()*9000);};
      L.timer=setTimeout(step,2500);return L;
    },
    vinyl(){
      const L={g:master,on:true};
      L.nodes=[noiseSrc(master,'lowpass',120,0.5,0.012)];
      const step=()=>{if(!L.on)return;
        if(Math.random()<0.75)noise({dur:0.005+Math.random()*0.006,type:'highpass',f:2800,g:0.004+Math.random()*0.012});
        L.timer=setTimeout(step,45+Math.random()*110);};
      step();return L;
    },
    dayAmb(){
      const L={g:master,on:true};
      L.nodes=[noiseSrc(master,'lowpass',320,0.5,0.012)];
      const step=()=>{if(!L.on)return;
        const t=now()+0.05,n=2+(Math.random()*2|0);
        for(let i=0;i<n;i++){const f0=2200+Math.random()*1400;
          tone({type:'sine',f:f0,f2:f0*0.72,t:t+i*0.12,dur:0.09,g:0.018});}
        L.timer=setTimeout(step,2500+Math.random()*5500);};
      L.timer=setTimeout(step,1200);return L;
    },
    nightAmb(){
      const L={g:master,on:true};
      L.nodes=[noiseSrc(master,'lowpass',200,0.5,0.008)];
      const step=()=>{if(!L.on)return;
        const t=now()+0.02;
        for(let i=0;i<4;i++)tone({type:'square',f:4300,t:t+i*0.055,dur:0.03,g:0.011});
        L.timer=setTimeout(step,700+Math.random()*900);};
      step();return L;
    },
    melody(){
      const g=makeGain(1),L={g,on:true};
      const bpm=78,spb=60/bpm,loopBeats=32;
      const lead=[[0,69,1],[1,72,1],[2,76,1.5],[3.5,74,0.5],
        [4,65,1],[5,69,1],[6,72,2],
        [8,64,1],[9,67,1],[10,72,1.5],[11.5,71,0.5],
        [12,67,1],[13,71,1],[14,74,2],
        [16,69,1],[17,72,1],[18,76,2],
        [20,77,1.5],[21.5,76,0.5],[22,74,1],[23,72,1],
        [24,67,1],[25,72,1],[26,76,2],
        [28,71,2],[30,69,2]];
      const bass=[[0,45],[4,41],[8,48],[12,43],[16,45],[20,41],[24,48],[28,43]];
      const pad=[[0,[57,60,64]],[4,[53,57,60]],[8,[48,52,55]],[12,[55,59,62]],
        [16,[57,60,64]],[20,[53,57,60]],[24,[48,52,55]],[28,[55,59,62]]];
      const schedule=(t0)=>{
        lead.forEach(n=>tone({type:'triangle',f:mf(n[1]),t:t0+n[0]*spb,dur:n[2]*spb*0.92,g:0.05,a:0.02,dest:g}));
        bass.forEach(n=>tone({type:'sine',f:mf(n[1]),t:t0+n[0]*spb,dur:3.4*spb,g:0.05,a:0.02,dest:g}));
        pad.forEach(n=>n[1].forEach(m=>tone({type:'sine',f:mf(m),t:t0+n[0]*spb,dur:3.8*spb,g:0.015,a:0.4,dest:g})));
        L.nextT=t0+loopBeats*spb;
        L.timer=setTimeout(()=>{if(L.on)schedule(L.nextT);},loopBeats*spb*1000-300);
      };
      schedule(now()+0.15);
      return L;
    }
  };

  function startLoop(name){
    if(loops[name]&&loops[name].on)return;
    loops[name]=loopBuilders[name]();
    loops[name].on=true;
  }
  function stopLoop(name){
    const L=loops[name];
    if(!L)return;
    L.on=false;
    if(L.timer)clearTimeout(L.timer);
    if(L.g&&L.g!==master)fadeOut(L.g,()=>{if(L.nodes)L.nodes.forEach(n=>{try{n.stop();}catch(e){}});});
    else if(L.nodes)L.nodes.forEach(n=>{try{n.stop();}catch(e){}});
    delete loops[name];
  }

  return {
    unlock(){ensure();},
    sfx(name){if(!ctx)return;if(sfxMap[name])sfxMap[name]();},
    loop(name,on){
      const st=loopStates[name]||(loopStates[name]={on:false});
      if(st.on===on)return;
      st.on=on;
      if(!ctx)return;
      if(on)startLoop(name);else stopLoop(name);
    }
  };
})();
