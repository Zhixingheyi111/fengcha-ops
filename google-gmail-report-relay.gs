/** Standalone Apps Script, owned by fengchaspringbranch@gmail.com.
 * Script Properties: REPORT_RELAY_TOKEN (same secret as Vercel).
 * Never put its value in this source or a repository file.
 * Deploy as Web App, execute as owner, access Anyone. Server validates the shared token.
 * MailApp authorization is required once by the owner.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return relayJson_({ok:false,code:'BUSY'});
  try {
    var p = JSON.parse(e && e.postData && e.postData.contents || '{}');
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('REPORT_RELAY_TOKEN');
    if (!expected || p.token !== expected) return relayJson_({ok:false,code:'AUTH'});
    if (['Heights','SP'].indexOf(p.store) < 0 || typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{8,160}$/.test(p.id)
      || typeof p.subject !== 'string' || p.subject.length > 180 || /[\r\n]/.test(p.subject)
      || typeof p.message !== 'string' || !p.message.trim() || p.message.length > 50000) return relayJson_({ok:false,code:'INVALID'});
    var now = Date.now(), all = props.getProperties();
    Object.keys(all).forEach(function(key) {
      if (key.indexOf('sent:') === 0 || key.indexOf('rate:') === 0) {
        try { var v=JSON.parse(all[key]); if(now-v.at>35*86400000)props.deleteProperty(key); } catch (_) {}
      }
    });
    var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,p.store+'\n'+p.subject+'\n'+p.message)
      .map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
    var sentKey='sent:'+p.id, previous=props.getProperty(sentKey);
    if(previous){var sent=JSON.parse(previous);return relayJson_(sent.hash===hash?{ok:true,duplicate:true}:{ok:false,code:'CONFLICT'});}
    var day=Utilities.formatDate(new Date(),'America/Chicago','yyyy-MM-dd');
    var rateKey='rate:'+p.store+':'+day, rate=JSON.parse(props.getProperty(rateKey)||'{"n":0}');
    if(rate.n>=20)return relayJson_({ok:false,code:'RATE_LIMIT'});
    if(MailApp.getRemainingDailyQuota()<1)return relayJson_({ok:false,code:'QUOTA'});
    var name=p.store==='SP'?'Spring Branch':'Heights';
    // Fixed recipient and store prefix: the relay cannot send to supplied addresses.
    MailApp.sendEmail({to:'fengchaspringbranch@gmail.com',subject:'[Feng Cha '+name+'] '+p.subject,
      body:p.message,name:'Feng Cha '+name+' Ops'});
    props.setProperty(sentKey,JSON.stringify({at:now,hash:hash}));
    props.setProperty(rateKey,JSON.stringify({at:now,n:rate.n+1}));
    return relayJson_({ok:true});
  } catch (_) { return relayJson_({ok:false,code:'SEND_FAILED'}); }
  finally { lock.releaseLock(); }
}
function relayJson_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
