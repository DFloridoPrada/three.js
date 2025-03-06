import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

let camera : THREE.PerspectiveCamera;
let scene : THREE.Scene;
let renderer : THREE.WebGLRenderer;
let water : Water;
let sky : Sky;
let sun : THREE.Vector3;
let stats : Stats;
let lastTime = performance.now();
let currentTime : number;
let deltaTime: number;


const initScene = () : THREE.Scene => {
  const scene = new THREE.Scene();
  return scene;
}


const initCamera = () : THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.set(30,30,100);
  return camera;
}


const initRenderer = () : THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.3;
  document.body.append(renderer.domElement);
  return renderer;
}


const initStats = () : Stats => {
  stats = new Stats();
  document.body.append(stats.dom);
  return stats;
}


const initOrbitControls = () : void => {
  new OrbitControls(camera, renderer.domElement);
}


const initResizeEvent = () : void => {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}


const initWater = () : Water => {
  // Para construir este objeto necesitamos una geometria y un shader 
  const water = new Water(
    // Ancho y alto del plano
    new THREE.PlaneGeometry(10000, 10000),
    /**
     * Se crea un shader o material personalizado con los siguientes parámetros:
     * 
     * 1. Ancho en px de la textura.
     * 
     * 2. Alto en px de la textura.
     * 
     * 3. Cargar la textura, cuando termina de cargar se indica
     * como se quiere que la textura se extienda por el plano.
     * En este caso se indica que tanto a lo ancho como a lo alto
     * la imagen de la textura se va a repetir hasta cubrir el plano.
     * 
     * 4. Vector que indicará la dirección del sol para luego crear efectos de iluminación.
     * por ahora lo dejamos vacío hasta que creemos el sol.
     * 
     * 5. Además de donde se encuentra el sol tenemos que indicarle de que color es la fuente
     * de luz del sol. En este caso utilizaré un color anaranjado 0xff8800.
     * 
     * 6. Color del agua.
     * 
     * 7. Cantidad de oleaje. Por defecto es 20.0.
     * 
     * 8. Por ultimo habilitamos la opción para decir al objeto que queremos que interactue
     * con la niebla en el caso de que la hubiera. Este valor es false por defecto.
     */
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load('textures/waternormals.jpg', (texture) => {
        console.log('Textura cargada');
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xff8800,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );

  // El plano no aparecerá por defecto de forma horizontal, por lo que tendremos que girarlo.
  // Para ello le aplicamos una rotación en radianes para girar el plano en el eje x 90 grados.
  water.rotation.x = -Math.PI / 2;

  // Añadimos el objeto a la scena
  scene.add(water);

  return water;
}


const initSky = () : Sky => {
  sky = new Sky();
  // Usamos el método de Object3D para escalar el objeto.
  // Se usa normalmente un valor muy alto para que cubra todo el cielo.
  sky.scale.setScalar(10000);
  
  scene.add(sky);

  // Accedemos y modificamos las propiedades del shader del cielo
  const skyUniforms = sky.material.uniforms;

  /**
   * 1. Cantidad de partículas en el aire. Aumentando este valor creamos un efecto
   * de neblina o nubes en el aire. Lo ideal es mantenerlo en valores bajos.
   * 
   * 2. Dispersión de la luz azul. Cuanto más alto sea este valor más azul se verá el cielo.
   * 
   * 3. Parecido a la primera. Define cómo la luz va a interactuar con las particulas grandes del aire.
   * Igual que el primero si se sube mucho el cielo estará demasiado brumoso.
   * 
   * 4. Afecta cómo se dispersa la luz del sol a través de la atmósfera y define la forma del halo de luz alrededor del sol.
   * Un valor muy alto (solo puede ser de 0 a 1) genera un sol muy brillante. 
   * Un valor muy bajo hace que el sol no sea tan brillante y se pueda ver la figura del sol.
   * Un valor realista estaría muy cerca de 1 pero sin llegar a 1.
   */
  skyUniforms['turbidity'].value = 10;
  skyUniforms[ 'rayleigh' ].value = 2;
  skyUniforms[ 'mieCoefficient' ].value = 0.005;
  skyUniforms[ 'mieDirectionalG' ].value = 0.8;
  
  return sky;
}


const initSun = () : THREE.Vector3 => {
  // Creo algunos parámetros para calcular la posición del sol
  // Uno es la elevación vertical y el otro la posición en el eje x
  const parameters = {
    elevation: 2,
    azimuth: 180
  };

  // Utilizaremos esta variable para almacenar las texturas renderizadas
  let renderTarget : THREE.WebGLRenderTarget | undefined;

  // Inicio el sol como un vector de 3 dimensiones
  sun = new THREE.Vector3();

  /**
   * Esto son mapas de entorno prefiltrados que se utilizan para simular
   * reflejos realistas y mejorar la iluminación de la escena 
   */
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  // Creamos una escena auxiliar donde se va a renderizar el cielo antes
  // de incluirse en la escena principal. Esto se hace para poder generar el mapa de entorno.
  const sceneEnv = new THREE.Scene();

  /**
   * Puesto que el sol se desplaza orbitando alrededor de la tierra necesitamos
   * expresar su posición mediante angulos.
   * En las dos variables lo que hacemos es pasar los grados a radianes,
   * para luego convertir esas coordenadas esféricas en coordenadas cartesianas
   * que se aplicarán al vector3 del sol.
   */
  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
  const theta = THREE.MathUtils.degToRad(parameters.azimuth);
  sun.setFromSphericalCoords(1, phi, theta);

  /**
   * Ahora que tenemos las posiciones del sol podemos modificar el parámetro
   * que dejamos vacío tanto en el cielo como en el agua.
   * Tenemos que copiar el valor del vector sin modificar su referencia.
   * 
   * En el agua el sol se indica mediante un vector normalizado, 
   * esto significa que trasformamos la posición absoluta del vector3 en 
   * un nuevo vector que únicamente indica la dirección.
   */
  sky.material.uniforms['sunPosition'].value.copy(sun);
  water.material.uniforms['sunDirection'].value.copy(sun).normalize();

  /**
   * Los buffer de renderizado consumen memoria en la tarjeta gráfica.
   * Cada vez que generamos un WebGLRenderTarget reservamos memoria en la gráfica.
   * 
   * Dispose libera la posible memoria que hayamos reservado con anterioridad,
   * para que la memoria nunca se llene y nos cause problemas de rendimiento, errores, crashes, etc.
   */
  if (renderTarget !== undefined) renderTarget.dispose();

  // Una vez vaciamos la memoria gráfica añadimos el cielo a la escena auxiliar,
  // generamos el mapa de entorno y la volvemos a añadir a la escena principal.
  // Luego tenemos que añadir el mapa de entorno generado a la scena para que se apliquen las mejoras.
  sceneEnv.add(sky);
  renderTarget = pmremGenerator.fromScene(sceneEnv);
  scene.add(sky);
  scene.environment = renderTarget.texture;

  return sun;
}


const animateWater = () : void => {
  /**
   * Para que la velocidad del movimiento del agua se adapte a los
   * frames de cada pantalla calculamos el tiempo transcurrido en milisegundos
   * desde el último frame para conseguir una cantidad de frames fijos por segundo.
   * 
   * Multiplico ese calculo por 0.3 para crear la sensación
   * de un mar en calma. 
   */
  currentTime = performance.now();
  deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;
  water.material.uniforms['time'].value += deltaTime * 0.3;
}


const init = () : void => {
  scene = initScene();
  camera = initCamera();
  renderer = initRenderer();
  water = initWater();
  sky = initSky();
  sun = initSun();
  stats = initStats();
  // initOrbitControls();
  initResizeEvent();
}


const loop = () : void => {
  requestAnimationFrame(loop);
  render();
  stats.update();
  animateWater();
}


const render = () : void => {
  renderer.render(scene, camera);
}


init();
loop();
