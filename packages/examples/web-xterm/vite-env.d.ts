/// <reference types="vite/client" />

// xterm ships its stylesheet as a bare CSS import; declare it so tsc/IDE accept it.
declare module '@xterm/xterm/css/xterm.css';
