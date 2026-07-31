function i(){var o;return(o=globalThis.navigator)==null?void 0:o.clipboard}function s(r,o,t){const e=t??i();return e?e.writeText(r):Promise.resolve()}export{s};
