// === CONFIGURACIÓN ===
const COLORS = {
    node: '#007acc',
    highlight: '#ce9178', // Naranja/Ámbar para "glow"
    insert: '#007acc',    // Azul, como pediste
    delete: '#f44747',    // Rojo
    rotating: '#ce9178',
    text: '#ffffff',
    line: '#6a9955',       // Verde
    fe: '#dcdcaa'
};
const NODE_RADIUS = 25, LEVEL_HEIGHT = 80;

let appState = {
    tree: null, history: [], currentStep: -1, isRecording: false, animSpeed: 333, isPaused: false,
    statusText: "", statusColor: COLORS.text,
    currentSessionName: "Nueva Sesión",
    currentAction: null // ★★★ AÑADIDO PARA LA FLECHA DE ROTACIÓN ★★★
};
let nodeRegistry = {}, nextNodeID = 0;

// === MODELO ===
class Node {
    constructor(val, isClone = false) {
        this.value = val; this.left = null; this.right = null; this.height = 1;
        this.id = isClone ? -1 : nextNodeID++;
        if (!isClone) {
            this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
            this.color = COLORS.insert; this.alpha = 0; this.visible = true;
            this.balanceValue = 0; nodeRegistry[this.id] = this;
        }
    }
    clone() {
        const c = new Node(this.value, true);
        c.height = this.height; c.id = this.id;
        if (this.left) c.left = this.left.clone();
        if (this.right) c.right = this.right.clone();
        return c;
    }
    getBalance() { return (this.left ? this.left.height : 0) - (this.right ? this.right.height : 0); }
    updateHeight() { this.height = 1 + Math.max(this.left?.height || 0, this.right?.height || 0); }
}

class AVL {
    constructor() { this.root = null; }
    clone() { const t = new AVL(); if (this.root) t.root = this.root.clone(); return t; }

    async insert(val) {
        if (this.search(val)) return false;
        await History.record(`🔽 Insertando ${val}...`, COLORS.text);
        this.root = await this._insertRec(this.root, val);
        return true;
    }
    async _insertRec(n, val) {
        if (!n) {
            const newNode = new Node(val);
            newNode.x = camera.x; newNode.y = camera.y - 100;
            await History.record(`✨ Nodo ${val} creado`, COLORS.insert);
            return newNode;
        }
        await this._highlight(n, val);
        if (val < n.value) n.left = await this._insertRec(n.left, val);
        else if (val > n.value) n.right = await this._insertRec(n.right, val);
        n.updateHeight();
        return await this._balance(n);
    }
    async delete(val) {
        if (!this.search(val)) return false;
        await History.record(`🗑️ Eliminando ${val}...`, COLORS.text);
        this.root = await this._deleteRec(this.root, val);
        return true;
    }
    async _deleteRec(n, val) {
        if (!n) return null;
        await this._highlight(n, val);
        if (val < n.value) n.left = await this._deleteRec(n.left, val);
        else if (val > n.value) n.right = await this._deleteRec(n.right, val);
        else {
            n.color = COLORS.delete;
            await History.record(`🎯 Nodo ${val} a eliminar`, COLORS.delete);
            if (!n.left || !n.right) n = n.left || n.right;
           // (Este es el REEMPLAZO con el predecesor)
            else {
                let temp = this._getMax(n.left); // <-- CAMBIO 1: Buscar el MÁXIMO a la IZQUIERDA
                await History.record(`🔄 Reemplazo por ${temp.value}`, COLORS.highlight);
                n.value = temp.value;
                n.left = await this._deleteRec(n.left, temp.value); // <-- CAMBIO 2: Eliminar el nodo de la IZQUIERDA
            }
        }
        if (!n) return null;
        n.updateHeight();
        return await this._balance(n);
    }

    async _balance(n) {
        const bal = n.getBalance();
        if (bal > 1 && n.left.getBalance() >= 0) {
            return await this._rotR(n);
        }
        if (bal < -1 && n.right.getBalance() <= 0) {
            return await this._rotL(n);
        }
        if (bal > 1 && n.left.getBalance() < 0) {
            await History.record(`🔄 Desequilibrio en ${n.value} (LR). ${n.left.value} necesita Rotación Izquierda primero.`, COLORS.rotating);
            n.left = await this._rotL(n.left);
            return await this._rotR(n);
        }
        if (bal < -1 && n.right.getBalance() > 0) {
            await History.record(`🔄 Desequilibrio en ${n.value} (RL). ${n.right.value} necesita Rotación Derecha primero.`, COLORS.rotating);
            n.right = await this._rotR(n.right);
            return await this._rotL(n);
        }
        return n;
    }

    async _rotR(y) {
        await History.record(`🔄 Desequilibrio en ${y.value} (FE: ${y.getBalance()}). Iniciando Rotación Simple a la Derecha.`, COLORS.rotating);
        const x = y.left;
        nodeRegistry[y.id].color = COLORS.rotating;
        nodeRegistry[x.id].color = COLORS.rotating;
        
        await History.record(`Nodos ${y.value} y ${x.value} están girando...`, COLORS.rotating, { type: 'rotate', direction: 'right', parentId: y.id, childId: x.id });
        
        let T2 = x.right;
        y.left = T2;
        x.right = y;
        y.updateHeight();
        x.updateHeight();
        await History.record(`Rotación Derecha completada. ${x.value} es la nueva raíz.`, COLORS.rotating);
        nodeRegistry[y.id].color = COLORS.node;
        nodeRegistry[x.id].color = COLORS.node;
        return x;
    }

    async _rotL(x) {
        await History.record(`🔄 Desequilibrio en ${x.value} (FE: ${x.getBalance()}). Iniciando Rotación Simple a la Izquierda.`, COLORS.rotating);
        const y = x.right;
        nodeRegistry[x.id].color = COLORS.rotating;
        nodeRegistry[y.id].color = COLORS.rotating;

        await History.record(`Nodos ${x.value} y ${y.value} están girando...`, COLORS.rotating, { type: 'rotate', direction: 'left', parentId: x.id, childId: y.id });
        
        let T2 = y.left;
        x.right = T2;
        y.left = x;
        x.updateHeight();
        y.updateHeight();
        await History.record(`Rotación Izquierda completada. ${y.value} es la nueva raíz.`, COLORS.rotating);
        nodeRegistry[x.id].color = COLORS.node;
        nodeRegistry[y.id].color = COLORS.node;
        return y;
    }

    async _highlight(n, val) {
        let pc = nodeRegistry[n.id].color;
        nodeRegistry[n.id].color = COLORS.highlight;
        await History.record(`🔍 Comparando ${val} con ${n.value}`, COLORS.highlight);
        nodeRegistry[n.id].color = pc;
    }
    search(val) { let c = this.root; while (c) { if (val === c.value) return c; c = val < c.value ? c.left : c.right; } return null; }
    _getMin(n) { while (n.left) n = n.left; return n; }
    _getMax(n) { while (n.right) n = n.right; return n; }
    count() { return this._c(this.root); } _c(n) { return n ? 1 + this._c(n.left) + this._c(n.right) : 0; }
    height() { return this.root?.height || 0; }
}

// === HISTORIAL ===
const History = {
    async record(desc, color = COLORS.node, action = null) {
        if (!appState.isRecording) return;
        const vSnap = {};
        for (let id in nodeRegistry) vSnap[id] = { c: nodeRegistry[id].color, v: nodeRegistry[id].value };
        const logicalTree = appState.tree.clone();
        this._assignBaseColors(logicalTree.root, vSnap);
        appState.history.push({ t: logicalTree, v: vSnap, d: desc, c: color, action: action });
        appState.currentStep++;
    },
    _assignBaseColors(n, vSnap) {
        if (!n) return;
        if (!vSnap[n.id]) {
            const vn = nodeRegistry[n.id];
            if (vn) {
                vSnap[n.id] = { c: COLORS.node, v: vn.value };
            }
        }
        this._assignBaseColors(n.left, vSnap);
        this._assignBaseColors(n.right, vSnap);
    },
    restore(idx) {
        if (idx < 0 || idx >= appState.history.length) return;
        appState.currentStep = idx;
        const s = appState.history[idx];
        appState.statusText = s.d;
        appState.statusColor = s.c;
        appState.currentAction = s.action || null; 
        
        Renderer.calculateTargets(s.t.root);
        const syncedNodes = new Set();
        this._sync(s.t.root, s.v, syncedNodes);
        this._hideUnsynced(syncedNodes);
        UI.update(s);
    },
    _sync(n, vSnap, syncedNodes) {
        if (!n) return;
        syncedNodes.add(n.id);
        const vn = nodeRegistry[n.id];
        if (vn) {
            vn.visible = true;
            vn.value = n.value;
            vn.balanceValue = n.getBalance();
            if (vSnap[n.id]) {
                vn.color = vSnap[n.id].c;
            } else {
                vn.color = COLORS.node;
            }
        }
        this._sync(n.left, vSnap, syncedNodes);
        this._sync(n.right, vSnap, syncedNodes);
    },
    _hideUnsynced(syncedNodes) {
        for (let id in nodeRegistry) {
            if (!syncedNodes.has(parseInt(id))) {
                nodeRegistry[id].visible = false;
            }
        }
    }
};

// === RENDERIZADOR ===
const canvas = document.getElementById('lienzo'), ctx = canvas.getContext('2d');
let camera = { x: 0, y: 50, z: 1 }, drag = { active: false, x: 0, y: 0 };

const Renderer = {
    isAnimating: false,
    init() {
        this.resize(); window.onresize = () => this.resize();
        this.loop(); 
        this.events(); 
    },
resize() {
        // 1. Obtener el ratio de píxeles del dispositivo (para pantallas Retina/HiDPI)
        const dpr = window.devicePixelRatio || 1;

        // 2. Obtener el tamaño en CSS (cuánto espacio ocupa en la pantalla)
        const rect = canvas.parentElement.getBoundingClientRect();
        const cssWidth = rect.width;
        const cssHeight = rect.height;

        // 3. Asignar el tamaño del <canvas> (cuántos píxeles *reales* va a dibujar)
        // Esto es (tamaño CSS) * (ratio de píxeles)
        canvas.width = cssWidth * dpr;
        canvas.height = cssHeight * dpr;

        // 4. Asignar el tamaño CSS (para que no se vea gigante)
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        // 5. Escalar el contexto de dibujo
        // Ahora, cuando dibujemos 1 píxel, el contexto lo escalará por 'dpr'
        ctx.scale(dpr, dpr);

        // 6. Centrar la cámara (como antes)
        if (camera.x === 0) {
            // Importante: la cámara opera en coordenadas CSS (cssWidth), 
            // no en píxeles de canvas (canvas.width)
            camera.x = cssWidth / 2;
        }
    },    loop() {
        this.isAnimating = this.updatePhysics();
        this.draw();
        requestAnimationFrame(() => this.loop());
    },
    updatePhysics() {
        let stillMoving = false;
        for (let id in nodeRegistry) {
            const n = nodeRegistry[id];
            const xDist = n.targetX - n.x;
            const yDist = n.targetY - n.y;
            const alphaDist = (n.visible ? 1 : 0) - n.alpha;
            if (Math.abs(xDist) > 0.1 || Math.abs(yDist) > 0.1 || Math.abs(alphaDist) > 0.01) {
                stillMoving = true;
                n.x += xDist * 0.2;
                n.y += yDist * 0.2;
                n.alpha += alphaDist * 0.15;
            } else {
                n.x = n.targetX;
                n.y = n.targetY;
                n.alpha = (n.visible ? 1 : 0);
            }
        }
        return stillMoving;
    },

    calculateTargets(root) {
        const totalHeight = root ? root.height : 0;
        if (!root) return; 

        let powerBase; 
        let leafWidth; 

        if (canvas.width <= 900) { 
            powerBase = 1.85; 
            leafWidth = 50;   
        } else {
            powerBase = 2;    
            leafWidth = 60;   
        }
        
        const treeWidth = Math.pow(powerBase, totalHeight - 1) * leafWidth;
        let initialOffset = treeWidth / 4;
        if (totalHeight === 1) {
            initialOffset = 0;
        }

        const assign = (n, x, y, offset) => {
            if (!n) return;
            if (nodeRegistry[n.id]) { 
                nodeRegistry[n.id].targetX = x;
                nodeRegistry[n.id].targetY = y; 
            }
            const nextOffset = offset / 2;
            assign(n.left, x - offset, y + LEVEL_HEIGHT, nextOffset); 
            assign(n.right, x + offset, y + LEVEL_HEIGHT, nextOffset);
        };
        
        assign(root, 0, 0, initialOffset);
    },

    _drawRotationArrow(childNode, parentNode, direction) {
        const arrowSize = 10;
        const margin = 8; 
        const curveHeight = 90; 
        const curveWidth = 70;  

        ctx.save();
        ctx.strokeStyle = COLORS.delete; 
        ctx.fillStyle = COLORS.delete;
        ctx.lineWidth = 4;
        ctx.lineCap = "round";

        const pX = parentNode.targetX;
        const pY = parentNode.targetY;
        const cX = childNode.targetX;
        const cY = childNode.targetY;

        const startX = cX;
        const startY = cY - NODE_RADIUS - margin;

        const endX = pX;
        const endY = pY - NODE_RADIUS - margin;

        let cp1x, cp1y, cp2x, cp2y; 

        if (direction === 'right') { 
            cp1x = startX - curveWidth; 
            cp1y = startY - curveHeight;
            cp2x = endX + curveWidth; 
            cp2y = endY - curveHeight;

        } else { 
            cp1x = startX + curveWidth; 
            cp1y = startY - curveHeight;
            cp2x = endX - curveWidth; 
            cp2y = endY - curveHeight;
        }

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        ctx.stroke();

        const angle = Math.atan2(endY - cp2y, endX - cp2x); 
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - arrowSize * Math.cos(angle - Math.PI / 6), endY - arrowSize * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(endX - arrowSize * Math.cos(angle + Math.PI / 6), endY - arrowSize * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    },

    _drawArrow(x1, y1, x2, y2) {
        const arrowSize = 10;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        
        const endX = x2 - (NODE_RADIUS + 2) * Math.cos(angle); 
        const endY = y2 - (NODE_RADIUS + 2) * Math.sin(angle);
        
        ctx.save();
        ctx.beginPath();
        ctx.translate(endX, endY); 
        ctx.rotate(angle);         
        
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.closePath();
        
        ctx.fillStyle = ctx.strokeStyle; 
        ctx.fill();
        ctx.restore();
    },

    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save(); 
        ctx.translate(camera.x, camera.y); 
        ctx.scale(camera.z, camera.z);
    
        if (appState.currentAction && appState.currentAction.type === 'rotate') {
            const nodeParent = nodeRegistry[appState.currentAction.parentId];
            const nodeChild = nodeRegistry[appState.currentAction.childId];
            if (nodeParent && nodeChild && nodeParent.visible && nodeChild.visible) {
                this._drawRotationArrow(nodeChild, nodeParent, appState.currentAction.direction);
            }
        }
        
        if (appState.history[appState.currentStep]) this._links(appState.history[appState.currentStep].t.root);
        for (let id in nodeRegistry) if (nodeRegistry[id].alpha > 0.01) this._node(nodeRegistry[id]);
        ctx.restore();

        if (appState.statusText) {
            ctx.font = 'bold 14px "Segoe UI"';
            ctx.fillStyle = appState.statusColor || COLORS.text;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(appState.statusText, 20, 20);
        }
    },

    _links(n) {
        if (!n) return;
        const vn = nodeRegistry[n.id];
        if (vn && vn.alpha > 0.1) {
            ctx.lineWidth = 3; 
            ctx.strokeStyle = COLORS.line; 
            ctx.globalAlpha = vn.alpha;
            
            if (n.left) { 
                const vl = nodeRegistry[n.left.id]; 
                if (vl) { 
                    this._drawArrow(vn.x, vn.y, vl.x, vl.y);
                    this._links(n.left); 
                } 
            }
            if (n.right) { 
                const vr = nodeRegistry[n.right.id]; 
                if (vr) { 
                    this._drawArrow(vn.x, vn.y, vr.x, vr.y);
                    this._links(n.right); 
                } 
            }
        }
    },

    _node(n) {
        ctx.globalAlpha = n.alpha;
        ctx.beginPath(); ctx.arc(n.x, n.y, NODE_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = n.color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = (n.color === COLORS.highlight || n.color === COLORS.insert) ? '#000' : COLORS.text;
        ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.value, n.x, n.y);
        if (n.alpha > 0.8) {
             
            if (n.balanceValue > 1 || n.balanceValue < -1) {
                ctx.fillStyle = COLORS.delete; 
            } else {
                ctx.fillStyle = COLORS.fe;     
            }
            
            ctx.font = 'bold 12px Arial';
            ctx.fillText(n.balanceValue, n.x, n.y - NODE_RADIUS - 10);
        }
        ctx.globalAlpha = 1;
    },

    events() {
        // Eventos de Ratón (PC)
        canvas.onmousedown = e => { 
            drag.active = true; 
            drag.x = e.clientX - camera.x; 
            drag.y = e.clientY - camera.y; 
            canvas.style.cursor = 'grabbing'; 
        };
        window.onmouseup = () => { 
            drag.active = false; 
            canvas.style.cursor = 'grab'; 
        };
        window.onmousemove = e => { 
            if (drag.active) { 
                camera.x = e.clientX - drag.x; 
                camera.y = e.clientY - drag.y; 
            } 
            this.hover(e); 
        };
        canvas.onwheel = e => { 
            e.preventDefault(); 
            camera.z *= e.deltaY > 0 ? 0.9 : 1.1; 
            camera.z = Math.max(0.1, Math.min(5, camera.z)); 
        };

        // Eventos Táctiles (CELULAR CON ZOOM)
        let initialZoomDist = null;
        let initialZoom = 1;

        canvas.ontouchstart = e => {
            if (e.touches.length === 1) { 
                const touch = e.touches[0];
                drag.active = true;
                drag.x = touch.clientX - camera.x;
                drag.y = touch.clientY - camera.y;
                initialZoomDist = null;
            } 
            else if (e.touches.length === 2) { 
                drag.active = false; 
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                initialZoomDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                initialZoom = camera.z;
            }
            e.preventDefault();
        };

        canvas.ontouchend = () => {
            drag.active = false;
            initialZoomDist = null;
        };

        canvas.ontouchmove = e => {
            if (drag.active && e.touches.length === 1) { 
                const touch = e.touches[0];
                camera.x = touch.clientX - drag.x;
                camera.y = touch.clientY - drag.y;
            } 
            else if (initialZoomDist && e.touches.length === 2) { 
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const zoomRatio = currentDist / initialZoomDist;
                camera.z = initialZoom * zoomRatio;
                camera.z = Math.max(0.1, Math.min(5, camera.z));
            }
            e.preventDefault();
        };
    },

    hover(e) {
        const r = canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left - camera.x) / camera.z, my = (e.clientY - r.top - camera.y) / camera.z;
        let hit = null;
        for (let id in nodeRegistry) {
            const n = nodeRegistry[id];
            if (n.visible && n.alpha > 0.5 && Math.hypot(n.x - mx, n.y - my) < NODE_RADIUS) hit = n;
        }
        const t = document.getElementById('tooltip-nodo');
        if (hit) {
            t.style.display = 'block';
            t.style.left = (e.clientX - r.left + 15) + 'px';
            t.style.top = (e.clientY - r.top + 15) + 'px';
            const logicalNode = findLogicalNode(appState.history[appState.currentStep]?.t.root, hit.id);
            const height = logicalNode ? logicalNode.height : 1;
            t.innerText = `Valor: ${hit.value}\nAltura: ${height}\nBalance: ${hit.balanceValue}`;
        } else t.style.display = 'none';
    }
}; // ★★★ FIN DEL OBJETO RENDERER ★★★

function findLogicalNode(n, id) { if (!n) return null; if (n.id === id) return n; return findLogicalNode(n.left, id) || findLogicalNode(n.right, id); }

// === SISTEMA DE MODALES PERSONALIZADOS ===
const CustomModal = {
    backdrop: document.getElementById('modal-backdrop'),
    modal: document.getElementById('custom-modal'),
    titleElement: document.getElementById('custom-modal-title'),
    messageElement: document.getElementById('custom-modal-message'),
    inputElement: document.getElementById('custom-modal-input'),
    buttonContainer: document.getElementById('custom-modal-buttons'),
    
    _resolver: null, 

    init() {
        document.querySelector('.close-modal-btn').addEventListener('click', () => this._handleAction(null)); 
        this.backdrop.addEventListener('click', () => this._handleAction(null)); 
        
        this.modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._handleAction(null); 
            }
            if (e.key === 'Enter') {
                const confirmButton = this.buttonContainer.querySelector('.btn-confirm');
                if (confirmButton) {
                    confirmButton.click();
                }
            }
        });
    },

    _show(title, message, buttonsConfig, showInput = false, defaultValue = '') {
        this.titleElement.innerText = title;
        this.messageElement.innerText = message;
        
        this.inputElement.classList.toggle('hidden', !showInput);
        this.inputElement.value = defaultValue;
        
        this.buttonContainer.innerHTML = ''; 

        buttonsConfig.forEach(btnConfig => {
            const button = document.createElement('button');
            button.innerText = btnConfig.text;
            button.classList.add('btn-modal', btnConfig.class); 
            button.addEventListener('click', () => this._handleAction(btnConfig.value));
            this.buttonContainer.appendChild(button);
        });
        
        this.backdrop.classList.remove('hidden');
        this.modal.classList.remove('hidden');

        if (showInput) {
            this.inputElement.focus();
            this.inputElement.select(); 
        } else {
            const firstButton = this.buttonContainer.querySelector('.btn-confirm');
            if (firstButton) {
                firstButton.focus();
            }
        }
    },
    
    _hide() {
        this.backdrop.classList.add('hidden');
        this.modal.classList.add('hidden');
    },

    _handleAction(resultValue) {
        if (this._resolver === null) return; 

        let finalValue;

        if (typeof resultValue === 'function') {
            finalValue = resultValue(); 
        } else {
            finalValue = resultValue; 
        }

        this._hide();
        this._resolver(finalValue); 
        this._resolver = null; 
    },
    
    confirm(title, message) {
        return new Promise(resolve => {
            this._resolver = resolve;
            const buttons = [
                { text: 'Cancelar', class: 'btn-cancel', value: false }, 
                { text: 'Aceptar', class: 'btn-confirm', value: true }  
            ];
            this._show(title, message, buttons, false);
        });
    },
    
    prompt(title, message, defaultValue = '') {
        return new Promise(resolve => {
            this._resolver = resolve;
            const buttons = [
                { text: 'Cancelar', class: 'btn-cancel', value: null }, 
                { text: 'Aceptar', class: 'btn-confirm', value: () => this.inputElement.value } 
            ];
            this._show(title, message, buttons, true, defaultValue); 
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CustomModal.init();
});
// === FIN SISTEMA DE MODALES ===

// === UI & PLAYER ===
const UI = {
    init() {
        limpiarArbol(true); 
        UI.logOperation('--- (Sesión nueva) ---');
        AnimPlayer.setSpeed(document.getElementById('velocidad').value);
        _loadSessionsUI(); 
        document.getElementById('help-close').onclick = UI.hideHelpModal;
    },

    _isBalanced(n) {
        if (!n) return true;
        if (Math.abs(n.getBalance()) > 1) return false;
        return this._isBalanced(n.left) && this._isBalanced(n.right);
    },

    update(s) {
        document.getElementById('paso-actual').innerText = appState.currentStep + 1;
        document.getElementById('paso-total').innerText = appState.history.length;
        const estadoSpan = document.getElementById('lbl-estado');
        if (!s.t.root) {
            estadoSpan.innerText = "Vacío";
            estadoSpan.style.color = "var(--text-dim)";
        } else if (this._isBalanced(s.t.root)) {
            estadoSpan.innerText = "Balanceado";
            estadoSpan.style.color = "var(--accent-green)";
        } else {
            estadoSpan.innerText = "No Balanceado";
            estadoSpan.style.color = "var(--accent-red)";
        }
        if (s.t) {
            document.getElementById('lbl-nodos').innerText = s.t.count();
            document.getElementById('lbl-altura').innerText = s.t.height();
        }
        this.updList();
    },

    updList() {
        const l = document.getElementById('lista-secuencia');
        if (l.children.length !== appState.history.length) {
            l.innerHTML = ''; appState.history.forEach((s, i) => {
                const li = document.createElement('li'); li.innerText = `[${i + 1}] ${s.d}`;
                li.onclick = () => { AnimPlayer.pause(); History.restore(i); }; l.appendChild(li);
            });
        }
        this.actualizarHighlightSecuencia();
    },
    
    actualizarHighlightSecuencia() {
        const listaItems = document.querySelectorAll('#lista-secuencia li');
        if (listaItems.length === 0) return;
        
        let operacionIndex = -1;
        
        for (let i = 0; i < appState.history.length; i++) {
            if (i === appState.currentStep) {
                operacionIndex = i;
                break;
            }
        }

        listaItems.forEach((li, index) => {
            if (index === operacionIndex) {
                li.classList.add('active');
                // li.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // Desactivado para móvil
            } else {
                li.classList.remove('active');
            }
        });
    },

    toast(m, t = 'info') { document.querySelectorAll('.toast-message').forEach(toast => toast.remove());
        const d = document.createElement('div'); d.className = `toast-message toast-${t}`; d.innerText = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
    ,
    logOperation(message) {
        const list = document.getElementById('lista-historial');
        if (!list) return;
        const li = document.createElement('li');
        li.innerText = message;
        list.appendChild(li);
        list.scrollTop = list.scrollHeight;
    },
    
    showHelpModal() {
        document.getElementById('help-modal').style.display = 'block';
    },
    hideHelpModal() {
        document.getElementById('help-modal').style.display = 'none';
    }
};

const AnimPlayer = {
    animationFrameId: null,
    lastStepTime: 0,
    play() {
        appState.isPaused = false;
        this.updBtn();
        if (appState.currentStep >= appState.history.length - 1) {
            History.restore(0);
        }
        this.lastStepTime = Date.now();
        this.loop();
    },
    pause() {
        appState.isPaused = true;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.updBtn();
    },
    toggle() { appState.isPaused ? this.play() : this.pause(); },
    loop() {
        if (appState.isPaused) return;
        if (!Renderer.isAnimating) {
            const now = Date.now();
            const timeSinceLastStep = now - this.lastStepTime;
            if (timeSinceLastStep >= appState.animSpeed) {
                this.lastStepTime = now;
                if (appState.currentStep < appState.history.length - 1) {
                    History.restore(appState.currentStep + 1);
                } else {
                    this.pause();
                }
            }
        }
        this.animationFrameId = requestAnimationFrame(() => this.loop());
    },
    siguiente() { this.pause(); History.restore(appState.currentStep + 1); },
    anterior() { this.pause(); History.restore(appState.currentStep - 1); },
    saltar() { this.pause(); History.restore(appState.history.length - 1); },
    setSpeed(v) { appState.animSpeed = 1000 / parseFloat(v); document.getElementById('velocidad-valor').innerText = parseFloat(v).toFixed(1) + 'x'; },
    updBtn() { document.getElementById('btn-play').style.display = appState.isPaused ? 'inline-block' : 'none'; document.getElementById('btn-pause').style.display = appState.isPaused ? 'none' : 'inline-block'; }
};
window.AnimPlayer = AnimPlayer;

// === FUNCIONES GLOBALES Y DE EVENTOS ===

async function insertar() {
    const v = getVals('in-insert'); if (!v) return;
    AnimPlayer.pause(); appState.isRecording = true;
    const start = appState.history.length;
    let nodosInsertados = 0;
    for (let x of v) {
        if (await appState.tree.insert(x)) {
            nodosInsertados++;
            UI.logOperation(`Insertado: ${x}`);
        }
        else {
            UI.toast(`${x} ya existe`, 'warning');
            UI.logOperation(`Inserción fallida: ${x} ya existe`);
        }
    }
    if (nodosInsertados > 0) {
        await History.record('Inserción finalizada', COLORS.insert);
        resetC();
        appState.isRecording = false;
        History.restore(start > 0 ? start : 0);
        AnimPlayer.play();
        centrarVista(); 
    } else {
        appState.isRecording = false;
    }
}
async function eliminar() {

    const v = getVals('in-delete'); if (!v) return;
    AnimPlayer.pause(); appState.isRecording = true;
    centrarVista();
    const start = appState.history.length;
    for (let x of v) {
        if (await appState.tree.delete(x)) {
            resetC();
            UI.logOperation(`Eliminado: ${x}`);
        } else {
            UI.toast(`${x} no existe`, 'warning');
            UI.logOperation(`Eliminación fallida: ${x} no existe`);
        }
    }
    await History.record('Eliminación finalizada', COLORS.text);
    appState.isRecording = false; History.restore(start); AnimPlayer.play();
}
async function buscar() {
    const v = getVals('in-search'); if (!v) return;
    AnimPlayer.pause(); appState.isRecording = true;
    const start = appState.history.length;
    
    resetC(); 
    
    for (let x of v) {
        resetC(); 
        
        UI.logOperation(`Buscando: ${x}`);
        await History.record(`Buscando ${x}...`, COLORS.text);
        await vSearch(x);
    }
    appState.isRecording = false; History.restore(start); AnimPlayer.play();
}
async function vSearch(val) {
    let c = appState.tree.root, f = false;
    while (c) {
        let pc = nodeRegistry[c.id].color;
        nodeRegistry[c.id].color = COLORS.highlight;
        await History.record(`Visitando ${c.value}`, COLORS.highlight);
        nodeRegistry[c.id].color = pc;
        if (val === c.value) {
            nodeRegistry[c.id].color = COLORS.delete;
            await History.record(`🎉 ${val} ENCONTRADO`, COLORS.delete);
            f = true; break;
        }
        c = val < c.value ? c.left : c.right;
    }
    if (!f) await History.record(`🚫 ${val} no encontrado`, COLORS.delete);
}
function getVals(id) { const s = document.getElementById(id).value.trim(); document.getElementById(id).value = ''; return s ? s.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x)) : null; }
function resetC(n = appState.tree.root) {
    if (!n) return;
    const vn = nodeRegistry[n.id];
    if (vn) {
        vn.color = COLORS.node;
    }
    resetC(n.left);
    resetC(n.right);
}
function zoomIn() { camera.z = Math.min(5, camera.z * 1.2); } function zoomOut() { camera.z = Math.max(0.2, camera.z / 1.2); }
// --- ★★★ REEMPLAZA ESTA FUNCIÓN COMPLETA (Paso 1) ★★★ ---
// --- ★★★ REEMPLAZA ESTA FUNCIÓN COMPLETA (aprox. línea 964) ★★★ ---
function centrarVista() {
    
    // --- ★★★ INICIO DE LA CORRECCIÓN MÓVIL ★★★ ---
    // Obtener el TAMAÑO CSS (no el tamaño de píxeles) del lienzo
    // Esto es crucial para que el centrado funcione con el devicePixelRatio
    const rect = canvas.parentElement.getBoundingClientRect();
    const canvasCssWidth = rect.width;
    const canvasCssHeight = rect.height;
    // --- ★★★ FIN DE LA CORRECCIÓN MÓVIL ★★★ ---

    // 1. Obtener todos los nodos visibles del snapshot actual
    const currentStep = appState.history[appState.currentStep];
    if (!currentStep || !currentStep.t || !currentStep.t.root) {
        // Si el árbol está vacío, solo resetea la cámara
        camera.x = canvasCssWidth / 2; // <-- CORREGIDO
        camera.y = 50;
        camera.z = 1;
        return;
    }
    const allNodes = Object.values(nodeRegistry).filter(n => n.visible);
    if (allNodes.length === 0) {
        camera.x = canvasCssWidth / 2; // <-- CORREGIDO
        camera.y = 50;
        camera.z = 1;
        return;
    }

    // 2. Encontrar los límites (el ancho y alto) del árbol
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
        if (n.targetX < minX) minX = n.targetX;
        if (n.targetX > maxX) maxX = n.targetX;
        if (n.targetY < minY) minY = n.targetY;
        if (n.targetY > maxY) maxY = n.targetY;
    });

    // 3. Calcular el tamaño del contenido (con un padding)
    const padding = 100; // 100px de margen
    const contentWidth = (maxX - minX) + (NODE_RADIUS * 2) + padding;
    const contentHeight = (maxY - minY) + (NODE_RADIUS * 2) + padding;

    // 4. Calcular el zoom necesario para que quepa
    const scaleX = canvasCssWidth / contentWidth;  // <-- CORREGIDO
    const scaleY = canvasCssHeight / contentHeight; // <-- CORREGIDO
    
    // Usamos el zoom más pequeño (para que quepa tanto a lo ancho como a lo alto)
    // y nos aseguramos de que nunca haga un "zoom in" (Math.min(1.0, ...))
    const newZoom = Math.min(1.0, scaleX, scaleY);
    camera.z = newZoom;

    // 5. Calcular la posición X para centrar el árbol
    // (canvasCssWidth / 2) es el centro de la pantalla
    // ((minX + maxX) / 2) es el centro del contenido del árbol
    const treeCenterX = (minX + maxX) / 2;
    camera.x = (canvasCssWidth / 2) - (treeCenterX * newZoom); // <-- CORREGIDO
    
    // 6. Asignar la posición Y (fija, para que siempre esté arriba)
    camera.y = 50; 
}
async function limpiarArbol(force = false) {
    const confirmed = force || await CustomModal.confirm('Confirmar', '¿Seguro que quieres borrar el árbol? Esta acción no se puede deshacer.');
    if (confirmed) {
        AnimPlayer.pause();
        appState.tree = new AVL();
        nodeRegistry = {};
        appState.history = [];
        appState.currentStep = -1;
        appState.isRecording = true;
        appState.currentSessionName = "Nueva Sesión"; 
        UI.logOperation('--- Árbol Limpiado ---');
        document.getElementById('lista-historial').innerHTML = '';
        document.getElementById('lista-secuencia').innerHTML = '';
        History.record('Limpio', COLORS.text);
        appState.isRecording = false;
        History.restore(0);
        centrarVista();
        
    }
}
function actualizarVelocidad(valor) {
    AnimPlayer.setSpeed(valor);
}

// --- Funciones de Recorridos ---
function recorrer(tipo) {
    if (!appState.tree.root) {
        UI.toast("El árbol está vacío.", "warning");
        return;
    }
    let values = [];
    let title = "";
    if (tipo === 'preorden') {
        values = _getPreorden(appState.tree.root);
        title = "Recorrido Pre-Orden";
    } else if (tipo === 'inorden') {
        values = _getInorden(appState.tree.root);
        title = "Recorrido In-Orden";
    } else if (tipo === 'postorden') {
        values = _getPostorden(appState.tree.root);
        title = "Recorrido Post-Orden";
    }
    _showTraversalModal(title, values.join('  →  '));
}
function _getPreorden(n) {
    if (!n) return [];
    return [n.value, ..._getPreorden(n.left), ..._getPreorden(n.right)];
}
function _getInorden(n) {
    if (!n) return [];
    return [..._getInorden(n.left), n.value, ..._getInorden(n.right)];
}
function _getPostorden(n) {
    if (!n) return [];
    return [..._getPostorden(n.left), ..._getPostorden(n.right), n.value];
}

// --- Funciones de Modales ---
function _showTraversalModal(title, content) {
    document.getElementById('traversal-title').innerText = title;
    const contentEl = document.getElementById('traversal-content');
    const numbers = content.split('  →  ');
    contentEl.innerHTML = '';
    numbers.forEach((num, index) => {
        const numSpan = document.createElement('span');
        numSpan.className = 'traversal-number';
        numSpan.innerText = num;
        contentEl.appendChild(numSpan);
        if (index < numbers.length - 1) {
            const arrowSpan = document.createElement('span');
            arrowSpan.className = 'traversal-arrow';
            arrowSpan.innerText = '→';
            contentEl.appendChild(arrowSpan);
        }
    });
    document.getElementById('traversal-modal').style.display = 'block';
}
function _hideTraversalModal() {
    document.getElementById('traversal-modal').style.display = 'none';
}
function _showContextMenu(e, session) {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.getElementById('menu-edit').onclick = () => {
        _editarSesion(session.id);
        _hideContextMenu();
    };
    document.getElementById('menu-delete').onclick = () => {
        _borrarSesion(session.id);
        _hideContextMenu();
    };
}
function _hideContextMenu() {
    document.getElementById('context-menu').style.display = 'none';
}

// --- Funciones de Sesiones ---
function _loadSessionsUI() {
    const list = document.getElementById('lista-sesiones');
    if (!list) return;
    let sessions = JSON.parse(localStorage.getItem("avlSessions")) || [];
    list.innerHTML = '';
    sessions.forEach(session => {
        const li = document.createElement('li');
        li.className = 'session-item';
        li.onclick = () => _cargarSesion(session.id);
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            _showContextMenu(e, session);
        });
        const nameDiv = document.createElement('div');
        nameDiv.className = 'session-name';
        nameDiv.innerText = session.name;
        const dateDiv = document.createElement('div');
        dateDiv.className = 'session-date';
        dateDiv.innerText = `(${session.date})`;
        li.appendChild(nameDiv);
        li.appendChild(dateDiv);
        list.appendChild(li);
    });
}
async function guardarSesion() {
    const values = _getTreeValues(appState.tree.root);
    if (values.length === 0) {
        UI.toast("Árbol vacío, no se puede guardar.", "warning");
        return;
    }
    
    const name = await CustomModal.prompt("Guardar Sesión", "Ingresa un nombre para tu sesión:", appState.currentSessionName); 
    
    if (!name || name.trim() === "") {
        UI.toast("Guardado cancelado.", "info");
        return; 
    }
    
    appState.currentSessionName = name; 
    
    const newSession = {
        id: Date.now(),
        name: name,
        date: new Date().toLocaleString('es-ES'),
        values: values
    };
    let sessions = JSON.parse(localStorage.getItem("avlSessions")) || [];
    sessions.push(newSession);
    localStorage.setItem("avlSessions", JSON.stringify(sessions));
    UI.toast("Sesión guardada.", "success");
    _loadSessionsUI();
}
function nuevaSesion() {
    limpiarArbol(true);
    UI.logOperation('--- (Sesión nueva) ---');
}

async function _cargarSesion(id) {
    let sessions = JSON.parse(localStorage.getItem("avlSessions")) || [];
    const session = sessions.find(s => s.id === id);
    if (!session) {
        UI.toast("No se encontró la sesión.", "error");
        return;
    }
    
    AnimPlayer.pause();
    limpiarArbol(true); 
    appState.currentSessionName = session.name; 
    UI.logOperation(`--- Cargada sesión: ${session.name} ---`);
    
    const valuesStr = session.values.join(',');
    document.getElementById('in-insert').value = valuesStr;
    
    await insertar(); 
    AnimPlayer.saltar();
    
    UI.logOperation(`Sesión '${session.name}' reconstruida.`);
    centrarVista();
}
async function _borrarSesion(id) {
    const confirmed = await CustomModal.confirm("Confirmar Borrado", "¿Estás seguro de que quieres borrar esta sesión? Esta acción no se puede deshacer.");
    if (!confirmed) return; 
    
    let sessions = JSON.parse(localStorage.getItem("avlSessions")) || [];
    sessions = sessions.filter(s => s.id !== id);
    localStorage.setItem("avlSessions", JSON.stringify(sessions));
    _loadSessionsUI();
    UI.toast("Sesión borrada.", "success");
}

async function _editarSesion(id) {
    let sessions = JSON.parse(localStorage.getItem("avlSessions")) || [];
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    
    const newName = await CustomModal.prompt("Editar Nombre", "Ingresa el nuevo nombre para la sesión:", session.name);
    
    if (!newName || newName.trim() === "") {
        UI.toast("Edición cancelada.", "info");
        return; 
    }
    
    session.name = newName;
    localStorage.setItem("avlSessions", JSON.stringify(sessions));
    _loadSessionsUI();
    UI.toast("Nombre de sesión actualizado.", "success");
}
function _getTreeValues(n) {
    if (!n) return [];
    return [n.value, ..._getTreeValues(n.left), ..._getTreeValues(n.right)];
}

// --- (INICIO) FUNCIONES DE IMPORTAR/EXPORTAR ---

function triggerImportJSON() {
    document.getElementById('import-json-input').click();
}

function exportarJSON() {
    const values = _getTreeValues(appState.tree.root); 
    if (values.length === 0) {
        UI.toast("Árbol vacío, no se puede exportar.", "warning");
        return;
    }
    const exportData = {
        tipo: "AVLVisualizer_v2", 
        values: values
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    
    const fileName = `avl_${appState.currentSessionName.replace(/ /g, '_')}.json`;
    a.setAttribute("download", fileName);
    
    document.body.appendChild(a);
    a.click();
    a.remove();
    UI.toast("Árbol exportado como JSON.", "success");
}

async function importarJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.tipo || data.tipo !== "AVLVisualizer_v2" || !data.values) {
                throw new Error("Archivo JSON no válido o incompatible.");
            }
            
            limpiarArbol(true); 
            UI.logOperation(`--- Importando desde: ${file.name} ---`);
            const valuesStr = data.values.join(',');
            document.getElementById('in-insert').value = valuesStr;
            await insertar(); 
            AnimPlayer.saltar();
            UI.toast("Árbol importado y reconstruido con éxito.", "success");
            appState.currentSessionName = file.name.replace('.json', '');

            centrarVista();
        } catch (error) {
            console.error("Error importando JSON:", error);
            UI.toast("Error al importar: " + error.message, "error");
        }
        event.target.value = null;
    };
    reader.readAsText(file);
}


// --- ★★★ REEMPLAZA ESTA FUNCIÓN COMPLETA (aprox. línea 902) ★★★ ---

async function exportarImagen() {
    // 1. OBTENER EL ÁRBOL Y LOS NODOS
    const currentStep = appState.history[appState.currentStep];
    if (!currentStep || !currentStep.t || !currentStep.t.root) {
        UI.toast("El árbol está vacío.", "warning");
        return;
    }
    const root = currentStep.t.root;
    const allNodes = Object.values(nodeRegistry); 
    if (allNodes.length === 0) {
         UI.toast("El árbol está vacío.", "warning");
        return;
    }

    UI.toast("Generando imagen... por favor espera.", "info");
// ★★★ NUEVO: Cargar el logo de la universidad ★★★
    let uniLogo;
    // (Asegúrate que la ruta sea correcta)
    const logoSrc = 'resource/ICO.png'; 
    try {
        uniLogo = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`No se pudo cargar el logo. Asegúrate de que '${logoSrc}' exista.`));
            img.src = logoSrc;
        });
    } catch (error) {
        console.error(error.message);
        UI.toast(error.message, "error");
        uniLogo = null; // Continuar sin el logo si falla
    }
    // ★★★ FIN NUEVO ★★★
    // 2. OBTENER DATOS (Stats y Recorridos)
    const stats = {
        nodos: document.getElementById('lbl-nodos').innerText,
        altura: document.getElementById('lbl-altura').innerText,
        estado: document.getElementById('lbl-estado').innerText,
        rootBalance: appState.tree.root.getBalance(),
        rotaciones: appState.history.filter(s => s.d.includes('Rotación')).length
    };
    const recorridos = {
        pre: _getPreorden(appState.tree.root).join(', '),
        in: _getInorden(appState.tree.root).join(', '),
        post: _getPostorden(appState.tree.root).join(', ')
    };

    // 3. CALCULAR DIMENSIONES REALES DEL ÁRBOL
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
        if (n.targetX < minX) minX = n.targetX;
        if (n.targetX > maxX) maxX = n.targetX;
        if (n.targetY < minY) minY = n.targetY;
        if (n.targetY > maxY) maxY = n.targetY;
    });

    let calculatedTreeWidth = (maxX - minX) + (NODE_RADIUS * 2) + 100;
    let calculatedTreeHeight = (maxY - minY) + (NODE_RADIUS * 2) + 100;

    // ★★★ NUEVO: Definir un tamaño mínimo para el área del árbol ★★★
    const minTreeAreaWidth = 500; // Por ejemplo, 500px de ancho mínimo para el área del árbol
    const minTreeAreaHeight = 500; // Por ejemplo, 500px de alto mínimo para el área del árbol

    const treeContentWidth = Math.max(calculatedTreeWidth, minTreeAreaWidth);
    const treeContentHeight = Math.max(calculatedTreeHeight, minTreeAreaHeight);
    // ★★★ FIN NUEVO ★★★
    
    // 4. CREAR CANVAS TEMPORAL
    const padding = 30;
    const infoWidth = 300;
    const recorridosHeight = 130;
    const creditsHeight = 100; 

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Ancho: contenido del árbol + info + padding
    tempCanvas.width = treeContentWidth + infoWidth + padding * 2;
    // Alto: MÁXIMO entre el contenido del árbol, la altura del panel de info + recorridos + créditos
    const infoPanelMinHeight = 550; // Altura mínima para el panel de stats (para que no se vea cortado)
    tempCanvas.height = Math.max(treeContentHeight, infoPanelMinHeight) + recorridosHeight + creditsHeight + padding * 2;


    // 5. OBTENER COLORES
    // ★★★ MODIFICADO: panelColor ahora es igual a bgColor ★★★
    const panelColor = '#151525'; // MISMO COLOR QUE EL FONDO DEL ÁRBOL
    const bgColor = '#151525'; // Fondo del canvas
    const textColor = '#cccccc';
    const textDim = '#888888';
    const accentYellow = '#dcdcaa';
    const accentBlue = '#007ACC';

    // 6. DIBUJAR FONDO GENERAL (Lienzo)
    tempCtx.fillStyle = bgColor;
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 7. DIBUJAR PANELES (Ahora con el mismo color de fondo, se "fusionan")
    const infoX = treeContentWidth + padding;
    const infoRect = { x: infoX - padding, y: 0, w: infoWidth + padding*2, h: tempCanvas.height };
    
    let tempInfoY = padding + 20 + 35 + (60 * 5); 
    let recY = Math.max(treeContentHeight, tempInfoY) + padding + 30;
    const recRect = { x: 0, y: recY - 20, w: tempCanvas.width, h: recorridosHeight + padding };
    
    let creditY = recY + recorridosHeight - 50; 
    const credRect = { x: 0, y: creditY - 20, w: tempCanvas.width, h: creditsHeight + padding };
    
    tempCtx.fillStyle = panelColor; // Ahora es el mismo que bgColor
    tempCtx.fillRect(infoRect.x, infoRect.y, infoRect.w, infoRect.h);
    tempCtx.fillRect(recRect.x, recRect.y, recRect.w, recRect.h);
    tempCtx.fillRect(credRect.x, credRect.y, credRect.w, credRect.h);

    // 8. REDIBUJAR EL ÁRBOL
    const printCameraX = (treeContentWidth / 2);
    // Ajuste de Y para centrar el árbol en el área asignada
    const printCameraY = (treeContentHeight / 2) - (calculatedTreeHeight / 2) + 50; // Ajuste fino para centrar la raíz

    tempCtx.save();
    tempCtx.translate(printCameraX, printCameraY);

    // --- Funciones de dibujado (reciben 'ctx' como parámetro) ---
    function drawArrow(ctx, x1, y1, x2, y2) { 
        const arrowSize = 10;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const endX = x2 - (NODE_RADIUS + 2) * Math.cos(angle); 
        const endY = y2 - (NODE_RADIUS + 2) * Math.sin(angle);
        ctx.save();
        ctx.beginPath();
        ctx.translate(endX, endY); 
        ctx.rotate(angle);         
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle; 
        ctx.fill();
        ctx.restore();
    }

    function drawLinks(ctx, n) { 
        if (!n) return;
        const vn = nodeRegistry[n.id];
        if (vn) { 
            ctx.lineWidth = 3; 
            ctx.strokeStyle = COLORS.line; 
            ctx.globalAlpha = 1; 
            
            if (n.left) { 
                const vl = nodeRegistry[n.left.id]; 
                if (vl) { 
                    drawArrow(ctx, vn.targetX, vn.targetY, vl.targetX, vl.targetY);
                    drawLinks(ctx, n.left); 
                } 
            }
            if (n.right) { 
                const vr = nodeRegistry[n.right.id]; 
                if (vr) { 
                    drawArrow(ctx, vn.targetX, vn.targetY, vr.targetX, vr.targetY);
                    drawLinks(ctx, n.right); 
                } 
            }
        }
    }

    function drawNode(ctx, n) { 
        if (!n) return;
        const vn = nodeRegistry[n.id];
        if (!vn) return;

        drawNode(ctx, n.left);
        drawNode(ctx, n.right);
        
        ctx.globalAlpha = 1; 
        ctx.beginPath(); 
        ctx.arc(vn.targetX, vn.targetY, NODE_RADIUS, 0, 2 * Math.PI);
        const stepNode = currentStep.v[vn.id];
        ctx.fillStyle = stepNode ? stepNode.c : vn.color; 
        ctx.fill();
        ctx.strokeStyle = '#fff'; 
        ctx.lineWidth = 2; 
        ctx.stroke();
        ctx.fillStyle = (ctx.fillStyle === COLORS.highlight || ctx.fillStyle === COLORS.insert) ? '#000' : COLORS.text;
        ctx.font = 'bold 16px Arial'; 
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        ctx.fillText(vn.value, vn.targetX, vn.targetY);
        
        if (vn.balanceValue > 1 || vn.balanceValue < -1) {
            ctx.fillStyle = COLORS.delete; 
        } else {
            ctx.fillStyle = COLORS.fe;     
        }
        ctx.font = 'bold 12px Arial';
        ctx.fillText(vn.balanceValue, vn.targetX, vn.targetY - NODE_RADIUS - 10);
    }

    // --- Ejecutamos el dibujado en el canvas temporal ---
    drawLinks(tempCtx, root);
    drawNode(tempCtx, root);

    tempCtx.restore(); 
    
    // 9. DIBUJAR EL TEXTO (Stats, Recorridos, Créditos)
    
    // Dibujar Estadísticas
    let infoY = padding + 20;
    tempCtx.fillStyle = accentBlue;
    tempCtx.font = 'bold 16px Segoe UI';
    tempCtx.fillText("ESTADÍSTICAS DEL ÁRBOL", infoX + 15, infoY);
    // ★★★ NUEVO: Dibujar el logo si se cargó ★★★
// ★★★ NUEVO: Dibujar el logo si se cargó (VERSIÓN CON PROPORCIÓN) ★★★
 // ★★★ NUEVO: Dibujar el logo si se cargó (VERSIÓN CON PROPORCIÓN) ★★★
    if (uniLogo) {
        const targetHeight = 90; // Altura deseada para el logo
        
        // Calcular el ancho proporcional...
        const aspectRatio = uniLogo.width / uniLogo.height;
        const targetWidth = targetHeight * aspectRatio;

        // Limitar el ancho máximo...
        const maxWidth = 180; 
        let finalWidth = targetWidth;
        let finalHeight = targetHeight;

        if (finalWidth > maxWidth) {
            finalWidth = maxWidth;
            finalHeight = finalWidth / aspectRatio;
        }
        
        // Posición X...
        const logoX = infoRect.x + infoRect.w - padding - finalWidth;
        
        // Posición Y...
        const logoY = infoY - (finalHeight / 2) - 10; 

        
        // ★★★ LA SOLUCIÓN (Añadido) ★★★
        // Forzamos al canvas a usar un difuminado (antialiasing) 
        // de alta calidad al reducir la imagen
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        // ★★★ FIN DE LA SOLUCIÓN ★★★


        // Dibujar con el ancho y alto final calculados
        tempCtx.drawImage(uniLogo, logoX, logoY, finalWidth, finalHeight);

        // (Opcional) Reseteamos el valor por si dibujamos algo más después
        tempCtx.imageSmoothingEnabled = false; 
    }
    // ★★★ FIN NUEVO ★★★★ FIN NUEVO ★★★
    // ★★★ FIN NUEVO ★★★
    infoY += 35;

    const drawStat = (label, value) => {
        tempCtx.font = '13px Segoe UI';
        tempCtx.fillStyle = textDim;
        tempCtx.fillText(label, infoX + 15, infoY);
        tempCtx.font = 'bold 20px Segoe UI';
        tempCtx.fillStyle = textColor;
        tempCtx.fillText(value, infoX + 15, infoY + 25);
        infoY += 60; 
    };
    drawStat("Nodos Totales:", stats.nodos);
    drawStat("Altura del ÁRBOL:", stats.altura);
    drawStat("Estado:", stats.estado);
    drawStat("Factor Balance (Raíz):", stats.rootBalance);
    drawStat("Rotaciones (Historial):", stats.rotaciones);

    // Dibujar Recorridos
    tempCtx.fillStyle = accentYellow;
    tempCtx.font = 'bold 16px Segoe UI';
    tempCtx.fillText("RECORRIDOS", padding, recY);
    recY += 35;
    tempCtx.font = '14px Courier New';
    tempCtx.fillStyle = textColor;
    const maxLen = Infinity;
    let pre = `Preorden:  ${recorridos.pre}`;
    let ino = `Inorden:   ${recorridos.in}`;
    let post = `Postorden: ${recorridos.post}`;
    tempCtx.fillText(pre.length > maxLen ? pre.substring(0, maxLen) + '...' : pre, padding, recY);
    recY += 25;
    tempCtx.fillText(ino.length > maxLen ? ino.substring(0, maxLen) + '...' : ino, padding, recY);
    recY += 25;
    tempCtx.fillText(post.length > maxLen ? post.substring(0, maxLen) + '...' : post, padding, recY);


creditY = recY + 60; 

// Ahora el resto de tu código (que ya tienes) funcionará:
tempCtx.fillStyle = accentYellow;
tempCtx.font = 'bold 16px Segoe UI';
tempCtx.fillText("CRÉDITOS", padding, creditY);
    creditY += 35;
    tempCtx.font = '14px Segoe UI';
    tempCtx.fillStyle = textColor;
    tempCtx.fillText("Integrantes: Jhon Mindiola, Jose Barreto, Yeleinys Gomez", padding, creditY); 
    creditY += 21;
    tempCtx.fillText("Curso: Estructura de Datos II - A1 ", padding, creditY); 
    creditY += 21;
    tempCtx.fillText("Profesor: David Fernandez", padding, creditY); 
    
    // 10. DESCARGAR
    const a = document.createElement('a');
    a.href = tempCanvas.toDataURL('image/png'); 
    const fileName = `avl_${appState.currentSessionName.replace(/ /g, '_')}.png`;
    a.download = fileName;
    a.click();
    
    UI.toast("Imagen exportada con éxito.", "success");
}

// --- INICIO DE LA APLICACIÓN Y EVENTOS ---

function _bindEventListeners() {
    
    const handleInputAsComma = (e) => {
        const input = e.target;
        if (input.value.endsWith(' ')) {
            input.value = input.value.substring(0, input.value.length - 1) + ',';
        }
    };

    const insertInput = document.getElementById('in-insert');
    const deleteInput = document.getElementById('in-delete');
    const searchInput = document.getElementById('in-search');

    insertInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') insertar(); });
    deleteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') eliminar(); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });

    insertInput.addEventListener('input', handleInputAsComma);
    deleteInput.addEventListener('input', handleInputAsComma);
    searchInput.addEventListener('input', handleInputAsComma);


    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || 
            document.getElementById('traversal-modal').style.display === 'block' ||
            document.getElementById('help-modal').style.display === 'block') {
            return;
        }
        
        switch (e.key) {
            case ' ': e.preventDefault(); AnimPlayer.toggle(); break;
            case 'ArrowRight': e.preventDefault(); AnimPlayer.siguiente(); break;
            case 'ArrowLeft': e.preventDefault(); AnimPlayer.anterior(); break;
        }
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            AnimPlayer.saltar();
        }
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-contextual') && !e.target.closest('.session-item')) {
            _hideContextMenu();
        }
    });
    document.getElementById('traversal-close').onclick = _hideTraversalModal;
    document.getElementById('import-json-input').addEventListener('change', importarJSON);
}

// Inicia la aplicación
_bindEventListeners();
Renderer.init(); 
UI.init();

