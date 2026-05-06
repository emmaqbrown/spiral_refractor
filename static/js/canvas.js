import * as THREE from 'three';

console.log('canvas.js')


const mouseNorm = { x: 0.5, y: 0.5 };
const fakeCursor = document.getElementById('fake-cursor');

// --- WORDS LOGIC ---
const words = [];
function createWord(text) {
    const el = document.createElement('div');
    el.className = 'floating-word';
    el.innerText = text;
    document.body.appendChild(el);
    words.push({
        el: el,
        anchorPctX: mouseNorm.x,
        anchorPctY: mouseNorm.y,
        speed: 0.0008 + Math.random() * 0.0005,
        range: 12 + Math.random() * 10,
        phase: Math.random() * 6.28
    });
}

// --- SHADER SOURCE ---
const _VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const _FS = `
    uniform vec2 uMouse;
    uniform vec2 uResolution;
    uniform vec2 uPositions[${SPIRAL_DATA.length}];
    uniform vec3 uColors[${SPIRAL_DATA.length}];
    uniform float uThickness[${SPIRAL_DATA.length}];
    uniform float uGrowth[${SPIRAL_DATA.length}];
    uniform float uTurns[${SPIRAL_DATA.length}];
    varying vec2 vUv;

    float hash12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
    }

    float spiralShape(vec2 uv, vec2 center, float growth, float thickness, float maxTurns, float seed) {
        vec2 rel = uv - center;
        float r = length(rel);
        float theta = atan(rel.y, rel.x);
        if (theta < 0.0) theta += 6.283185; 
        float turn = floor((r / (growth * 6.283185)) - (theta / 6.283185) + 0.5);
        float spiralR = growth * (theta + turn * 6.283185);
        float distToSpiral = abs(r - spiralR);
        if (spiralR / (growth * 6.283185) > maxTurns || r < 0.005) return 0.0;
        float bristle = fbm(vec2(theta * 8.0, r * 40.0) + seed);
        float mask = smoothstep(thickness, thickness * 0.5, distToSpiral + bristle * 0.005);
        return mask * (0.5 + bristle * 0.5) * smoothstep(maxTurns, maxTurns - 0.8, spiralR / (growth * 6.283185));
    }

    void main() {
        vec2 uv = vUv;
        float aspect = uResolution.x / uResolution.y;
        vec2 screenUv = uv * vec2(aspect, 1.0);
        vec2 mouseUv = uMouse * vec2(aspect, 1.0);
        float dToMouse = distance(screenUv, mouseUv);
        vec2 distortedUv = screenUv;
        if (dToMouse < 0.15) {
            float nD = dToMouse / 0.15;
            distortedUv = mouseUv + (screenUv - mouseUv) * mix(0.25, 1.0, pow(nD, 3.0));
        }
        vec3 finalColor = vec3(1.0, 0.995, 0.99); 
        for(int i = 0; i < ${SPIRAL_DATA.length}; i++) {
            vec2 p = uPositions[i] * vec2(aspect, 1.0);
            float mask = spiralShape(distortedUv, p, uGrowth[i], uThickness[i], uTurns[i], float(i) * 12.0);
            finalColor *= mix(vec3(1.0), uColors[i], mask * 0.85);
        }
        gl_FragColor = vec4(finalColor - hash12(uv * 800.0) * 0.01, 1.0);
    }
`;

// --- THREE.JS INITIALIZATION ---
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const uniforms = {
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uPositions: { value: SPIRAL_DATA.map(s => new THREE.Vector2(s.pos[0], s.pos[1])) },
    uColors: { value: SPIRAL_DATA.map(s => new THREE.Color(...s.color)) },
    uThickness: { value: SPIRAL_DATA.map(s => s.thickness) },
    uGrowth: { value: SPIRAL_DATA.map(s => s.growth) },
    uTurns: { value: SPIRAL_DATA.map(s => s.turns) }
};

const material = new THREE.ShaderMaterial({ uniforms, vertexShader: _VS, fragmentShader: _FS });
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

// --- INITIALIZE SAVED DATA ---
function initView() {
    savedThoughts.forEach(t => {
        mouseNorm.x = t.location[0];
        mouseNorm.y = t.location[1];
        createWord(t.text);
    });
}
initView();

// --- ANIMATION & INTERACTION ---
window.addEventListener('mousemove', (e) => {
    mouseNorm.x = e.clientX / window.innerWidth;
    mouseNorm.y = e.clientY / window.innerHeight;
    fakeCursor.style.left = e.clientX + 'px';
    fakeCursor.style.top = e.clientY + 'px';
    uniforms.uMouse.value.set(mouseNorm.x, 1.0 - mouseNorm.y);
});

function animate(time) {
    words.forEach(w => {
        const bx = w.anchorPctX * window.innerWidth;
        const by = w.anchorPctY * window.innerHeight;
        w.el.style.left = `${bx + Math.cos(time * w.speed + w.phase) * w.range}px`;
        w.el.style.top = `${by + Math.sin(time * w.speed + w.phase) * w.range}px`;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);