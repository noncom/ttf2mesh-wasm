/*
 * This is a TypeScript Wasm wrapper, heavily based on the `.out.js` that Emscripten generates.
 * Even though https://www.npmjs.com/package/@types/emscripten exists, I still prefer this.
 */

import { WasmModuleWrapper } from "./wasm-wrapper.js";

/* These constants are used in places where the original JS code simply provided no value */
const UNDEF_INT = 0
const UNDEF_BOOL = false

const printCharBuffers: [null, number[], number[]] = [null, [], []]

const UTF8Decoder = globalThis.TextDecoder && new TextDecoder()

export type WasmModuleWrapper_StringUtils = {
    findStringEnd: typeof findStringEnd
    UTF8ArrayToString: typeof utf8ArrayToString
    UTF8ToString: typeof UTF8ToString
    getStr: typeof getStr
    printChar: typeof printChar
    flush_NO_FILESYSTEM: typeof flush_NO_FILESYSTEM
    getWrapper: () => WasmModuleWrapper
}

function findStringEnd(this: WasmModuleWrapper_StringUtils, heapOrArray: Uint8Array, idx: number, maxBytesToRead: number, ignoreNul: boolean) {
    var maxIdx = idx + maxBytesToRead
    if (ignoreNul) return maxIdx
    // TextDecoder needs to know the byte length in advance, it doesn't stop on
    // null terminator by itself.
    // As a tiny code save trick, compare idx against maxIdx using a negation,
    // so that maxBytesToRead=undefined/NaN means Infinity.
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx
    return idx
}

/**
* Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
* array that contains uint8 values, returns a copy of that string as a
* Javascript String object.
* heapOrArray is either a regular array, or a JavaScript typed array view.
* @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
*/
function utf8ArrayToString(this: WasmModuleWrapper_StringUtils, heapOrArray: Uint8Array, idx: number, maxBytesToRead: number, ignoreNul: boolean): string {

    var endPtr = this.findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul)

    // When using conditional TextDecoder, skip it for short strings as the overhead of the native call is not worth it.
    if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr))
    }
    var str = ''
    while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++]
        if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue }
        var u1 = heapOrArray[idx++] & 63
        if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue }
        var u2 = heapOrArray[idx++] & 63
        if ((u0 & 0xF0) == 0xE0) {
            u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
        } else {
            u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63)
        }

        if (u0 < 0x10000) {
            str += String.fromCharCode(u0)
        } else {
            var ch = u0 - 0x10000
            str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF))
        }
    }
    return str
}

/**
* Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
* emscripten HEAP, returns a copy of that string as a Javascript String object.
*
* @param {number} ptr
* @param {number=} maxBytesToRead - An optional length that specifies the
*   maximum number of bytes to read. You can omit this parameter to scan the
*   string until the first 0 byte. If maxBytesToRead is passed, and the string
*   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
*   string will cut short at that byte index.
* @param {boolean=} ignoreNul - If true, the function will not stop on a NUL character.
* @return {string}
*/
function UTF8ToString(this: WasmModuleWrapper_StringUtils, ptr: number, maxBytesToRead: number, ignoreNul: boolean) {
    const memory = this.getWrapper().memory
    return ptr ? this.UTF8ArrayToString(memory.memoryViews.HEAPU8, ptr, maxBytesToRead, ignoreNul) : ''
}

function getStr(this: WasmModuleWrapper_StringUtils, ptr: number) {
    var ret = this.UTF8ToString(ptr, UNDEF_INT, UNDEF_BOOL)
    return ret
}

function printChar(this: WasmModuleWrapper_StringUtils, stream: number, curr: number) {
    var buffer = printCharBuffers[stream]
    if (!buffer) {
        return
    }

    if (curr === 0 || curr === 10) {
        const io = this.getWrapper().io
        const out = (stream === 1 ? io.out : io.err)
        out(this.UTF8ArrayToString(new Uint8Array(buffer), UNDEF_INT, UNDEF_INT, UNDEF_BOOL))
        buffer.length = 0
    } else {
        buffer.push(curr)
    }
}

function flush_NO_FILESYSTEM(this: WasmModuleWrapper_StringUtils) {
    // flush anything remaining in the buffers during shutdown
    if (printCharBuffers[1].length) this.printChar(1, 10)
    if (printCharBuffers[2].length) this.printChar(2, 10)
}

export function createWasmModuleWrapper_StringUtils(wrapper: WasmModuleWrapper): WasmModuleWrapper_StringUtils {
    return {
        findStringEnd,
        UTF8ArrayToString: utf8ArrayToString,
        UTF8ToString,
        getStr,
        printChar,
        flush_NO_FILESYSTEM,
        getWrapper: () => wrapper
    }
}