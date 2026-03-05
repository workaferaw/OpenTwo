"use strict";
// Test: get electron API through _linkedBinding
console.log("electron version:", process.versions.electron);

// Method: use _linkedBinding to get internal electron modules
try {
    const app = process._linkedBinding('electron_browser_app');
    console.log("app via _linkedBinding:", typeof app);
    console.log("app properties:", Object.keys(app).slice(0, 10));
} catch (e) {
    console.log("_linkedBinding('electron_browser_app') error:", e.message);
}

// Method 2: try electron_common_command_line
try {
    const features = process._linkedBinding('electron_common_features');
    console.log("features:", typeof features);
} catch (e) {
    console.log("features error:", e.message);
}

// Method 3: try to list available bindings
try {
    const names = ['electron_browser_app', 'electron_common_features', 'electron_browser_window',
        'electron_browser_browser_window', 'electron_common_v8_util'];
    for (const name of names) {
        try {
            const b = process._linkedBinding(name);
            console.log(`  ${name}: OK (${typeof b})`);
        } catch (e) {
            console.log(`  ${name}: FAIL (${e.message.slice(0, 40)})`);
        }
    }
} catch (e) { }

// Method 4: check if require('electron') works differently when we delete the npm cache entry
try {
    const resolvedPath = require.resolve('electron');
    console.log("resolved electron path:", resolvedPath);

    // NativeModule check - in Electron, 'electron' should be a builtin
    const Module = require('module');
    console.log("builtinModules includes electron:", Module.builtinModules.includes('electron'));
    console.log("first 5 builtins:", Module.builtinModules.filter(m => m.includes('electron')));
} catch (e) {
    console.log("resolve error:", e.message);
}

process.exit(0);
