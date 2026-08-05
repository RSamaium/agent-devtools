import { initDevtools } from '@pixi/devtools';
import { Application, Container, Graphics, Sprite, Texture, VERSION } from 'pixi.js';
import './style.css';

const app = new Application();
await app.init({ resizeTo: window, antialias: true, background: '#111827' });
document.querySelector('#app')?.append(app.canvas);

app.stage.label = 'Agent DevTools Scene';
const world = new Container({ label: 'World' });
const textureCanvas = document.createElement('canvas'); textureCanvas.width = 64; textureCanvas.height = 64;
const textureContext = textureCanvas.getContext('2d');
if (textureContext) {
  textureContext.fillStyle = '#f59e0b'; textureContext.fillRect(0, 0, 64, 64);
  textureContext.fillStyle = '#111827'; textureContext.fillRect(16, 16, 32, 32);
}
const hero = new Sprite({ texture: Texture.from(textureCanvas), label: 'Hero', x: 160, y: 120 });
const marker = new Graphics({ label: 'Destination' }).circle(360, 220, 28).fill('#38bdf8');
world.addChild(hero, marker); app.stage.addChild(world);

await initDevtools({ app, version: VERSION });

app.ticker.add(ticker => { hero.rotation += 0.01 * ticker.deltaTime; });
