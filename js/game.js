// Electric Battery game: sequencer, mic sampling, piano, harp, persistence

const padsContainer = document.getElementById('pads');
const playBtn = document.getElementById('play');
const bpmSlider = document.getElementById('bpm');
const recordBtn = document.getElementById('record');
const saveBtn = document.getElementById('save');

const NUM_PADS = 8;
const STEPS = 8;
let samplers = [];
let patterns = [];
let currentPattern = 0;
let isPlaying = false;
let stepIndex = 0;
let currentSamples = new Array(NUM_PADS).fill(null);

// simple in-memory sequencer grid: patterns[pattern][pad][step] = boolean
function makeDefaultPatterns(){
  const p = [];
  for(let pat=0;pat<3;pat++){
    const grid = Array.from({length:NUM_PADS}, ()=>Array.from({length:STEPS}, ()=>false));
    // simple presets
    if(pat===0){ grid[0][0]=true; grid[1][2]=true; grid[2][4]=true; grid[3][6]=true; }
    if(pat===1){ grid[0][0]=true; grid[0][4]=true; grid[1][2]=true; grid[2][2]=true; grid[3][6]=true; }
    if(pat===2){ for(let i=0;i<NUM_PADS;i++) grid[i][i%STEPS]=true; }
    p.push(grid);
  }
  return p;
}

patterns = makeDefaultPatterns();

function makePads(){
  padsContainer.innerHTML='';
  for(let i=0;i<NUM_PADS;i++){
    const b = document.createElement('button');
    b.className='pad';
    b.textContent = `Pad ${i+1}`;
    b.dataset.index = i;
    b.addEventListener('touchstart', onPad);
    b.addEventListener('mousedown', onPad);
    padsContainer.appendChild(b);

    const player = new Tone.Player({url: getDefaultSample(i), autostart:false}).toDestination();
    samplers.push(player);
  }
}

function getDefaultSample(i){
  const defaults = [
    '/assets/kick.wav','/assets/snare.wav','/assets/hihat.wav','/assets/clap.wav',
    '/assets/tom1.wav','/assets/tom2.wav','/assets/rim.wav','/assets/cowbell.wav'
  ];
  return defaults[i] || defaults[0];
}

async function onPad(e){
  e.preventDefault();
  const i = Number(e.currentTarget.dataset.index);
  const p = samplers[i];
  if(p && p.start){ p.start(); }
}

// Sequencer tick
Tone.Transport.scheduleRepeat((time)=>{
  if(!isPlaying) return;
  for(let pad=0;pad<NUM_PADS;pad++){
    if(patterns[currentPattern][pad][stepIndex]){
      samplers[pad].start(time);
      flashPad(pad);
    }
  }
  stepIndex = (stepIndex+1)%STEPS;
}, '8n');

function flashPad(i){
  const btn = padsContainer.querySelector(`button[data-index=\"${i}\"]`);
  if(!btn) return;
  btn.animate([{transform:'scale(1)'},{transform:'scale(1.06)'}],{duration:120,iterations:1});
}

playBtn?.addEventListener('click', async ()=>{
  await Tone.start();
  Tone.Transport.bpm.value = Number(bpmSlider.value);
  if(isPlaying){ Tone.Transport.stop(); isPlaying=false; playBtn.textContent='Play'; }
  else { Tone.Transport.start(); isPlaying=true; playBtn.textContent='Stop'; }
});

bpmSlider?.addEventListener('input', ()=>{ Tone.Transport.bpm.value = Number(bpmSlider.value); });

// microphone recording / sample assignment
let userMedia = null;
let recorder = null;

recordBtn?.addEventListener('click', async ()=>{
  if(!recorder){ await startRecording(); }
  else { await stopRecording(); }
});

async function startRecording(){
  try{
    await Tone.start();
    userMedia = new Tone.UserMedia();
    await userMedia.open();
    recorder = new Tone.Recorder();
    userMedia.connect(recorder);
    recorder.start();
    recordBtn.textContent='Stop Recording';
  }catch(err){ console.error(err); alert('Microphone access failed: '+err.message); }
}

async function stopRecording(){
  if(!recorder) return;
  const recording = await recorder.stop();
  const blob = new Blob([recording], {type:'audio/webm'});
  const url = URL.createObjectURL(blob);
  // assign to first free pad or pad 0 for simplicity
  const padIndex = 0;
  samplers[padIndex].load(url);
  // persist to localStorage (small) as base64
  const reader = new FileReader();
  reader.onload = ()=>{
    try{ localStorage.setItem('pad-sample-'+padIndex, reader.result); }
    catch(e){ console.warn('persist failed',e); }
  };
  reader.readAsDataURL(blob);
  recordBtn.textContent='Record Sample';
  recorder = null;
}

// Load persisted samples
function loadPersisted(){
  for(let i=0;i<NUM_PADS;i++){
    const data = localStorage.getItem('pad-sample-'+i);
    if(data){ samplers[i].load(data); }
  }
}

// Save/Load presets (export/import JSON)
saveBtn?.addEventListener('click', ()=>{
  const preset = {patterns, currentPattern, samples:[]};
  for(let i=0;i<NUM_PADS;i++) preset.samples.push(localStorage.getItem('pad-sample-'+i));
  const blob = new Blob([JSON.stringify(preset)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='baia-preset.json'; a.click();
});

// Simple piano (one octave)
function makePiano(){
  const keyboard = document.getElementById('keyboard');
  if(!keyboard) return;
  const notes = ['C4','D4','E4','F4','G4','A4','B4','C5'];
  const synth = new Tone.Synth().toDestination();
  notes.forEach(n=>{
    const btn = document.createElement('button'); btn.className='key'; btn.textContent=n;
    btn.addEventListener('touchstart',()=>synth.triggerAttackRelease(n,'8n'));
    btn.addEventListener('mousedown',()=>synth.triggerAttackRelease(n,'8n'));
    keyboard.appendChild(btn);
  });
}

// Simple harp
function makeHarp(){
  const harp = document.getElementById('harp');
  if(!harp) return;
  const strings = ['C5','E5','G5','B4','D5','F5'];
  const pluck = new Tone.PluckSynth().toDestination();
  strings.forEach(s=>{
    const b = document.createElement('button'); b.className='string'; b.textContent='♪';
    b.addEventListener('touchstart',()=>pluck.triggerAttack(s));
    b.addEventListener('mousedown',()=>pluck.triggerAttack(s));
    harp.appendChild(b);
  });
}

// init
makePads();
loadPersisted();
makePiano();
makeHarp();

// TODO: UI for pattern selection, pad-assign UI, better persistence, sample management
