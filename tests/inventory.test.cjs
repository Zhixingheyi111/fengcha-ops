const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
function app(storage=new Map()){
 const elements=new Map();
 const ctx={console,Date,Math,JSON,Number,isFinite,encodeURIComponent,Promise,setTimeout,clearTimeout,setInterval(){},navigator:{},window:{addEventListener(){}},
 document:{readyState:'loading',addEventListener(){},querySelectorAll(){return[];},getElementById(id){if(!elements.has(id))elements.set(id,{style:{},innerHTML:'',textContent:''});return elements.get(id);}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch(){throw Error('Unexpected network');}};
 vm.createContext(ctx);vm.runInContext(script,ctx);ctx.ST.emp='Test Employee';ctx.ST.store='Heights';
 ctx.ST.invItems={daily:[{name:'Milk',min:2,cat:'DRINK',unit:'Bottle'}],biw:[{name:'Cups',min:3,cat:'PACKAGING'}]};
 ctx.invLoadDraft();ctx.loadInvLast=()=>Promise.resolve();ctx.syncBiweeklySheet=()=>Promise.resolve();
 return {ctx,storage,elements};
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
test('drafts survive mode/store changes and reload, isolated by employee',async()=>{
 const {ctx:c,storage}=app();c.invSet('Milk','3.25');c.invMode('biw');assert.equal(c.ST.invCounts.Milk,undefined);c.invSet('Cups','7');c.invMode('daily');assert.equal(c.ST.invCounts.Milk,'3.25');
 c.ST.store='SP';c.renderInv();assert.equal(c.ST.invCounts.Milk,undefined);c.invSet('Milk','9');c.ST.store='Heights';c.renderInv();assert.equal(c.ST.invCounts.Milk,'3.25');
 const fresh=app(storage).ctx;assert.equal(fresh.ST.invCounts.Milk,'3.25');fresh.ST.emp='Other';fresh.renderInv();assert.equal(fresh.ST.invCounts.Milk,undefined);await settle();
});
test('mail failure keeps a durable outbox and retry never writes inventory again',async()=>{
 const {ctx:c,storage,elements}=app();let writes=0;c.sb=()=>{writes++;return Promise.resolve({ok:true});};c.sendReport=()=>Promise.reject(Error('monthly quota'));c.invSet('Milk','1');c.invSubmit();c.invSubmit();await settle();
 assert.equal(writes,1);assert.equal(c.ST.invOutbox.length,1);assert.equal(Object.keys(c.ST.invCounts).length,0);assert.match(elements.get('invSt').textContent,/Inventory saved/);
 const fresh=app(storage).ctx;assert.equal(fresh.ST.invOutbox.length,1);fresh.sb=()=>{throw Error('Retry must not save inventory');};fresh.sendReport=()=>Promise.resolve({ok:true});fresh.invRetryEmails();await settle();assert.equal(fresh.ST.invOutbox.length,0);
});
test('save failure preserves counts and never sends email',async()=>{
 const {ctx:c,elements}=app();c.sb=()=>Promise.resolve({ok:false,status:403});c.sendReport=()=>{throw Error('Must not send');};c.invSet('Milk','2');c.invSubmit();await settle();assert.equal(c.ST.invCounts.Milk,'2');assert.equal(c.ST.invOutbox.length,0);assert.match(elements.get('invSt').textContent,/save not confirmed/);assert.equal(c.ST.invBusy,false);
});
test('negative counts are rejected before network access',()=>{const {ctx:c}=app();c.invSet('Milk','-1');c.invSubmit();assert.equal(c.ST.invBusy,false);});
test('switching store during save leaves each draft and email with its own store',async()=>{
 const {ctx:c}=app();let complete,report;c.sb=()=>new Promise(r=>complete=r);c.sendReport=r=>{report=r;return Promise.resolve({ok:true});};c.invSet('Milk','1');c.invSubmit();c.ST.store='SP';c.renderInv();c.invSet('Milk','8');complete({ok:true});await settle();assert.equal(c.ST.invCounts.Milk,'8');assert.equal(report.store,'Heights');c.ST.store='Heights';c.renderInv();assert.equal(Object.keys(c.ST.invCounts).length,0);
});
const handler=require('../api/send-report.js');
function res(){return{code:200,setHeader(){},status(n){this.code=n;return this;},json(d){this.data=d;return this;}};}
test('server rejects invalid origins, invalid stores, and unconfigured relay',async()=>{
 let r=res();await handler({method:'POST',headers:{origin:'https://bad.example'},body:{}},r);assert.equal(r.code,403);
 r=res();await handler({method:'POST',headers:{origin:'https://fengcha-ops.vercel.app'},body:{id:'inventory-test-1',store:'Other',subject:'Test',message:'Test'}},r);assert.equal(r.code,400);
 r=res();await handler({method:'POST',headers:{origin:'https://fengcha-ops.vercel.app'},body:{id:'inventory-test-1',store:'SP',subject:'Test',message:'Test'}},r);assert.equal(r.code,503);
});
test('Apps Script deduplicates retries and separates two store subjects',()=>{
 const props=new Map([['REPORT_RELAY_TOKEN','test-only']]),sent=[];const c={Date,JSON,Math,MailApp:{getRemainingDailyQuota:()=>10,sendEmail:x=>sent.push(x)},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v),getProperties:()=>Object.fromEntries(props),deleteProperty:k=>props.delete(k)})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>[...require('node:crypto').createHash('sha256').update(s).digest()],formatDate:()=> '2026-10-19'},ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('google-gmail-report-relay.gs','utf8'),c);
 const post=p=>c.doPost({postData:{contents:JSON.stringify({token:'test-only',id:'inventory-test-1',store:'SP',subject:'Daily',message:'Test',...p})}});
 assert.equal(post({}).ok,true);assert.equal(post({}).duplicate,true);assert.equal(sent.length,1);assert.equal(post({id:'inventory-test-2',store:'Heights'}).ok,true);assert.match(sent[0].subject,/Spring Branch/);assert.match(sent[1].subject,/Heights/);assert.equal(sent[0].to,'fengchaspringbranch@gmail.com');assert.equal(post({token:'invalid',id:'inventory-test-3'}).ok,false);
});
test('both stores and both inventory modes send correctly labelled saved snapshots',async()=>{
 for(const store of ['Heights','SP'])for(const mode of ['daily','biw']){
  const {ctx:c}=app();c.ST.store=store;c.ST.invMode=mode;c.invLoadDraft();let saved,sent;
  c.sb=(_,opts)=>{saved=JSON.parse(opts.body);return Promise.resolve({ok:true});};c.sendReport=r=>{sent=r;return Promise.resolve({ok:true});};
  c.invSet(mode==='daily'?'Milk':'Cups','1');c.invSubmit();await settle();assert.equal(saved[0].store,store);assert.equal(saved[0].mode,mode);assert.equal(sent.store,store);assert.match(sent.subject,mode==='daily'?/DAILY/:/BI-WEEKLY/);assert.equal(c.ST.invOutbox.length,0);
 }
});
test('server forwards only report fields and handles relay success and quota errors',async()=>{
 const oldFetch=global.fetch,oldUrl=process.env.GMAIL_REPORT_RELAY_URL,oldToken=process.env.GMAIL_REPORT_RELAY_TOKEN;
 process.env.GMAIL_REPORT_RELAY_URL='https://script.google.com/macros/s/mock-deployment/exec';process.env.GMAIL_REPORT_RELAY_TOKEN='test-only';
 try{
  let forwarded;global.fetch=async(_,opts)=>{forwarded=JSON.parse(opts.body);return{ok:true,json:async()=>({ok:true,duplicate:true})};};
  const req={method:'POST',headers:{origin:'https://fengcha-ops.vercel.app'},body:{id:'inventory-test-1',store:'SP',subject:'Daily',message:'Test',to:'arbitrary@example.com'}};
  let r=res();await handler(req,r);assert.equal(r.code,200);assert.equal(r.data.duplicate,true);assert.equal(forwarded.to,undefined);
  global.fetch=async()=>({ok:true,json:async()=>({ok:false,code:'QUOTA'})});r=res();await handler(req,r);assert.equal(r.code,502);assert.match(r.data.error,/Gmail sending limit/);
 }finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.GMAIL_REPORT_RELAY_URL;else process.env.GMAIL_REPORT_RELAY_URL=oldUrl;if(oldToken===undefined)delete process.env.GMAIL_REPORT_RELAY_TOKEN;else process.env.GMAIL_REPORT_RELAY_TOKEN=oldToken;}
});
