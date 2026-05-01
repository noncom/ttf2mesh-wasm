/* -----------------------------------------------------------------------------------
 *     Helpers for working with the ttf2mesh Wasm module
 * --------------------------------------------------------------------------------- */

export type GlyphDataReader = {
    ints: Int32Array
    uints: Uint32Array
    floats: Float32Array
    offset: number
    readInt: (this: GlyphDataReader) => number
    readUint: (this: GlyphDataReader) => number
    readFloat: (this: GlyphDataReader) => number
}

function readInt(this: GlyphDataReader): number {
    const value = this.ints[this.offset]
    this.offset += 1
    return value
}
function readUint(this: GlyphDataReader): number {
    const value = this.uints[this.offset]
    this.offset += 1
    return value
}
function readFloat(this: GlyphDataReader): number {
    const value = this.floats[this.offset]
    this.offset += 1
    return value
}

export function createGlyphDataReader(data: ArrayBuffer) {
    const reader: GlyphDataReader = {
        ints: new Int32Array(data),
        uints: new Uint32Array(data),
        floats: new Float32Array(data),
        offset: 0,
        readInt, readUint, readFloat
    }

    return reader
}