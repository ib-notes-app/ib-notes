// SPDX-License-Identifier: MPL-2.0
// Build and package an empty static edition. Never writes the installed dist.
import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,extname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const directory=join(root,'local-study-packs',`public-blank-${stamp}`),site=join(directory,'site'),source=join(directory,'source');
const base='./',installed=join(root,'apps/web/dist');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=path=>readdirSync(path,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(path,e.name)):e.isFile()?[join(path,e.name)]:[]);
const inventory=path=>files(path).map(file=>{const bytes=readFileSync(file);return {path:relative(path,file),bytes:bytes.length,sha256:sha(bytes)};}).sort((a,b)=>a.path.localeCompare(b.path));
const before=existsSync(installed)?inventory(installed):null;
mkdirSync(source,{recursive:true});

// An allowlist, not a repository archive: no Git metadata, exports, journals,
// research, environment files, tests or build artifacts enter the source copy.
const extensions=new Set(['.ts','.tsx','.css','.svg','.png','.json']);
for(const folder of ['apps/web/src','apps/web/build','apps/web/server','apps/web/public','packages']){
  for(const file of files(join(root,folder))){
    const name=relative(root,file);
    if(name.split('/').some(p=>p.startsWith('.')||['data','node_modules','dist','fixtures','__tests__'].includes(p))||
      /\.test\.tsx?$/.test(name)||/\/(?:phoneTestFixtures\.ts|PhoneTest\.css)$/.test(name)||!extensions.has(extname(name)))continue;
    const destination=join(source,name);mkdirSync(dirname(destination),{recursive:true});
    if(name==='apps/web/src/PhoneTest.tsx'){
      writeFileSync(destination,'// Internal synthetic phone fixtures are not distributed.\nexport async function preparePhoneTest(){throw new Error("Synthetic phone testing is not part of this edition.");}\nexport function clearPhoneTestSeed(){}\nexport const PhoneTestBar=()=>null;\n');
    }else cpSync(file,destination,{errorOnExist:true,force:false});
  }
}
for(const name of ['package.json','package-lock.json','tsconfig.base.json','LICENSE','apps/web/package.json','apps/web/tsconfig.json','apps/web/index.html','apps/web/vite.config.ts','scripts/build-public.mjs']){
  const destination=join(source,name);mkdirSync(dirname(destination),{recursive:true});cpSync(join(root,name),destination);
}
writeFileSync(join(source,'apps/web/src/private-data.d.ts'),'// No private reference files are supplied. Public mode removes these imports.\ndeclare module "*.json" { const value: unknown; export default value; }\n');
writeFileSync(join(source,'README.md'),`# IB Notes — blank-slate source\n\nThis is the application source for the public-blank build. No market history, user journals, Study Packs, research or internal phone fixtures are supplied. The internal phone fixture module is a nonfunctional stub; private JSON imports have type-only declarations and are eliminated by the public build.\n\nRequires Node 20.19+, npm and Python 3. Run npm ci, then npm run build:public. Use build:public for this edition; the ordinary private build expects reference files which are intentionally absent.\n\nSource: MPL 2.0 (LICENSE). Dependencies retain their licenses. Packaging is local; no hosting or data service is created.\n`);

function run(command,args,options={}){
  const result=spawnSync(command,args,{cwd:root,stdio:'inherit',...options});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`${command} failed (${result.status})`);
}
function zip(folder,destination){
  run('python3',['-c','import pathlib,sys,zipfile\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],"w",compression=zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob("*")):\n  if p.is_file(): z.write(p,p.relative_to(root).as_posix())',folder,destination]);
}
run(join(root,'node_modules/.bin/vite'),['build','--mode','public-blank','--base',base,'--outDir',site],{cwd:join(root,'apps/web')});
const identity=JSON.parse(readFileSync(join(site,'build-info.json'),'utf8'));
if(identity.distribution!=='public-blank')throw Error('Wrong build distribution');

cpSync(join(root,'LICENSE'),join(site,'LICENSE.txt'));
const packages=['react','react-dom','scheduler','@js-temporal/polyfill','jsbi','@sqlite.org/sqlite-wasm','vite','vite-plugin-pwa','idb',
  ...readdirSync(join(root,'node_modules')).filter(name=>name.startsWith('workbox-'))];
const notices=['IB Notes third-party notices','Application source: Mozilla Public License 2.0; see LICENSE.txt and source.zip.'];
for(const name of [...new Set(packages)].sort()){
  const folder=join(root,'node_modules',name);
  if(!existsSync(join(folder,'package.json')))continue;
  const info=JSON.parse(readFileSync(join(folder,'package.json'),'utf8'));
  notices.push(`\n${info.name} ${info.version} — ${typeof info.license==='string'?info.license:JSON.stringify(info.license)}\n${JSON.stringify(info.repository??info.homepage??'')}`);
  const licenseFiles=readdirSync(folder).filter(file=>/^(?:license|copying|notice)(?:[.\-]|$)/i.test(file));
  for(const file of licenseFiles)notices.push(readFileSync(join(folder,file),'utf8'));
  if(name==='@sqlite.org/sqlite-wasm'&&!licenseFiles.length){
    notices.push(`Apache-2.0 package metadata author: ${JSON.stringify(info.author)}.\n`+readFileSync(join(root,'node_modules/jsbi/LICENSE'),'utf8'));
    const upstream=readFileSync(join(folder,'dist/index.mjs'),'utf8').match(/\/\* @preserve[\s\S]*?\*\//)?.[0];
    if(!upstream)throw Error('SQLite upstream license notice is missing; review packaging.');
    notices.push(upstream);
  }
}
writeFileSync(join(site,'THIRD-PARTY-NOTICES.txt'),notices.join('\n\n')+'\n');
zip(source,join(site,'source.zip'));
const readme=`IB Notes — blank-slate edition\nBuild: ${identity.buildId}\n\nFree manual Initial Balance journal. No historical market data, Study Packs, example journal records or private backups are included. Users record their own observations using data they have permission to use. Historical forecast probabilities are unavailable without suitable compatible learning history. No live price feed or automatic news service is included. Journals stay in each browser on that device.\n\nHOSTING\nExtract IB-Notes-blank-slate.zip and serve its contents from static HTTPS hosting. Relative asset URLs support a site root or project subfolder. Open the HTTPS address in Safari/Chrome; install to the Home Screen where supported. This ZIP is a website/PWA build, not an APK or a native installer. Opening index.html directly from Files is not supported by browser storage/workers.\n\nLOCAL DESKTOP PREVIEW\nFrom the source repository:\nnpm run preview --workspace @ib-field-notes/web -- --mode public-blank --host 127.0.0.1 --port 4202 --strictPort --outDir ${site}\nOpen http://127.0.0.1:4202/ . Stop with Ctrl+C. This loopback address is for the desktop, not a phone. This does not replace the installed phone build.\n\nBACKUPS\nExport SQLite in Settings before clearing browser data, moving devices or changing app addresses. Separate addresses do not share or automatically sync journals.\n\nLICENSE AND SOURCE\nSee LICENSE.txt, THIRD-PARTY-NOTICES.txt and source.zip. Source code licensing does not grant rights to any data a user imports. Educational journal only; no trade recommendations.\n\nThis package is prepared locally. It has not been publicly deployed. Physical Android/iPhone installation on a public origin remains to be checked.\n`;
// The published copy contains no developer filesystem path.
writeFileSync(join(site,'README.txt'),readme.replace(site,'/absolute/path/to/this/site'));
writeFileSync(join(directory,'README.txt'),readme);
const outputInventory=inventory(site);
const excluded=/(?:es-(?:recent-journal|overnight-reference|ib-path-reference|ib-learning-2026-reference|market-memory-reference|auction-range-reference))|\.(?:ibpack|pricepack|fbdpack|contextpack|study|replay|sqlite3?|db|csv)(?:\.|$)/i;
for(const file of outputInventory){
  if(excluded.test(file.path)||file.path.endsWith('.map'))throw Error(`Unexpected data/source-map artifact: ${file.path}`);
  // Emscripten's literal /home/web_user is a browser virtual directory,
  // not a developer's filesystem path. Other home paths remain forbidden.
  if(/\.(?:js|css|html|txt|json)$/.test(file.path)&&/[a-z0-9.-]+\.ts\.net|https?:\/\/10\.|\/home\/(?!web_user(?:[`"']|$))[^/\s`"']+/.test(readFileSync(join(site,file.path),'utf8')))throw Error(`Private address in public artifact: ${file.path}`);
}
const after=before?inventory(installed):null;
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('The installed private build changed during preparation');
const archive=join(directory,'IB-Notes-blank-slate.zip');zip(site,archive);
const audit={...identity,base,createdAt:new Date().toISOString(),published:false,installedPrivateBuildUnchanged:true,
  privateBuild:before?JSON.parse(readFileSync(join(installed,'build-info.json'),'utf8')):null,
  bundledMarketData:false,bundledJournalRecords:false,syntheticPhoneFixtures:false,automaticNews:false,
  moduleBoundary:'Private src/data modules and PhoneTest setup rejected in app and worker outputs.',
  files:outputInventory,totalBytes:outputInventory.reduce((n,f)=>n+f.bytes,0),
  archive:{path:relative(directory,archive),sha256:sha(readFileSync(archive))},
  privateFilesBefore:before,privateFilesAfter:after,physicalPhoneTesting:'Pending',publicOriginInstall:'Pending'};
writeFileSync(join(directory,'public-audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({directory,site,archive,build:identity,privateBuildUnchanged:true,totalBytes:audit.totalBytes}));
