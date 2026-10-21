function preference(name:string) { try{return localStorage.getItem(name)==='true';}catch{return false;} }
export class AudioEngine {
  musicMuted=preference('escape.musicMuted');
  sfxMuted=preference('escape.sfxMuted');
  private ctx?:AudioContext; private noteAt=0; private beat=0;
  private mode:'sail'|'calm'='calm';
  unlock() {
    this.ctx??=new AudioContext();
    void this.ctx.resume();
  }
  toggle(kind:'music'|'sfx') {
    this.unlock();
    if(kind==='music')this.musicMuted=!this.musicMuted;else this.sfxMuted=!this.sfxMuted;
    try{localStorage.setItem(`escape.${kind}Muted`,String(kind==='music'?this.musicMuted:this.sfxMuted));}catch{/* Private mode still plays. */}
  }
  setMode(mode:'sail'|'calm') { this.mode=mode;this.noteAt=0;this.beat=0; }
  private tone(freq:number,duration:number,volume:number,type:OscillatorType='triangle',offset=0,endFreq?:number) {
    const c=this.ctx;if(!c||c.state!=='running')return;
    const t=c.currentTime+offset,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    if(endFreq)o.frequency.exponentialRampToValueAtTime(endFreq,t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.001,t+duration);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+0.02);
  }
  update() {
    const c=this.ctx;if(!c||c.state!=='running'||this.musicMuted)return;
    if(c.currentTime<this.noteAt)return;
    // Original synthesized D-minor jig; calmer half-tempo menu arrangement.
    const tune=[62,69,69,72,74,72,69,65,67,69,67,64,62,65,69,62,65,72,72,74,77,74,72,69,67,64,67,69,65,64,62,57];
    const rate=this.mode==='sail'?0.205:0.39;
    this.tone(440*2**((tune[this.beat%tune.length]-69)/12),rate*0.85,0.028,'triangle');
    if(this.beat%3===0)this.tone(this.beat%12<6?146.83:110,rate*1.5,0.025,'sine');
    this.beat++;this.noteAt=c.currentTime+rate;
  }
  play(kind:'shot'|'coin'|'positive'|'negative'|'death') {
    if(this.sfxMuted)return;
    if(kind==='shot')this.tone(160,0.14,0.12,'sawtooth',0,38);
    if(kind==='coin'){this.tone(990,0.1,0.09,'sine');this.tone(1480,0.14,0.07,'sine',0.07);}
    if(kind==='positive')[523,659,784].forEach((n,i)=>this.tone(n,0.17,0.09,'triangle',i*0.065));
    if(kind==='negative')[392,311,196].forEach((n,i)=>this.tone(n,0.19,0.12,'triangle',i*0.065));
    if(kind==='death') {
      this.tone(95,0.65,0.22,'sawtooth',0,22);
      this.tone(71,0.85,0.16,'square',0.04,20);
    }
  }
}
