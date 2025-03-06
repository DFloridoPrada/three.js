import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import Cube from './Cube.js';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let cube: Cube;
let stats: Stats;

const init = () => {
  scene = initScene();
  camera = initCamera();
  renderer = initRenderer();
  cube = initCube();
  stats = initStats();
  initOrbitControls();
  initResizeEvent();
};

const initCamera = () => {
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 0, 3);
  return camera;
};

const initRenderer = () => {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.append(renderer.domElement);
  return renderer;
};

const initScene = () => {
  return new THREE.Scene();
};

const initCube = () => {
  cube = new Cube();
  scene.add(cube.getMesh());
  return cube;
};

const initStats = () => {
  stats = new Stats();
  document.body.append(stats.dom);
  return stats;
};

const initOrbitControls = () => {
  new OrbitControls(camera, renderer.domElement);
};

const initResizeEvent = () => {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
};

const loop = () => {
  requestAnimationFrame(loop);
  render();
  stats.update();
  cube.animate();
};

const render = () => {
  renderer.render(scene, camera);
};

init();
loop();
