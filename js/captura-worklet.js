/*
 * captura-worklet.js — Procesador de audio (AudioWorklet) para la grabación en WAV (app 1.6).
 * Corre aparte del resto de la app: toma el sonido del micrófono en bloques y se los pasa a grabacion.js
 * cada ~0,1 s. No guarda nada por su cuenta ni modifica el sonido.
 */
class CapturaPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(4096); // ~0,09 s a 44,1–48 kHz
    this.n = 0;
  }
  process(entradas) {
    var canal = entradas[0] && entradas[0][0];
    if (canal) {
      for (var i = 0; i < canal.length; i++) {
        this.buf[this.n++] = canal[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf.slice(0));
          this.n = 0;
        }
      }
    }
    return true; // seguir activo mientras dure la grabación
  }
}
registerProcessor('captura-pcm', CapturaPCM);
