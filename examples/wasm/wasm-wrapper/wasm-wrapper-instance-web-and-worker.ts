import { WasmModuleWrapper_InstanceInfo } from "./wasm-wrapper-instance.js"
import { isFileURI } from "./wasm-wrapper.js"

export type InstanceConfigWebOrWorker = {
    wasmInstanceConfig: "web-or-worker"

    /* Values */
    scriptDirectory: string
    
    /* Functions */
    readBinary: (typeof _readBinary) | undefined
    readAsync: typeof readAsync

    quit: typeof quit
}

function getScriptDirectory(info: WasmModuleWrapper_InstanceInfo) {
    try {
        const scriptDirectory = new URL('.', info.scriptName).href; // includes trailing slash
        return scriptDirectory
    } catch {
        // Must be a `blob:` or `data:` URL (e.g. `blob:http://site.com/etc/etc`), we cannot
        // infer anything from them.
        return ""
    }
}

function _readBinary(url: string) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', url, false)
    xhr.responseType = 'arraybuffer'
    xhr.send(null)
    return new Uint8Array(/** @type{!ArrayBuffer} */(xhr.response))
}

async function readAsync(url: string, binary = false): Promise<string | Buffer<ArrayBuffer>> {
    // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
    // See https://github.com/github/fetch/pull/92#issuecomment-140665932
    // Cordova or Electron apps are typically loaded from a file:// url.
    // So use XHR on webview if URL is a file URL.
    if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onload = () => {
                if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
                    resolve(xhr.response);
                    return;
                }
                reject(xhr.status);
            };
            xhr.onerror = reject;
            xhr.send(null);
        });
    }
    var response = await fetch(url, { credentials: 'same-origin' });
    if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
    }
    throw new Error(response.status + ' : ' + response.url);
}

function quit(status: string, toThrow: unknown) {
    process.exitCode = status
    throw toThrow;
}

export function createEnvironmentWebOrWorker(info: WasmModuleWrapper_InstanceInfo): InstanceConfigWebOrWorker {
    if (!info.isWeb && !info.isWorker) {
        throw new Error("[ERROR] Can't execute `createEnvironmentWebOrWorker()` when environment is not shell or worker")
    }

    const scriptDirectory = getScriptDirectory(info)

    return {
        wasmInstanceConfig: "web-or-worker",
        scriptDirectory,
        readBinary: info.isWorker ? _readBinary : undefined,
        readAsync,
        quit
    }
}