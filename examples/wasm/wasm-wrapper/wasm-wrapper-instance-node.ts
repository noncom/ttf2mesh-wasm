import * as fs from "node:fs"
import { WasmModuleWrapper_InstanceInfo } from "./wasm-wrapper-instance.js"
import { isFileURI } from "./wasm-wrapper.js"

export type InstanceConfigNodeJS = {
    wasmInstanceConfig: "nodejs"

    /* Values */
    thisProgram: string
    programArgs: string[]

    /* Functions */
    readBinary: typeof readBinary
    readAsync: typeof readAsync
    quit: typeof quit
}

// include: node_shell_read.js
function readBinary(filename: string) {
    // We need to re-wrap `file://` strings to URLs.
    const resFilename = isFileURI(filename) ? new URL(filename) : filename
    var ret = fs.readFileSync(resFilename)
    return ret
}

async function readAsync(filename: string, binary = true): Promise<string | Buffer<ArrayBuffer>> {
    // See the comment in the `readBinary` function.
    const resFilename = isFileURI(filename) ? new URL(filename) : filename
    var ret = fs.readFileSync(resFilename, binary ? undefined : 'utf8')
    return ret
}

function quit(status: string, toThrow: unknown) {
    process.exitCode = status
    throw toThrow;
}

export function createEnvironmentNode(info: WasmModuleWrapper_InstanceInfo): InstanceConfigNodeJS {
    if (!info.isNode) {
        throw new Error("[ERROR] Can't execute `createEnvironmentNode()` when environment is not NodeJS")
    }

    const thisProgram = process.argv.length > 1
        ? process.argv[1].replace(/\\/g, '/')
        : "<unknown_program>"

    const programArgs = process.argv.slice(2);

    // MODULARIZE will export the module in the proper place outside, we don't need to export here
    // if (typeof module != 'undefined') {
    //     module['exports'] = Module;
    // }

    return {
        wasmInstanceConfig: "nodejs",
        /* Values */
        thisProgram, programArgs,
        /* Functions */
        readBinary, readAsync, quit
    }
}