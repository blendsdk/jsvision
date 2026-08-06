import{c as a}from"./virtual-fs.CTNS5bZf.js";const o="/workspace",i={[o]:{".env":`MODE=demo
`,"README.md":`# File laboratory
`,"notes.txt":`safe notes\x1B[2J
`,src:{"main.ts":`export const answer = 42;
`,"view.ts":`export const view = "classic";
`},empty:{}}};function E(){const r=a({tree:i,home:o,mtime:new Date("2026-07-15T10:30:00.000Z")});let n="none";const t=()=>{if(n==="denied")throw Object.assign(new Error("EACCES: access denied"),{code:"EACCES"});if(n==="io-error")throw Object.assign(new Error("EIO: virtual I/O error"),{code:"EIO"})};return{fs:{...r,roots:()=>(t(),r.roots()),readDir:e=>(t(),r.readDir(e)),stat:e=>(t(),r.stat(e)),lstat:e=>(t(),r.lstat(e)),readFile:e=>(t(),r.readFile(e)),writeFile:(e,s)=>{t(),r.writeFile(e,s)},rename:(e,s)=>{t(),r.rename(e,s)},unlink:e=>{t(),r.unlink(e)}},setFault:e=>{n=e},reset:()=>{n="none"}}}export{o as F,E as c};
