#include "ttf2mesh.h"
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

/* -----------------------------------------------------------------------------------
 *     Global state
 * --------------------------------------------------------------------------------- */

ttf_t *font = NULL;

/* -----------------------------------------------------------------------------------
 *     Logging delegated to JS
 *     The `jsLog()` function is assumed to be among the imports passed to the Wasm module instantiation
 * --------------------------------------------------------------------------------- */

extern void jsLog(char* text, int length);

void log___ (char* string) {
    jsLog(string, strlen(string));
}

void log___w_sx(char* string, int a) {
    char* s = NULL;
    asprintf(&s, string, a);
    log___(s);
}

void log___w_sx_x(char* string, int a, int b) {
    char* s = NULL;
    asprintf(&s, string, a, b);
    log___(s);
}

/* -----------------------------------------------------------------------------------
 *     Wasm module API for calling from JS :: Font management
 * --------------------------------------------------------------------------------- */

/**
 * Call from JS -- load the font from the byte buffer
 */
__attribute__((used)) int wasm_loadFontFromBuffer(const uint8_t *data, int size) {
    int pointer = ttf_load_from_mem(data, size, &font, false);
    free(data);
    return pointer;
}

/**
 * Call from JS -- release the loaded font
 */
__attribute__((used)) int wasm_freeFont() {
    if (font == NULL) {
        return 1;
    }
    
    free(font);
    return 0;
}

/* -----------------------------------------------------------------------------------
 *     Serialization size calculations
 * --------------------------------------------------------------------------------- */

int calculateSerializedOutlineSize(ttf_outline_t *outline) {
    /* 1 word to write the boolean if the outline is present or not */
    int size = sizeof(int);

    if (outline == NULL) { return size; }

    size +=
    /* total_points */
    + sizeof(int)
    /* ncontours */
    + sizeof(int);
    
    for (int i = 0; i < outline->ncontours; i++) {
        /* The 3 integer fields of the struct */
        size += sizeof(int) * 3; 
        /* The array of `ttf_point_t` */
        size += sizeof(ttf_point_t) * outline->cont[i].length;
    }
    return size;
}

int calculateSerializedMeshSize(ttf_mesh3d_t *mesh) {
    const int size = 
    /* nvert */
    sizeof(int) +
    /* nfaces */
    sizeof(int) +
    /* vert */ 
    (sizeof(float) * 3) * (mesh->nvert) +
    /* faces */
    (sizeof(int) * 3) * (mesh->nfaces) +
    /* normals */
    (sizeof(float) * 3) * (mesh->nfaces) +
    /* outline */
    calculateSerializedOutlineSize(mesh->outline);
    
    return size;
}

/* -----------------------------------------------------------------------------------
 *     Serialization primitives
 * --------------------------------------------------------------------------------- */

void writeInt(uint8_t *buffer, int *offset, int value) {
    int typedOffset = *offset / sizeof(int);
    ((int*)buffer)[typedOffset] = value;
    *offset += sizeof(int);
}

void writeUint32(uint8_t *buffer, int *offset, uint32_t value) {
    int typedOffset = *offset / sizeof(uint32_t);
    ((uint32_t*)buffer)[typedOffset] = value;
    *offset += sizeof(uint32_t);
}

void writeFloat(uint8_t *buffer, int *offset, float value) {
    int typedOffset = *offset / sizeof(float);
    ((float*)buffer)[typedOffset] = value;
    *offset += sizeof(float);
}

/*
 * Wasm bools are 1 byte in size, like `uint8`, which would complicate the data layout.
 * So the boolean is coerced to an int which is 4 bytes to just simplify the calculations.
 */
void writeBool(uint8_t *buffer, int *offset, bool value) {
    if (value) {
        writeInt(buffer, offset, 1);
    } else {
        writeInt(buffer, offset, 0);
    }
}

/* -----------------------------------------------------------------------------------
 *     Serialization of TTF structures
 * --------------------------------------------------------------------------------- */

void writeOutline(ttf_outline_t *outline, uint8_t *buffer, int *position) {
    if (outline == NULL) {
        return;
    }

    int* o = position;
    writeInt(buffer, o, outline->total_points);
    writeInt(buffer, o, outline->ncontours);
    for (int i = 0; i < outline->ncontours; i++) {
        writeInt(buffer, o, outline->cont[i].length);
        writeInt(buffer, o, outline->cont[i].subglyph_id);
        writeInt(buffer, o, outline->cont[i].subglyph_order);
        for (int ipt = 0; ipt < outline->cont[i].length; ipt++) {
            writeFloat(buffer, o, outline->cont[i].pt[ipt].x);
            writeFloat(buffer, o, outline->cont[i].pt[ipt].y);
            writeUint32(buffer, o, outline->cont[i].pt[ipt].spl);
            writeUint32(buffer, o, outline->cont[i].pt[ipt].onc);
            writeUint32(buffer, o, outline->cont[i].pt[ipt].shd);
            writeUint32(buffer, o, outline->cont[i].pt[ipt].res);
        }
    }
}

/** 
 * The initial start offset for the payload in the serialized buffer.
 * It is `sizeof(int)` because the first `sizeof(int)` bytes are reserved for the int denoting the size of the buffer.
 * The size is required to let JS get the memory segment of the returned array.
 * In practice `sizeof(int)` is assumed to be equal to `4`.
 * */
const int PAYLOAD_START_OFFSET = sizeof(int);

void writeMesh(ttf_mesh3d_t *mesh, uint8_t *buffer, int length) {
    int offset = PAYLOAD_START_OFFSET;
    int *o = &offset;
    writeInt(buffer, o, mesh->nvert);
    writeInt(buffer, o, mesh->nfaces);

    for (int i = 0; i < mesh->nvert; i++) {
        writeFloat(buffer, o, mesh->vert[i].x);
        writeFloat(buffer, o, mesh->vert[i].y);
        writeFloat(buffer, o, mesh->vert[i].z);
    }
    for (int i = 0; i < mesh->nfaces; i++) {
        writeInt(buffer, o, mesh->faces[i].v1);
        writeInt(buffer, o, mesh->faces[i].v2);
        writeInt(buffer, o, mesh->faces[i].v3);
    }
    for (int i = 0; i < mesh->nfaces; i++) {
        writeFloat(buffer, o, mesh->normals[i].x);
        writeFloat(buffer, o, mesh->normals[i].y);
        writeFloat(buffer, o, mesh->normals[i].z);
    }

    /* Using a `bool` directly will treat it as a `uint8` and will result in difficulties with parsing the array on the JS side as the length won't be a multiple of 4.
     * Therefore the boolean value is encoded with an `int` instead */
    writeBool(buffer, o, mesh->outline != NULL);

    writeOutline(mesh->outline, buffer, o);
}

/**
 * Prepare the mesh for transferring to the JS side
 */
uint8_t* packMesh(ttf_mesh3d_t *mesh) {
    const int size = calculateSerializedMeshSize(mesh);

    /* Allocate and pack */
    uint8_t* buffer = (uint8_t*) malloc(size + 4);
    writeMesh(mesh, buffer, size);
    ((uint32_t* ) buffer)[0] = size;
    return buffer;
}

/* -----------------------------------------------------------------------------------
 *     Wasm module API for calling from JS :: Glyph mesh data retrieval
 * --------------------------------------------------------------------------------- */

/**
 * Call from JS -- get the geometric data for the particular glyph
 */
__attribute__((used)) uint8_t* wasm_getGlyphMeshData(wchar_t symbol, uint8_t quality, int features, float depth) {
    int index = ttf_find_glyph(font, symbol);
    if (index < 0) { 
        return 0;
    }

    ttf_mesh3d_t *mesh = NULL;
    // int meshingStatus = ttf_glyph2mesh3d(&font->glyphs[index], &mesh, TTF_QUALITY_NORMAL, TTF_FEATURES_DFLT, 0.1f);
    int meshingStatus = ttf_glyph2mesh3d(&font->glyphs[index], &mesh, quality, features, depth);
    if (meshingStatus != TTF_DONE) {
        log___w_sx("[ttf2mesh] ttf_glyph2mesh3d() returned error=%d, the returned value will be NULL.", meshingStatus);
        return (uint8_t*)NULL;
    }

    uint8_t* packed = packMesh(mesh);

    ttf_free_mesh3d(mesh);

    return packed;
}