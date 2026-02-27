// Standalone GIF encoder — no external dependencies, no worker
// Based on the jsgif / as3gif / gif.js lineage, rewritten to run synchronously on main thread

(function(global) {

// ── NeuQuant ──────────────────────────────────────────────────────────────────
function NeuQuant(pixels, samplefac) {
  var netsize = 256, maxnetpos = netsize - 1;
  var netbiasshift = 4, ncycles = 100;
  var intbiasshift = 16, intbias = 1 << intbiasshift;
  var gammashift = 10, betashift = 10;
  var beta = intbias >> betashift, betagamma = intbias << (gammashift - betashift);
  var initrad = netsize >> 3, radiusbiasshift = 6, radiusbias = 1 << radiusbiasshift;
  var initradius = initrad * radiusbias;
  var radiusdec = 30;
  var alphabiasshift = 10, initalpha = 1 << alphabiasshift;
  var radbiasshift = 8, radbias = 1 << radbiasshift;
  var alpharadbshift = alphabiasshift + radbiasshift, alpharadbias = 1 << alpharadbshift;
  var network = [], netindex = new Int32Array(256);
  var bias = new Int32Array(netsize), freq = new Int32Array(netsize);
  var radpower = new Int32Array(netsize >> 3);

  function init() {
    for (var i = 0; i < netsize; i++) {
      var v = (i << (netbiasshift + 1)) / netsize | 0;
      network[i] = new Float64Array([v, v, v, 0]);
      freq[i] = intbias / netsize | 0;
      bias[i] = 0;
    }
  }

  function unbiasnet() {
    for (var i = 0; i < netsize; i++) {
      network[i][0] >>= netbiasshift;
      network[i][1] >>= netbiasshift;
      network[i][2] >>= netbiasshift;
      network[i][3] = i;
    }
  }

  function altersingle(alpha, i, b, g, r) {
    network[i][0] -= (alpha * (network[i][0] - b)) / initalpha | 0;
    network[i][1] -= (alpha * (network[i][1] - g)) / initalpha | 0;
    network[i][2] -= (alpha * (network[i][2] - r)) / initalpha | 0;
  }

  function alterneigh(rad, i, b, g, r) {
    var lo = i - rad < 0 ? 0 : i - rad;
    var hi = i + rad > maxnetpos ? maxnetpos : i + rad;
    var j = i + 1, k = i - 1, m = 1;
    while (j <= hi || k >= lo) {
      var a = radpower[m++];
      if (j <= hi) { var p = network[j++]; p[0] -= (a * (p[0] - b)) / alpharadbias | 0; p[1] -= (a * (p[1] - g)) / alpharadbias | 0; p[2] -= (a * (p[2] - r)) / alpharadbias | 0; }
      if (k >= lo) { var p = network[k--]; p[0] -= (a * (p[0] - b)) / alpharadbias | 0; p[1] -= (a * (p[1] - g)) / alpharadbias | 0; p[2] -= (a * (p[2] - r)) / alpharadbias | 0; }
    }
  }

  function contest(b, g, r) {
    var bestd = ~(1 << 31), bestbiasd = bestd, bestpos = -1, bestbiaspos = -1;
    for (var i = 0; i < netsize; i++) {
      var n = network[i];
      var dist = Math.abs(n[0] - b) + Math.abs(n[1] - g) + Math.abs(n[2] - r);
      if (dist < bestd) { bestd = dist; bestpos = i; }
      var biasdist = dist - ((bias[i]) >> (netbiasshift + 8 - 3));
      if (biasdist < bestbiasd) { bestbiasd = biasdist; bestbiaspos = i; }
      var betafreq = freq[i] >> betashift;
      freq[i] -= betafreq; bias[i] += betafreq << gammashift;
    }
    freq[bestpos] += beta; bias[bestpos] -= betagamma;
    return bestbiaspos;
  }

  function inxbuild() {
    var i, j, p, q, smallval, radius, s;
    var previouscol = 0, startpos = 0;
    for (i = 0; i < netsize; i++) {
      p = network[i]; smallval = p[1]; j = i;
      for (s = i + 1; s < netsize; s++) { q = network[s]; if (q[1] < smallval) { smallval = q[1]; j = s; } }
      q = network[j];
      if (i != j) { var tmp; tmp=q[0];q[0]=p[0];p[0]=tmp; tmp=q[1];q[1]=p[1];p[1]=tmp; tmp=q[2];q[2]=p[2];p[2]=tmp; tmp=q[3];q[3]=p[3];p[3]=tmp; }
      if (smallval != previouscol) {
        netindex[previouscol] = (startpos + i) >> 1;
        for (j = previouscol + 1; j < smallval; j++) netindex[j] = i;
        previouscol = smallval; startpos = i;
      }
    }
    netindex[previouscol] = (startpos + maxnetpos) >> 1;
    for (j = previouscol + 1; j < 256; j++) netindex[j] = maxnetpos;
  }

  function learn() {
    var i, j, b, g, r, radius, rad, alpha, step, delta, samplepixels;
    var lim = pixels.length;
    samplepixels = lim / (3 * samplefac) | 0;
    delta = samplepixels / ncycles | 0;
    alpha = initalpha; radius = initradius;
    rad = radius >> radiusbiasshift;
    if (rad <= 1) rad = 0;
    for (i = 0; i < rad; i++) radpower[i] = alpha * (((rad * rad - i * i) * radbias) / (rad * rad)) | 0;
    if (lim % 3 != 0) step = 3; // prime steps
    else if ((lim / 3) % 2 != 0) step = 6;
    else if ((lim / 3) % 3 != 0) step = 9;
    else step = 12;
    for (i = 0, j = 0; i < samplepixels;) {
      b = (pixels[j] & 0xff) << netbiasshift;
      g = (pixels[j+1] & 0xff) << netbiasshift;
      r = (pixels[j+2] & 0xff) << netbiasshift;
      var idx = contest(b, g, r);
      altersingle(alpha, idx, b, g, r);
      if (rad != 0) alterneigh(rad, idx, b, g, r);
      j += step; if (j >= lim) j -= lim;
      i++;
      if (delta == 0) delta = 1;
      if (i % delta == 0) {
        alpha -= alpha / 30; radius -= radius / radiusdec;
        rad = radius >> radiusbiasshift;
        if (rad <= 1) rad = 0;
        for (var k = 0; k < rad; k++) radpower[k] = alpha * (((rad * rad - k * k) * radbias) / (rad * rad)) | 0;
      }
    }
  }

  init(); learn(); unbiasnet(); inxbuild();

  return {
    map: function(b, g, r) {
      var bestd = 1000, best = -1, i = netindex[g], j = i - 1;
      while (i < netsize || j >= 0) {
        if (i < netsize) { var p = network[i]; var d = p[1] - g; if (d >= bestd) i = netsize; else { i++; d = Math.abs(d) + Math.abs(p[0] - b); if (d < bestd) { d += Math.abs(p[2] - r); if (d < bestd) { bestd = d; best = p[3]; } } } }
        if (j >= 0) { var p = network[j]; var d = g - p[1]; if (d >= bestd) j = -1; else { j--; d = Math.abs(d) + Math.abs(p[0] - b); if (d < bestd) { d += Math.abs(p[2] - r); if (d < bestd) { bestd = d; best = p[3]; } } } }
      }
      return best;
    },
    getColormap: function() {
      var map = new Uint8Array(netsize * 3), index = new Uint8Array(netsize);
      for (var i = 0; i < netsize; i++) index[network[i][3]] = i;
      for (var i = 0, j = 0; i < netsize; i++) { var p = network[index[i]]; map[j++] = p[2]; map[j++] = p[1]; map[j++] = p[0]; }
      return map;
    }
  };
}

// ── LZW ───────────────────────────────────────────────────────────────────────
function lzwEncode(width, height, pixels, colorDepth) {
  var initCodeSize = Math.max(2, colorDepth);
  var output = [];
  output.push(initCodeSize);

  var nPixels = width * height;
  var accum = new Uint8Array(256), htab = new Int32Array(5003), codetab = new Int32Array(5003);
  var maxbits = 12, maxmaxcode = 1 << maxbits;
  var BITS = initCodeSize + 1, maxcode = (1 << BITS) - 1;
  var ClearCode = 1 << initCodeSize, EOFCode = ClearCode + 1, free_ent = ClearCode + 2;
  var cur_accum = 0, cur_bits = 0, a_count = 0, clear_flg = false;
  var masks = [0,1,3,7,15,31,63,127,255,511,1023,2047,4095,8191,16383,32767,65535];
  var pix = 0;

  function char_out(c) { accum[a_count++] = c; if (a_count >= 254) flush_char(); }
  function flush_char() { if (a_count > 0) { output.push(a_count); for (var i = 0; i < a_count; i++) output.push(accum[i]); a_count = 0; } }
  function output_code(code) {
    cur_accum &= masks[cur_bits]; cur_accum |= code << cur_bits; cur_bits += BITS;
    while (cur_bits >= 8) { char_out(cur_accum & 255); cur_accum >>= 8; cur_bits -= 8; }
    if (free_ent > maxcode || clear_flg) {
      if (clear_flg) { maxcode = (1 << (BITS = initCodeSize + 1)) - 1; clear_flg = false; }
      else { BITS++; maxcode = BITS == maxbits ? maxmaxcode : (1 << BITS) - 1; }
    }
    if (code == EOFCode) { while (cur_bits > 0) { char_out(cur_accum & 255); cur_accum >>= 8; cur_bits -= 8; } flush_char(); }
  }

  for (var i = 0; i < htab.length; i++) htab[i] = -1;
  output_code(ClearCode);
  var ent = pixels[pix++];
  while (pix < nPixels) {
    var c = pixels[pix++];
    var fcode = (c << maxbits) + ent;
    var i = (c << 8) ^ ent;
    if (htab[i] == fcode) { ent = codetab[i]; continue; }
    if (htab[i] >= 0) {
      var disp = 5003 - i; if (i == 0) disp = 1;
      do { if ((i -= disp) < 0) i += 5003; if (htab[i] == fcode) { ent = codetab[i]; break; } } while (htab[i] >= 0);
      if (htab[i] == fcode) continue;
    }
    output_code(ent); ent = c;
    if (free_ent < maxmaxcode) { codetab[i] = free_ent++; htab[i] = fcode; }
    else { for (var k = 0; k < htab.length; k++) htab[k] = -1; output_code(ClearCode); clear_flg = true; BITS = initCodeSize + 1; maxcode = (1 << BITS) - 1; free_ent = ClearCode + 2; }
  }
  output_code(ent); output_code(EOFCode);
  output.push(0); // block terminator
  return output;
}

// ── GIF builder ───────────────────────────────────────────────────────────────
function GIFBuilder() {
  this.frames = [];
  this.width = 0;
  this.height = 0;
}

GIFBuilder.prototype.addFrame = function(imageData, delay) {
  if (!this.width) { this.width = imageData.width; this.height = imageData.height; }
  this.frames.push({ imageData: imageData, delay: delay || 100 });
};

GIFBuilder.prototype.encode = function(onProgress) {
  var w = this.width, h = this.height;
  var bytes = [];
  var nFrames = this.frames.length;

  function wb(b) { bytes.push(b & 0xFF); }
  function wu16(v) { bytes.push(v & 0xFF, (v >> 8) & 0xFF); }
  function wstr(s) { for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); }

  wstr('GIF89a');
  wu16(w); wu16(h);
  // Global colour table flag, colour resolution, sort flag, size of GCT
  wb(0xF7); // 1 111 0 111 = global ct, 8-bit depth, not sorted, 256 colours
  wb(0);    // background colour index
  wb(0);    // pixel aspect ratio

  // Placeholder global palette (first frame will provide it)
  var firstData = this.frames[0].imageData.data;
  var firstPx = new Uint8Array(w * h * 3);
  for (var i = 0, j = 0; i < firstData.length; i += 4) { firstPx[j++] = firstData[i]; firstPx[j++] = firstData[i+1]; firstPx[j++] = firstData[i+2]; }
  var nq0 = new NeuQuant(firstPx, 10);
  var gct = nq0.getColormap();
  for (var i = 0; i < 256 * 3; i++) wb(gct[i]);

  // Netscape loop extension
  wstr('\x21\xFF\x0BNETSCAPE2.0\x03\x01'); wu16(0); wb(0);

  for (var f = 0; f < nFrames; f++) {
    if (onProgress) onProgress(f / nFrames);
    var frame = this.frames[f];
    var imgData = frame.imageData;
    var px = new Uint8Array(w * h * 3);
    var src = imgData.data;
    for (var i = 0, j = 0; i < src.length; i += 4) { px[j++] = src[i]; px[j++] = src[i+1]; px[j++] = src[i+2]; }

    var nq = new NeuQuant(px, 10);
    var palette = nq.getColormap();

    // Graphic control extension
    wb(0x21); wb(0xF9); wb(4);
    wb(0); // disposal: do not dispose
    wu16(frame.delay / 10 | 0);
    wb(0); wb(0);

    // Image descriptor
    wb(0x2C);
    wu16(0); wu16(0); wu16(w); wu16(h);
    wb(0x87); // local colour table, interlace=0, sort=0, size=256

    // Local colour table
    for (var i = 0; i < 256 * 3; i++) wb(palette[i]);

    // Index pixels
    var indexed = new Uint8Array(w * h);
    for (var i = 0, j = 0; i < px.length; i += 3) indexed[j++] = nq.map(px[i], px[i+1], px[i+2]);

    // LZW encode
    var lzw = lzwEncode(w, h, indexed, 8);
    for (var i = 0; i < lzw.length; i++) wb(lzw[i]);
  }

  if (onProgress) onProgress(1);
  wb(0x3B); // GIF trailer

  return new Uint8Array(bytes);
};

global.GIFBuilder = GIFBuilder;

})(typeof window !== 'undefined' ? window : self);
