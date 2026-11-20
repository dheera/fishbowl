/* Fishbowl: small, individually shaded sprites, painted once and animated cheaply. */
(function () {
  'use strict';

  var W = 256, H = 224, CY = 112, ROOT = 70;
  var species = [
    { id: 'neon', name: 'Neon tetra', size: 76, speed: 1.12, school: true },
    { id: 'comet', name: 'Comet goldfish', size: 148, speed: 0.76, school: false },
    { id: 'angel', name: 'Silver angelfish', size: 126, speed: 0.62, school: false },
    { id: 'guppy', name: 'Fan-tail guppy', size: 90, speed: 0.91, school: false },
    { id: 'tiger', name: 'Tiger barb', size: 96, speed: 1.08, school: true },
    { id: 'pearl', name: 'Pearl gourami', size: 128, speed: 0.66, school: false },
    { id: 'danio', name: 'Zebra danio', size: 82, speed: 1.30, school: true },
    { id: 'cherry', name: 'Cherry barb', size: 80, speed: 0.98, school: true }
  ];

  function random(seed) {
    var n = (Number(seed) || 1) >>> 0;
    return function () {
      n += 0x6D2B79F5;
      var t = n;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function layer() {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  }

  function bodyPath(c, depth, id) {
    c.beginPath();
    c.moveTo(ROOT, CY - 7);
    if (id === 'angel') {
      c.bezierCurveTo(101, CY - 12, 112, CY - depth, 152, CY - depth);
      c.bezierCurveTo(185, CY - depth, 193, CY - 24, 228, CY - 4);
      c.quadraticCurveTo(238, CY, 225, CY + 5);
      c.bezierCurveTo(201, CY + 17, 187, CY + depth, 152, CY + depth);
      c.bezierCurveTo(112, CY + depth, 104, CY + 15, ROOT, CY + 7);
    } else {
      c.bezierCurveTo(103, CY - 10, 111, CY - depth, 164, CY - depth);
      c.bezierCurveTo(201, CY - depth, 222, CY - depth * 0.45, 231, CY - 3);
      c.quadraticCurveTo(238, CY + 1, 228, CY + 7);
      c.bezierCurveTo(211, CY + depth * 0.78, 168, CY + depth * 0.89, 142, CY + depth * 0.68);
      c.bezierCurveTo(106, CY + depth * 0.49, 99, CY + 9, ROOT, CY + 7);
    }
    c.closePath();
  }

  function fin(c, points, color, alpha, rays, root) {
    c.save();
    c.globalAlpha = alpha;
    c.beginPath(); c.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) {
      var p = points[i];
      if (p.length === 6) c.bezierCurveTo.apply(c, p);
      else if (p.length === 4) c.quadraticCurveTo.apply(c, p);
      else c.lineTo(p[0], p[1]);
    }
    c.closePath();
    var g = c.createLinearGradient(root[0], root[1], points[1][0], points[1][1]);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(196,225,210,0.14)');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(214,238,220,0.28)'; c.lineWidth = 0.7; c.stroke();
    c.clip();
    for (var r = 0; r < rays.length; r++) {
      c.beginPath(); c.moveTo(root[0] + r * 1.1, root[1]);
      c.quadraticCurveTo((root[0] + rays[r][0]) * 0.5 - 4, (root[1] + rays[r][1]) * 0.5, rays[r][0], rays[r][1]);
      c.strokeStyle = r % 2 ? 'rgba(240,236,196,0.24)' : 'rgba(27,52,39,0.20)';
      c.lineWidth = 0.75; c.stroke();
    }
    c.restore();
  }

  function drawTail(c, id, color, rng) {
    var points, rays = [], i;
    if (id === 'guppy') {
      points = [[74, CY - 7], [48, 90, 22, 69, 5, 63], [-1, 85, -1, 136, 9, 159], [30, 149, 52, 131, 74, CY + 7]];
      for (i = 0; i < 17; i++) rays.push([3 + Math.abs(i - 8) * 0.6, 63 + i * 6]);
    } else if (id === 'comet') {
      points = [[74, CY - 7], [50, 88, 30, 65, 3, 65], [23, 87, 29, 108, 34, 112], [27, 123, 17, 153, 5, 163], [40, 158, 58, 133, 74, CY + 7]];
      for (i = 0; i < 16; i++) rays.push([i < 8 ? 2 + i * 4 : 30 - (i - 8) * 4, 64 + i * 6.5]);
    } else if (id === 'angel') {
      points = [[74, CY - 8], [49, 95, 27, 84, 13, 82], [19, 103, 19, 122, 13, 143], [38, 138, 54, 128, 74, CY + 8]];
      for (i = 0; i < 13; i++) rays.push([12, 82 + i * 5]);
    } else {
      points = [[74, CY - 7], [51, 94, 36, 79, 15, 78], [21, 95, 35, 108, 39, 112], [26, 127, 21, 135, 15, 146], [43, 142, 57, 126, 74, CY + 7]];
      for (i = 0; i < 13; i++) rays.push([i < 6 ? 14 + i * 4 : 36 - (i - 6) * 4, 78 + i * 5.7]);
    }
    fin(c, points, color, id === 'neon' || id === 'danio' ? 0.68 : 0.92, rays, [74, CY]);
    if (id === 'guppy') {
      c.save(); c.globalCompositeOperation = 'source-atop';
      for (i = 0; i < 42; i++) {
        var x = 8 + rng() * 50, y = 68 + rng() * 88;
        c.fillStyle = i % 4 ? 'rgba(12,32,44,0.70)' : 'rgba(241,191,88,0.66)';
        c.beginPath(); c.ellipse(x, y, 1.2 + rng() * 2.5, 1 + rng(), -0.5, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  function drawFins(c, id, depth, color) {
    var top = CY - depth;
    if (id === 'angel') {
      fin(c, [[104, 88], [113, 48, 127, 9, 146, 8], [147, 33, 158, 57, 180, 74], [151, 80, 126, 85, 104, 88]], color, 0.8,
        [[119, 30], [126, 17], [134, 8], [145, 8], [150, 30], [155, 44], [166, 60]], [135, 81]);
      fin(c, [[105, 135], [119, 155, 122, 196, 142, 216], [148, 183, 164, 160, 182, 151], [151, 142, 126, 139, 105, 135]], color, 0.78,
        [[120, 174], [126, 192], [138, 214], [149, 193], [160, 171], [173, 155]], [140, 142]);
      c.strokeStyle = 'rgba(218,231,214,0.56)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(188, 145); c.bezierCurveTo(178, 174, 166, 200, 154, 215); c.stroke();
      c.beginPath(); c.moveTo(192, 142); c.bezierCurveTo(187, 173, 175, 199, 169, 212); c.stroke();
    } else {
      var dorsalHeight = id === 'comet' ? 32 : id === 'guppy' ? 30 : 22;
      fin(c, [[111, top + 14], [122, top - 5, 143, top - dorsalHeight, 158, top - dorsalHeight], [162, top - 10, 181, top + 1, 184, top + 7]], color, 0.72,
        [[122, top - 7], [133, top - 17], [145, top - dorsalHeight], [155, top - dorsalHeight], [166, top - 12], [179, top + 4]], [141, top + 11]);
      fin(c, [[103, CY + depth * 0.48], [111, CY + depth + 17, 124, CY + depth + 19, 143, CY + depth * 0.7]], color, 0.56,
        [[111, CY + depth + 15], [121, CY + depth + 20], [131, CY + depth + 12]], [119, CY + depth * 0.53]);
      fin(c, [[159, CY + depth * 0.74], [157, CY + depth + 17, 168, CY + depth + 21, 183, CY + depth * 0.61]], color, 0.52,
        [[158, CY + depth + 12], [166, CY + depth + 20], [178, CY + depth + 7]], [170, CY + depth * 0.62]);
      if (id === 'pearl') {
        c.strokeStyle = 'rgba(201,213,173,0.48)'; c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(184, CY + 21); c.bezierCurveTo(159, CY + 35, 124, CY + 46, 95, CY + 43); c.stroke();
        c.beginPath(); c.moveTo(190, CY + 17); c.bezierCurveTo(171, CY + 41, 139, CY + 53, 114, CY + 55); c.stroke();
      }
    }
  }

  function theme(id, rng) {
    var variation = rng();
    if (id === 'neon') return { depth: 22, top: '#253c40', middle: '#819c94', belly: '#bdc6ad', fin: 'rgba(103,183,172,0.62)' };
    if (id === 'comet') return { depth: 36, top: variation > 0.45 ? '#6f310f' : '#792c13', middle: variation > 0.45 ? '#efa22c' : '#e66a21', belly: '#ecc479', fin: 'rgba(230,139,54,0.9)' };
    if (id === 'angel') return { depth: 45, top: '#4c5a57', middle: '#c1c8b6', belly: '#9eac9c', fin: 'rgba(141,164,157,0.78)' };
    if (id === 'guppy') return { depth: 21, top: '#2e4a4c', middle: '#83a6a0', belly: '#bac1a2', fin: variation > 0.5 ? 'rgba(71,127,187,0.98)' : 'rgba(211,118,56,0.95)' };
    if (id === 'tiger') return { depth: 34, top: '#61552c', middle: '#d9ba5b', belly: '#dfd39a', fin: 'rgba(220,119,45,0.80)' };
    if (id === 'pearl') return { depth: 33, top: '#33564c', middle: '#81a28c', belly: '#c6af7c', fin: 'rgba(117,159,137,0.75)' };
    if (id === 'danio') return { depth: 20, top: '#3b514b', middle: '#adbfa1', belly: '#d3d1ab', fin: 'rgba(162,184,148,0.60)' };
    return { depth: 26, top: '#76362c', middle: variation > 0.5 ? '#c9613b' : '#ad6544', belly: '#d9a66e', fin: 'rgba(186,92,58,0.72)' };
  }

  function patterns(c, id, d, rng) {
    var g, i;
    if (id === 'neon') {
      g = c.createLinearGradient(84, CY, 221, CY);
      g.addColorStop(0, '#087e91'); g.addColorStop(0.45, '#41ddce'); g.addColorStop(1, '#82e0df');
      c.fillStyle = g; c.beginPath(); c.moveTo(83, CY - 2); c.bezierCurveTo(124, CY - 13, 177, CY - 13, 218, CY - 6); c.lineTo(216, CY - 1); c.bezierCurveTo(159, CY - 6, 120, CY - 5, 83, CY + 2); c.closePath(); c.fill();
      c.fillStyle = '#c12d2c'; c.beginPath(); c.moveTo(76, CY + 4); c.lineTo(159, CY + 2); c.lineTo(160, CY + 25); c.lineTo(81, CY + 13); c.fill();
      c.strokeStyle = 'rgba(164,255,232,0.8)'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(87, CY - 2); c.quadraticCurveTo(151, CY - 14, 216, CY - 6); c.stroke();
    } else if (id === 'angel' || id === 'tiger') {
      var stripes = id === 'angel' ? [[89, 10], [127, 15], [171, 16], [213, 10]] : [[94, 12], [134, 16], [173, 16], [215, 10]];
      for (i = 0; i < stripes.length; i++) {
        var x = stripes[i][0], width = stripes[i][1];
        g = c.createLinearGradient(x - width / 2, 0, x + width, 0);
        g.addColorStop(0, 'rgba(16,32,26,0)'); g.addColorStop(0.2, 'rgba(17,30,27,0.85)'); g.addColorStop(0.7, 'rgba(19,32,28,0.92)'); g.addColorStop(1, 'rgba(20,32,29,0.1)');
        c.fillStyle = g; c.beginPath(); c.moveTo(x - width / 2, CY - 70); c.lineTo(x + width, CY - 70); c.lineTo(x + width - 7, CY + 70); c.lineTo(x - width / 2 - 9, CY + 70); c.fill();
      }
    } else if (id === 'danio') {
      for (i = -2; i <= 2; i++) {
        c.strokeStyle = i % 2 ? '#294f62' : '#365f69'; c.lineWidth = 3.0;
        c.beginPath(); c.moveTo(76, CY + i * 2.9); c.bezierCurveTo(125, CY + i * 6, 178, CY + i * 7, 219, CY + i * 3.7); c.stroke();
      }
    } else if (id === 'pearl') {
      c.strokeStyle = 'rgba(25,50,40,0.75)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(78, CY); c.quadraticCurveTo(152, CY - 6, 223, CY); c.stroke();
      for (i = 0; i < 155; i++) {
        var px = 80 + rng() * 139, py = CY - d + rng() * d * 2;
        c.fillStyle = 'rgba(17,56,42,0.48)'; c.beginPath(); c.ellipse(px, py, 1.9, 1.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(213,233,194,0.74)'; c.beginPath(); c.ellipse(px - 0.4, py - 0.4, 1.3, 0.8, 0, 0, Math.PI * 2); c.fill();
      }
    } else if (id === 'guppy') {
      g = c.createLinearGradient(76, CY, 182, CY); g.addColorStop(0, '#294b7c'); g.addColorStop(0.5, '#2d9191'); g.addColorStop(1, 'rgba(105,150,123,0)');
      c.fillStyle = g; c.fillRect(76, CY - 20, 109, 40);
      for (i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? 'rgba(227,146,56,0.95)' : 'rgba(14,32,33,0.76)';
        c.beginPath(); c.ellipse(95 + rng() * 70, CY - 13 + rng() * 26, 2 + rng() * 4, 2 + rng() * 3, -0.5, 0, Math.PI * 2); c.fill();
      }
    } else if (id === 'cherry') {
      c.strokeStyle = 'rgba(67,30,22,0.65)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(78, CY); c.quadraticCurveTo(148, CY - 5, 223, CY); c.stroke();
      c.strokeStyle = 'rgba(239,183,111,0.60)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(81, CY - 3); c.quadraticCurveTo(146, CY - 9, 211, CY - 4); c.stroke();
    } else if (id === 'comet' && rng() > 0.50) {
      c.fillStyle = 'rgba(238,229,184,0.87)';
      c.beginPath(); c.ellipse(114 + rng() * 37, CY + 7, 24, 24, -0.3, 0, Math.PI * 2); c.fill();
      if (rng() > 0.5) { c.fillStyle = 'rgba(47,50,32,0.75)'; c.beginPath(); c.ellipse(181, CY - 17, 13, 10, 0.4, 0, Math.PI * 2); c.fill(); }
    }
  }

  function create(index, seed) {
    index = ((index | 0) % species.length + species.length) % species.length;
    var id = species[index].id, rng = random(seed), t = theme(id, rng), d = t.depth;
    var body = layer(), tail = layer(), pectoral = layer();
    var c = body.getContext('2d');
    drawTail(tail.getContext('2d'), id, t.fin, rng);
    drawFins(c, id, d, t.fin);

    bodyPath(c, d, id);
    var base = c.createLinearGradient(0, CY - d, 0, CY + d);
    base.addColorStop(0, t.top); base.addColorStop(0.38, t.middle); base.addColorStop(0.64, t.middle); base.addColorStop(1, t.belly);
    c.fillStyle = base; c.fill();
    c.save(); bodyPath(c, d, id); c.clip();
    patterns(c, id, d, rng);
    // Each scale is a soft crescent. These paths are never redrawn during swimming.
    var spacing = id === 'comet' || id === 'angel' ? 7 : 5;
    for (var row = -10; row <= 10; row++) {
      for (var col = 0; col < 23; col++) {
        var sx = 80 + col * spacing + (row % 2 ? spacing * 0.5 : 0), sy = CY + row * spacing * 0.72;
        if (sx > 201) continue;
        c.strokeStyle = 'rgba(236,244,211,' + (0.06 + rng() * 0.09).toFixed(3) + ')'; c.lineWidth = 0.55;
        c.beginPath(); c.arc(sx, sy, spacing * 0.55, -1.10, 1.10); c.stroke();
        c.strokeStyle = 'rgba(17,34,27,0.09)';
        c.beginPath(); c.arc(sx - 0.6, sy + 0.8, spacing * 0.55, -1.10, 1.10); c.stroke();
      }
    }
    var roundness = c.createLinearGradient(0, CY - d, 0, CY + d);
    roundness.addColorStop(0, 'rgba(3,22,22,0.38)');
    roundness.addColorStop(0.24, 'rgba(240,255,226,0.17)');
    roundness.addColorStop(0.43, 'rgba(244,255,228,0.05)');
    roundness.addColorStop(0.72, 'rgba(5,32,29,0.08)');
    roundness.addColorStop(1, 'rgba(10,30,25,0.31)');
    c.fillStyle = roundness; c.fillRect(62, CY - d, 180, d * 2);
    var sheen = c.createRadialGradient(173, CY - d * 0.35, 0, 162, CY - d * 0.17, 62);
    sheen.addColorStop(0, 'rgba(229,255,237,0.13)'); sheen.addColorStop(1, 'rgba(229,255,237,0)');
    c.fillStyle = sheen; c.fillRect(94, CY - d, 140, d * 2);
    c.restore();

    // Gill plate and its soft reflective edge; the eye remains appropriately small.
    c.strokeStyle = 'rgba(13,37,31,0.38)'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(197, CY - d * 0.61); c.bezierCurveTo(187, CY - 4, 190, CY + 8, 202, CY + d * 0.50); c.stroke();
    c.strokeStyle = 'rgba(225,239,206,0.25)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(199, CY - d * 0.58); c.bezierCurveTo(191, CY - 3, 193, CY + 7, 204, CY + d * 0.47); c.stroke();
    var ex = id === 'angel' ? 215 : 214, ey = CY - (id === 'angel' ? 7 : d * 0.23), er = id === 'comet' ? 4.3 : id === 'tiger' ? 4.2 : 3.7;
    c.fillStyle = 'rgba(19,35,29,0.64)'; c.beginPath(); c.arc(ex, ey, er + 0.7, 0, Math.PI * 2); c.fill();
    var iris = c.createRadialGradient(ex - 0.7, ey - 0.7, 0, ex, ey, er);
    iris.addColorStop(0, '#d2c58b'); iris.addColorStop(0.7, id === 'angel' ? '#bda375' : '#a89c62'); iris.addColorStop(1, '#526455');
    c.fillStyle = iris; c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#07171a'; c.beginPath(); c.arc(ex + 0.3, ey, er * 0.65, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(236,255,241,0.75)'; c.beginPath(); c.arc(ex + 0.8, ey - 1.3, 0.85, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(36,43,28,0.48)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(231, CY + 1); c.quadraticCurveTo(225, CY + 2, 223, CY + 4); c.stroke();

    var pc = pectoral.getContext('2d');
    fin(pc, [[190, CY + 4], [177, CY + 8, 153, CY + 21, 153, CY + 34], [169, CY + 37, 190, CY + 16, 190, CY + 4]], t.fin, 0.70,
      [[154, CY + 23], [154, CY + 29], [158, CY + 35], [167, CY + 34], [179, CY + 25]], [190, CY + 4]);
    return { body: body, tail: tail, fin: pectoral, species: index, id: id, seed: seed };
  }

  function draw(ctx, sprite, x, y, length, heading, phase, turn, alpha, yaw) {
    var facingLeft = Math.cos(heading) < 0;
    var angle = facingLeft ? heading + Math.PI : heading;
    var scale = length / 230;
    var narrowed = (1 - Math.min(0.24, Math.abs(turn || 0) * 0.16)) * (yaw === undefined ? 1 : yaw);
    var wave = Math.sin(phase);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.scale((facingLeft ? -1 : 1) * scale * narrowed, scale);
    ctx.globalAlpha *= alpha === undefined ? 1 : alpha;
    ctx.save(); ctx.translate(ROOT - 148, 0);
    ctx.rotate(wave * 0.11); ctx.scale(0.94 + Math.cos(phase) * 0.06, 1);
    ctx.drawImage(sprite.tail, -ROOT, -CY); ctx.restore();
    ctx.drawImage(sprite.body, -148, -CY);
    ctx.save(); ctx.translate(190 - 148, 4); ctx.rotate(Math.sin(phase + 0.9) * 0.14);
    ctx.scale(1, 0.68 + (Math.sin(phase * 1.3) + 1) * 0.16);
    ctx.drawImage(sprite.fin, -190, -CY - 4); ctx.restore();
    ctx.restore();
  }

  window.FishArt = { species: species, create: create, draw: draw };
}());
