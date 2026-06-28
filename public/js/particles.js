/**
 * ============================================================
 * SCORPION X – PARTICLES.JS
 * Fire particle system for background
 * ============================================================
 */

class FireParticles {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.running = false;
        this.colors = ['#FF4500', '#FF6600', '#FFD700', '#FF0000', '#FF8C00'];

        this.resize();
        this.init();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        const count = Math.min(120, Math.floor(window.innerWidth / 10));
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
        this.running = true;
        this.animate();
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: this.canvas.height + Math.random() * 20,
            size: Math.random() * 3 + 1.5,
            speedY: Math.random() * 2.5 + 1.5,
            speedX: (Math.random() - 0.5) * 1.2,
            opacity: Math.random() * 0.6 + 0.2,
            color: this.colors[Math.floor(Math.random() * this.colors.length)]
        };
    }

    animate() {
        if (!this.running) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let p of this.particles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.opacity;
            this.ctx.shadowColor = '#FF4500';
            this.ctx.shadowBlur = 8;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
            this.ctx.globalAlpha = 1;

            p.y -= p.speedY;
            p.x += p.speedX;

            if (p.y < -10) {
                Object.assign(p, this.createParticle());
                p.y = this.canvas.height + 10;
            }
        }

        requestAnimationFrame(() => this.animate());
    }

    destroy() {
        this.running = false;
        this.particles = [];
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fireParticles');
    if (canvas) {
        window.fireParticles = new FireParticles('fireParticles');
    }
});
