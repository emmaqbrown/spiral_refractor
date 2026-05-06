import * as THREE from 'three';

let isLocked = false;
let initialized = false;
const fakeCursor = document.getElementById('fake-cursor');
const mouseNorm = { x: 0.5, y: 0.5 };

let currentCanvasId = null;

// --- SPIRAL SETUP ---
const TARGET_COUNT = 4; 
const SPIRAL_DATA = [];

for (let i = 0; i < TARGET_COUNT; i++) {
    SPIRAL_DATA.push({
        pos: [Math.random(), Math.random()],
        color: [0, 0, 0], // Placeholder
        thickness: 0.007 + Math.random() * 0.015,
        growth: 0.012 + Math.random() * 0.06,
        turns: 2.0 + Math.random() * 4.0
    });
}



// --- INTERACTION LOGIC ---
window.addEventListener('mousemove', (e) => {
    if (!isLocked) {
        mouseNorm.x = e.clientX / window.innerWidth;
        mouseNorm.y = e.clientY / window.innerHeight;
        fakeCursor.style.left = e.clientX + 'px';
        fakeCursor.style.top = e.clientY + 'px';
        uniforms.uMouse.value.set(mouseNorm.x, 1.0 - mouseNorm.y);
    }
});

// Prevent the site from starting when clicking on color wells
document.querySelectorAll('.color-well').forEach(well => {
    well.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
});


// Reference to the save image from your HTML
const saveBtn = document.getElementById('save');

saveBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();

    if (!initialized) return;

    // 1. Save the Canvas first
    fetch('/save-canvas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SPIRAL_DATA)
    })
    .then(response => response.json())
    .then(data => {
        currentCanvasId = data.canvas_id;
        
        // 2. Map all thoughts into an array of fetch promises
        const thoughtPromises = words.map(wordObj => {
            return fetch('/save-thought', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    canvas_id: currentCanvasId,
                    text: wordObj.text,
                    location: [wordObj.anchorPctX, wordObj.anchorPctY]
                })
            });
        });

        // 3. Wait for all thoughts to finish saving before redirecting
        Promise.all(thoughtPromises)
            .then(() => {
                // Forward the user to the view_canvas route
                window.location.href = `/canvas/${currentCanvasId}`;
            })
            .catch(err => {
                console.error('Error saving thoughts:', err);
                // Redirect anyway if you'd like, or alert the user
                window.location.href = `/canvas/${currentCanvasId}`;
            });
    })
    .catch(err => console.error('Error during manual save:', err));
});

window.addEventListener('mousedown', (e) => {
    // Handle First Click (Start)
    if (!initialized) {
        if (e.target.classList.contains('button')) {
            const colorInputs = document.querySelectorAll('.spiral-color');
            const userPalette = Array.from(colorInputs).map(input => {
                const col = new THREE.Color(input.value);
                return [col.r, col.g, col.b];
            });

            SPIRAL_DATA.forEach((spiral, i) => {
                const chosenColor = userPalette[i % userPalette.length];
                spiral.color = chosenColor;
                uniforms.uColors.value[i].setRGB(chosenColor[0], chosenColor[1], chosenColor[2]);
            });

            
            document.getElementById('instructions').style.opacity = '0';
            setTimeout(() => document.getElementById('instructions').style.display = 'none', 800);
            initialized = true;
        }
        return;
    }

    // Handle Subsequent Clicks (Add Word)
    if (!isLocked) {
        isLocked = true;
        inputContainer.style.display = 'block';
        lockOverlay.style.display = 'block';
        fakeCursor.style.background = 'rgba(200, 50, 50, 0.5)';
        fakeCursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
        setTimeout(() => wordInput.focus(), 50);
    }
});

const words = [];
const inputContainer = document.getElementById('input-container');
const lockOverlay = document.getElementById('lock-overlay');
const wordInput = document.getElementById('word-input');
const submitBtn = document.getElementById('submit-word');

function createWord(text) {
    const el = document.createElement('div');
    el.className = 'floating-word';
    el.innerText = text;
    document.body.appendChild(el);
    words.push({
        el: el,
        text: text,
        anchorPctX: mouseNorm.x,
        anchorPctY: mouseNorm.y,
        speed: 0.0008 + Math.random() * 0.0005,
        range: 12 + Math.random() * 10,
        phase: Math.random() * 6.28
    });

  
}

const handleAction = () => {
    if(wordInput.value.trim()) {
        console.log(wordInput)
        createWord(wordInput.value.trim());
        wordInput.value = '';
        isLocked = false;
        inputContainer.style.display = 'none';
        lockOverlay.style.display = 'none';
        fakeCursor.style.background = 'rgba(40, 100, 160, 0.6)';
        fakeCursor.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }
};

submitBtn.onclick = handleAction;
wordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAction(); });

function updateWords(time) {
    words.forEach(w => {
        const bx = w.anchorPctX * window.innerWidth;
        const by = w.anchorPctY * window.innerHeight;
        w.el.style.left = `${bx + Math.cos(time * w.speed + w.phase) * w.range}px`;
        w.el.style.top = `${by + Math.sin(time * w.speed + w.phase) * w.range}px`;
    });
}

// --- SHADER ---
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
        
        float magRadius = 0.15;      // Increased size slightly to see more distortion
        float magnification = 0.25;  // Lower = stronger zoom
        float dToMouse = distance(screenUv, mouseUv);
        
        vec2 distortedUv = screenUv;
        
        if (dToMouse < magRadius) {
            // nD goes from 0.0 (center) to 1.0 (edge)
            float nD = dToMouse / magRadius;
            
            // Using a higher power (3.0) creates that aggressive "spherical" warp
            float warp = pow(nD, 3.0); 
            
            // Apply the distortion
            distortedUv = mouseUv + (screenUv - mouseUv) * mix(magnification, 1.0, warp);
        }

        vec3 finalColor = vec3(1.0, 0.995, 0.99); 
        for(int i = 0; i < ${SPIRAL_DATA.length}; i++) {
            vec2 p = uPositions[i] * vec2(aspect, 1.0);
            float mask = spiralShape(distortedUv, p, uGrowth[i], uThickness[i], uTurns[i], float(i) * 12.0);
            finalColor *= mix(vec3(1.0), uColors[i], mask * 0.85);
        }

        // Enhanced lens edge shading to sell the "glass" look
        if (dToMouse < magRadius) {
            // Subtle dark ring at the very edge
            float edge = smoothstep(magRadius - 0.02, magRadius, dToMouse);
            finalColor *= mix(1.0, 0.85, edge);
            
            // Add a tiny bit of "chromatic" darkening in the center
            finalColor -= (1.0 - smoothstep(0.0, magRadius, dToMouse)) * 0.03;
        }
        
        gl_FragColor = vec4(finalColor - hash12(uv * 800.0) * 0.01, 1.0);
    }
`;

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

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});


function animate(time) {
    updateWords(time);
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);