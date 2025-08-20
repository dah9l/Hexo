"use strict";
const $ = (sel) => document.querySelector(sel);
const canvas = $("#hueRing");
const ctx = canvas.getContext("2d");
const thumb = $("#thumb");
const rgbInput = $("#rgb");
const hslInput = $("#hsl");
const hexInput = $("#hex");
const presets = $("#presets");
const historyBox = $("#history");
const copied = $("#copied");
const eyedropperBtn = $("#eyedropper");
const RING_R = 110;
const RING_W = 26;
let h = 320; // начальный hue
let s = 0.76; // для близости к макету фиксируем s/l в управляемых пределах
let l = 0.62;
init();
function init() {
    drawHueRing();
    placeThumbByHue(h);
    updateAll(fromHsl({ h, s, l }));
    bind();
    restoreHistory();
}
function drawHueRing() {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const inner = RING_R - RING_W / 2;
    const outer = RING_R + RING_W / 2;
    // очистка
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // сегменты градиента
    for (let a = 0; a < 360; a += 1) {
        const rad = (a - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.strokeStyle = `hsl(${a} 100% 50%)`;
        ctx.lineWidth = RING_W;
        ctx.arc(cx, cy, RING_R, rad, rad + Math.PI / 180);
        ctx.stroke();
    }
    // прозрачный центр
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
}
function placeThumbByHue(hue) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const angle = (hue - 90) * Math.PI / 180;
    const x = cx + Math.cos(angle) * RING_R;
    const y = cy + Math.sin(angle) * RING_R;
    thumb.style.left = `${x - 12}px`;
    thumb.style.top = `${y - 12}px`;
    thumb.style.background = `hsl(${hue} 100% 50%)`;
    thumb.setAttribute("aria-valuenow", String(Math.round(hue)));
}
function bind() {
    let dragging = false;
    const onMove = (ev) => {
        const pt = getPoint(ev);
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = pt.x - cx;
        const dy = pt.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < (RING_R - RING_W / 2) || dist > (RING_R + RING_W / 2))
            return;
        const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
        h = angle;
        placeThumbByHue(h);
        updateAll(fromHsl({ h, s, l }));
    };
    canvas.addEventListener("pointerdown", (e) => { dragging = true; onMove(e); });
    window.addEventListener("pointermove", (e) => dragging && onMove(e));
    window.addEventListener("pointerup", () => dragging = false);
    // Копирование по клику
    [rgbInput, hslInput, hexInput].forEach(inp => {
        inp.addEventListener("click", async () => {
            await navigator.clipboard.writeText(inp.value);
            showCopied();
            pushHistory(hexInput.value);
        });
    });
    // Пресеты
    presets?.addEventListener("click", (e) => {
        const btn = e.target.closest(".sw");
        if (!btn)
            return;
        const hex = btn.getAttribute("data-color");
        const { h: hv, s: sv, l: lv } = hexToHsl(hex);
        h = hv;
        s = sv;
        l = lv;
        placeThumbByHue(h);
        updateAll(hexToRgb(hex));
        pushHistory(hex);
    });
    // EyeDropper API
    eyedropperBtn.addEventListener("click", async () => {
        if (!("EyeDropper" in window)) {
            alert("EyeDropper API не поддерживается.");
            return;
        }
        // @ts-ignore
        const ed = new EyeDropper();
        try {
            const res = await ed.open();
            const hex = res.sRGBHex;
            const { h: hv, s: sv, l: lv } = hexToHsl(hex);
            h = hv;
            s = sv;
            l = lv;
            placeThumbByHue(h);
            updateAll(hexToRgb(hex));
            pushHistory(hex);
        }
        catch { }
    });
}
function getPoint(ev) {
    if (ev instanceof TouchEvent) {
        const t = ev.touches[0] ?? ev.changedTouches;
        return { x: t.clientX, y: t.clientY };
    }
    return { x: ev.clientX, y: ev.clientY };
}
function updateAll(rgb) {
    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);
    const hslStr = `${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%`;
    const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    hexInput.value = hex.toUpperCase();
    rgbInput.value = rgbStr;
    hslInput.value = hslStr;
    document.body.style.setProperty("--accent", hex);
}
function fromHsl(hsl) {
    return hslToRgb(hsl.h, hsl.s, hsl.l);
}
/* ====== Color conversions ====== */
function rgbToHex({ r, g, b }) {
    const c = (n) => n.toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
}
function hexToRgb(hex) {
    const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
    if (!m)
        throw new Error("Bad hex");
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl({ r, g, b }) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h *= 60;
    }
    return { h, s, l };
}
function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    if (0 <= h && h < 60)
        [r1, g1, b1] = [c, x, 0];
    else if (60 <= h && h < 120)
        [r1, g1, b1] = [x, c, 0];
    else if (120 <= h && h < 180)
        [r1, g1, b1] = [0, c, x];
    else if (180 <= h && h < 240)
        [r1, g1, b1] = [0, x, c];
    else if (240 <= h && h < 300)
        [r1, g1, b1] = [x, 0, c];
    else
        [r1, g1, b1] = [c, 0, x];
    return {
        r: Math.round((r1 + m) * 255),
        g: Math.round((g1 + m) * 255),
        b: Math.round((b1 + m) * 255)
    };
}
function hexToHsl(hex) { return rgbToHsl(hexToRgb(hex)); }
/* ====== History (chrome.storage) ====== */
async function pushHistory(hex) {
    const key = "hexo_history";
    const st = await chrome.storage.local.get(key);
    const arr = st[key] ?? [];
    const next = [hex, ...arr.filter(x => x !== hex)].slice(0, 12);
    await chrome.storage.local.set({ [key]: next });
    renderHistory(next);
}
async function restoreHistory() {
    const key = "hexo_history";
    const st = await chrome.storage.local.get(key);
    renderHistory(st[key] ?? []);
}
function renderHistory(list) {
    historyBox.innerHTML = "";
    list.forEach(hex => {
        const el = document.createElement("button");
        el.className = "chip";
        el.innerHTML = `<span class="dot" style="background:${hex}"></span><span class="code">${hex}</span>`;
        el.addEventListener("click", async () => {
            await navigator.clipboard.writeText(hex);
            showCopied();
        });
        historyBox.appendChild(el);
    });
}
/* ===== UX ===== */
let copyTimer;
function showCopied() {
    copied.hidden = false;
    if (copyTimer)
        clearTimeout(copyTimer);
    // @ts-ignore
    copyTimer = setTimeout(() => copied.hidden = true, 1200);
}
