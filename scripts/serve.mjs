import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8','.json':'application/json','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.otf':'font/otf'};
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const filename=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    const file=(await stat(filename)).isDirectory()?path.join(filename,'index.html'):filename;
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT||0),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'/'));
const stop=()=>{server.close(()=>process.exit(0));server.closeAllConnections();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
