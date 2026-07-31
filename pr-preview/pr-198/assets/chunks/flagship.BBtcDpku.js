import{a as _}from"./demo-shell.DZjxuq9w.js";import{T as W}from"./template1-dialog.CSrY69D2.js";import{c as V,a as K,L as j,t as B,b as Y,C as X,d as J,e as Q,f as Z,o as w}from"./probe.CMI_qbLz.js";import{s as E,T as P,B as M,G as ee,a as p}from"./button.BQ6XfzoM.js";const te=72,ne=20,N=68,ie=16,U=`interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

const profiles: UserProfile[] = [
  {
    id: 'usr-1042',
    displayName: 'Ada Lovelace',
    email: 'ada@example.test',
    role: 'admin',
  },
];

function formatProfile(profile: UserProfile): string {
  const heading = \`Profile: \${profile.displayName}\`;
  profile.
  return heading;
}

for (const profile of profiles) {
  console.log(formatProfile(profile));
}
`,G=`interface Invoice {
  number: string;
  customerId: string;
  total: number;
  paid: boolean;
}

const customerNames = new Map<string, string>([
  ['customer-1', 'Northwind'],
  ['customer-2', 'Contoso'],
]);

function describeInvoice(invoice: Invoice): string {
  const customer = customerNames.get(invoice.customerIdd);
  const state = invoice.paid ? 'paid' : 'open';
  const amount = invoice.total.toFixed(2);

  return \`\${invoice.number} · \${customer} · \${amount} · \${state}\`;
}

const invoice: Invoice = {
  number: 'INV-2048',
  customerId: 'customer-1',
  total: 1840.5,
  paid: false,
};

console.log(describeInvoice(invoice));
`,q=`interface Release {
  version: string;
  channel: 'stable' | 'preview';
  features: readonly string[];
}

function summarizeRelease(release: Release): string {
  const heading = \`\${release.version} [\${release.channel}]\`;
  const features = release.features
    .map((feature, index) => \`  \${index + 1}. \${feature}\`)
    .join('\\n');

  if (features.length === 0) {
    return \`\${heading}\\n  No visible changes\`;
  }

  return \`\${heading}\\n\${features}\`;
}

const nextRelease: Release = {
  version: '1.4.0',
  channel: 'preview',
  features: [
    'Syntax-aware examples',
    'Responsive editor workspaces',
    'Visible language intelligence',
  ],
};

console.log(summarizeRelease(nextRelease));
`;function oe(e){return e==="lsp-completion"?{source:U,actionLabel:"~R~equest suggestions",panelTitle:"SMART COMPLETION",lookFor:"A real suggestion popup plus bounded hover and signature evidence.",caretOffset:U.indexOf(`profile.
`)+8}:e==="lsp-diagnostics"?{source:G,actionLabel:"~R~eveal diagnostics",panelTitle:"DIAGNOSTICS",lookFor:"The error marker beside customerIdd and a safe, readable explanation.",caretOffset:G.indexOf("customerIdd")+11}:{source:q,actionLabel:"Fold ~r~egion",panelTitle:"CODE FOLDING",lookFor:"Fold arrows in the gutter and a shorter, easier-to-scan document.",caretOffset:q.indexOf("function summarizeRelease")}}function se(e,n){if(e==="language-folding")return;const o=Q({capabilities:{completion:!0,hover:!0,signatureHelp:!0,diagnostics:!0}}),s=Z({document:n,session:o,uri:n.uri??`file:///docs/${e}.ts`,languageId:"typescript",limits:{completionItems:6,diagnostics:4,contentCharacters:120}});return{session:o,coordinator:s}}function ae(e){return{scenario:e,language:"typescript","document-revision":0,"selection-size":0,"caret-offset":0,"fold-count":0,"completion-count":0,"diagnostic-count":0,"intelligence-kinds":0,"service-state":e==="language-folding"?"plain":"ready","syntax-state":"loading","terminal-safe":!0,"status-text":"Ready"}}function re(e,n,o,s){e.bindProbe("language",()=>n.document.languageId),e.bindProbe("document-revision",()=>Number(n.document.identity.revision)),e.bindProbe("selection-size",()=>n.publicState.selectionSize),e.bindProbe("caret-offset",()=>Number(n.document.selection.head)),e.bindProbe("fold-count",()=>n.retainedState.folds),e.bindProbe("intelligence-kinds",()=>s.intelligenceKinds),o!==void 0&&(e.bindProbe("completion-count",()=>{var t;return((t=o.coordinator.presentation.completion)==null?void 0:t.items.length)??0}),e.bindProbe("diagnostic-count",()=>o.coordinator.presentation.diagnostics.items.length),e.bindProbe("service-state",()=>o.coordinator.serviceState),e.bindProbe("request-line",()=>{const t=z(o.session,"textDocument/completion");return typeof(t==null?void 0:t.line)=="number"?t.line:-1}),e.bindProbe("request-character",()=>{const t=z(o.session,"textDocument/completion");return typeof(t==null?void 0:t.character)=="number"?t.character:-1}))}function z(e,n){for(let o=e.requests.length-1;o>=0;o-=1){const s=e.requests[o];if((s==null?void 0:s.method)!==n)continue;const t=s.params.position;return typeof t=="object"&&t!==null?t:void 0}}function ce(e){const n=w(e.document.snapshot,Number(e.document.selection.head));return{line:Number(n.line),character:Number(n.character)}}function de(e,n,o,s,t,i,r,u){if(e==="lsp-completion"){const a=ce(n),c=i==null?void 0:i.coordinator.requestCompletion(a);i==null||i.session.respond(c==null?void 0:c.requestId,{items:[{label:"displayName",detail:"UserProfile.displayName",insertText:"displayName"},{label:"email",detail:"UserProfile.email",insertText:"email"},{label:"role",detail:"UserProfile.role",insertText:"role"}]});const d=i==null?void 0:i.coordinator.requestHover(a,{width:36,height:5});i==null||i.session.respond(d==null?void 0:d.requestId,{contents:{kind:"plaintext",value:"profile: UserProfile"}});const l=i==null?void 0:i.coordinator.requestSignature(a);i==null||i.session.respond(l==null?void 0:l.requestId,{signatures:[{label:"formatProfile(profile: UserProfile): string"}],activeSignature:0,activeParameter:0}),t.intelligenceKinds=3,t.result.set("Suggestions ready"),t.detail.set(`3 bounded items
Hover: UserProfile
Signature: formatProfile(…)`),s.set("status-text","completion + hover + signature bounded · service ready"),o.invalidate();return}if(e==="lsp-diagnostics"){const a=n.document.text.indexOf("customerIdd");if(a<0){t.result.set("Diagnostic target changed"),t.detail.set("Reset the lesson to restore the intentional customerIdd typo."),s.set("status-text","diagnostic target unavailable"),o.invalidate();return}const c=w(n.document.snapshot,a),d=w(n.document.snapshot,a+11);i==null||i.session.publishDiagnostics(n.document.uri??"file:///docs/lsp-diagnostics.ts",Number(n.document.identity.revision),[{range:{start:{line:Number(c.line),character:Number(c.character)},end:{line:Number(d.line),character:Number(d.character)}},severity:1,message:"Property 'customerIdd' does not exist on type 'Invoice'. Did you mean 'customerId'?"}]),t.result.set("Diagnostic revealed"),t.detail.set(`ERROR · line 14
Unknown property: customerIdd
Suggestion: customerId`),s.set("status-text","1 diagnostic · terminal-safe overlay"),o.invalidate();return}r.then(()=>{if(!u())return;n.foldAll(),o.scroll.y.set(0);const a=n.folds.length;t.result.set("Folded regions"),t.detail.set(`${a} validated regions collapsed
Source text remains unchanged`),s.set("status-text","language fold collapsed"),o.invalidate()})}function ue(e,n,o,s,t,i,r){e==="lsp-completion"?(r==null||r.coordinator.dismissTransientAssistance(),o.dismissAssistance(),i.intelligenceKinds=0):e==="lsp-diagnostics"?r==null||r.session.publishDiagnostics(o.document.uri??"file:///docs/lsp-diagnostics.ts",Number(o.document.identity.revision),[]):o.unfoldAll(),o.document.setSelection({anchor:n.caretOffset,head:n.caretOffset}),i.result.set("Ready"),i.detail.set("Use the highlighted source and the focused action below."),t.set("status-text","Ready"),s.invalidate()}function le(e,n,o,s,t,i,r,u){const a=e.width-4,c=e.height-4,d=Math.min(24,Math.max(20,Math.floor(a*.3))),l=Math.max(36,a-d-2),v=Math.max(10,c-3),f=l+2,h=Math.max(8,c-6),g=Math.max(11,c-3);n.setLayout({rect:{x:1,y:1,width:a,height:c}}),s.setLayout({rect:{x:0,y:0,width:a,height:2}}),o.setLayout({rect:{x:0,y:2,width:l,height:v}}),o.resizeViewport(l,v),t.setLayout({rect:{x:f,y:2,width:d,height:Math.max(5,h-2)}}),i.setLayout({rect:{x:f,y:h,width:d,height:2}}),r.setLayout({rect:{x:f,y:g,width:d,height:2}}),u.setLayout({rect:{x:0,y:c-1,width:a,height:1}})}function be(e,n){var F;const o=_(e,{themeMenu:!0}),s=oe(n.scenario),t=V({text:s.source,uri:`file:///docs/${n.scenario}.ts`,languageId:"typescript"});t.setSelection({anchor:s.caretOffset,head:s.caretOffset});const i=se(n.scenario,t),r=K({document:t,...i===void 0?{}:{lsp:i.coordinator}}),u={intelligenceKinds:0,result:E("Ready"),detail:E("Use the highlighted source and the focused action below.")};let a=Promise.resolve();const c=new j([B]),d=Y({maxResults:1e4,schedule:y=>y()}),l=new AbortController;let v,f=!1,h=0;const g=new X({controller:r,lineNumbers:!0,onDocumentChange:()=>{a=C()}}),R=()=>{h+=1;const y=h;de(n.scenario,r,g,x,u,i,a,()=>!f&&h===y)},x=new J(ae(n.scenario),R);re(x,r,i,u);function C(){return d.analyze(c.get("typescript"),t.text,t.identity,v,{signal:l.signal}).then(b=>{const k=t.identity;if(f||l.signal.aborted||b.identity.lineage!==k.lineage||Number(b.identity.revision)!==Number(k.revision))return;r.setLanguageResult(b);const I=r.languageResult;I===void 0||I.identity.lineage!==b.identity.lineage||Number(I.identity.revision)!==Number(b.identity.revision)||(v=b,x.set("syntax-state",b.state),b.state!=="ready"&&(u.result.set("Syntax unavailable"),u.detail.set("The source remains editable using safe plain presentation.")),g.invalidate())})}a=C();const L=()=>{f||(f=!0,h+=1,l.abort(),i==null||i.coordinator.close(),g.dispose())};g.onMount(()=>g.onCleanup(L)),(F=e.onCleanup)==null||F.call(e,L);const H=()=>{h+=1,ue(n.scenario,s,r,g,x,u,i)},T=new P(`Try: ${n.instruction}`),O=new P(()=>`${s.panelTitle}

Result: ${u.result()}
${u.detail()}

Look for: ${s.lookFor}`),S=new M(s.actionLabel,{onClick:R}),D=new M("~C~lear & reset",{onClick:H}),$=new P("Alt+R action · Alt+C reset · click source to edit · F2 maximize/restore"),m=new ee;m.add(p(x,0,0,0,0)),m.add(p(T,0,0,N,2)),m.add(p(g,0,2,44,13)),m.add(p(O,46,2,22,8)),m.add(p(S,46,10,22,2)),m.add(p(D,46,13,22,2)),m.add(p($,0,15,N,1));const A=new W({title:` ${n.title} `,width:te,height:ne,startMaximized:!0,onResize:y=>le(y,m,g,T,O,S,D,$)});return A.add(p(m,1,1,N,ie)),o.desktop.addWindow(A),o.loop.focusView(g),o}export{be as b};
