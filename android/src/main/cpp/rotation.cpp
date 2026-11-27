#include <jni.h>
#include <dlfcn.h>
#include <cstdint>

extern "C" JNIEXPORT void JNICALL
Java_org_ammo_pdf_RotatedDocumentSource_setPageRotation(JNIEnv *env, jclass, jlong page, jint rotation) {
    // PDFiumAndroid owns the loaded library and page lifetime. Keep this binding to the
    // public PDFium C ABI; never dereference vendor-private structures.
    void *library = dlopen("libpdfium.so", RTLD_NOW | RTLD_NOLOAD);
    using SetRotation = void (*)(void *, int);
    auto setRotation = library ? reinterpret_cast<SetRotation>(dlsym(library, "FPDFPage_SetRotation")) : nullptr;
    if (setRotation && page) {
        setRotation(reinterpret_cast<void *>(static_cast<intptr_t>(page)), rotation);
    } else {
        env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), "PDFium page rotation API is unavailable");
    }
    if (library) dlclose(library);
}
