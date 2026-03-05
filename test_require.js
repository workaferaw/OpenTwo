"use strict";
console.log("process.type:", process.type);
console.log("process.versions.electron:", process.versions.electron);

const Module = require('module');
console.log("builtinModules with electron:", Module.builtinModules.filter(m => m.includes('electron')));

// Try require('electron') and see what we get
const e = require('electron');
console.log("typeof electron:", typeof e);
if (typeof e === 'string') {
    console.log("electron is a STRING (npm stub):", e.slice(0, 100));
} else if (typeof e === 'object') {
    console.log("electron is an OBJECT with keys:", Object.keys(e).slice(0, 15));
    console.log("has app:", !!e.app);
    console.log("has BrowserWindow:", !!e.BrowserWindow);
}

process.exit(0);
