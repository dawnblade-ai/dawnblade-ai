const path="/home/user/dawnblade-ai/tools/page.js";
const {open}=require(path);
const OUT=(process.env.OUT||".")+"/";
(async()=>{
  const {page,errors,close}=await open({w:393,h:852,deps:process.env.PAGE_DEPS});
  await page.waitForTimeout(1500);
  const kinds=["opt","pick","modal","pay","reveal","target","alloc","soak"];
  const boxes=await page.evaluate((kinds)=>{
    const pool=Object.values(window.DawnPool||{}).slice?null:null;
    const mk=(n,i)=>({uid:"u"+i,name:n,pitch:1,cost:1,power:3,defense:2,types:["Generic","Action","Attack"],text:"Go again"});
    const cards=[mk("Raging Onslaught",1),mk("Sink Below",2),mk("Pummel",3)];
    const base={side:0,src:"Test Card",cards:[],sel:[],down:[],hint:"A hint with {r} pips."};
    const P={
      opt:{...base,tag:"opt",title:"Opt 2",cards:cards.slice(0,2),order:[0,1],down:[1]},
      pick:{...base,tag:"pick",title:"Choose a card",cards,sel:[0],max:2,min:0,optional:true},
      modal:{...base,tag:"modal",title:"Choose one",options:[{label:"Draw a card"},{label:"Gain 2{h}"}],choice:0,optional:true},
      pay:{...base,tag:"pay",title:"Pay or not",cost:2,avail:3,choice:null,ops:[{}],elseOps:[]},
      reveal:{...base,tag:"reveal",title:"Revealed",cards},
      target:{...base,tag:"target",title:"Declare your attack-target",cards:cards.slice(0,2),choice:null},
      alloc:{...base,tag:"alloc",title:"Distribute",cards:cards.slice(0,2),sel:[0,0],max:4},
      soak:{...base,tag:"soak",title:"Arcane incoming",amount:3,avail:4,sel:[0],options:[{uid:"a",kind:"barrier",name:"Arcane Barrier",amount:1,cost:1},{uid:"b",kind:"spellvoid",name:"Spellvoid",amount:2,cost:0}]},
    };
    window.__P=P; return Object.keys(P);
  },kinds);
  for(const k of kinds){
    const r=await page.evaluate((k)=>{
      let el=document.getElementById("__ps"); if(!el){el=document.createElement("div");el.id="__ps";document.body.appendChild(el);}
      ReactDOM.unmountComponentAtNode(el);
      const f=()=>{};
      ReactDOM.render(React.createElement(PromptSheet,{p:window.__P[k],me:0,onToggle:f,onPick:f,onTakeBack:f,onMove:f,onDecline:f,onConfirm:f}),el);
      const s=el.querySelector(".psheet"); if(!s) return "none";
      const b=s.getBoundingClientRect(); return {h:Math.round(b.height),txt:s.innerText.replace(/\s+/g," ").slice(0,200)};
    },k);
    console.log(k,JSON.stringify(r));
    await page.waitForTimeout(400); await page.screenshot({path:OUT+k+".png",scale:"css",clip:{x:0,y:852-(r.h||300)-10,width:393,height:(r.h||300)+10}});
  }
  console.log("errors",errors.length,errors.slice(0,3));
  await close();
})().catch(e=>{console.error(e);process.exit(1)});
